const admin = require('firebase-admin');

/**
 * Create donation document (supports both one-time and recurring)
 * @param {object} donationData - Donation data
 * @return {Promise<object>} Firestore document reference
 */
const createDonationDoc = async (donationData) => {
  const {
    transactionId, // Use as doc ID for idempotency
    campaignId,
    organizationId,
    amount,
    currency = 'usd',
    donorName = 'Anonymous',
    donorEmail = null,
    donorPhone = null,
    donorMessage = null,
    isAnonymous = false,
    isGiftAid = false,
    isRecurring = false,
    recurringInterval = null,
    subscriptionId = null,
    invoiceId = null,
    kioskId = null,
    platform = 'web',
    metadata = {},
  } = donationData;

  const donationRef = admin.firestore().collection('donations').doc(transactionId);

  let writeResult = {
    created: false,
    enrichedFields: [],
  };

  await admin.firestore().runTransaction(async (tx) => {
    const existing = await tx.get(donationRef);
    if (existing.exists) {
      const existingData = existing.data() || {};
      const patch = {};

      const setIfMissing = (field, value) => {
        if (value === undefined || value === null || value === '') return;
        const current = existingData[field];
        if (current === undefined || current === null || current === '') {
          patch[field] = value;
        }
      };

      setIfMissing('campaignId', campaignId);
      setIfMissing('organizationId', organizationId);
      setIfMissing('donorName', donorName);
      setIfMissing('donorEmail', donorEmail);
      setIfMissing('donorPhone', donorPhone);
      setIfMissing('donorMessage', donorMessage);
      setIfMissing('currency', currency);
      setIfMissing('kioskId', kioskId);
      setIfMissing('platform', platform);
      setIfMissing('subscriptionId', subscriptionId);
      setIfMissing('invoiceId', invoiceId);
      setIfMissing('recurringInterval', recurringInterval);
      setIfMissing('campaignTitleSnapshot', metadata.campaignTitleSnapshot);

      if (isRecurring === true && existingData.isRecurring !== true) {
        patch.isRecurring = true;
      }
      if (isGiftAid === true && existingData.isGiftAid !== true) {
        patch.isGiftAid = true;
      }
      if (typeof isAnonymous === 'boolean' && existingData.isAnonymous === undefined) {
        patch.isAnonymous = isAnonymous;
      }

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = admin.firestore.Timestamp.now();
        patch.enrichedByWebhook = true;
        tx.set(donationRef, patch, { merge: true });
        writeResult = {
          created: false,
          enrichedFields: Object.keys(patch),
        };
      }
      return;
    }

    tx.set(donationRef, {
      campaignId,
      organizationId,
      amount,
      currency,
      donorName,
      donorEmail,
      donorPhone,
      donorMessage,
      isAnonymous,
      isGiftAid,
      isRecurring,
      recurringInterval: recurringInterval || null,
      subscriptionId: subscriptionId || null,
      invoiceId: invoiceId || null,
      kioskId: kioskId || null,
      platform,
      transactionId,
      paymentStatus: 'success',
      timestamp: admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      ...metadata,
    });

    if (campaignId) {
      const campaignRef = admin.firestore().collection('campaigns').doc(campaignId);
      tx.set(
        campaignRef,
        {
          raised: admin.firestore.FieldValue.increment(amount),
          donationCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.Timestamp.now(),
        },
        { merge: true },
      );
    }

    writeResult = {
      created: true,
      enrichedFields: [],
    };
  });

  if (writeResult.created) {
    console.log('Donation document created:', transactionId);
    if (campaignId) {
      console.log('Campaign stats updated for:', campaignId);
    }
  } else if (writeResult.enrichedFields.length > 0) {
    console.log(
      'Donation existed; enriched missing fields:',
      transactionId,
      writeResult.enrichedFields,
    );
  } else {
    console.log('Donation already exists with complete fields:', transactionId);
  }

  return donationRef;
};

module.exports = {
  createDonationDoc,
};
