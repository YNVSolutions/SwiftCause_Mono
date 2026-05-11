const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { ensureStripeInitialized } = require('../services/stripe');
const { sendSubscriptionMagicLinkEmail } = require('../services/email');
const { generateToken, storeToken, verifyToken, consumeToken } = require('../utils/tokenManager');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// Firestore-backed sliding-window rate limiter.
// Works correctly across multiple Cloud Function instances and survives
// cold starts. Each user has a single document in `rate_limits` that stores
// only the timestamps that fall within the current window.
//
// Future upgrade: swap for Redis/Upstash if sub-millisecond latency or
// very high throughput is required.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // requests per window per user
const RATE_LIMIT_COLLECTION = 'rate_limits';

// ---------------------------------------------------------------------------
// Trusted domains for return URL validation
// ---------------------------------------------------------------------------
const TRUSTED_DOMAINS = [
  'localhost:3000',
  'swiftcause.com',
  'swiftcause-app.web.app',
  'swiftcause-app.firebaseapp.com',
  'swiftcause--swiftcause-app.us-east4.hosted.app',
  'swift-cause-web.vercel.app',
];

// ---------------------------------------------------------------------------
// User-facing error message constants
// (Kept as named constants to satisfy the 80-char line limit and to make
// messages easy to update in one place.)
// ---------------------------------------------------------------------------
const MSG_MISSING_AUTH = 'Unauthorized: Missing authentication token';
const MSG_INVALID_AUTH = 'Unauthorized: Invalid authentication token';
const MSG_EMAIL_NOT_IN_TOKEN = 'Unauthorized: Email not found in token';
const MSG_WRONG_TOKEN_PURPOSE = 'Unauthorized: Token was not issued for subscription management';
const MSG_ACTIVE_DONATIONS =
  'If this email has active donations, ' + 'you will receive a link shortly.';
const MSG_SUB_CONFIG_ERROR = 'Subscription configuration error. Please contact support.';
const MSG_ORG_NOT_FOUND = 'Organization not found. Please contact support.';
const MSG_ORG_PAYMENT_NOT_CONFIGURED =
  'Organization payment system not configured. Please contact support.';
const MSG_ORG_PAYMENT_CONFIG_ERROR =
  'Organization payment configuration error. Please contact support.';
const MSG_FORBIDDEN = 'Forbidden: You do not have permission to access this subscription';
const MSG_PORTAL_ERROR = 'Unable to open subscription management. Please try again later.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Structured audit logger - emits JSON to Cloud Logging.
 * @param {string} action - The action being logged
 * @param {object} data - Additional data to include in the log entry
 */
const auditLog = (action, data) => {
  console.log(
    JSON.stringify({
      action,
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
};

/**
 * Runs an async handler after CORS middleware has accepted the request.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {Function} handler - Async request handler
 * @return {Promise<*>}
 */
const runWithCors = (req, res, handler) => {
  return new Promise((resolve, reject) => {
    cors(req, res, () => {
      Promise.resolve(handler()).then(resolve, reject);
    });
  });
};

/**
 * Firestore-backed sliding-window rate limiter using a transaction.
 *
 * The read-check-write is wrapped in a Firestore transaction so that
 * concurrent requests for the same user are serialised at the database
 * level. Without the transaction, two simultaneous requests could both
 * read the same timestamp array, both pass the limit check, and both
 * write back - effectively bypassing the limit.
 *
 * Failure modes:
 * - Transaction conflict (Firestore retries automatically, up to 5 times).
 * - Firestore unavailable: fails open so legitimate users are not blocked.
 *   The error is logged so the issue is visible in Cloud Logging.
 *
 * @param {string} userId - Normalised user identifier (email or UID)
 * @return {Promise<boolean>} True if the request is within the allowed rate
 */
const checkRateLimit = async (userId) => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const db = admin.firestore();
  const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(userId);

  try {
    const allowed = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      const data = doc.exists ? doc.data() : { timestamps: [] };

      // Prune timestamps outside the current window
      const recent = (data.timestamps || []).filter((ts) => ts > windowStart);

      if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
        // Do not write - just signal rejection
        return false;
      }

      // Atomically append and persist within the same transaction.
      // merge: true preserves any fields added by future schema changes.
      recent.push(now);
      tx.set(docRef, { userId, timestamps: recent, updatedAt: now }, { merge: true });
      return true;
    });

    return allowed;
  } catch (err) {
    // Fail open: a rate-limit check failure should not block legitimate users.
    // The error is logged for observability.
    console.error('Rate limit check failed (failing open):', err.message);
    return true;
  }
};

