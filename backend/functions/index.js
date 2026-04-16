const functions = require('firebase-functions');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Define secrets for v2 functions
const recaptchaSecretKey = defineSecret('RECAPTCHA_SECRET_KEY');
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const sendgridFromEmail = defineSecret('SENDGRID_FROM_EMAIL');
const sendgridFromName = defineSecret('SENDGRID_FROM_NAME');
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecretAccount = defineSecret('STRIPE_WEBHOOK_SECRET_ACCOUNT');
const stripeWebhookSecretPayment = defineSecret('STRIPE_WEBHOOK_SECRET_PAYMENT');

// Import handlers
const { createUser, updateUser, deleteUser } = require('./handlers/users');
const { sendDonationThankYouEmail, sendContactConfirmationEmail } = require('./handlers/email');
const {
  handleAccountUpdatedStripeWebhook,
  handlePaymentCompletedStripeWebhook,
  handleSubscriptionWebhook,
} = require('./handlers/webhooks');
const {
  createOnboardingLink,
  createKioskPaymentIntent,
  createPaymentIntent,
  createExpressDashboardLink,
} = require('./handlers/payments');
const { exportGiftAidDeclarations, downloadGiftAidExportBatchFile } = require('./handlers/giftAid');
const { exportDonations } = require('./handlers/donationsExport');
const { exportSubscriptions } = require('./handlers/subscriptionsExport');
const { exportKiosks } = require('./handlers/kiosksExport');
const { exportCampaigns } = require('./handlers/campaignsExport');
const {
  createRecurringSubscription,
  cancelRecurringSubscription,
  updateSubscriptionPaymentMethod,
} = require('./handlers/subscriptions');
const { createStripeAccountForNewOrg, sendWelcomeEmailForNewOrg } = require('./handlers/triggers');
const { verifySignupRecaptcha } = require('./handlers/signup');
const { kioskLogin } = require('./handlers/kiosk');
const { completeEmailVerification } = require('./handlers/verification');
const { logAuthEvent } = require('./handlers/auth');
const { createConnectionToken } = require('./handlers/terminal');

// Crypto for token hashing
const crypto = require('crypto');

// CORS Configuration - restrict to your domains
// Must match domains used in payments.js to prevent CORS errors
const ALLOWED_ORIGINS = [
  'https://swiftcause--swiftcause-app.us-east4.hosted.app',
  'https://swiftcause--swiftcause-prod.europe-west4.hosted.app',
  'https://swiftcause.com',
  'https://swift-cause-web.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

// Rate limiting configuration
const MAX_VALIDATION_ATTEMPTS = 5;

/**
 * Extract client IP from request headers
 * Handles x-forwarded-for with multiple IPs (takes first one)
 * @param {object} req - Express request object
 * @return {string} Client IP address
 */
const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'] || '';
  const firstIp = forwardedFor.split(',')[0].trim();

  return firstIp || req.headers['x-real-ip'] || req.connection.remoteAddress || 'unknown';
};

// Export all functions (backwards compatible)
exports.createUser = functions.https.onRequest(createUser);
exports.updateUser = functions.https.onRequest(updateUser);
exports.deleteUser = functions.https.onRequest(deleteUser);
exports.completeEmailVerification = functions.https.onRequest(completeEmailVerification);
exports.logAuthEvent = functions.https.onRequest(logAuthEvent);
exports.sendContactConfirmationEmail = onRequest(
  { secrets: [sendgridApiKey, sendgridFromEmail, sendgridFromName] },
  sendContactConfirmationEmail,
);
exports.sendDonationThankYouEmail = onRequest(
  { secrets: [sendgridApiKey, sendgridFromEmail, sendgridFromName] },
  sendDonationThankYouEmail,
);
exports.handleAccountUpdatedStripeWebhook = functions.https.onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecretAccount],
  },
  handleAccountUpdatedStripeWebhook,
);
exports.handlePaymentCompletedStripeWebhook = functions.https.onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecretPayment],
  },
  handlePaymentCompletedStripeWebhook,
);
exports.handleSubscriptionWebhook = functions.https.onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecretPayment],
  },
  handleSubscriptionWebhook,
);
exports.createOnboardingLink = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  createOnboardingLink,
);
exports.createKioskPaymentIntent = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  createKioskPaymentIntent,
);
exports.createPaymentIntent = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  createPaymentIntent,
);
exports.createExpressDashboardLink = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  createExpressDashboardLink,
);
exports.exportGiftAidDeclarations = functions.https.onRequest(exportGiftAidDeclarations);
exports.downloadGiftAidExportBatchFile = functions.https.onRequest(downloadGiftAidExportBatchFile);
exports.exportDonations = functions.https.onRequest(exportDonations);
exports.exportSubscriptions = functions.https.onRequest(exportSubscriptions);
exports.exportKiosks = functions.https.onRequest(exportKiosks);
exports.exportCampaigns = functions.https.onRequest(exportCampaigns);
exports.createRecurringSubscription = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  createRecurringSubscription,
);
exports.cancelRecurringSubscription = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  cancelRecurringSubscription,
);
exports.updateSubscriptionPaymentMethod = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  updateSubscriptionPaymentMethod,
);
exports.createConnectionToken = functions.https.onRequest(
  { secrets: [stripeSecretKey] },
  createConnectionToken,
);
exports.createStripeAccountForNewOrg = createStripeAccountForNewOrg;
exports.sendWelcomeEmailForNewOrg = sendWelcomeEmailForNewOrg;
exports.kioskLogin = functions.https.onRequest(kioskLogin);

