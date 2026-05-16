const admin = require('firebase-admin');
const { stripe, ensureStripeInitialized } = require('../services/stripe');
const { verifyAuth } = require('../middleware/auth');
const cors = require('../middleware/cors');
const { resolveLocationIdFromKiosk, resolveLocationForDonation } = require('../shared/location');
const { createSubscriptionDoc } = require('../entities/subscription');

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'https://swift-cause-web.vercel.app',
  'https://swiftcause--swiftcause-app.us-east4.hosted.app',
  'https://swiftcause--swiftcause-prod.europe-west4.hosted.app',
  'https://swiftcause.com',
]);

const logOnboardingLinkAccess = (level, payload) => {
  const logPayload = {
    action_type: 'create_onboarding_link',
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (level === 'warn') {
    console.warn('Stripe onboarding link access denied', logPayload);
    return;
  }

  console.info('Stripe onboarding link privileged access', logPayload);
};

const normalizeStripeMetadata = (metadata = {}) =>
  Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (typeof value === 'string') return [key, value];
        if (typeof value === 'number' || typeof value === 'boolean') return [key, String(value)];
        return [key, JSON.stringify(value)];
      }),
  );

/**
 * Create Stripe onboarding link for organization
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createOnboardingLink = (req, res) => {
  cors(req, res, async () => {
    try {
      // Ensure Stripe is initialized
      const stripeClient = ensureStripeInitialized();

      // Verify authentication
      const auth = await verifyAuth(req);

      const requestedOrgId = typeof req.body?.orgId === 'string' ? req.body.orgId.trim() : '';
      if (!requestedOrgId) {
        return res.status(400).send({ error: 'Missing orgId' });
      }

      const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();

      if (!callerDoc.exists) {
        logOnboardingLinkAccess('warn', {
          actor_uid: auth.uid,
          requested_org_id: requestedOrgId,
          denial_reason: 'caller_profile_not_found',
        });
        return res.status(403).send({ error: 'Caller is not a valid user' });
      }

      const callerData = callerDoc.data() || {};
      const callerRole = typeof callerData.role === 'string' ? callerData.role : '';
      const callerOrgId =
        typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';
      const callerPermissions = Array.isArray(callerData.permissions) ? callerData.permissions : [];
      const isPrivilegedCaller =
        callerRole === 'super_admin' || callerPermissions.includes('system_admin');

      if (!isPrivilegedCaller && callerOrgId !== requestedOrgId) {
        logOnboardingLinkAccess('warn', {
          actor_uid: auth.uid,
          requested_org_id: requestedOrgId,
          caller_org_id: callerOrgId || null,
          caller_role: callerRole || null,
          denial_reason: 'cross_organization_access_denied',
        });
        return res.status(403).send({
          error: 'You can only create onboarding links for your organization',
        });
      }

      if (isPrivilegedCaller) {
        logOnboardingLinkAccess('info', {
          actor_uid: auth.uid,
          requested_org_id: requestedOrgId,
          caller_org_id: callerOrgId || null,
          caller_role: callerRole || null,
          privileged_override: callerOrgId !== requestedOrgId,
        });
      }

      const orgDoc = await admin.firestore().collection('organizations').doc(requestedOrgId).get();
      if (!orgDoc.exists) {
        return res.status(404).send({ error: 'Organization not found' });
      }

      const data = orgDoc.data();
      if (!data.stripe || !data.stripe.accountId) {
        return res.status(404).send({ error: 'Stripe account not found' });
      }

      const accountId = data.stripe.accountId;

      const baseUrl = req.get('origin');

      if (!baseUrl || !ALLOWED_ORIGINS.has(baseUrl)) {
        return res.status(400).send({ error: 'Invalid origin' });
      }

      const accountLink = await stripeClient.accountLinks.create({
        account: accountId,
        type: 'account_onboarding',
        refresh_url: `${baseUrl}/admin`,
        return_url: `${baseUrl}/admin`,
      });

      return res.status(200).send({ url: accountLink.url });
    } catch (error) {
      console.error('Error creating onboarding link:', error);
      return res.status(500).send({ error: error.message });
    }
  });
};

/**
 * Create payment intent for kiosk donations
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createKioskPaymentIntent = (req, res) => {
  cors(req, res, async () => {
    try {
      // Ensure Stripe is initialized
      const stripeClient = ensureStripeInitialized();

      const {
        amount,
        currency = 'usd',
        metadata,
        frequency,
        intervalCount = 1,
        donor,
        paymentMethodId,
        setupIntentId,
        customerId,
      } = req.body;

      console.log('[Payment] Incoming createKioskPaymentIntent request', {
        campaignId: metadata?.campaignId || null,
        frequency: frequency || null,
        intervalCount: intervalCount ?? null,
        hasDonorEmail: Boolean(donor?.email),
        hasPaymentMethodId: Boolean(paymentMethodId),
        hasSetupIntentId: Boolean(setupIntentId),
        hasCustomerId: Boolean(customerId),
      });

      if (!amount || !currency || !metadata || !metadata.campaignId) {
        return res.status(400).send({ error: 'Missing amount, currency, or campaignId' });
      }

      const campaignId = String(metadata.campaignId).trim();

      // Get campaign/org details
      const campaignSnap = await admin.firestore().collection('campaigns').doc(campaignId).get();
      if (!campaignSnap.exists) {
        return res.status(404).send({ error: 'Campaign not found' });
      }
      const campaignData = campaignSnap.data();
      const orgId = campaignData.organizationId;

      // Validate location before creating the Stripe payment intent.
      // A kiosk donation without a valid location cannot be recorded after payment,
      // so we fail here rather than producing a paid-but-unrecordable donation.
      const kioskId = typeof metadata.kioskId === 'string' ? metadata.kioskId.trim() : null;
      let kioskLocationId = null;
      if (kioskId) {
        console.log(
          `[Payment] Validating location for kiosk: ${kioskId} (campaign: ${campaignId})`,
        );
        // Both helpers throw if kiosk/location is missing or fields are incomplete
        kioskLocationId = await resolveLocationIdFromKiosk(kioskId, `payment:${campaignId}`);
        await resolveLocationForDonation(kioskLocationId, kioskId, `payment:${campaignId}`);
        console.log(`[Payment] Location validated: ${kioskLocationId} (kiosk: ${kioskId})`);
      }

      const canonicalMetadata = {
        ...metadata,
        campaignId,
        campaignTitle: campaignData.title || metadata.campaignTitle || null,
        organizationId: orgId || metadata.organizationId || null,
        // Keep both keys to support mixed webhook consumers and old/new clients.
        isGiftAid: metadata.isGiftAid,
        giftAidEnabled: metadata.giftAidEnabled ?? metadata.isGiftAid,
        // Location reference — read by webhook to build location_snapshot on donation
        location_id: kioskLocationId,
      };
      const stripeCanonicalMetadata = normalizeStripeMetadata(canonicalMetadata);

      const orgSnap = await admin.firestore().collection('organizations').doc(orgId).get();
      if (!orgSnap.exists) {
        return res.status(404).send({ error: 'Org not found' });
      }

      const stripeAccountId = orgSnap.data().stripe?.accountId;
      if (!stripeAccountId) {
        return res.status(400).send({ error: 'Org not onboarded with Stripe' });
      }

      // Resolve or create a Stripe customer for donation/subscription tracking.
      // Recurring setup + finalize calls must share the same customer.
      let customer = null;
      if (customerId) {
        customer = await stripeClient.customers.retrieve(customerId);
        if (!customer || customer.deleted) {
          return res.status(400).send({ error: 'Invalid customerId' });
        }
      } else {
        // Create a Customer for tracking donations and supporting recurring payments
        // Note: Link will appear if customer has an email, but that's okay for kiosk use
        customer = await stripeClient.customers.create({
          email: donor?.email || undefined,
          name: donor?.name || undefined,
          metadata: stripeCanonicalMetadata,
        });
      }

      let clientSecret;

      if (!frequency || frequency === 'once') {
        // One-time donation
        // Support both card (manual entry via PaymentSheet) and card_present (Tap to Pay)
        const paymentIntent = await stripeClient.paymentIntents.create({
          amount,
          currency,
          customer: customer.id,
          payment_method_types: ['card', 'card_present'],
          payment_method_options: {
            card: {
              request_three_d_secure: 'automatic',
            },
          },
          transfer_data: { destination: stripeAccountId },
          metadata: normalizeStripeMetadata({
            ...canonicalMetadata,
            platform: 'kiosk',
            frequency: 'once',
          }),
        });
        clientSecret = paymentIntent.client_secret;
      } else {
        // Recurring donation (subscription)
        console.log('[Payment] Entering recurring branch', {
          frequency,
          intervalCount,
          hasPaymentMethodId: Boolean(paymentMethodId),
          hasSetupIntentId: Boolean(setupIntentId),
        });

        if (!donor?.email) {
          return res.status(400).send({ error: 'Missing donor.email for recurring donation' });
        }

        const normalizedIntervalCount = Number(intervalCount);
        if (
          !Number.isInteger(normalizedIntervalCount) ||
          normalizedIntervalCount < 1 ||
          (frequency === 'year' && normalizedIntervalCount !== 1) ||
          (frequency === 'month' && ![1, 3].includes(normalizedIntervalCount))
        ) {
          return res.status(400).send({ error: 'Invalid intervalCount for frequency' });
        }

        let resolvedPaymentMethodId = paymentMethodId;

        // Two-step recurring flow support:
        // 1) First call (no paymentMethodId/setupIntentId): return SetupIntent client secret
        // 2) Second call (setupIntentId provided): resolve payment_method from SetupIntent
        if (!resolvedPaymentMethodId && !setupIntentId) {
          console.log('[Payment] Recurring bootstrap: creating SetupIntent', {
            customerId: customer.id,
            frequency,
            normalizedIntervalCount,
          });

          const setupIntent = await stripeClient.setupIntents.create({
            customer: customer.id,
            payment_method_types: ['card'],
            usage: 'off_session',
            metadata: normalizeStripeMetadata({
              ...canonicalMetadata,
              platform: 'kiosk',
              flow: 'recurring_setup',
              frequency,
              intervalCount: String(normalizedIntervalCount),
            }),
          });

          return res.status(200).send({
            setupIntentClientSecret: setupIntent.client_secret,
            customerId: customer.id,
          });
        }

        if (!resolvedPaymentMethodId && setupIntentId) {
          console.log('[Payment] Recurring finalize: resolving payment method from SetupIntent', {
            setupIntentId,
            customerId: customer.id,
          });

          const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId, {
            expand: ['payment_method'],
          });

          if (!setupIntent || !setupIntent.customer || setupIntent.customer !== customer.id) {
            return res.status(400).send({ error: 'Invalid setupIntentId for customer' });
          }

          if (setupIntent.status !== 'succeeded') {
            return res.status(400).send({
              error: `SetupIntent status: ${setupIntent.status}`,
              setupIntentId,
            });
          }

          resolvedPaymentMethodId =
            typeof setupIntent.payment_method === 'string'
              ? setupIntent.payment_method
              : setupIntent.payment_method?.id;
        }

        if (!resolvedPaymentMethodId) {
          console.error('Missing payment method for recurring donation finalization');
          return res.status(400).send({
            error: 'Missing paymentMethodId for recurring donation; use PaymentSheet setup first',
          });
        }

        // Create price for subscription
        const price = await stripeClient.prices.create({
          unit_amount: amount,
          currency,
          recurring: { interval: frequency, interval_count: normalizedIntervalCount }, // month/year with count
          product_data: {
            name: `Recurring donation to campaign ${campaignId}`,
          },
        });

        let subscription;
        // Attach payment method to customer and set as default
        try {
          await stripeClient.paymentMethods.attach(resolvedPaymentMethodId, {
            customer: customer.id,
          });
        } catch (attachError) {
          const alreadyAttached =
            attachError?.code === 'resource_already_exists' ||
            (typeof attachError?.message === 'string' &&
              attachError.message.includes('already attached'));
          if (!alreadyAttached) {
            throw attachError;
          }
        }
        await stripeClient.customers.update(customer.id, {
          invoice_settings: { default_payment_method: resolvedPaymentMethodId },
        });

        // Create subscription using the attached payment method (web-like flow)
        subscription = await stripeClient.subscriptions.create({
          customer: customer.id,
          items: [{ price: price.id }],
          default_payment_method: resolvedPaymentMethodId,
          collection_method: 'charge_automatically',
          expand: ['latest_invoice.payment_intent'],
          trial_period_days: 0,
          transfer_data: { destination: stripeAccountId },
          metadata: normalizeStripeMetadata({
            ...canonicalMetadata,
            platform: 'kiosk',
            frequency,
            intervalCount: String(normalizedIntervalCount),
          }),
        });

        console.log('Subscription created:', {
          id: subscription.id,
          status: subscription.status,
          latest_invoice: subscription.latest_invoice,
          latest_invoice_status: subscription.latest_invoice?.status,
          payment_intent_id: subscription.latest_invoice?.payment_intent?.id,
          payment_intent_status: subscription.latest_invoice?.payment_intent?.status,
        });

        // Update invoice + payment intent metadata before heavier persistence work.
        // Stripe emits payment_intent.created at object creation time, so that event can still
        // show empty metadata; this ensures subsequent events/object reads have the canonical keys.
        let latestInvoice = subscription.latest_invoice;

        if (
          latestInvoice &&
          !latestInvoice.payment_intent &&
          latestInvoice.status === 'open' &&
          latestInvoice.id
        ) {
          console.warn(
            'Latest invoice is open without expanded payment intent; reloading invoice',
            {
              subscriptionId: subscription.id,
              invoiceId: latestInvoice.id,
            },
          );

          latestInvoice = await stripeClient.invoices.retrieve(latestInvoice.id, {
            expand: ['payment_intent'],
          });
        }

        const recurringMetadata = {
          ...canonicalMetadata,
          isRecurring: true,
          recurringInterest: true,
          frequency,
          intervalCount: String(normalizedIntervalCount),
          subscriptionId: subscription.id,
        };

        if (latestInvoice?.id) {
          try {
            await stripeClient.invoices.update(latestInvoice.id, {
              metadata: normalizeStripeMetadata({
                ...recurringMetadata,
                invoiceId: latestInvoice.id,
              }),
            });
          } catch (invoiceMetaError) {
            console.warn('Unable to update invoice metadata for recurring donation', {
              invoiceId: latestInvoice.id,
              error: invoiceMetaError.message,
            });
          }
        }

        const paymentIntentId =
          typeof latestInvoice?.payment_intent === 'string'
            ? latestInvoice.payment_intent
            : latestInvoice?.payment_intent?.id;

        if (paymentIntentId) {
          try {
            await stripeClient.paymentIntents.update(paymentIntentId, {
              metadata: normalizeStripeMetadata({
                ...recurringMetadata,
                invoiceId: latestInvoice?.id || null,
              }),
            });
          } catch (paymentIntentMetaError) {
            console.warn('Unable to update payment intent metadata for recurring donation', {
              paymentIntentId,
              error: paymentIntentMetaError.message,
            });
          }
        }

        await createSubscriptionDoc({
          stripeSubscriptionId: subscription.id,
          customerId: customer.id,
          campaignId,
          organizationId: orgId,
          interval: frequency,
          intervalCount: normalizedIntervalCount,
          amount,
          currency,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          startedAt: subscription.start_date || subscription.current_period_start || null,
          nextPaymentAt: subscription.current_period_end || null,
          metadata: {
            donorEmail: donor?.email || canonicalMetadata.donorEmail || null,
            donorName: donor?.name || canonicalMetadata.donorName || 'Anonymous',
            donorPhone: donor?.phone || canonicalMetadata.donorPhone || null,
            campaignTitle: campaignData.title || canonicalMetadata.campaignTitle || null,
            platform: canonicalMetadata.platform || 'kiosk',
            ...canonicalMetadata,
          },
        });

        if (latestInvoice) {
          if (latestInvoice.payment_intent) {
            // Payment requires confirmation
            clientSecret = latestInvoice.payment_intent.client_secret;
          } else if (latestInvoice.status === 'paid') {
            // Payment was successful immediately - no confirmation needed
            return res.status(200).send({
              success: true,
              message: 'Subscription created and payment completed successfully',
              subscriptionId: subscription.id,
              invoiceId: latestInvoice.id,
              amountPaid: latestInvoice.amount_paid,
            });
          } else {
            return res.status(400).send({
              error: `Invoice status: ${latestInvoice.status}`,
              subscriptionId: subscription.id,
            });
          }
        } else {
          return res.status(500).send({
            error: 'No invoice generated for subscription',
            subscriptionId: subscription.id,
          });
        }
      }
      return res.status(200).send({ clientSecret });
    } catch (error) {
      console.error('Error creating kiosk payment intent:', error);
      res.status(500).send({ error: error.message });
    }
  });
};

/**
 * Create payment intent for authenticated users
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @return {Promise<void>} Promise that resolves when complete
 */
