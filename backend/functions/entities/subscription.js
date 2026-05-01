const admin = require('firebase-admin');

/**
 * Convert value to Firestore Timestamp
 * @param {number|Date|object} value - Value to convert
 * @return {object} Firestore Timestamp
 */
const toFirestoreTimestamp = (value) => {
  if (!value) {
    return admin.firestore.Timestamp.now();
  }
  if (typeof value === 'number') {
    // Unix timestamp in seconds, convert to milliseconds
    return admin.firestore.Timestamp.fromMillis(value * 1000);
  }
  if (value instanceof Date) {
    return admin.firestore.Timestamp.fromDate(value);
  }
  if (value.seconds !== undefined) {
    // Already a Firestore Timestamp-like object
    return admin.firestore.Timestamp.fromMillis(value.seconds * 1000);
  }
  return admin.firestore.Timestamp.now();
};

/**
 * Calculate next payment date based on interval
 * @param {number} currentPeriodEnd - Unix timestamp in seconds
 * @param {string} interval - Subscription interval (month/year)
 * @param {number} intervalCount - Number of intervals
 * @return {object} Firestore Timestamp
 */
const calculateNextPaymentAt = (currentPeriodEnd, interval, intervalCount) => {
  if (!currentPeriodEnd) {
    return null;
  }
  // currentPeriodEnd is already the next payment date from Stripe
  return toFirestoreTimestamp(currentPeriodEnd);
};

/**
 * Create subscription document in Firestore
 * @param {object} subscriptionData - Subscription data
 * @return {Promise<object>} Firestore document reference
 */
const createSubscriptionDoc = async (subscriptionData) => {
  const {
    stripeSubscriptionId,
    customerId,
    campaignId,
    organizationId,
    interval,
    intervalCount = 1,
    amount,
    currency = 'usd',
    status,
    currentPeriodEnd,
    startedAt = null,
    lastPaymentAt = null,
    nextPaymentAt = null,
    cancelReason = null,
    currentPeriodStart,
    location_id = null,
    location_snapshot = null,
    metadata = {},
  } = subscriptionData;

  const subscriptionRef = admin.firestore().collection('subscriptions').doc(stripeSubscriptionId);

  const now = admin.firestore.Timestamp.now();
  const periodEndTimestamp = toFirestoreTimestamp(currentPeriodEnd);

  const toTimestampOrNull = (value) => {
    if (!value) return null;
    if (typeof value === 'number') {
      return admin.firestore.Timestamp.fromMillis(value * 1000);
    }
    if (value instanceof Date) {
      return admin.firestore.Timestamp.fromDate(value);
    }
    return null;
  };

  const startedAtTimestamp =
    toTimestampOrNull(startedAt) ||
    (currentPeriodStart ? toFirestoreTimestamp(currentPeriodStart) : now);
  const lastPaymentAtTimestamp = toTimestampOrNull(lastPaymentAt);
  const nextPaymentAtTimestamp =
    toTimestampOrNull(nextPaymentAt) ||
    calculateNextPaymentAt(currentPeriodEnd, interval, intervalCount);

  await subscriptionRef.set({
    stripeSubscriptionId,
    customerId,
    campaignId,
    organizationId,
    interval,
    intervalCount,
    amount,
    currency,
    status,
    donorEmail: metadata.donorEmail || null,
    donorName: metadata.donorName || null,
    donorPhone: metadata.donorPhone || null,
    startedAt: startedAtTimestamp,
    lastPaymentAt: lastPaymentAtTimestamp,
    nextPaymentAt: nextPaymentAtTimestamp,
    cancelReason: cancelReason || null,
    location_id: typeof location_id === 'string' ? location_id.trim() || null : null,
    location_snapshot: location_snapshot
      ? {
          name: location_snapshot.name?.trim() || null,
          postcode: location_snapshot.postcode?.trim() || null,
          city: location_snapshot.city?.trim() || null,
        }
      : null,
    currentPeriodEnd: periodEndTimestamp,
    canceledAt: null,
    createdAt: now,
    updatedAt: now,
    metadata: metadata,
  });

  console.log('Subscription document created:', stripeSubscriptionId);
  return subscriptionRef;
};

/**
 * Update subscription status
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @param {string} status - New status
 * @param {object} updates - Additional fields to update
 * @return {Promise<boolean>} True if subscription exists and was updated
 */
const updateSubscriptionStatus = async (stripeSubscriptionId, status, updates = {}) => {
  const subscriptionRef = admin.firestore().collection('subscriptions').doc(stripeSubscriptionId);

  const existing = await subscriptionRef.get();
  if (!existing.exists) {
    console.warn('Subscription not found for status update:', stripeSubscriptionId);
    return false;
  }

  // Normalize timestamp fields in updates
  const normalizedUpdates = { ...updates };
  if (normalizedUpdates.currentPeriodEnd) {
    normalizedUpdates.currentPeriodEnd = toFirestoreTimestamp(normalizedUpdates.currentPeriodEnd);
  }
  if (normalizedUpdates.lastPaymentAt) {
    normalizedUpdates.lastPaymentAt = toFirestoreTimestamp(normalizedUpdates.lastPaymentAt);
  }
  if (normalizedUpdates.nextPaymentAt) {
    normalizedUpdates.nextPaymentAt = toFirestoreTimestamp(normalizedUpdates.nextPaymentAt);
  }
  if (normalizedUpdates.canceledAt) {
    normalizedUpdates.canceledAt = toFirestoreTimestamp(normalizedUpdates.canceledAt);
  }

  const updateData = {
    status,
    updatedAt: admin.firestore.Timestamp.now(),
    ...normalizedUpdates,
  };

  await subscriptionRef.update(updateData);
  console.log('Subscription status updated:', stripeSubscriptionId, status);
  return true;
};

/**
 * Get subscription by Stripe ID
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @return {Promise<object|null>} Subscription data or null
 */
const getSubscriptionByStripeId = async (stripeSubscriptionId) => {
  const doc = await admin.firestore().collection('subscriptions').doc(stripeSubscriptionId).get();

  return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

module.exports = {
  createSubscriptionDoc,
  updateSubscriptionStatus,
  getSubscriptionByStripeId,
  toFirestoreTimestamp,
  calculateNextPaymentAt,
};
