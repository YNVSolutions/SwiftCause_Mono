jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));
jest.mock('../services/stripe', () => ({
  stripe: {},
  getWebhookSecrets: jest.fn(() => ({
    payment: 'whsec_test',
    account: 'whsec_account',
  })),
  ensureStripeInitialized: jest.fn(() => ({
    invoices: {
      retrieve: jest.fn(),
    },
    subscriptions: {
      retrieve: jest.fn(),
    },
  })),
  verifyWebhookSignatureWithAnySecret: jest.fn(),
}));
jest.mock('../entities/donation', () => ({
  createDonationDoc: jest.fn(),
}));
jest.mock('../entities/subscription', () => ({
  updateSubscriptionStatus: jest.fn(),
  getSubscriptionByStripeId: jest.fn(),
}));

const admin = require('firebase-admin');
const { verifyWebhookSignatureWithAnySecret } = require('../services/stripe');
const { createDonationDoc } = require('../entities/donation');
const { handlePaymentCompletedStripeWebhook } = require('./webhooks');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

// Helper: seed a Firestore document directly via the mock
const seedDoc = async (collectionName, id, data) => {
  await admin.firestore().collection(collectionName).doc(id).set(data);
};

// Helper: build a minimal payment_intent.succeeded event
const makePaymentEvent = (overrides = {}) => ({
  id: overrides.eventId || 'evt_test',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: overrides.paymentIntentId || 'pi_test',
      amount: overrides.amount || 1000,
      currency: 'gbp',
      invoice: null,
      metadata: {
        isGiftAid: 'false',
        isAnonymous: 'false',
        campaignId: overrides.campaignId || null,
        organizationId: overrides.organizationId || null,
        ...overrides.metadata,
      },
    },
  },
});

const makeRequest = () => ({
  headers: { 'stripe-signature': 'sig' },
  rawBody: Buffer.from('payload'),
});