const createPaymentIntent = async (req, res) => {
  try {
    // Ensure Stripe is initialized
    const stripeClient = ensureStripeInitialized();

    const auth = await verifyAuth(req);
    const uid = auth.uid;
    const email = auth.email;
    const name = auth.name || 'Anonymous';

    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();

    let customerId;

    if (userDoc.exists && userDoc.data().stripeCustomerId) {
      customerId = userDoc.data().stripeCustomerId;
    } else {
      const customer = await stripeClient.customers.create({
        email: email,
        name: name,
        metadata: { firebaseUID: uid },
      });

      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const ephemeralKey = await stripeClient.ephemeralKeys.create(
      { customer: customerId },
      { apiVersion: '2022-11-15' },
    );

    const { amount, currency, metadata } = req.body;
    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};
    const { platform } = safeMetadata;

    let paymentMethodTypes = ['card'];
    if (platform === 'android_ttp') {
      paymentMethodTypes = ['card_present'];
    }

    if (!amount || !currency) {
      return res.status(400).send({ error: 'Missing amount or currency' });
    }

    const { campaignId, donorId, donorName, isGiftAid } = safeMetadata;

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      metadata: normalizeStripeMetadata({
        campaignId: campaignId || null,
        donorId: donorId || null,
        donorName: donorName || null,
        isGiftAid: Boolean(isGiftAid),
        platform: platform || null,
      }),
    });

    if (platform === 'android_ttp') {
      res.status(200).send({
        paymentIntentId: paymentIntent.id,
        customer: customerId,
      });
    } else {
      res.status(200).send({
        paymentIntentClientSecret: paymentIntent.client_secret,
        customer: customerId,
        ephemeralKey: ephemeralKey.secret,
      });
    }
  } catch (err) {
    console.error('Error creating payment intent:', err);
    return res.status(500).send({ error: err.message });
  }
};