/**
 * Validates that a return URL belongs to a trusted domain.
 * Only called when NEXT_PUBLIC_APP_URL is externally configured - the
 * check guards against misconfiguration, not user-supplied input.
 * @param {string} url - URL to validate
 * @return {boolean} True if the host is in TRUSTED_DOMAINS
 */
const isValidReturnUrl = (url) => {
  try {
    const { host } = new URL(url);
    return TRUSTED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

/**
 * Extracts the donor email from a subscription document, checking both the
 * root field and the nested metadata field for backwards compatibility.
 * Centralised here so callers never repeat the fallback logic.
 * @param {object} data - Firestore subscription document data
 * @return {string} Lowercase email, or empty string if absent
 */
const getSubscriptionEmail = (data) => {
  return (
    data.donorEmailNormalized ||
    data.metadata?.donorEmailNormalized ||
    data.donorEmail ||
    data.metadata?.donorEmail ||
    ''
  ).toLowerCase();
};

/**
 * Returns true when a subscription belongs to the normalized email.
 * @param {object} data - Firestore subscription document data
 * @param {string} emailNormalized - Lowercase email
 * @return {boolean}
 */
const subscriptionMatchesEmail = (data, emailNormalized) => {
  const candidates = [
    data.donorEmail,
    data.donorEmailNormalized,
    data.metadata?.donorEmail,
    data.metadata?.donorEmailNormalized,
  ];

  return candidates.some((value) => {
    return typeof value === 'string' && value.trim().toLowerCase() === emailNormalized;
  });
};

/**
 * Fetches subscriptions by normalized email.
 * Runs four indexed queries in parallel to cover all storage patterns:
 * - donorEmailNormalized (new normalized field)
 * - metadata.donorEmailNormalized (new normalized field in metadata)
 * - donorEmail (legacy exact-match, works when stored lowercase)
 * - metadata.donorEmail (legacy exact-match in metadata)
 *
 * Mixed-case legacy docs (e.g. "Donor@Example.com") will be found once
 * donorEmailNormalized is backfilled. Until then they are missed by these
 * queries, which is the correct trade-off: a full collection scan is not
 * an acceptable permanent solution at scale.
 * @param {object} ref - Firestore subscriptions collection reference
 * @param {string} emailNormalized - Lowercase email
 * @return {Promise<object[]>} Deduplicated subscription documents
 */
const fetchSubscriptionsForEmail = async (ref, emailNormalized) => {
  const querySnaps = await Promise.all([
    ref.where('donorEmailNormalized', '==', emailNormalized).get(),
    ref.where('metadata.donorEmailNormalized', '==', emailNormalized).get(),
    ref.where('donorEmail', '==', emailNormalized).get(),
    ref.where('metadata.donorEmail', '==', emailNormalized).get(),
  ]);

  const subMap = new Map();
  querySnaps.forEach((snap) => {
    snap.forEach((doc) => {
      subMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
  });

  return Array.from(subMap.values());
};

/**
 * Checks whether any subscription exists for the given email without
 * loading document data. Runs 4 existence queries in parallel (one per
 * storage pattern), each limited to 1 document with no field projections,
 * and resolves true as soon as any query returns a result.
 * @param {object} ref - Firestore subscriptions collection reference
 * @param {string} emailNormalized - Lowercase email
 * @return {Promise<boolean>}
 */
const subscriptionsExistForEmail = async (ref, emailNormalized) => {
  const snaps = await Promise.all([
    ref.where('donorEmailNormalized', '==', emailNormalized).limit(1).get(),
    ref.where('metadata.donorEmailNormalized', '==', emailNormalized).limit(1).get(),
    ref.where('donorEmail', '==', emailNormalized).limit(1).get(),
    ref.where('metadata.donorEmail', '==', emailNormalized).limit(1).get(),
  ]);
  return snaps.some((snap) => !snap.empty);
};

/**
 * Validates that a subscription document contains all required fields.
 * @param {object} data - Firestore subscription document data
 * @return {{valid: boolean, missingFields: string[]}}
 */
const validateSubscriptionData = (data) => {
  const required = ['customerId', 'organizationId'];
  const missingFields = required.filter((f) => !data[f]);

  if (!getSubscriptionEmail(data)) {
    missingFields.push('donorEmail');
  }

  return { valid: missingFields.length === 0, missingFields };
};

/**
 * Maps a Stripe API error to a safe HTTP status + user-facing message.
 * Full error details are written to audit logs; nothing internal is
 * forwarded to the client.
 * @param {Error} error - Stripe error object
 * @param {object} context - Additional context for the audit log
 * @return {{status: number, message: string}}
 */
const handleStripeError = (error, context) => {
  auditLog('stripe_error', {
    errorType: error.type,
    errorCode: error.code,
    errorMessage: error.message,
    ...context,
  });

  if (error.code === 'resource_missing') {
    return {
      status: 404,
      message: 'Subscription not found in payment system.' + ' Please contact support.',
    };
  }

  if (error.code === 'account_invalid') {
    return { status: 500, message: MSG_ORG_PAYMENT_CONFIG_ERROR };
  }

  const errorMap = {
    StripeInvalidRequestError: {
      status: 400,
      message: 'Unable to open subscription management.' + ' Please contact support.',
    },
    StripeAuthenticationError: {
      status: 500,
      message: 'Service configuration error. Please contact support.',
    },
    StripePermissionError: {
      status: 403,
      message: 'Unable to access subscription. Please contact support.',
    },
    StripeRateLimitError: {
      status: 429,
      message: 'Service temporarily unavailable. Please try again shortly.',
    },
    StripeConnectionError: {
      status: 503,
      message: 'Service temporarily unavailable. Please try again.',
    },
  };

  return errorMap[error.type] || { status: 500, message: MSG_PORTAL_ERROR };
};

/**
 * Trims a string and returns null if the result is empty.
 * @param {*} value - Value to normalize
 * @return {string|null}
 */
const normalizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Verifies the Bearer token in the Authorization header using Firebase Auth.
 * Throws a typed error (with .status) on failure so callers can respond
 * consistently without duplicating auth logic.
 * @param {object} req - Express request object
 * @return {Promise<object>} Decoded Firebase ID token claims
 */
const verifyBearerToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = new Error(MSG_MISSING_AUTH);
    err.status = 401;
    throw err;
  }
  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    const err = new Error(MSG_INVALID_AUTH);
    err.status = 401;
    throw err;
  }

  if (decodedToken.purpose !== 'subscription_management' || decodedToken.type !== 'donor') {
    const err = new Error(MSG_WRONG_TOKEN_PURPOSE);
    err.status = 401;
    throw err;
  }

  return decodedToken;
};

// ---------------------------------------------------------------------------
// Endpoint: sendSubscriptionMagicLink
// ---------------------------------------------------------------------------

/**
 * Sends a one-time magic link to the donor's email address.
 * Checks both root and metadata.donorEmail fields for backwards compat.
 * Always returns a generic success message to avoid email enumeration.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const sendSubscriptionMagicLink = (req, res) => {
  return runWithCors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const email = normalizeString(req.body?.email);

      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const emailNormalized = email.toLowerCase();
      const db = admin.firestore();

      // Rate limiting BEFORE token generation and email send.
      // Checked sequentially: email first so a known-limited email short-circuits
      // before the IP counter is incremented.
      const emailAllowed = await checkRateLimit(emailNormalized);
      if (!emailAllowed) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
      const ipAllowed = await checkRateLimit(`ip:${clientIp}`);
      if (!ipAllowed) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }

      const ref = db.collection('subscriptions');
      const hasSubscriptions = await subscriptionsExistForEmail(ref, emailNormalized);

      // Return the same response regardless - prevents email enumeration
      if (!hasSubscriptions) {
        return res.status(200).json({
          success: true,
          message: MSG_ACTIVE_DONATIONS,
        });
      }

      const token = generateToken();
      await storeToken(token, {
        email: emailNormalized,
        purpose: 'subscription_management',
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl && process.env.NODE_ENV === 'production') {
        console.error('NEXT_PUBLIC_APP_URL is not configured — cannot generate magic link');
        return res.status(500).json({ error: 'Service misconfiguration. Please try again later.' });
      }
      const magicLink = `${appUrl || 'http://localhost:3000'}/link/${token}`;

      try {
        await sendSubscriptionMagicLinkEmail({
          to: email,
          magicLink,
          expiresInMinutes: 15,
        });
      } catch (emailError) {
        console.error('Failed to send magic link email:', emailError);

        if (process.env.NODE_ENV !== 'production') {
          console.log('MAGIC_LINK_FOR_TESTING:', magicLink);
          return res.status(200).json({
            success: true,
            message: MSG_ACTIVE_DONATIONS,
            devLink: magicLink,
          });
        }

        return res.status(500).json({
          error: 'Email service unavailable. Please try again later.',
        });
      }

      const response = { success: true, message: MSG_ACTIVE_DONATIONS };

      if (process.env.NODE_ENV !== 'production') {
        response.devLink = magicLink;
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error('Error sending magic link:', error);
      return res.status(500).json({ error: 'Failed to send magic link' });
    }
  });
};

// Endpoint: verifySubscriptionMagicLink

/**
 * Verifies a magic link token and returns a Firebase custom token.
 * The custom token is used by the frontend to sign in via
 * signInWithCustomToken, after which the client obtains a real ID token
 * for subsequent API calls.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const verifySubscriptionMagicLink = (req, res) => {
  return runWithCors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const token = normalizeString(req.body?.token);

      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      try {
        // Step 1: Validate without consuming — token stays active if anything
        // below fails transiently, so the donor can click the link again.
        const tokenData = await verifyToken(token);
        const { email } = tokenData;

        const crypto = require('crypto');
        const uid = `donor_${crypto.createHash('sha256').update(email).digest('hex')}`;

        // Step 2: Issue Firebase custom token BEFORE consuming the magic link.
        const customToken = await admin.auth().createCustomToken(uid, {
          email,
          purpose: 'subscription_management',
          type: 'donor',
        });

        // Step 3: Consume only after successful issuance.
        await consumeToken(token);

        return res.status(200).json({
          success: true,
          email,
          token: customToken,
        });
      } catch (error) {
        const errorMessage = error.message || 'UNKNOWN_ERROR';
        const statusMap = {
          TOKEN_NOT_FOUND: 401,
          TOKEN_CONSUMED: 401,
          TOKEN_EXPIRED: 401,
          TOKEN_INVALID: 401,
        };

        return res.status(statusMap[errorMessage] || 500).json({
          error: errorMessage,
          message: getErrorMessage(errorMessage),
        });
      }
    } catch (error) {
      console.error('Error verifying magic link:', error);
      return res.status(500).json({ error: 'Failed to verify token' });
    }
  });
};

// Endpoint: getSubscriptionsByEmail

/**
 * Returns all subscriptions for the authenticated donor.
 * Requires a valid Firebase ID token (obtained after signInWithCustomToken).
 * Queries both root and metadata.donorEmail for backwards compatibility.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getSubscriptionsByEmail = (req, res) => {
  return runWithCors(req, res, async () => {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      let decodedToken;
      try {
        decodedToken = await verifyBearerToken(req);
      } catch (err) {
        return res.status(err.status || 401).json({ error: err.message });
      }

      if (!decodedToken.email) {
        return res.status(401).json({ error: MSG_EMAIL_NOT_IN_TOKEN });
      }

      const emailNormalized = decodedToken.email.toLowerCase();

      const withinLimit = await checkRateLimit(emailNormalized);
      if (!withinLimit) {
        return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      }

      const db = admin.firestore();
      const ref = db.collection('subscriptions');
      const subscriptions = await fetchSubscriptionsForEmail(ref, emailNormalized);

      if (subscriptions.length === 0) {
        return res.status(200).json({ subscriptions: [], count: 0 });
      }

      // Batch-fetch all unique campaigns in one getAll() call instead of N reads.
      const campaignIds = [...new Set(subscriptions.map((s) => s.campaignId).filter(Boolean))];
      const campaignMap = new Map();
      if (campaignIds.length > 0) {
        const refs = campaignIds.map((id) => db.collection('campaigns').doc(id));
        const docs = await db.getAll(...refs);
        docs.forEach((d) => {
          if (d.exists) campaignMap.set(d.id, d.data());
        });
      }

      const enriched = subscriptions.map((sub) => {
        const cd = campaignMap.get(sub.campaignId);
        if (cd) {
          const meta = sub.metadata || {};
          return {
            ...sub,
            metadata: {
              ...meta,
              campaignTitle: cd.title || meta.campaignTitle,
              organizationName: cd.organizationName || meta.organizationName,
            },
          };
        }
        return sub;
      });

      // Sort: active-like subscriptions first, then newest first within each group
      enriched.sort((a, b) => {
        const aActiveLike = a.status === 'active' || a.status === 'trialing' ? 0 : 1;
        const bActiveLike = b.status === 'active' || b.status === 'trialing' ? 0 : 1;
        if (aActiveLike !== bActiveLike) return aActiveLike - bActiveLike;
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      });

      // Serialise Firestore Timestamps to ISO strings so the frontend
      // receives a consistent format regardless of SDK version.
      const TIMESTAMP_FIELDS = [
        'currentPeriodEnd',
        'createdAt',
        'updatedAt',
        'startedAt',
        'lastPaymentAt',
        'nextPaymentAt',
        'canceledAt',
      ];

      const serialise = (sub) => {
        const out = { ...sub };
        TIMESTAMP_FIELDS.forEach((field) => {
          const val = out[field];
          if (val && typeof val.toMillis === 'function') {
            out[field] = new Date(val.toMillis()).toISOString();
          } else if (val && typeof val._seconds === 'number') {
            // Fallback for plain-object Timestamps (_seconds/_nanoseconds)
            out[field] = new Date(val._seconds * 1000).toISOString();
          }
        });
        return out;
      };

      return res.status(200).json({
        subscriptions: enriched.map(serialise),
        count: enriched.length,
      });
    } catch (error) {
      const errorId = `sub_fetch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      console.error(`Error fetching subscriptions [${errorId}]:`, error);
      return res.status(500).json({
        error: 'Failed to fetch subscriptions',
        errorId,
      });
    }
  });
};

// ---------------------------------------------------------------------------
// Endpoint: createCustomerPortalSession
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Billing Portal session for the authenticated donor.
 *
 * Architecture note - platform vs connected accounts:
 * Subscriptions are created on the PLATFORM Stripe account using
 * transfer_data.destination to route funds to the connected org account.
 * Therefore the Stripe Customer object lives on the platform account and
 * the portal session must be created WITHOUT a stripeAccount parameter.
 * stripeAccountId is fetched and validated here only to confirm the
 * organisation's Stripe integration is correctly configured; it is not
 * passed to the Stripe API call.
 *
 * Security features:
 * - Firebase ID token authentication
 * - In-memory rate limiting (10 req/min per user)
 * - Email-based ownership validation
 * - Secondary customerId presence check (future: validate against allowlist)
 * - Subscription data integrity validation
 * - Stripe account format validation (org integrity check)
 * - Return URL domain allowlist
 * - Structured audit logging (stack traces redacted in production)
 * - Safe Stripe error mapping
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createCustomerPortalSession = (req, res) => {
  return runWithCors(req, res, async () => {
    const startTime = Date.now();
    let authenticatedEmail = null;
    let subscriptionId = null;

    try {
      // 1. METHOD VALIDATION
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // 2. AUTHENTICATION
      let decodedToken;
      try {
        decodedToken = await verifyBearerToken(req);
      } catch (err) {
        auditLog('portal_session_failed', {
          reason: err.message,
          ip: req.ip,
        });
        return res.status(err.status || 401).json({ error: err.message });
      }

      authenticatedEmail = decodedToken.email;

      if (!authenticatedEmail) {
        auditLog('portal_session_failed', {
          reason: 'email_not_in_token',
          uid: decodedToken.uid,
        });
        return res.status(401).json({ error: MSG_EMAIL_NOT_IN_TOKEN });
      }

      const emailNormalized = authenticatedEmail.toLowerCase();

      // 3. RATE LIMITING
      // NOTE: Firestore-backed - works across all instances.
      const withinLimit = await checkRateLimit(emailNormalized);
      if (!withinLimit) {
        auditLog('portal_session_rate_limited', {
          email: emailNormalized,
          ip: req.ip,
        });
        return res.status(429).json({
          error: 'Too many requests. Please try again shortly.',
        });
      }

      // 4. INPUT VALIDATION
      subscriptionId = normalizeString(req.body?.subscriptionId);

      if (!subscriptionId) {
        auditLog('portal_session_failed', {
          reason: 'missing_subscription_id',
          email: emailNormalized,
        });
        return res.status(400).json({ error: 'Subscription ID is required' });
      }

      if (subscriptionId.length < 10 || subscriptionId.length > 100) {
        auditLog('portal_session_failed', {
          reason: 'invalid_subscription_id_format',
          email: emailNormalized,
          subscriptionId,
        });
        return res.status(400).json({ error: 'Invalid subscription ID format' });
      }

      // 5. FETCH SUBSCRIPTION
      const db = admin.firestore();
      const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();

      if (!subscriptionDoc.exists) {
        auditLog('portal_session_failed', {
          reason: 'subscription_not_found',
          email: emailNormalized,
          subscriptionId,
        });
        return res.status(404).json({ error: 'Subscription not found' });
      }

      const subscriptionData = subscriptionDoc.data();

      // 6. DATA INTEGRITY CHECK
      const validation = validateSubscriptionData(subscriptionData);
      if (!validation.valid) {
        auditLog('portal_session_failed', {
          reason: 'subscription_data_invalid',
          email: emailNormalized,
          subscriptionId,
          missingFields: validation.missingFields,
        });
        return res.status(500).json({ error: MSG_SUB_CONFIG_ERROR });
      }

      // 7. OWNERSHIP VALIDATION
      // Primary: email match. Email is not a globally unique identity but is
      // sufficient here because the token was issued to this email address.
      // Secondary: customerId presence is verified below (step 8).
      // Future: validate customerId against an email->customerIds allowlist.
      const subscriptionEmail = getSubscriptionEmail(subscriptionData);

      if (!subscriptionMatchesEmail(subscriptionData, emailNormalized)) {
        auditLog('portal_session_unauthorized', {
          reason: 'email_mismatch',
          authenticatedEmail: emailNormalized,
          subscriptionEmail: subscriptionEmail || 'none',
          subscriptionId,
          ip: req.ip,
        });
        return res.status(403).json({ error: MSG_FORBIDDEN });
      }

      // 8. EXTRACT AND VALIDATE REQUIRED FIELDS
      const { customerId, organizationId } = subscriptionData;

      if (!customerId) {
        auditLog('portal_session_failed', {
          reason: 'missing_customer_id',
          email: emailNormalized,
          subscriptionId,
        });
        return res.status(500).json({ error: MSG_SUB_CONFIG_ERROR });
      }

      if (!organizationId) {
        auditLog('portal_session_failed', {
          reason: 'missing_organization_id',
          email: emailNormalized,
          subscriptionId,
        });
        return res.status(500).json({ error: MSG_SUB_CONFIG_ERROR });
      }

      // 9. FETCH ORGANISATION - validate Stripe account integrity
      // stripeAccountId is NOT passed to the portal session (platform model),
      // but we verify it exists and is well-formed as an org health check.
      const orgDoc = await db.collection('organizations').doc(organizationId).get();

      if (!orgDoc.exists) {
        auditLog('portal_session_failed', {
          reason: 'organization_not_found',
          email: emailNormalized,
          subscriptionId,
          organizationId,
        });
        return res.status(500).json({ error: MSG_ORG_NOT_FOUND });
      }

      const stripeAccountId = orgDoc.data().stripe?.accountId;

      if (!stripeAccountId) {
        auditLog('portal_session_failed', {
          reason: 'missing_stripe_account_id',
          email: emailNormalized,
          subscriptionId,
          organizationId,
        });
        return res.status(500).json({ error: MSG_ORG_PAYMENT_NOT_CONFIGURED });
      }

      // Validate format as an org integrity check only - not used in API call
      if (!stripeAccountId.startsWith('acct_')) {
        auditLog('portal_session_failed', {
          reason: 'invalid_stripe_account_id_format',
          email: emailNormalized,
          subscriptionId,
          organizationId,
          stripeAccountId: stripeAccountId.substring(0, 10) + '...',
        });
        return res.status(500).json({ error: MSG_ORG_PAYMENT_CONFIG_ERROR });
      }

      // Log a warning if customerId prefix doesn't match expected Stripe format
      // (non-blocking - future hook point for deeper customer ownership checks)
      if (!customerId.startsWith('cus_')) {
        auditLog('potential_data_inconsistency', {
          reason: 'unexpected_customer_id_format',
          customerId: customerId.substring(0, 10) + '...',
          organizationId,
          subscriptionId,
        });
      }

      // 10. VALIDATE RETURN URL
      // The URL is constructed from an env var, not user input. The check
      // guards against misconfiguration (e.g. a typo in NEXT_PUBLIC_APP_URL).
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const returnUrl = `${appUrl}/manage/dashboard`;

      if (!isValidReturnUrl(returnUrl)) {
        auditLog('portal_session_failed', {
          reason: 'invalid_return_url',
          email: emailNormalized,
          subscriptionId,
          returnUrl,
        });
        return res.status(500).json({
          error: 'Configuration error. Please contact support.',
        });
      }

      // 11. CREATE STRIPE PORTAL SESSION
      // Customer lives on the PLATFORM account - no stripeAccount param.
      const stripe = ensureStripeInitialized();

      let session;
      try {
        session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
      } catch (stripeError) {
        const errorInfo = handleStripeError(stripeError, {
          email: emailNormalized,
          subscriptionId,
          organizationId,
          stripeAccountId: stripeAccountId.substring(0, 10) + '...',
          customerId: customerId.substring(0, 10) + '...',
        });
        return res.status(errorInfo.status).json({ error: errorInfo.message });
      }

      // 12. SUCCESS
      const duration = Date.now() - startTime;
      auditLog('portal_session_created', {
        email: emailNormalized,
        subscriptionId,
        organizationId,
        stripeAccountId: stripeAccountId.substring(0, 10) + '...',
        customerId: customerId.substring(0, 10) + '...',
        sessionId: session.id,
        duration_ms: duration,
      });

      return res.status(200).json({ success: true, url: session.url });
    } catch (error) {
      // 13. CATCH-ALL - never expose internals to the client
      const duration = Date.now() - startTime;
      auditLog('portal_session_error', {
        reason: 'unexpected_error',
        error: error.message,
        // Redact stack traces in production to avoid leaking file paths
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        email: authenticatedEmail,
        subscriptionId,
        duration_ms: duration,
      });

      return res.status(500).json({ error: MSG_PORTAL_ERROR });
    }
  });
};

// ---------------------------------------------------------------------------
// Helper: getErrorMessage
// ---------------------------------------------------------------------------

/**
 * Maps a token error code to a user-friendly message.
 * @param {string} errorCode - The error code from verifyToken
 * @return {string} User-friendly message
 */
const getErrorMessage = (errorCode) => {
  const messages = {
    TOKEN_NOT_FOUND: 'This link is invalid or has been removed.',
    TOKEN_EXPIRED: 'This link has expired. Please request a new one.',
    TOKEN_CONSUMED: 'This link has already been used.',
    TOKEN_INVALID: 'This link is no longer valid.',
  };

  return messages[errorCode] || 'This link is no longer valid.';
};

// ---------------------------------------------------------------------------
// Endpoint: getPaymentHistory
// ---------------------------------------------------------------------------

/**
 * Returns the payment history (donations) for a specific subscription.
 * Requires a valid donor magic-link token. Validates that the subscription
 * belongs to the authenticated donor before returning any data.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const getPaymentHistory = (req, res) => {
  return runWithCors(req, res, async () => {
    try {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // 1. AUTHENTICATION
      let decodedToken;
      try {
        decodedToken = await verifyBearerToken(req);
      } catch (err) {
        return res.status(err.status || 401).json({ error: err.message });
      }

      if (!decodedToken.email) {
        return res.status(401).json({ error: MSG_EMAIL_NOT_IN_TOKEN });
      }

      const emailNormalized = decodedToken.email.toLowerCase();

      // 2. RATE LIMITING
      const withinLimit = await checkRateLimit(emailNormalized);
      if (!withinLimit) {
        return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      }

      // 3. INPUT VALIDATION
      const subscriptionId = normalizeString(req.body?.subscriptionId || req.query?.subscriptionId);

      if (!subscriptionId) {
        return res.status(400).json({ error: 'Subscription ID is required' });
      }

      // 3. FETCH SUBSCRIPTION AND VERIFY OWNERSHIP
      const db = admin.firestore();
      const subscriptionDoc = await db.collection('subscriptions').doc(subscriptionId).get();

      if (!subscriptionDoc.exists) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      const subscriptionData = subscriptionDoc.data();

      if (!subscriptionMatchesEmail(subscriptionData, emailNormalized)) {
        auditLog('payment_history_unauthorized', {
          reason: 'email_mismatch',
          authenticatedEmail: emailNormalized,
          subscriptionId,
          ip: req.ip,
        });
        return res.status(403).json({ error: MSG_FORBIDDEN });
      }

      // 4. FETCH DONATIONS FOR THIS SUBSCRIPTION
      // Strategy: two query patterns merged via donationMap dedup.
      // (1) subscriptionId field match — for recurring Stripe invoices
      // (2) donorEmail/donorEmailNormalized + campaignId fallback — for
      //     kiosk/one-time donations never linked by subscriptionId
      const donorEmail = getSubscriptionEmail(subscriptionData);

      const tsToIso = (val) => {
        if (!val) return null;
        if (typeof val.toMillis === 'function') {
          return new Date(val.toMillis()).toISOString();
        }
        if (typeof val._seconds === 'number') {
          return new Date(val._seconds * 1000).toISOString();
        }
        if (typeof val.seconds === 'number') {
          return new Date(val.seconds * 1000).toISOString();
        }
        return typeof val === 'string' ? val : null;
      };

      const donationMap = new Map();

      const addSnap = (snap) => {
        snap.forEach((doc) => {
          if (!donationMap.has(doc.id)) {
            donationMap.set(doc.id, doc.data());
          }
        });
      };

      // Query 1: direct subscriptionId link
      const q1 = await db
        .collection('donations')
        .where('subscriptionId', '==', subscriptionId)
        .get();
      addSnap(q1);

      // Query 2: email + campaign fallback (covers kiosk/legacy docs).
      // Two parallel queries cover both storage patterns:
      // - donorEmailNormalized (new docs written with a normalised field)
      // - donorEmail exact match (legacy docs stored in lowercase)
      // Mixed-case legacy docs (e.g. "Donor@Example.com") are missed until
      // donorEmailNormalized is backfilled, consistent with the subscription queries.
      if (donorEmail && subscriptionData.campaignId) {
        const [q2a, q2b] = await Promise.all([
          db
            .collection('donations')
            .where('donorEmailNormalized', '==', donorEmail)
            .where('campaignId', '==', subscriptionData.campaignId)
            .get(),
          db
            .collection('donations')
            .where('donorEmail', '==', donorEmail)
            .where('campaignId', '==', subscriptionData.campaignId)
            .get(),
        ]);
        addSnap(q2a);
        addSnap(q2b);
      }

      const payments = [];
      donationMap.forEach((d, id) => {
        payments.push({
          id,
          amount: d.amount,
          currency: d.currency,
          status: d.paymentStatus || 'success',
          campaignTitle: d.campaignTitleSnapshot || d.metadata?.campaignTitleSnapshot || null,
          createdAt: tsToIso(d.createdAt) || tsToIso(d.timestamp) || null,
          isGiftAid: d.isGiftAid || false,
        });
      });

      // Sort newest first
      payments.sort((a, b) => {
        const toMs = (v) => (v ? new Date(v).getTime() : 0);
        return toMs(b.createdAt) - toMs(a.createdAt);
      });

      return res.status(200).json({
        payments,
        count: payments.length,
        subscriptionId,
      });
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return res.status(500).json({
        error: 'Failed to fetch payment history',
      });
    }
  });
};

module.exports = {
  sendSubscriptionMagicLink,
  verifySubscriptionMagicLink,
  getSubscriptionsByEmail,
  createCustomerPortalSession,
  getPaymentHistory,
};