describe('handlePaymentCompletedStripeWebhook', () => {
  beforeEach(() => {
    admin.__reset();
    jest.clearAllMocks();
  });

  it('processes parallel duplicate deliveries exactly once', async () => {
    const event = {
      id: 'evt_parallel_payment',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_parallel_payment',
          amount: 1500,
          currency: 'gbp',
          metadata: {
            donorName: 'Parallel Donor',
            isGiftAid: 'false',
            isAnonymous: 'false',
          },
        },
      },
    };

    verifyWebhookSignatureWithAnySecret.mockReturnValue(event);

    const request = {
      headers: {
        'stripe-signature': 'sig',
      },
      rawBody: Buffer.from('payload'),
    };

    const responseA = createResponse();
    const responseB = createResponse();

    await Promise.all([
      handlePaymentCompletedStripeWebhook(request, responseA),
      handlePaymentCompletedStripeWebhook(request, responseB),
    ]);

    expect(createDonationDoc).toHaveBeenCalledTimes(1);
    expect(responseA.statusCode).toBe(200);
    expect(responseB.statusCode).toBe(200);
    expect(admin.__getDoc('webhook_events', 'evt_parallel_payment')).toMatchObject({
      status: 'processed',
      paymentIntentId: 'pi_parallel_payment',
    });
  });

  it('resolves kiosk location from kiosk doc when payment metadata omits location_id', async () => {
    await seedDoc('kiosks', 'kiosk_rollout_001', {
      location_id: 'loc_rollout_001',
    });
    await seedDoc('locations', 'loc_rollout_001', {
      name: 'Central Hall',
      postcode: 'SW1A 1AA',
      city: 'London',
    });

    const event = makePaymentEvent({
      eventId: 'evt_kiosk_missing_location_id',
      paymentIntentId: 'pi_kiosk_missing_location_id',
      metadata: {
        kioskId: 'kiosk_rollout_001',
        platform: 'kiosk',
      },
    });
    verifyWebhookSignatureWithAnySecret.mockReturnValue(event);

    const res = createResponse();
    await handlePaymentCompletedStripeWebhook(makeRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(createDonationDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: 'pi_kiosk_missing_location_id',
        kioskId: 'kiosk_rollout_001',
        location_id: 'loc_rollout_001',
        location_snapshot: {
          name: 'Central Hall',
          postcode: 'SW1A 1AA',
          city: 'London',
        },
      }),
    );
  });

  // ─── Declaration-first linkage tests ────────────────────────────────────────

  describe('declaration-first linkage (pre-created declaration)', () => {
    it('links an unlinked declaration to the donation and promotes it to active', async () => {
      const declarationId = 'decl_unlinked_001';
      const paymentIntentId = 'pi_decl_link_001';

      // Seed a pre-created declaration with donationId: '' (pre-payment state)
      await seedDoc('giftAidDeclarations', declarationId, {
        donationId: '',
        donorFirstName: 'Jane',
        donorSurname: 'Smith',
        donorEmail: 'jane@example.com',
        campaignTitle: 'Save the Forests',
        organizationId: 'org_abc',
        giftAidStatus: 'pending',
        hmrcClaimStatus: 'pending',
        operationalStatus: 'captured',
      });

      const event = makePaymentEvent({
        eventId: 'evt_decl_link_001',
        paymentIntentId,
        amount: 2000,
        metadata: {
          giftAidDeclarationId: declarationId,
          donorEmail: 'jane@example.com',
          organizationId: 'org_abc',
        },
      });
      verifyWebhookSignatureWithAnySecret.mockReturnValue(event);

      const res = createResponse();
      await handlePaymentCompletedStripeWebhook(makeRequest(), res);

      expect(res.statusCode).toBe(200);

      // Donation should be marked as Gift Aid with donor name and declaration ID
      const donation = admin.__getDoc('donations', paymentIntentId);
      expect(donation).toMatchObject({
        isGiftAid: true,
        giftAidDeclarationId: declarationId,
        donorName: 'Jane Smith',
      });

      // Declaration should be promoted to active and linked to donation
      const declaration = admin.__getDoc('giftAidDeclarations', declarationId);
      expect(declaration).toMatchObject({
        donationId: paymentIntentId,
        donationAmount: 2000,
        giftAidAmount: 500,
        giftAidStatus: 'active',
        hmrcClaimStatus: 'pending',
        operationalStatus: 'captured',
      });
    });

    it('also links when metadata uses the legacy declarationId key', async () => {
      const declarationId = 'decl_legacy_key_001';
      const paymentIntentId = 'pi_legacy_key_001';

      await seedDoc('giftAidDeclarations', declarationId, {
        donationId: '',
        donorFirstName: 'Bob',
        donorSurname: 'Jones',
        campaignTitle: 'Clean Water',
        organizationId: 'org_xyz',
        giftAidStatus: 'pending',
      });

      // Client sends 'declarationId' instead of 'giftAidDeclarationId'
      const event = makePaymentEvent({
        eventId: 'evt_legacy_key_001',
        paymentIntentId,
        amount: 500,
        metadata: {
          declarationId, // legacy key
          organizationId: 'org_xyz',
        },
      });
      verifyWebhookSignatureWithAnySecret.mockReturnValue(event);

      const res = createResponse();
      await handlePaymentCompletedStripeWebhook(makeRequest(), res);

      expect(res.statusCode).toBe(200);

      const donation = admin.__getDoc('donations', paymentIntentId);
      expect(donation).toMatchObject({
        isGiftAid: true,
        giftAidDeclarationId: declarationId,
        donorName: 'Bob Jones',
      });

      const declaration = admin.__getDoc('giftAidDeclarations', declarationId);
      expect(declaration).toMatchObject({
        donationId: paymentIntentId,
        giftAidStatus: 'active',
      });
    });

    it('skips linkage and writes a reconciliation issue when declaration is already linked to a different donation', async () => {
      const declarationId = 'decl_already_linked_001';
      const paymentIntentId = 'pi_new_payment_001';
      const existingDonationId = 'pi_original_payment_001';

      // Declaration already linked to a different donation
      await seedDoc('giftAidDeclarations', declarationId, {
        donationId: existingDonationId,
        donorFirstName: 'Alice',
        donorSurname: 'Brown',
        giftAidStatus: 'active',
      });

      const event = makePaymentEvent({
        eventId: 'evt_already_linked_001',
        paymentIntentId,
        amount: 1000,
        metadata: {
          giftAidDeclarationId: declarationId,
          organizationId: 'org_abc',
        },
      });
      verifyWebhookSignatureWithAnySecret.mockReturnValue(event);

      const res = createResponse();
      await handlePaymentCompletedStripeWebhook(makeRequest(), res);

      // Webhook should still succeed (linkage failure is non-critical)
      expect(res.statusCode).toBe(200);

      // Donation should NOT be marked as Gift Aid
      const donation = admin.__getDoc('donations', paymentIntentId);
      expect(donation?.isGiftAid).not.toBe(true);
      expect(donation?.giftAidDeclarationId).toBeUndefined();

      // Declaration should NOT be re-homed
      const declaration = admin.__getDoc('giftAidDeclarations', declarationId);
      expect(declaration.donationId).toBe(existingDonationId);

      // A reconciliation issue should have been written
      const issues = admin.__getCollection('giftAidReconciliationIssues');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].data).toMatchObject({
        reason: 'pre_created_declaration_already_linked_to_other_donation',
        declarationId,
      });
    });

    it('preserves the declaration campaignTitle when campaignTitleSnapshot is the placeholder', async () => {
      const declarationId = 'decl_title_preserve_001';
      const paymentIntentId = 'pi_title_preserve_001';

      await seedDoc('giftAidDeclarations', declarationId, {
        donationId: '',
        donorFirstName: 'Tom',
        donorSurname: 'Hardy',
        campaignTitle: 'Real Campaign Title',
        giftAidStatus: 'pending',
      });

      // No campaignId in metadata → campaignTitleSnapshot stays 'Deleted Campaign'
      const event = makePaymentEvent({
        eventId: 'evt_title_preserve_001',
        paymentIntentId,
        amount: 750,
        metadata: {
          giftAidDeclarationId: declarationId,
          // campaignId intentionally omitted
        },
      });
      verifyWebhookSignatureWithAnySecret.mockReturnValue(event);

      const res = createResponse();
      await handlePaymentCompletedStripeWebhook(makeRequest(), res);

      expect(res.statusCode).toBe(200);

      const declaration = admin.__getDoc('giftAidDeclarations', declarationId);
      // Should keep the real title, not 'Deleted Campaign'
      expect(declaration.campaignTitle).toBe('Real Campaign Title');
    });
  });
});
