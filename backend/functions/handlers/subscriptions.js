const admin = require('firebase-admin');
const { ensureStripeInitialized } = require('../services/stripe');
const cors = require('../middleware/cors');
const { createSubscriptionDoc } = require('../entities/subscription');
const { createDonationDoc } = require('../entities/donation');
const { resolveLocationForDonation } = require('../shared/location');
const DEFAULT_GIFT_AID_DECLARATION_TEXT =
  'I want to Gift Aid my donation and any donations I make in the future or have made in the past four years to this charity. I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.';

const toBoolean = (value) => value === true || value === 'true' || value === '1';

const toStringOrNull = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeEmail = (value) => {
  const email = toStringOrNull(value);
  return email ? email.toLowerCase() : null;
};

const getTaxYear = (dateValue) => {
  // Handle Firestore Timestamp objects (duck-type on .toDate())
  const resolved =
    typeof dateValue === 'object' && typeof dateValue.toDate === 'function'
      ? dateValue.toDate()
      : new Date(dateValue);
  if (Number.isNaN(resolved.getTime())) return null;
  const year = resolved.getUTCFullYear();
  const month = resolved.getUTCMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
};

const writeGiftAidReconciliationIssue = async ({
  paymentIntentId,
  declarationId,
  organizationId,
  reason,
  metadata,
}) => {
  await admin
    .firestore()
    .collection('giftAidReconciliationIssues')
    .add({
      paymentIntentId: paymentIntentId || null,
      declarationId: declarationId || null,
      organizationId: organizationId || null,
      reason,
      metadata: metadata || {},
      resolved: false,
      createdAt: admin.firestore.Timestamp.now(),
    });
};

