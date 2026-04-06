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
    {secrets: [stripeSecretKey]},
    createConnectionToken,
);
exports.createStripeAccountForNewOrg = createStripeAccountForNewOrg;
exports.sendWelcomeEmailForNewOrg = sendWelcomeEmailForNewOrg;
exports.kioskLogin = functions.https.onRequest(kioskLogin);

// Export v2 function with secret
exports.verifySignupRecaptcha = onRequest({ secrets: [recaptchaSecretKey] }, verifySignupRecaptcha);
