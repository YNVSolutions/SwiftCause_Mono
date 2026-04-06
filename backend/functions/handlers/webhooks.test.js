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
});