/**
 * Create Stripe Express Dashboard login link
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createExpressDashboardLink = (req, res) => {
  cors(req, res, async () => {
    try {
      // Ensure Stripe is initialized
      const stripeClient = ensureStripeInitialized();

      const auth = await verifyAuth(req);
      const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();

      if (!callerDoc.exists) {
        return res.status(403).json({ error: 'Caller is not a valid user' });
      }

      const callerData = callerDoc.data() || {};
      const callerRole = callerData.role;
      const callerOrgId =
        typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';
      const callerPermissions = Array.isArray(callerData.permissions) ? callerData.permissions : [];
      const requestedOrgId = typeof req.body?.orgId === 'string' ? req.body.orgId.trim() : '';
      const isSuperScope =
        callerRole === 'super_admin' || callerPermissions.includes('system_admin');

      let targetOrgId = callerOrgId;
      if (isSuperScope && requestedOrgId) {
        targetOrgId = requestedOrgId;
      } else if (requestedOrgId && requestedOrgId !== callerOrgId) {
        return res.status(403).json({
          error: 'You can only access Stripe dashboard for your organization',
        });
      }

      if (!targetOrgId) {
        return res.status(400).json({ error: 'Missing orgId' });
      }

      const orgDoc = await admin.firestore().collection('organizations').doc(targetOrgId).get();

      if (!orgDoc.exists) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const stripeAccountId = orgDoc.data()?.stripe?.accountId;
      if (!stripeAccountId) {
        return res.status(404).json({ error: 'Stripe account not found' });
      }

      const loginLink = await stripeClient.accounts.createLoginLink(stripeAccountId);
      res.json({ url: loginLink.url });
    } catch (err) {
      console.error('Error creating Express dashboard link:', err);
      if (err.code === 401 || err.code === 403) {
        return res.status(err.code).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });
};

module.exports = {
  createOnboardingLink,
  createKioskPaymentIntent,
  createPaymentIntent,
  createExpressDashboardLink,
};
