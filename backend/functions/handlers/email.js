const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const {
  sendDonationThankYouEmail: sendDonationThankYouEmailViaSendGrid,
  sendContactConfirmationEmail: sendContactConfirmationEmailViaSendGrid,
} = require('../services/email');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveDonationByReference = async (referenceId) => {
  const donationsRef = admin.firestore().collection('donations');

  // Fast path: donation doc id equals reference id.
  const directDoc = await donationsRef.doc(referenceId).get();
  if (directDoc.exists) return directDoc;

  // Fallbacks for recurring flows where UI may pass subscription/invoice ids.
  // Also supports gift aid declaration id lookup.
  const lookups = [
    ['transactionId', referenceId],
    ['subscriptionId', referenceId],
    ['invoiceId', referenceId],
    ['giftAidDeclarationId', referenceId],
  ];

  for (const [field, value] of lookups) {
    const snapshot = await donationsRef.where(field, '==', value).limit(1).get();

    if (!snapshot.empty) {
      return snapshot.docs[0];
    }
  }

  return null;
};

const getDonationWithRetry = async (transactionId, attempts = 10, delayMs = 700) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const donationSnap = await resolveDonationByReference(transactionId);
    if (donationSnap && donationSnap.exists) {
      return donationSnap;
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  return null;
};

const getSubscriptionByReference = async (referenceId) => {
  const subscriptionsRef = admin.firestore().collection('subscriptions');
  const directDoc = await subscriptionsRef.doc(referenceId).get();
  if (directDoc.exists) return directDoc;
  return null;
};

/**
 * Send donation thank-you email via SendGrid (replaces Firestore mail queue).
 * Validates that the provided transactionId corresponds to an existing donation.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const sendDonationThankYouEmail = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const email = normalizeString(req.body?.email);
      const transactionId = normalizeString(req.body?.transactionId);

      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).send({ error: 'A valid email is required.' });
      }

      if (!transactionId) {
        return res.status(400).send({ error: 'transactionId is required.' });
      }

      const donationSnap = await getDonationWithRetry(transactionId);
      let donationData = donationSnap?.data() || null;

      // Recurring fallback: if donation isn't available yet, use subscription data.
      if (!donationData && transactionId.startsWith('sub_')) {
        const subscriptionSnap = await getSubscriptionByReference(transactionId);
        if (subscriptionSnap && subscriptionSnap.exists) {
          const subData = subscriptionSnap.data() || {};
          donationData = {
            organizationId: subData.organizationId || null,
            donorName: subData.donorName || subData.metadata?.donorName || 'Donor',
            currency: subData.currency || '',
            amount: typeof subData.amount === 'number' ? subData.amount : null,
            campaignTitleSnapshot: subData.metadata?.campaignTitle || null,
          };
        }
      }

      if (!donationData) {
        console.warn('Receipt lookup unresolved', {
          referenceId: transactionId,
          isSubscriptionReference: transactionId.startsWith('sub_'),
        });
        return res.status(409).send({
          error: 'Donation is still processing. Please retry in a few seconds.',
          code: 'RECEIPT_LOOKUP_PENDING',
        });
      }

      const organizationId = normalizeString(donationData.organizationId) || '';
      const campaignName =
        normalizeString(req.body?.campaignName) ||
        normalizeString(donationData.campaignTitleSnapshot);
      let organizationName = null;

      if (organizationId) {
        try {
          const orgSnap = await admin
            .firestore()
            .collection('organizations')
            .doc(organizationId)
            .get();
          if (orgSnap.exists) {
            const orgData = orgSnap.data() || {};
            organizationName =
              normalizeString(orgData.name) || normalizeString(orgData.organizationName);
          }
        } catch (orgError) {
          console.warn('Failed to resolve organization name for receipt email:', {
            transactionId,
            organizationId,
            error: orgError.message,
          });
        }
      }

      const emailResult = await sendDonationThankYouEmailViaSendGrid({
        to: email,
        donorName: normalizeString(donationData.donorName) || 'Donor',
        campaignName,
        organizationName,
        amount: typeof donationData.amount === 'number' ? donationData.amount : null,
        currency: normalizeString(donationData.currency) || '',
        donationId: transactionId,
        organizationId,
      });

      console.log('Donation thank-you email sent', {
        transactionId,
        email,
        statusCode: emailResult?.statusCode || null,
        source: donationSnap?.exists ? 'donation' : 'subscription_fallback',
      });

      return res.status(200).send({
        success: true,
        message: 'Thank-you email sent.',
      });
    } catch (error) {
      console.error('Error sending donation thank-you email:', error);
      return res.status(500).send({
        error: error.message || 'Failed to send thank-you email.',
      });
    }
  });
};

/**
 * Send contact form confirmation email via SendGrid.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const sendContactConfirmationEmail = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const email = normalizeString(req.body?.email);
      const firstName = normalizeString(req.body?.firstName);
      const message = normalizeString(req.body?.message);

      if (!email || !EMAIL_REGEX.test(email)) {
        return res.status(400).send({ error: 'A valid email is required.' });
      }

      if (!message) {
        return res.status(400).send({ error: 'message is required.' });
      }

      const emailResult = await sendContactConfirmationEmailViaSendGrid({
        to: email,
        firstName,
        message,
      });

      console.log('Contact confirmation email sent', {
        email,
        statusCode: emailResult?.statusCode || null,
      });

      return res.status(200).send({ success: true });
    } catch (error) {
      console.error('Error sending contact confirmation email:', error);
      return res.status(500).send({
        error: error.message || 'Failed to send contact confirmation email.',
      });
    }
  });
};

module.exports = {
  sendDonationThankYouEmail,
  sendContactConfirmationEmail,
};
