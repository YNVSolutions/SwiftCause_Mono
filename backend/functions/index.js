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
const {
  kioskDeviceRegister,
  kioskDevicePolicy,
  kioskDeviceStatus,
  kioskDeviceHeartbeat,
  kioskApkDownload,
} = require('./handlers/managedDevices');
const { completeEmailVerification } = require('./handlers/verification');
const { logAuthEvent } = require('./handlers/auth');
const { createConnectionToken } = require('./handlers/terminal');
const { updateOrganizationSettings } = require('./handlers/organizationSettings');

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
exports.kioskDeviceRegister = functions.https.onRequest(kioskDeviceRegister);
exports.kioskDevicePolicy = functions.https.onRequest(kioskDevicePolicy);
exports.kioskDeviceStatus = functions.https.onRequest(kioskDeviceStatus);
exports.kioskDeviceHeartbeat = functions.https.onRequest(kioskDeviceHeartbeat);
exports.kioskApkDownload = functions.https.onRequest(kioskApkDownload);
exports.updateOrganizationSettings = functions.https.onRequest(updateOrganizationSettings);

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
      // Direct document lookup using tokenHash as document ID (O(1) lookup)
      const tokenRef = db.collection('magicLinkTokens').doc(tokenHash);
      const tokenDoc = await transaction.get(tokenRef);

      // Check if token exists
      if (!tokenDoc.exists) {
        console.warn('⚠️ [Validate Token] Token not found');
        return {
          status: 404,
          response: {
            valid: false,
            error: 'TOKEN_NOT_FOUND',
          },
        };
      }

      const tokenData = tokenDoc.data();
      const tokenId = tokenDoc.id;

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
