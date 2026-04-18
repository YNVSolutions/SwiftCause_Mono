const admin = require("firebase-admin");
const {stripe, ensureStripeInitialized} = require("../services/stripe");
const {verifyAuth} = require("../middleware/auth");
const cors = require("../middleware/cors");

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "https://swift-cause-web.vercel.app",
  "https://swiftcause--swiftcause-app.us-east4.hosted.app",
  "https://swiftcause--swiftcause-prod.europe-west4.hosted.app",
  "https://swiftcause.com"
]);

const logOnboardingLinkAccess = (level, payload) => {
  const logPayload = {
    action_type: "create_onboarding_link",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (level === "warn") {
    console.warn("Stripe onboarding link access denied", logPayload);
    return;
  }

  console.info("Stripe onboarding link privileged access", logPayload);
};
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

      const requestedOrgId = typeof req.body?.orgId === "string" ?
        req.body.orgId.trim() :
        "";
      if (!requestedOrgId) {
        return res.status(400).send({error: "Missing orgId"});
      }

      const callerDoc = await admin
          .firestore()
          .collection("users")
          .doc(auth.uid)
          .get();

      if (!callerDoc.exists) {
        logOnboardingLinkAccess("warn", {
          actor_uid: auth.uid,
          requested_org_id: requestedOrgId,
          denial_reason: "caller_profile_not_found",
        });
        return res.status(403).send({error: "Caller is not a valid user"});
      }

      const callerData = callerDoc.data() || {};
      const callerRole = typeof callerData.role === "string" ?
        callerData.role :
        "";
      const callerOrgId = typeof callerData.organizationId === "string" ?
        callerData.organizationId.trim() :
        "";
      const callerPermissions = Array.isArray(callerData.permissions) ?
        callerData.permissions :
        [];
      const isPrivilegedCaller =
        callerRole === "super_admin" ||
        callerPermissions.includes("system_admin");

      if (!isPrivilegedCaller && callerOrgId !== requestedOrgId) {
        logOnboardingLinkAccess("warn", {
          actor_uid: auth.uid,
          requested_org_id: requestedOrgId,
          caller_org_id: callerOrgId || null,
          caller_role: callerRole || null,
          denial_reason: "cross_organization_access_denied",
        });
        return res.status(403).send({
          error: "You can only create onboarding links for your organization",
        });
      }

      if (isPrivilegedCaller) {
        logOnboardingLinkAccess("info", {
          actor_uid: auth.uid,
          requested_org_id: requestedOrgId,
          caller_org_id: callerOrgId || null,
          caller_role: callerRole || null,
          privileged_override: callerOrgId !== requestedOrgId,
        });
      }

      const orgDoc = await admin
          .firestore()
          .collection("organizations")
          .doc(requestedOrgId)
          .get();
      if (!orgDoc.exists) {
        return res.status(404).send({error: "Organization not found"});
      }

      const data = orgDoc.data();
      if (!data.stripe || !data.stripe.accountId) {
        return res.status(404).send({error: "Stripe account not found"});
      }

      const accountId = data.stripe.accountId;

      const baseUrl = req.get("origin");

      if (!baseUrl || !ALLOWED_ORIGINS.has(baseUrl)) {
        return res.status(400).send({error: "Invalid origin"});
      }

      const accountLink = await stripeClient.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${baseUrl}/admin`,
        return_url: `${baseUrl}/admin`,
      });

      return res.status(200).send({url: accountLink.url});
    } catch (error) {
      console.error("Error creating onboarding link:", error);
      return res.status(500).send({error: error.message});
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
        currency = "usd",
        metadata,
        frequency,
        donor,
        paymentMethodId,
      } = req.body;

      if (!amount || !currency || !metadata || !metadata.campaignId) {
        return res
            .status(400)
            .send({error: "Missing amount, currency, or campaignId"});
      }

      const campaignId = String(metadata.campaignId).trim();

      // Get campaign/org details
      const campaignSnap = await admin
          .firestore()
          .collection("campaigns")
          .doc(campaignId)
          .get();
      if (!campaignSnap.exists) {
        return res.status(404).send({error: "Campaign not found"});
      }
      const campaignData = campaignSnap.data();
      const orgId = campaignData.organizationId;
      const canonicalMetadata = {
        ...metadata,
        campaignId,
        campaignTitle: campaignData.title || metadata.campaignTitle || null,
        organizationId: orgId || metadata.organizationId || null,
        // Keep both keys to support mixed webhook consumers and old/new clients.
        isGiftAid: metadata.isGiftAid,
        giftAidEnabled: metadata.giftAidEnabled ?? metadata.isGiftAid,
      };

      const orgSnap = await admin
          .firestore()
          .collection("organizations")
          .doc(orgId)
          .get();
      if (!orgSnap.exists) {
        return res.status(404).send({error: "Org not found"});
      }

      const stripeAccountId = orgSnap.data().stripe?.accountId;
      if (!stripeAccountId) {
        return res.status(400).send({error: "Org not onboarded with Stripe"});
      }

      // Create a Customer for tracking donations and supporting recurring payments
      // Note: Link will appear if customer has an email, but that's okay for kiosk use
      const customer = await stripeClient.customers.create({
        email: donor?.email || undefined,
        name: donor?.name || undefined,
        metadata: canonicalMetadata,
      });

      let clientSecret;

      if (!frequency || frequency === "once") {
        // One-time donation
        // Support both card (manual entry via PaymentSheet) and card_present (Tap to Pay)
        const paymentIntent = await stripeClient.paymentIntents.create({
          amount,
          currency,
          customer: customer.id,
          payment_method_types: ["card", "card_present"],
          payment_method_options: {
            card: {
              request_three_d_secure: "automatic",
            },
          },
          transfer_data: {destination: stripeAccountId},
          metadata: {...canonicalMetadata, platform: "kiosk", frequency: "once"},
        });
        clientSecret = paymentIntent.client_secret;
      } else {
        // Recurring donation (subscription)
        if (!paymentMethodId) {
          return res
              .status(400)
              .send({error: "Missing paymentMethodId for subscription"});
        }

        // Attach payment method to customer and set as default
        await stripeClient.paymentMethods.attach(paymentMethodId, {
          customer: customer.id,
        });
        await stripeClient.customers.update(customer.id, {
          invoice_settings: {default_payment_method: paymentMethodId},
        });

        // Create price for subscription
        const price = await stripeClient.prices.create({
          unit_amount: amount,
          currency,
          recurring: {interval: frequency}, // "month" or "year"
          product_data: {
            name: `Recurring donation to campaign ${campaignId}`,
          },
        });

        // Create subscription with the default payment method
        const subscription = await stripeClient.subscriptions.create({
          customer: customer.id,
          items: [{price: price.id}],
          default_payment_method: paymentMethodId,
          collection_method: "charge_automatically",
          expand: ["latest_invoice.payment_intent"],
          trial_period_days: 0,
          transfer_data: {destination: stripeAccountId},
          metadata: {...canonicalMetadata, platform: "kiosk", frequency},
        });

        console.log("Subscription created:", {
          id: subscription.id,
          status: subscription.status,
          latest_invoice: subscription.latest_invoice,
          latest_invoice_status: subscription.latest_invoice?.status,
          payment_intent_id: subscription.latest_invoice?.payment_intent?.id,
          payment_intent_status:
            subscription.latest_invoice?.payment_intent?.status,
        });

        const latestInvoice = subscription.latest_invoice;

        if (latestInvoice) {
          if (latestInvoice.payment_intent) {
            // Payment requires confirmation
            clientSecret = latestInvoice.payment_intent.client_secret;
          } else if (latestInvoice.status === "paid") {
            // Payment was successful immediately - no confirmation needed
            return res.status(200).send({
              success: true,
              message:
                "Subscription created and payment completed successfully",
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
            error: "No invoice generated for subscription",
            subscriptionId: subscription.id,
          });
        }
      }
      return res.status(200).send({clientSecret});
    } catch (error) {
      console.error("Error creating kiosk payment intent:", error);
      res.status(500).send({error: error.message});
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
    const name = auth.name || "Anonymous";

    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();

    let customerId;

    if (userDoc.exists && userDoc.data().stripeCustomerId) {
      customerId = userDoc.data().stripeCustomerId;
    } else {
      const customer = await stripeClient.customers.create({
        email: email,
        name: name,
        metadata: {firebaseUID: uid},
      });

      customerId = customer.id;
      await userRef.set({stripeCustomerId: customerId}, {merge: true});
    }

    const ephemeralKey = await stripeClient.ephemeralKeys.create(
        {customer: customerId},
        {apiVersion: "2022-11-15"},
    );

    const {amount, currency, metadata} = req.body;
    const {platform} = metadata || null;

    let paymentMethodTypes = ["card"];
    if (platform === "android_ttp") {
      paymentMethodTypes = ["card_present"];
    }

    if (!amount || !currency) {
      return res.status(400).send({error: "Missing amount or currency"});
    }

    const {campaignId, donorId, donorName, isGiftAid} = metadata;

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      metadata: {
        campaignId,
        donorId,
        donorName,
        isGiftAid: isGiftAid.toString(),
        platform,
      },
    });

    if (platform === "android_ttp") {
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
    console.error("Error creating payment intent:", err);
    return res.status(500).send({error: err.message});
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
      const callerDoc = await admin
          .firestore()
          .collection("users")
          .doc(auth.uid)
          .get();

      if (!callerDoc.exists) {
        return res.status(403).json({error: "Caller is not a valid user"});
      }

      const callerData = callerDoc.data() || {};
      const callerRole = callerData.role;
      const callerOrgId = typeof callerData.organizationId === "string" ?
        callerData.organizationId.trim() :
        "";
      const callerPermissions = Array.isArray(callerData.permissions) ?
        callerData.permissions :
        [];
      const requestedOrgId = typeof req.body?.orgId === "string" ?
        req.body.orgId.trim() :
        "";
      const isSuperScope =
        callerRole === "super_admin" ||
        callerPermissions.includes("system_admin");

      let targetOrgId = callerOrgId;
      if (isSuperScope && requestedOrgId) {
        targetOrgId = requestedOrgId;
      } else if (requestedOrgId && requestedOrgId !== callerOrgId) {
        return res.status(403).json({
          error: "You can only access Stripe dashboard for your organization",
        });
      }

      if (!targetOrgId) {
        return res.status(400).json({error: "Missing orgId"});
      }

      const orgDoc = await admin
          .firestore()
          .collection("organizations")
          .doc(targetOrgId)
          .get();

      if (!orgDoc.exists) {
        return res.status(404).json({error: "Organization not found"});
      }

      const stripeAccountId = orgDoc.data()?.stripe?.accountId;
      if (!stripeAccountId) {
        return res.status(404).json({error: "Stripe account not found"});
      }

      const loginLink = await stripeClient.accounts.createLoginLink(stripeAccountId);
      res.json({url: loginLink.url});
    } catch (err) {
      console.error("Error creating Express dashboard link:", err);
      if (err.code === 401 || err.code === 403) {
        return res.status(err.code).json({error: err.message});
      }
      res.status(500).json({error: err.message});
    }
  });
};

module.exports = {
  createOnboardingLink,
  createKioskPaymentIntent,
  createPaymentIntent,
  createExpressDashboardLink,
};
