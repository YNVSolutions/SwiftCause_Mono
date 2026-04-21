const admin = require('firebase-admin');
const cors = require('../middleware/cors');

const normalizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Complete email verification for cross-device verification flows.
 * Validates a one-time token stored on the user document, then marks the user
 * as emailVerified in Firestore which triggers the welcome email flow.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const completeEmailVerification = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const uid = normalizeString(req.body?.uid);
      const token = normalizeString(req.body?.token);

      if (!uid || !token) {
        return res.status(400).send({ error: 'uid and token are required.' });
      }

      const userRef = admin.firestore().collection('users').doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return res.status(404).send({ error: 'User not found.' });
      }

      const userData = userSnap.data() || {};
      const storedToken = normalizeString(userData.emailVerificationToken);
      const expiresAt = normalizeString(userData.emailVerificationTokenExpiresAt);

      if (!storedToken || storedToken !== token) {
        return res.status(403).send({ error: 'Invalid verification token.' });
      }

      if (expiresAt) {
        const expiryDate = new Date(expiresAt);
        if (!Number.isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) {
          return res.status(403).send({ error: 'Verification token expired.' });
        }
      }

      await userRef.set(
        {
          emailVerified: true,
          emailVerifiedAt: admin.firestore.Timestamp.now(),
          emailVerificationToken: admin.firestore.FieldValue.delete(),
          emailVerificationTokenExpiresAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );

      return res.status(200).send({ success: true });
    } catch (error) {
      console.error('Error completing email verification:', error);
      return res.status(500).send({
        error: error.message || 'Failed to complete verification.',
      });
    }
  });
};

module.exports = {
  completeEmailVerification,
};
