const crypto = require('crypto');
const admin = require('firebase-admin');

// Constants
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days as per Issue #587
const TWO_MINUTES_MS = 2 * 60 * 1000; // 2 minutes for ephemeral token

/**
 * Helper function to parse boolean values from metadata
 * @param {*} val - Value to check
 * @return {boolean} True if value is truthy boolean
 */
const isTrue = (val) => val === true || val === 'true';

/**
 * Determine magic link purpose based on metadata
 * Magic link generated for campaigns with Gift Aid enabled (not based on donor opt-in)
 * @param {object} metadata - Payment intent metadata
 * @return {string|null} Purpose or null if no magic link needed
 */
const determinePurpose = (metadata) => {
  // Campaign has Gift Aid enabled (NOT whether donor opted in)
  const campaignHasGiftAid = isTrue(metadata.giftAidEnabled);

  // Donor expressed interest in recurring donations
  // Check both 'recurringInterest' (future) and 'isRecurring' (current implementation)
  const recurringInterest = isTrue(metadata.recurringInterest) || isTrue(metadata.isRecurring);

  // ALWAYS generate magic link for Gift Aid campaigns (shown on Thank You screen)
  if (campaignHasGiftAid && recurringInterest) {
    return 'gift_aid_and_recurring';
  } else if (campaignHasGiftAid) {
    return 'gift_aid';
  } else if (recurringInterest) {
    return 'recurring';
  }

  // No magic link needed (no Gift Aid and no recurring interest)
  return null;
};

/**
 * Generate magic link token atomically using a single Firestore transaction
 * Ensures full idempotency - no duplicate tokens or consent events on webhook retries
 *
 * @param {object} params - Token generation parameters
 * @param {string} params.paymentIntentId - Stripe payment intent ID
 * @param {string} params.donationId - Donation document ID
 * @param {string} params.campaignId - Campaign ID
 * @param {string} params.charityId - Organization/charity ID
 * @param {string} params.kioskId - Kiosk ID
 * @param {number} params.amount - Amount in pence
 * @param {string} params.currency - Currency code (e.g., 'gbp')
 * @param {string} params.purpose - Token purpose
 * @param {string|null} params.donorEmail - Donor email if known
 * @return {Promise<object>} Token generation result
 */