const createGiftAidDeclarationFromMetadata = async ({
  donationId,
  amountMinor,
  metadata = {},
  campaignId,
  campaignTitle,
  organizationId,
  donationDateIso,
}) => {
  // Strict Guard: Only process if isGiftAid is explicitly true
  const isGiftAid = toBoolean(metadata.isGiftAid);
  if (!isGiftAid) {
    return; // Exit immediately - not a Gift Aid donation
  }

  // Consent Validation: Verify required consent fields are present
  const giftAidConsent = toBoolean(metadata.giftAidConsent);
  const ukTaxpayerConfirmation = toBoolean(metadata.giftAidTaxpayer);

  if (!giftAidConsent || !ukTaxpayerConfirmation) {
    console.warn('[Gift Aid Recurring] Skipping declaration: missing required consent', {
      donationId,
      campaignId: campaignId || 'unknown',
      // Raw metadata values (for debugging string vs boolean issues)
      raw: {
        isGiftAid: metadata.isGiftAid,
        giftAidConsent: metadata.giftAidConsent,
        giftAidTaxpayer: metadata.giftAidTaxpayer,
      },
      // Parsed boolean values
      parsed: {
        isGiftAid,
        giftAidConsent,
        ukTaxpayerConfirmation,
      },
      // Validation failure reason
      reason: !giftAidConsent ? 'missing_gift_aid_consent' : 'missing_uk_taxpayer_confirmation',
    });
    return; // Exit immediately - consent not provided
  }

  const declarationId =
    toStringOrNull(metadata.giftAidDeclarationId) || toStringOrNull(metadata.declarationId);
  const now = admin.firestore.Timestamp.now();
  const donorTitle = toStringOrNull(metadata.giftAidTitle);

  if (declarationId) {
    const declarationRef = admin.firestore().collection('giftAidDeclarations').doc(declarationId);
    const declarationSnap = await declarationRef.get();

    if (declarationSnap.exists) {
      const existingDonationId = toStringOrNull(declarationSnap.data()?.donationId);
      if (existingDonationId && existingDonationId !== donationId) {
        // Track conflict in reconciliation issues (matches one-time behavior)
        await writeGiftAidReconciliationIssue({
          paymentIntentId: donationId,
          declarationId,
          organizationId: organizationId || null,
          reason: 'declaration_already_linked_to_other_donation',
          metadata: {
            existingDonationId,
            incomingDonationId: donationId,
            source: 'recurring_subscription',
          },
        });
        console.error('[Gift Aid Recurring] Declaration already linked to different donation:', {
          declarationId,
          existingDonationId,
          incomingDonationId: donationId,
          campaignId: campaignId || 'unknown',
        });
        // Note: We return instead of throw to avoid breaking subscription flow,
        // but we DO track the issue for visibility (deliberate divergence from one-time path)
        return;
      }

      await declarationRef.set(
        {
          ...(donorTitle ? { donorTitle } : {}),
          donationId,
          donationAmount: amountMinor,
          giftAidAmount: Math.round(amountMinor * 0.25),
          campaignId: campaignId || null,
          campaignTitle: campaignTitle || 'Recurring Donation',
          organizationId: organizationId || null,
          giftAidStatus: 'active',
          hmrcClaimStatus: 'pending',
          operationalStatus: 'captured',
          donorEmail: toStringOrNull(metadata.donorEmail) || null,
          donorEmailNormalized: normalizeEmail(metadata.donorEmail),
          updatedAt: now,
        },
        { merge: true },
      );
      return;
    }
  }

  const ref = admin.firestore().collection('giftAidDeclarations').doc(donationId);
  const existing = await ref.get();
  if (existing.exists) return;

  const donorName = toStringOrNull(metadata.donorName) || 'Anonymous Donor';
  const parsed = donorName.split(' ').filter(Boolean);
  const fallbackFirst = parsed[0] || 'Anonymous';
  const fallbackLast = parsed.slice(1).join(' ') || 'Donor';

  // donationDateIso is always a valid ISO string (set from invoice.created * 1000).
  // giftAidDeclarationDate comes from Stripe metadata and may be absent or malformed.
  // Validate both upfront so we fail fast rather than writing a bad document.
  const donationDateObj = new Date(donationDateIso);
  if (isNaN(donationDateObj.getTime())) {
    throw new Error(`[Gift Aid Recurring] Invalid donationDateIso: "${donationDateIso}"`);
  }

  // Declare donationDateTimestamp first — declarationDateTimestamp may reference it as fallback
  const donationDateTimestamp = admin.firestore.Timestamp.fromDate(donationDateObj);

  const rawDeclarationDate = toStringOrNull(metadata.giftAidDeclarationDate);
  let declarationDateTimestamp;
  if (rawDeclarationDate) {
    const declarationDateObj = new Date(rawDeclarationDate);
    if (isNaN(declarationDateObj.getTime())) {
      // Malformed optional field — fall back to donation date, same as one-time webhook path
      console.warn(
        '[Gift Aid Recurring] Invalid giftAidDeclarationDate, falling back to donationDate:',
        rawDeclarationDate,
      );
      declarationDateTimestamp = donationDateTimestamp;
    } else {
      declarationDateTimestamp = admin.firestore.Timestamp.fromDate(declarationDateObj);
    }
  } else {
    declarationDateTimestamp = donationDateTimestamp;
  }

  await ref.set({
    id: donationId,
    donationId,
    donorTitle: donorTitle || '',
    donorFirstName: toStringOrNull(metadata.giftAidFirstName) || fallbackFirst,
    donorSurname: toStringOrNull(metadata.giftAidSurname) || fallbackLast,
    donorHouseNumber: toStringOrNull(metadata.giftAidHouseNumber) || '',
    donorAddressLine1: toStringOrNull(metadata.giftAidAddressLine1) || '',
    donorAddressLine2: toStringOrNull(metadata.giftAidAddressLine2) || '',
    donorTown: toStringOrNull(metadata.giftAidTown) || '',
    donorPostcode: toStringOrNull(metadata.giftAidPostcode) || '',
    donorEmail: toStringOrNull(metadata.donorEmail) || null,
    donorEmailNormalized: normalizeEmail(metadata.donorEmail),
    declarationText:
      toStringOrNull(metadata.giftAidDeclarationText) || DEFAULT_GIFT_AID_DECLARATION_TEXT,
    declarationTextVersion:
      toStringOrNull(metadata.giftAidDeclarationTextVersion) || 'hmrc-ch3-2026-03',
    declarationDate: declarationDateTimestamp,
    giftAidConsent: toBoolean(metadata.giftAidConsent),
    ukTaxpayerConfirmation: toBoolean(metadata.giftAidTaxpayer),
    dataProcessingConsent: toBoolean(metadata.giftAidDataProcessingConsent),
    homeAddressConfirmed: toBoolean(metadata.giftAidHomeAddressConfirmed),
    donationAmount: amountMinor,
    giftAidAmount: Math.round(amountMinor * 0.25),
    campaignId: campaignId || null,
    campaignTitle: campaignTitle || 'Recurring Donation',
    organizationId: organizationId || null,
    donationDate: donationDateTimestamp,
    taxYear: toStringOrNull(metadata.giftAidTaxYear) || getTaxYear(donationDateIso) || 'unknown',
    giftAidStatus: 'pending',
    hmrcClaimStatus: 'pending',
    operationalStatus: 'captured',
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * Create recurring subscription
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createRecurringSubscription = (req, res) => {
  cors(req, res, async () => {
    try {
      const stripeClient = ensureStripeInitialized();

      const {
        amount,
        interval, // 'month', 'year'
        intervalCount = 1,
        campaignId,
        donor,
        paymentMethodId,
        cancelReason,
        metadata = {},
      } = req.body;

      console.log('createRecurringSubscription called with:', {
        amount,
        interval,
        intervalCount,
        campaignId,
        donorEmail: donor?.email,
        paymentMethodId: paymentMethodId ? 'provided' : 'missing',
      });

      // Validation
      if (!amount || !interval || !campaignId || !donor?.email) {
        console.error('Validation failed:', {
          amount,
          interval,
          campaignId,
          donorEmail: donor?.email,
        });
        return res.status(400).send({
          error: 'Missing required fields: amount, interval, campaignId, donor.email',
        });
      }

      if (!['month', 'year'].includes(interval)) {
        console.error('Invalid interval:', interval);
        return res.status(400).send({
          error: "Invalid interval. Must be 'month' or 'year'",
        });
      }

      const normalizedIntervalCount = Number(intervalCount);
      if (
        !Number.isInteger(normalizedIntervalCount) ||
        normalizedIntervalCount < 1 ||
        (interval === 'year' && normalizedIntervalCount !== 1) ||
        (interval === 'month' && ![1, 3].includes(normalizedIntervalCount))
      ) {
        console.error('Invalid intervalCount:', intervalCount);
        return res.status(400).send({
          error: 'Invalid intervalCount for the selected interval',
        });
      }

      if (!paymentMethodId) {
        console.error('Missing paymentMethodId');
        return res.status(400).send({
          error: 'Missing paymentMethodId',
        });
      }

      // Get campaign and organization
      const campaignSnap = await admin.firestore().collection('campaigns').doc(campaignId).get();

      if (!campaignSnap.exists) {
        return res.status(404).send({ error: 'Campaign not found' });
      }

      const campaignData = campaignSnap.data();
      const orgId = campaignData.organizationId;

      // Resolve location — strict for kiosk subscriptions, null for web
      const subscriptionKioskId = toStringOrNull(metadata.kioskId);
      let subscriptionLocationId = null;
      let subscriptionLocationSnapshot = null;
      if (subscriptionKioskId) {
        const kioskSnap = await admin
          .firestore()
          .collection('kiosks')
          .doc(subscriptionKioskId)
          .get();
        const kioskLocationId = kioskSnap.exists
          ? toStringOrNull(kioskSnap.data().location_id)
          : null;
        const resolved = await resolveLocationForDonation(
          kioskLocationId,
          subscriptionKioskId,
          `subscription:${campaignId}`,
        );
        subscriptionLocationId = resolved.location_id;
        subscriptionLocationSnapshot = resolved.location_snapshot;
      }

      const orgSnap = await admin.firestore().collection('organizations').doc(orgId).get();
      if (!orgSnap.exists) {
        return res.status(404).send({ error: 'Organization not found' });
      }

      const stripeAccountId = orgSnap.data().stripe?.accountId;
      if (!stripeAccountId) {
        return res.status(400).send({
          error: 'Organization not onboarded with Stripe',
        });
      }

      // Get organization currency or default to usd
      const orgData = orgSnap.data();
      const currency = (orgData.currency || 'usd').toLowerCase();

      console.log('Organization data:', {
        orgId,
        currency,
        stripeAccountId,
      });

      // Create a NEW customer for this subscription to avoid currency conflicts
      // (Stripe doesn't allow mixing currencies on the same customer)
      const customer = await stripeClient.customers.create({
        email: donor.email,
        name: donor.name || 'Anonymous',
        phone: donor.phone || undefined,
        metadata: {
          campaignId,
          organizationId: orgId,
          platform: metadata.platform || 'web',
        },
      });

      console.log('Customer created:', customer.id);

      // Attach payment method to customer
      await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      await stripeClient.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Create price with inline product (per-subscription strategy)
      const price = await stripeClient.prices.create({
        unit_amount: amount,
        currency: currency,
        recurring: {
          interval,
          interval_count: normalizedIntervalCount,
        },
        product_data: {
          name: `Recurring donation to ${campaignData.title}`,
          metadata: {
            campaignId,
            organizationId: orgId,
          },
        },
      });

      // Create subscription
      const subscription = await stripeClient.subscriptions.create({
        customer: customer.id,
        items: [{ price: price.id }],
        default_payment_method: paymentMethodId,
        collection_method: 'charge_automatically',
        expand: ['latest_invoice.payment_intent'],
        transfer_data: { destination: stripeAccountId },
        metadata: {
          campaignId,
          organizationId: orgId,
          donorEmail: donor.email,
          donorName: donor.name || 'Anonymous',
          platform: metadata.platform || 'web',
          ...metadata,
        },
      });

      console.log('Subscription created:', {
        id: subscription.id,
        status: subscription.status,
        customer: customer.id,
      });

      // Save to Firestore
      await createSubscriptionDoc({
        stripeSubscriptionId: subscription.id,
        customerId: customer.id,
        campaignId,
        organizationId: orgId,
        interval,
        intervalCount: normalizedIntervalCount,
        amount,
        currency: currency,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        startedAt: subscription.start_date || subscription.current_period_start || null,
        nextPaymentAt: subscription.current_period_end || null,
        cancelReason: cancelReason || null,
        metadata: {
          donorEmail: donor.email,
          donorName: donor.name || 'Anonymous',
          donorPhone: donor.phone || null,
          campaignTitle: campaignData.title,
          platform: metadata.platform || 'web',
          ...metadata,
        },
      });

      // Handle first invoice
      const latestInvoice = subscription.latest_invoice;
      const recurringInterval =
        interval === 'year' ? 'yearly' : normalizedIntervalCount === 3 ? 'quarterly' : 'monthly';

      console.log('Latest invoice details:', {
        exists: !!latestInvoice,
        status: latestInvoice?.status,
        hasPaymentIntent: !!latestInvoice?.payment_intent,
        invoiceId: latestInvoice?.id,
      });

      if (latestInvoice?.payment_intent) {
        const paymentIntent = latestInvoice.payment_intent;
        // Safety net: if first recurring payment is already successful, persist donation immediately.
        if (paymentIntent.status === 'succeeded') {
          const donationId = paymentIntent.id || latestInvoice.id || subscription.id;
          await createDonationDoc({
            transactionId: donationId,
            campaignId,
            organizationId: orgId,
            amount: latestInvoice.amount_paid || amount,
            currency,
            donorEmail: donor.email || null,
            donorName: donor.name || 'Anonymous',
            donorPhone: donor.phone || null,
            isGiftAid: toBoolean(metadata.isGiftAid),
            isRecurring: true,
            recurringInterval,
            subscriptionId: subscription.id,
            invoiceId: latestInvoice.id || null,
            platform: metadata.platform || 'web',
            location_id: subscriptionLocationId,
            location_snapshot: subscriptionLocationSnapshot,
            metadata: {
              campaignTitleSnapshot: campaignData.title || 'Recurring Donation',
              source: 'create_recurring_subscription',
            },
          });

          await createGiftAidDeclarationFromMetadata({
            donationId,
            amountMinor: latestInvoice.amount_paid || amount,
            metadata,
            campaignId,
            campaignTitle: campaignData.title || 'Recurring Donation',
            organizationId: orgId,
            donationDateIso: new Date(
              (latestInvoice.created || Math.floor(Date.now() / 1000)) * 1000,
            ).toISOString(),
          });
        }

        return res.status(200).send({
          subscriptionId: subscription.id,
          customerId: customer.id,
          invoiceId: latestInvoice.id || null,
          paymentIntentId: paymentIntent.id || null,
          clientSecret: paymentIntent.client_secret,
          status: subscription.status,
          requiresAction: paymentIntent.status === 'requires_action',
        });
      } else if (latestInvoice?.status === 'paid') {
        const donationId = latestInvoice.payment_intent?.id || latestInvoice.id || subscription.id;
        await createDonationDoc({
          transactionId: donationId,
          campaignId,
          organizationId: orgId,
          amount: latestInvoice.amount_paid || amount,
          currency,
          donorEmail: donor.email || null,
          donorName: donor.name || 'Anonymous',
          donorPhone: donor.phone || null,
          isGiftAid: toBoolean(metadata.isGiftAid),
          isRecurring: true,
          recurringInterval,
          subscriptionId: subscription.id,
          invoiceId: latestInvoice.id || null,
          platform: metadata.platform || 'web',
          location_id: subscriptionLocationId,
          location_snapshot: subscriptionLocationSnapshot,
          metadata: {
            campaignTitleSnapshot: campaignData.title || 'Recurring Donation',
            source: 'create_recurring_subscription',
          },
        });

        await createGiftAidDeclarationFromMetadata({
          donationId,
          amountMinor: latestInvoice.amount_paid || amount,
          metadata,
          campaignId,
          campaignTitle: campaignData.title || 'Recurring Donation',
          organizationId: orgId,
          donationDateIso: new Date(
            (latestInvoice.created || Math.floor(Date.now() / 1000)) * 1000,
          ).toISOString(),
        });

        return res.status(200).send({
          success: true,
          subscriptionId: subscription.id,
          customerId: customer.id,
          invoiceId: latestInvoice.id || null,
          paymentIntentId: latestInvoice.payment_intent?.id || null,
          message: 'Subscription created and first payment completed',
          status: subscription.status,
        });
      }

      return res.status(200).send({
        subscriptionId: subscription.id,
        customerId: customer.id,
        status: subscription.status,
      });
    } catch (error) {
      console.error('Error creating recurring subscription:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
      });
      return res.status(500).send({ error: error.message });
    }
  });
};

/**
 * Cancel recurring subscription
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const cancelRecurringSubscription = (req, res) => {
  cors(req, res, async () => {
    try {
      const stripeClient = ensureStripeInitialized();

      const { subscriptionId, cancelImmediately = false, cancelReason = null } = req.body;

      if (!subscriptionId) {
        return res.status(400).send({
          error: 'Missing subscriptionId',
        });
      }

      // Get subscription from Firestore
      const subscriptionDoc = await admin
        .firestore()
        .collection('subscriptions')
        .doc(subscriptionId)
        .get();

      if (!subscriptionDoc.exists) {
        return res.status(404).send({ error: 'Subscription not found' });
      }

      const subscriptionData = subscriptionDoc.data();

      // Cancel in Stripe
      const canceledSubscription = await stripeClient.subscriptions.cancel(
        subscriptionData.stripeSubscriptionId,
        {
          prorate: !cancelImmediately,
          invoice_now: cancelImmediately,
        },
      );

      // Update in Firestore with cancel reason
      await admin
        .firestore()
        .collection('subscriptions')
        .doc(subscriptionId)
        .update({
          status: 'canceled',
          canceledAt: admin.firestore.Timestamp.now(),
          cancelReason: cancelReason || null,
          cancelReason: cancelReason || null,
          updatedAt: admin.firestore.Timestamp.now(),
        });

      console.log('Subscription canceled:', subscriptionId);

      return res.status(200).send({
        success: true,
        message: 'Subscription canceled successfully',
        subscription: {
          id: canceledSubscription.id,
          status: canceledSubscription.status,
          canceledAt: canceledSubscription.canceled_at,
        },
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return res.status(500).send({ error: error.message });
    }
  });
};

/**
 * Update subscription payment method
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updateSubscriptionPaymentMethod = (req, res) => {
  cors(req, res, async () => {
    try {
      const stripeClient = ensureStripeInitialized();

      const { subscriptionId, paymentMethodId } = req.body;

      if (!subscriptionId || !paymentMethodId) {
        return res.status(400).send({
          error: 'Missing subscriptionId or paymentMethodId',
        });
      }

      // Get subscription from Firestore
      const subscriptionDoc = await admin
        .firestore()
        .collection('subscriptions')
        .doc(subscriptionId)
        .get();

      if (!subscriptionDoc.exists) {
        return res.status(404).send({ error: 'Subscription not found' });
      }

      const subscriptionData = subscriptionDoc.data();

      // Attach new payment method to customer
      await stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: subscriptionData.customerId,
      });

      // Update customer's default payment method
      await stripeClient.customers.update(subscriptionData.customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // Update subscription's default payment method
      await stripeClient.subscriptions.update(subscriptionData.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });

      console.log('Payment method updated for subscription:', subscriptionId);

      return res.status(200).send({
        success: true,
        message: 'Payment method updated successfully',
      });
    } catch (error) {
      console.error('Error updating payment method:', error);
      return res.status(500).send({ error: error.message });
    }
  });
};

module.exports = {
  createRecurringSubscription,
  cancelRecurringSubscription,
  updateSubscriptionPaymentMethod,
  // Test-only export — not part of the public API
  __createRecurringGiftAidDeclaration: createGiftAidDeclarationFromMetadata,
};