// Export v2 function with secret
exports.verifySignupRecaptcha = onRequest({ secrets: [recaptchaSecretKey] }, verifySignupRecaptcha);

// Magic Link Token Validation
// Validates a magic link token and returns donation details if valid
// Implements attempt tracking, blocking, and abuse prevention
exports.validateMagicLinkToken = functions.https.onRequest(async (req, res) => {
  console.log('🔵 [Validate Token] Request received');

  // CORS - restrict to allowed origins
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.error('❌ [Validate Token] Invalid method:', req.method);
    res.status(405).json({
      valid: false,
      error: 'METHOD_NOT_ALLOWED',
    });
    return;
  }

  try {
    const { token } = req.body;

    // Validate input
    if (!token || typeof token !== 'string') {
      console.error('❌ [Validate Token] Missing or invalid token');
      res.status(400).json({
        valid: false,
        error: 'INVALID_REQUEST',
      });
      return;
    }

    // Get client IP for tracking
    const clientIp = getClientIp(req);

    console.log('🔵 [Validate Token] Token received (length:', token.length, '), IP:', clientIp);

    // Hash the token (same way as generation)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('🔵 [Validate Token] Token hashed');

    // Use transaction to safely update validation attempts
    const db = admin.firestore();

    const result = await db.runTransaction(async (transaction) => {
      // Look up token by hash
      const tokensQuery = await transaction.get(
        db.collection('magicLinkTokens').where('tokenHash', '==', tokenHash).limit(1),
      );

      // Check if token exists
      if (tokensQuery.empty) {
        console.warn('⚠️ [Validate Token] Token not found');
        return {
          status: 404,
          response: {
            valid: false,
            error: 'TOKEN_NOT_FOUND',
          },
        };
      }

      const tokenDoc = tokensQuery.docs[0];
      const tokenData = tokenDoc.data();
      const tokenId = tokenDoc.id;
      const tokenRef = db.collection('magicLinkTokens').doc(tokenId);

      console.log('🔵 [Validate Token] Token found:', {
        tokenId,
        status: tokenData.status,
        blocked: tokenData.blocked,
        attempts: tokenData.validationAttempts || 0,
      });

      // Check if token is already blocked
      if (tokenData.blocked === true) {
        console.warn('⚠️ [Validate Token] Token blocked due to abuse');
        return {
          status: 403,
          response: {
            valid: false,
            error: 'TOKEN_BLOCKED',
          },
        };
      }

      // Check if this would be the blocking attempt (before incrementing)
      const currentAttempts = tokenData.validationAttempts || 0;
      if (currentAttempts >= MAX_VALIDATION_ATTEMPTS) {
        console.warn('⚠️ [Validate Token] Token has reached max attempts, blocking');

        // Mark as blocked
        transaction.update(tokenRef, {
          blocked: true,
          lastAttemptAt: admin.firestore.Timestamp.now(),
          lastAttemptIp: clientIp,
        });

        return {
          status: 403,
          response: {
            valid: false,
            error: 'TOKEN_BLOCKED',
          },
        };
      }

      // Helper function to track failed validation attempts
      // Only increments attempts when validation fails to prevent blocking legitimate users
      const trackFailedAttempt = (errorCode) => {
        const newAttempts = currentAttempts + 1;
        const shouldBlock = newAttempts >= MAX_VALIDATION_ATTEMPTS;

        transaction.update(tokenRef, {
          validationAttempts: newAttempts,
          lastAttemptAt: admin.firestore.Timestamp.now(),
          lastAttemptIp: clientIp,
          blocked: shouldBlock,
        });

        console.log('🔵 [Validate Token] Failed attempt tracked:', {
          attempts: newAttempts,
          blocked: shouldBlock,
          error: errorCode,
        });

        return shouldBlock;
      };

      // Check if token is already consumed
      if (tokenData.status === 'consumed') {
        console.warn('⚠️ [Validate Token] Token already consumed');
        trackFailedAttempt('TOKEN_CONSUMED');
        return {
          status: 410,
          response: {
            valid: false,
            error: 'TOKEN_CONSUMED',
          },
        };
      }

      // Check if token is expired (status)
      if (tokenData.status === 'expired') {
        console.warn('⚠️ [Validate Token] Token marked as expired');
        trackFailedAttempt('TOKEN_EXPIRED');
        return {
          status: 410,
          response: {
            valid: false,
            error: 'TOKEN_EXPIRED',
          },
        };
      }

      // Check if token is active
      if (tokenData.status !== 'active') {
        console.warn('⚠️ [Validate Token] Token not active:', tokenData.status);
        trackFailedAttempt('TOKEN_INVALID');
        return {
          status: 410,
          response: {
            valid: false,
            error: 'TOKEN_INVALID',
          },
        };
      }

      // Check expiry timestamp
      const now = Date.now();
      const expiresAt = tokenData.expiresAt?.toMillis();

      if (!expiresAt || expiresAt < now) {
        console.warn('⚠️ [Validate Token] Token expired by timestamp');

        // Track failed attempt and mark as expired
        trackFailedAttempt('TOKEN_EXPIRED');

        // Mark as expired in database
        transaction.update(tokenRef, {
          status: 'expired',
        });

        return {
          status: 410,
          response: {
            valid: false,
            error: 'TOKEN_EXPIRED',
          },
        };
      }

      // Token is valid - DO NOT increment attempts (legitimate user)
      // This prevents blocking users who refresh the page multiple times
      console.log('✅ [Validate Token] Token valid (attempts NOT incremented)');

      return {
        status: 200,
        response: {
          valid: true,
          tokenId: tokenId,
          donationId: tokenData.donationId,
          campaignId: tokenData.campaignId,
          amount: tokenData.amount,
          currency: tokenData.currency,
          purpose: tokenData.purpose,
          expiresAt: tokenData.expiresAt?.toDate().toISOString(),
        },
      };
    });

    // Return result from transaction
    res.status(result.status).json(result.response);
  } catch (error) {
    console.error('❌ [Validate Token] Error:', error);
    res.status(500).json({
      valid: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

// Magic Link Token Consumption
// Marks a token as consumed after Gift Aid form submission
// Uses transaction to prevent race conditions and double consumption
exports.consumeMagicLinkToken = functions.https.onRequest(async (req, res) => {
  console.log('🔵 [Consume Token] Request received');

  // CORS - restrict to allowed origins
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.error('❌ [Consume Token] Invalid method:', req.method);
    res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
    });
    return;
  }

  try {
    const { tokenId } = req.body;

    // Validate input
    if (!tokenId || typeof tokenId !== 'string') {
      console.error('❌ [Consume Token] Missing or invalid tokenId');
      res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
      });
      return;
    }

    console.log('🔵 [Consume Token] Token ID:', tokenId);

    // Use transaction to prevent race conditions
    const db = admin.firestore();
    const tokenRef = db.collection('magicLinkTokens').doc(tokenId);

    const result = await db.runTransaction(async (transaction) => {
      // Read token
      const tokenSnap = await transaction.get(tokenRef);

      // Check if token exists
      if (!tokenSnap.exists) {
        console.warn('⚠️ [Consume Token] Token not found:', tokenId);
        return {
          status: 404,
          response: {
            success: false,
            error: 'TOKEN_NOT_FOUND',
          },
        };
      }

      const tokenData = tokenSnap.data();

      console.log('🔵 [Consume Token] Token status:', tokenData.status);

      // Check if token is blocked (CRITICAL: prevent consuming blocked tokens)
      if (tokenData.blocked === true) {
        console.warn('⚠️ [Consume Token] Token blocked due to abuse');
        return {
          status: 403,
          response: {
            success: false,
            error: 'TOKEN_BLOCKED',
          },
        };
      }

      // Check if token is expired (CRITICAL: prevent consuming expired tokens)
      const now = Date.now();
      const expiresAt = tokenData.expiresAt?.toMillis();

      if (!expiresAt || expiresAt < now) {
        console.warn('⚠️ [Consume Token] Token expired, cannot consume');
        return {
          status: 410,
          response: {
            success: false,
            error: 'TOKEN_EXPIRED',
          },
        };
      }

      // Check if already consumed
      if (tokenData.status === 'consumed') {
        console.warn('⚠️ [Consume Token] Token already consumed:', tokenId);
        return {
          status: 409,
          response: {
            success: false,
            error: 'TOKEN_ALREADY_CONSUMED',
          },
        };
      }

      // Check if token is active
      if (tokenData.status !== 'active') {
        console.warn('⚠️ [Consume Token] Token not active:', tokenData.status);
        return {
          status: 400,
          response: {
            success: false,
            error: 'TOKEN_NOT_ACTIVE',
          },
        };
      }

      // Update status to consumed (atomic)
      transaction.update(tokenRef, {
        status: 'consumed',
        completedAt: admin.firestore.Timestamp.now(),
      });

      console.log('✅ [Consume Token] Token marked as consumed:', tokenId);

      return {
        status: 200,
        response: {
          success: true,
          tokenId: tokenId,
        },
      };
    });

    // Return result from transaction
    res.status(result.status).json(result.response);
  } catch (error) {
    console.error('❌ [Consume Token] Error:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

// ============================================
// COMPLETE GIFT AID FLOW - ATOMIC & IDEMPOTENT
// ============================================

const PROCESSING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Complete Gift Aid Flow - Atomic & Idempotent
 *
 * Handles the entire Gift Aid submission in a single transaction:
 * 1. Validate token
 * 2. Check idempotency
 * 3. Create declaration
 * 4. Link donation
 * 5. Consume token
 *
 * ALL OR NOTHING - no partial failures
 */
exports.completeGiftAidFlow = functions.https.onRequest(async (req, res) => {
  // CORS
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed',
    });
  }

  try {
    const { token, formData } = req.body;

    // ============================================
    // INPUT VALIDATION
    // ============================================

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Token is required',
      });
    }

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Form data is required',
      });
    }

    // Validate required fields
    const requiredFields = [
      'firstName',
      'surname',
      'houseNumber',
      'addressLine1',
      'town',
      'postcode',
    ];
    const missingFields = requiredFields.filter((field) => !formData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    // Validate consents
    const consents = formData.consents || {};
    const requiredConsents = [
      'giftAidConsent',
      'ukTaxpayerConfirmation',
      'dataProcessingConsent',
      'homeAddressConfirmed',
    ];
    const missingConsents = requiredConsents.filter((consent) => consents[consent] !== true);

    if (missingConsents.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_CONSENTS',
        message: 'All required consents must be provided',
      });
    }

    // Hash token for lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // ============================================
    // ATOMIC TRANSACTION
    // ============================================

    const db = admin.firestore();
    const timestamp = admin.firestore.Timestamp.now();

    const result = await db.runTransaction(async (transaction) => {
      // ----------------------------------------
      // STEP 1: FETCH & VALIDATE TOKEN (Direct Lookup)
      // ----------------------------------------

      // Use tokenHash as document ID for direct lookup (no query)
      const tokenRef = db.collection('magicLinkTokens').doc(tokenHash);
      const tokenSnap = await transaction.get(tokenRef);

      if (!tokenSnap.exists) {
        throw {
          status: 404,
          error: 'TOKEN_NOT_FOUND',
          message: 'Invalid or expired link',
        };
      }

      const tokenData = tokenSnap.data();

      // Check token status
      if (tokenData.blocked === true) {
        throw {
          status: 403,
          error: 'TOKEN_BLOCKED',
          message: 'This link has been blocked',
        };
      }

      if (tokenData.status === 'consumed') {
        throw {
          status: 409,
          error: 'TOKEN_CONSUMED',
          message: 'This link has already been used',
        };
      }

      if (tokenData.status !== 'active') {
        throw {
          status: 400,
          error: 'TOKEN_INVALID',
          message: 'Invalid link',
        };
      }

      const expiresAt = tokenData.expiresAt?.toMillis();
      if (!expiresAt || expiresAt < Date.now()) {
        throw {
          status: 410,
          error: 'TOKEN_EXPIRED',
          message: 'This link has expired',
        };
      }

      // ----------------------------------------
      // STEP 2: FETCH DONATION
      // ----------------------------------------

      const donationId = tokenData.donationId;
      const donationRef = db.collection('donations').doc(donationId);
      const donationSnap = await transaction.get(donationRef);

      if (!donationSnap.exists) {
        throw {
          status: 404,
          error: 'DONATION_NOT_FOUND',
          message: 'Associated donation not found',
        };
      }

      const donationData = donationSnap.data();

      // ----------------------------------------
      // STEP 3: CHECK PROCESSING LOCK (with timeout)
      // ----------------------------------------

      if (donationData.processing === true) {
        const startedAt = donationData.processingStartedAt?.toMillis();

        // Check if lock is stale (older than timeout)
        if (!startedAt || Date.now() - startedAt < PROCESSING_TIMEOUT_MS) {
          throw {
            status: 409,
            error: 'PROCESSING_IN_PROGRESS',
            message: 'This donation is currently being processed',
          };
        }

        // Stale lock detected - allow override
        console.warn('Stale processing lock detected, overriding', {
          donationId,
          startedAt: new Date(startedAt).toISOString(),
          age: Date.now() - startedAt,
        });
      }

      // ----------------------------------------
      // STEP 4: IDEMPOTENCY CHECK
      // ----------------------------------------

      if (donationData.giftAidDeclarationId && donationData.isGiftAid === true) {
        // Already processed - return success (idempotent)
        const giftAidAmount = Math.round(donationData.amount * 0.25);

        return {
          success: true,
          idempotent: true,
          declarationId: donationData.giftAidDeclarationId,
          donationId: donationId,
          giftAidAmount: giftAidAmount,
          totalImpact: donationData.amount + giftAidAmount,
        };
      }

      // ----------------------------------------
      // STEP 5: SET PROCESSING LOCK
      // ----------------------------------------

      transaction.update(donationRef, {
        processing: true,
        processingStartedAt: timestamp,
      });

      // ----------------------------------------
      // STEP 6: CREATE GIFT AID DECLARATION
      // ----------------------------------------

      const declarationRef = db.collection('giftAidDeclarations').doc();
      const declarationId = declarationRef.id;

      const giftAidAmount = Math.round(tokenData.amount * 0.25);
      const totalImpact = tokenData.amount + giftAidAmount;

      const donorEmail = formData.donorEmail?.trim() || null;
      const donorEmailNormalized = donorEmail?.toLowerCase() || null;

      const getTaxYear = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return month >= 3 ? `${year}-${(year + 1) % 100}` : `${year - 1}-${year % 100}`;
      };

      const declarationData = {
        id: declarationId,
        donationId: donationId,
        donorTitle: formData.donorTitle?.trim() || '',
        donorFirstName: formData.firstName.trim(),
        donorSurname: formData.surname.trim(),
        donorHouseNumber: formData.houseNumber.trim(),
        donorAddressLine1: formData.addressLine1.trim(),
        donorAddressLine2: formData.addressLine2?.trim() || '',
        donorTown: formData.town.trim(),
        donorPostcode: formData.postcode.trim(),
        donorEmail: donorEmail,
        donorEmailNormalized: donorEmailNormalized,
        declarationText:
          'I want to Gift Aid my donation and any donations I make in the future or have made in the past 4 years to this charity. I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.',
        declarationTextVersion: 'v1.0',
        declarationDate: timestamp,
        giftAidConsent: consents.giftAidConsent,
        ukTaxpayerConfirmation: consents.ukTaxpayerConfirmation,
        dataProcessingConsent: consents.dataProcessingConsent,
        homeAddressConfirmed: consents.homeAddressConfirmed,
        donationAmount: tokenData.amount,
        giftAidAmount: giftAidAmount,
        campaignId: tokenData.campaignId || null,
        campaignTitle: donationData.metadata?.campaignTitleSnapshot || 'Donation',
        organizationId: tokenData.charityId || donationData.organizationId || null,
        donationDate: donationData.createdAt || timestamp,
        taxYear: getTaxYear(new Date()),
        giftAidStatus: 'active',
        hmrcClaimStatus: 'pending',
        operationalStatus: 'captured',
        captureMethod: 'magic_link',
        magicLinkTokenId: tokenHash,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      transaction.set(declarationRef, declarationData);

      // ----------------------------------------
      // STEP 7: LINK DONATION & CLEAR LOCK
      // ----------------------------------------

      transaction.update(donationRef, {
        isGiftAid: true,
        giftAidDeclarationId: declarationId,
        processing: false,
        processingCompletedAt: timestamp,
        updatedAt: timestamp,
      });

      // ----------------------------------------
      // STEP 8: CONSUME TOKEN
      // ----------------------------------------

      transaction.update(tokenRef, {
        status: 'consumed',
        completedAt: timestamp,
      });

      // ----------------------------------------
      // STEP 9: RETURN SUCCESS
      // ----------------------------------------

      return {
        success: true,
        idempotent: false,
        declarationId: declarationId,
        donationId: donationId,
        giftAidAmount: giftAidAmount,
        totalImpact: totalImpact,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Complete Gift Aid Flow Error:', error);

    // Structured error response
    if (error.status && error.error) {
      return res.status(error.status).json({
        success: false,
        error: error.error,
        message: error.message,
      });
    }

    // Unexpected error
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});