const generateMagicLinkToken = async ({
  paymentIntentId,
  donationId,
  campaignId,
  charityId,
  kioskId,
  amount,
  currency,
  purpose,
  donorEmail = null,
}) => {
  const db = admin.firestore();

  console.log('🔵 [Magic Link] Generation started', {
    paymentIntentId,
    donationId,
    purpose,
    campaignId,
    charityId,
    kioskId,
  });

  // Validate purpose is not null
  if (!purpose) {
    console.warn('⚠️ [Magic Link] Generation skipped: purpose is null', {
      paymentIntentId,
      donationId,
    });
    return {
      id: paymentIntentId,
      skipped: true,
      reason: 'purpose_is_null',
    };
  }

  // References - Check idempotency FIRST using paymentIntentId
  // We use a separate collection for idempotency to keep magicLinkTokens clean
  const idempotencyRef = db.collection('magicLinkTokenByPaymentIntent').doc(paymentIntentId);

  console.log('🔵 [Magic Link] Starting transaction', { paymentIntentId });

  // Execute SINGLE TRANSACTION for full atomicity and idempotency
  try {
    const result = await db.runTransaction(async (transaction) => {
      console.log('🔵 [Magic Link] Transaction: Checking idempotency', {
        paymentIntentId,
      });

      // 1. CHECK IDEMPOTENCY using paymentIntentId (stable key)
      const existingIdempotency = await transaction.get(idempotencyRef);

      if (existingIdempotency.exists) {
        const existingData = existingIdempotency.data();
        console.log('✅ [Magic Link] Token already exists (idempotent)', {
          paymentIntentId,
          donationId,
          purpose,
          tokenHash: existingData.tokenHash,
        });
        return {
          id: existingData.tokenHash,
          paymentIntentId: paymentIntentId,
          alreadyExists: true,
        };
      }

      console.log("🔵 [Magic Link] Transaction: Token doesn't exist, generating new token", {
        paymentIntentId,
      });

      // 2. GENERATE TOKEN (only if doesn't exist - no wasted tokens)
      const plainToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

      console.log('🔵 [Magic Link] Transaction: Token generated and hashed', {
        paymentIntentId,
        tokenHash,
        tokenLength: plainToken.length,
        hashLength: tokenHash.length,
      });

      // 3. SET EXPIRY
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + THIRTY_DAYS_MS);
      const ephemeralExpiresAt = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + TWO_MINUTES_MS,
      );

      console.log('🔵 [Magic Link] Transaction: Expiry set', {
        paymentIntentId,
        tokenHash,
        expiresAt: expiresAt.toDate().toISOString(),
        ephemeralExpiresAt: ephemeralExpiresAt.toDate().toISOString(),
      });

      // 4. CREATE REFERENCES
      const tokenRef = db.collection('magicLinkTokens').doc(tokenHash);
      const ephemeralRef = db.collection('magicLinkEphemeral').doc(paymentIntentId);
      const donationRef = db.collection('donations').doc(donationId);
      const consentRef = donationRef.collection('ConsentEvents').doc();

      console.log('🔵 [Magic Link] Transaction: Writing 5 documents atomically', {
        paymentIntentId,
        tokenHash,
        idempotencyDocId: paymentIntentId,
        tokenDocId: tokenHash,
        ephemeralDocId: paymentIntentId,
        consentEventId: consentRef.id,
        donationId,
      });

      // 5. ATOMIC WRITES - ALL IN ONE TRANSACTION

      // 5a. Create idempotency pointer (separate collection for clean schema)
      transaction.set(idempotencyRef, {
        tokenHash: tokenHash,
        transactionId: paymentIntentId,
        paymentIntentId: paymentIntentId,
        donationId: donationId,
        purpose: purpose,
        createdAt: now,
      });

      // 5b. Create secure token document (keyed by tokenHash for O(1) lookup)
      transaction.set(tokenRef, {
        tokenHash: tokenHash,
        transactionId: paymentIntentId,
        paymentIntentId: paymentIntentId,
        donationId: donationId,
        amount: amount,
        campaignId: campaignId,
        charityId: charityId,
        kioskId: kioskId,
        currency: currency,
        purpose: purpose,
        status: 'active', // Token is ready to use
        createdAt: now,
        expiresAt: expiresAt,
        completedAt: null,
        donorEmail: donorEmail,
        validationAttempts: 0,
        blocked: false,
        lastAttemptAt: null,
        lastAttemptIp: null,
      });

      // 5c. Create ephemeral document (public, time-restricted)
      transaction.set(ephemeralRef, {
        plainToken: plainToken,
        expiresAt: ephemeralExpiresAt,
        createdAt: now,
      });

      // 5d. Create consent event (implicit consent from kiosk T&Cs)
      transaction.set(consentRef, {
        id: consentRef.id,
        type: 'implicit',
        captureMethod: 'contactless_kiosk',
        kioskId: kioskId,
        gdprAccepted: true,
        consentTextVersion: 'v1.0',
        timestamp: now,
        giftAidDeclared: false,
        ipAddress: null,
        userAgent: 'kiosk',
      });

      // 5e. Update donation document (merge to prevent failure if doesn't exist)
      transaction.set(
        donationRef,
        {
          magicLinkTokenId: tokenHash, // Store tokenHash instead of paymentIntentId
          magicLinkPurpose: purpose,
          magicLinkExpiresAt: expiresAt,
          hasConsentEvents: true,
        },
        { merge: true },
      );

      // 6. RETURN RESULT (transaction will commit all writes atomically)
      console.log('✅ [Magic Link] Transaction: All writes prepared, committing', {
        paymentIntentId,
        tokenHash,
        donationId,
        purpose,
      });

      // Note: Plain token is returned here but NEVER stored in database or logged
      return {
        id: tokenHash, // Return tokenHash as the ID
        paymentIntentId: paymentIntentId,
        plainToken: plainToken,
        donationId: donationId,
        purpose: purpose,
        expiresAt: expiresAt,
        alreadyExists: false,
      };
    });

    console.log('✅ [Magic Link] Token created successfully', {
      tokenHash: result.id,
      paymentIntentId: result.paymentIntentId,
      donationId: result.donationId,
      purpose: result.purpose,
      expiresAt: result.expiresAt?.toDate().toISOString(),
      alreadyExists: result.alreadyExists,
    });

    return result;
  } catch (error) {
    console.error('❌ [Magic Link] Failed to create token', {
      paymentIntentId,
      donationId,
      purpose,
      error: error.message,
      errorStack: error.stack,
    });
    throw new Error('Token generation failed');
  }
};

module.exports = {
  generateMagicLinkToken,
  determinePurpose,
};
