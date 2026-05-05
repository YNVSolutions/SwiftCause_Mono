const admin = require('firebase-admin');
const crypto = require('crypto');

/**
 * Token Manager for Subscription Magic Links
 * Handles secure token generation, storage, and verification in Firestore
 */

const COLLECTION_NAME = 'subscriptionMagicLinkTokens';
const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a secure random token
 * @return {string} 64-character hex token (256 bits)
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token for storage (prevents token exposure in database)
 * @param {string} token - Plain token
 * @return {string} SHA-256 hash of token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Store a token in Firestore
 * @param {string} token - Plain token (will be hashed)
 * @param {object} data - Token data
 * @param {string} data.email - Donor email
 * @param {string} data.purpose - Token purpose (e.g., 'subscription_management')
 * @return {Promise<string>} Token hash (document ID)
 */
const storeToken = async (token, { email, purpose = 'subscription_management' }) => {
  const tokenHash = hashToken(token);
  const db = admin.firestore();
  const timestamp = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + TOKEN_EXPIRY_MS);

  await db.collection(COLLECTION_NAME).doc(tokenHash).set({
    email: email.toLowerCase().trim(),
    purpose,
    status: 'active',
    expiresAt,
    createdAt: timestamp,
    consumedAt: null,
  });

  console.log('Token stored:', {
    tokenHash: tokenHash.substring(0, 10) + '...',
    email,
    purpose,
    expiresAt: expiresAt.toDate().toISOString(),
  });

  return tokenHash;
};

/**
 * Verify and consume a token (one-time use)
 * @param {string} token - Plain token
 * @return {Promise<object>} Token data if valid
 * @throws {Error} If token is invalid, expired, or already consumed
 */
const verifyToken = async (token) => {
  const tokenHash = hashToken(token);
  const db = admin.firestore();

  // Use transaction to prevent race conditions
  const result = await db.runTransaction(async (transaction) => {
    const tokenRef = db.collection(COLLECTION_NAME).doc(tokenHash);
    const tokenDoc = await transaction.get(tokenRef);

    // Check if token exists
    if (!tokenDoc.exists) {
      console.warn('Token not found:', tokenHash.substring(0, 10) + '...');
      throw new Error('TOKEN_NOT_FOUND');
    }

    const tokenData = tokenDoc.data();

    // Check if already consumed
    if (tokenData.status === 'consumed') {
      console.warn('Token already consumed:', tokenHash.substring(0, 10) + '...');
      throw new Error('TOKEN_CONSUMED');
    }

    // Check if expired
    const now = Date.now();
    const expiresAt = tokenData.expiresAt?.toMillis();

    if (!expiresAt || expiresAt < now) {
      console.warn('Token expired:', tokenHash.substring(0, 10) + '...');

      // Mark as expired
      transaction.update(tokenRef, {
        status: 'expired',
      });

      return { error: 'TOKEN_EXPIRED' };
    }

    // Check status
    if (tokenData.status !== 'active') {
      console.warn('Token not active:', tokenData.status);
      throw new Error('TOKEN_INVALID');
    }

    // Token is valid - consume it (one-time use)
    transaction.update(tokenRef, {
      status: 'consumed',
      consumedAt: admin.firestore.Timestamp.now(),
    });

    console.log('Token verified and consumed:', {
      tokenHash: tokenHash.substring(0, 10) + '...',
      email: tokenData.email,
    });

    return {
      email: tokenData.email,
      purpose: tokenData.purpose,
      createdAt: tokenData.createdAt,
    };
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
};

/**
 * Cleanup expired tokens (should be called periodically)
 * @return {Promise<number>} Number of tokens marked as expired
 */
const cleanupExpiredTokens = async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // Find expired tokens
  const expiredTokens = await db
    .collection(COLLECTION_NAME)
    .where('expiresAt', '<', now)
    .where('status', '==', 'active')
    .limit(100) // Process in batches
    .get();

  if (expiredTokens.empty) {
    return 0;
  }

  // Mark as expired in batch
  const batch = db.batch();
  expiredTokens.docs.forEach((doc) => {
    batch.update(doc.ref, { status: 'expired' });
  });

  await batch.commit();

  console.log('Cleaned up expired tokens:', expiredTokens.size);
  return expiredTokens.size;
};

/**
 * Delete old consumed/expired tokens (for periodic cleanup)
 * Deletes tokens that are consumed or expired and older than X days
 * @param {number} daysOld - Delete tokens older than this many days (default: 30)
 * @return {Promise<number>} Number of tokens deleted
 */
const deleteOldTokens = async (daysOld = 30) => {
  const db = admin.firestore();
  const cutoffDate = admin.firestore.Timestamp.fromMillis(
    Date.now() - daysOld * 24 * 60 * 60 * 1000,
  );

  // Find old consumed tokens
  const oldConsumedTokens = await db
    .collection(COLLECTION_NAME)
    .where('status', '==', 'consumed')
    .where('consumedAt', '<', cutoffDate)
    .limit(100) // Process in batches
    .get();

  // Find old expired tokens
  const oldExpiredTokens = await db
    .collection(COLLECTION_NAME)
    .where('status', '==', 'expired')
    .where('expiresAt', '<', cutoffDate)
    .limit(100) // Process in batches
    .get();

  const totalToDelete = oldConsumedTokens.size + oldExpiredTokens.size;

  if (totalToDelete === 0) {
    return 0;
  }

  // Delete in batch
  const batch = db.batch();

  oldConsumedTokens.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  oldExpiredTokens.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  console.log('Deleted old tokens:', {
    consumed: oldConsumedTokens.size,
    expired: oldExpiredTokens.size,
    total: totalToDelete,
    olderThan: `${daysOld} days`,
  });

  return totalToDelete;
};

module.exports = {
  generateToken,
  hashToken,
  storeToken,
  verifyToken,
  cleanupExpiredTokens,
  deleteOldTokens,
  TOKEN_EXPIRY_MS,
};
