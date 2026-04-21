const admin = require('firebase-admin');

/**
 * Convert a value to a proper Firestore Timestamp
 * Handles string dates, Date objects, and existing Timestamps
 * @param {*} value - Value to convert
 * @return {admin.firestore.Timestamp|null} Firestore Timestamp or null if parsing fails
 */
const ensureFirestoreTimestamp = (value) => {
  if (!value) return admin.firestore.Timestamp.now();

  // Already a Firestore Timestamp — duck-type on .toMillis() which both the
  // real Admin SDK Timestamp and the test mock expose.
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value;
  }

  // Date object
  if (value instanceof Date) {
    return admin.firestore.Timestamp.fromDate(value);
  }

  // String — try standard ISO parse first
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return admin.firestore.Timestamp.fromDate(date);
    }

    // Fallback: parse the Firestore console human-readable format
    // e.g. "20 April 2026 at 19:06:49 UTC+5:30"
    const m = value.match(
      /(\d{1,2})\s+(\w+)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2}):(\d{2})\s+UTC([+-])(\d{1,2}):(\d{2})/,
    );
    if (m) {
      const [, day, monthName, year, hour, minute, second, tzSign, tzHour, tzMin] = m;
      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const month = monthNames.indexOf(monthName);
      if (month !== -1) {
        // Zero-pad timezone hour: "+5:30" → "+05:30" (required for valid ISO 8601)
        const paddedTz = `${tzSign}${tzHour.padStart(2, '0')}:${tzMin}`;
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}${paddedTz}`;
        const parsed = new Date(iso);
        if (!isNaN(parsed.getTime())) {
          return admin.firestore.Timestamp.fromDate(parsed);
        }
      }
    }

    // Unparseable — return null so callers can preserve the original value
    console.warn('[ensureFirestoreTimestamp] Could not parse, preserving original:', value);
    return null;
  }

  // Unknown type — use current time
  console.warn('[ensureFirestoreTimestamp] Unexpected value type, using now:', typeof value);
  return admin.firestore.Timestamp.now();
};

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

      // Heal legacy timestamp fields if they're strings.
      // Only add to patch when healing succeeds; on failure (null) the original
      // string is preserved and no write happens for that field.
      if (typeof existingData.createdAt === 'string') {
        const healed = ensureFirestoreTimestamp(existingData.createdAt);
        if (healed !== null) patch.createdAt = healed;
      }
      if (typeof existingData.timestamp === 'string') {
        const healed = ensureFirestoreTimestamp(existingData.timestamp);
        if (healed !== null) patch.timestamp = healed;
      }
      if (typeof existingData.updatedAt === 'string') {
        // updatedAt healing: if unparseable, still update to now so the field
        // becomes a proper Timestamp on the next touch.
        const healed = ensureFirestoreTimestamp(existingData.updatedAt);
        patch.updatedAt = healed !== null ? healed : admin.firestore.Timestamp.now();
      }

      if (Object.keys(patch).length > 0) {
        if (!patch.updatedAt) {
          patch.updatedAt = admin.firestore.Timestamp.now();
        }
        patch.enrichedByWebhook = true;
        tx.set(donationRef, patch, { merge: true });
        writeResult = {
          created: false,
          enrichedFields: Object.keys(patch),
        };
      }
      return;
    }

    // Sanitize metadata to prevent timestamp field overwrites
    const sanitizedMetadata = { ...metadata };
    delete sanitizedMetadata.createdAt;
    delete sanitizedMetadata.timestamp;
    delete sanitizedMetadata.updatedAt;

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
      timestamp: ensureFirestoreTimestamp(),
      createdAt: ensureFirestoreTimestamp(),
      ...sanitizedMetadata,
    });

    if (campaignId) {
      const campaignRef = admin.firestore().collection('campaigns').doc(campaignId);
      tx.set(
        campaignRef,
        {
          raised: admin.firestore.FieldValue.increment(amount),
          donationCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: ensureFirestoreTimestamp(),
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
  ensureFirestoreTimestamp,
};
