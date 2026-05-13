// ---------------------------------------------------------------------------
// subscriptionManagement.test.js
// ---------------------------------------------------------------------------
// Tests for the four subscription management endpoints:
//   - sendSubscriptionMagicLink
//   - verifySubscriptionMagicLink
//   - getSubscriptionsByEmail
//   - createCustomerPortalSession
//
// Also covers the Firestore-backed rate limiter in isolation.
// ---------------------------------------------------------------------------

jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));

jest.mock('../middleware/cors', () => (req, res, callback) => callback());

jest.mock('../services/stripe', () => ({
  ensureStripeInitialized: jest.fn(),
}));

jest.mock('../services/email', () => ({
  sendSubscriptionMagicLinkEmail: jest.fn(),
}));

jest.mock('../utils/tokenManager', () => ({
  generateToken: jest.fn(),
  storeToken: jest.fn(),
  verifyToken: jest.fn(),
  consumeToken: jest.fn(),
  releaseToken: jest.fn(),
}));

const admin = require('firebase-admin');
const { ensureStripeInitialized } = require('../services/stripe');
const { sendSubscriptionMagicLinkEmail } = require('../services/email');
const {
  generateToken,
  storeToken,
  verifyToken,
  consumeToken,
  releaseToken,
} = require('../utils/tokenManager');

const {
  sendSubscriptionMagicLink,
  verifySubscriptionMagicLink,
  getSubscriptionsByEmail,
  createCustomerPortalSession,
  getPaymentHistory,
} = require('./subscriptionManagement');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Minimal Express-like response object.
 * @return {{statusCode: number, body: *, status: Function, json: Function}}
 */
const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

/**
 * Build a minimal Express-like request object.
 * @param {{method?: string, body?: object, token?: string|null}} opts
 * @return {object} Request object
 */
const makeReq = ({ method = 'POST', body = {}, token = null } = {}) => ({
  method,
  body,
  headers: token ? { authorization: `Bearer ${token}` } : {},
  ip: '127.0.0.1',
});

/**
 * Seed a Firestore document via the mock.
 * @param {string} collection - Collection name
 * @param {string} id - Document ID
 * @param {object} data - Document data
 * @return {Promise<void>}
 */
const seed = async (collection, id, data) => {
  await admin.firestore().collection(collection).doc(id).set(data);
};

/**
 * Stub admin.auth().verifyIdToken to return a valid donor magic-link token.
 * @param {string} email - Email to embed in the decoded token
 */
const stubAuth = (email) => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      email,
      uid: `uid_${email}`,
      purpose: 'subscription_management',
      type: 'donor',
    }),
    createCustomToken: jest.fn().mockResolvedValue('custom-token-stub'),
  }));
};

/** Make admin.auth().verifyIdToken throw */
const stubAuthFail = () => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid token')),
  }));
};

/**
 * Stub a valid Firebase token that was NOT issued by the donor magic link.
 * @param {string} email - Email to embed in the decoded token
 */
const stubWrongPurposeAuth = (email) => {
  admin.auth = jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      email,
      uid: `uid_${email}`,
      purpose: 'admin',
      type: 'admin',
    }),
  }));
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  admin.__reset();
  jest.clearAllMocks();
  generateToken.mockReturnValue('tok_abc123');
  storeToken.mockResolvedValue(undefined);
  sendSubscriptionMagicLinkEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ===========================================================================
// sendSubscriptionMagicLink
// ===========================================================================

describe('sendSubscriptionMagicLink', () => {
  it('returns 405 for non-POST requests', async () => {
    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 when email is missing', async () => {
    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'not-an-email' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with generic message when no subscriptions exist', async () => {
    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'unknown@example.com' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    // Must NOT reveal whether the email exists
    expect(storeToken).not.toHaveBeenCalled();
  });

  it('sends magic link when subscription found via root donorEmail', async () => {
    await seed('subscriptions', 'sub_1', {
      donorEmail: 'donor@example.com',
      customerId: 'cus_1',
      organizationId: 'org_1',
    });

    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'donor@example.com' } }), res);

    expect(res.statusCode).toBe(200);
    expect(storeToken).toHaveBeenCalledWith(
      'tok_abc123',
      expect.objectContaining({
        email: 'donor@example.com',
        purpose: 'subscription_management',
      }),
    );
    expect(sendSubscriptionMagicLinkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'donor@example.com',
        magicLink: expect.stringContaining('/link/tok_abc123'),
      }),
    );
  });

  it('sends magic link when subscription found via metadata.donorEmail', async () => {
    await seed('subscriptions', 'sub_2', {
      metadata: { donorEmail: 'meta@example.com' },
      customerId: 'cus_2',
      organizationId: 'org_1',
    });

    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'meta@example.com' } }), res);

    expect(res.statusCode).toBe(200);
    expect(sendSubscriptionMagicLinkEmail).toHaveBeenCalled();
  });

  it('finds subscriptions through root donorEmailNormalized', async () => {
    await seed('subscriptions', 'sub_3', {
      donorEmail: 'Upper@Example.com',
      donorEmailNormalized: 'upper@example.com',
      customerId: 'cus_3',
      organizationId: 'org_1',
    });

    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'UPPER@EXAMPLE.COM' } }), res);

    expect(sendSubscriptionMagicLinkEmail).toHaveBeenCalled();
  });

  it('finds subscriptions through metadata.donorEmailNormalized', async () => {
    await seed('subscriptions', 'sub_4', {
      metadata: {
        donorEmail: 'MetaUpper@Example.com',
        donorEmailNormalized: 'metaupper@example.com',
      },
      customerId: 'cus_4',
      organizationId: 'org_1',
    });

    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'METAUPPER@EXAMPLE.COM' } }), res);

    expect(res.statusCode).toBe(200);
    expect(sendSubscriptionMagicLinkEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'METAUPPER@EXAMPLE.COM' }),
    );
  });

  it('returns 200 with devLink when email service is unavailable', async () => {
    // SendGrid is currently non-functional; the handler falls back to returning
    // the magic link directly in the response body so the flow stays testable.
    await seed('subscriptions', 'sub_email_fail', {
      donorEmail: 'donor@example.com',
      customerId: 'cus_1',
      organizationId: 'org_1',
    });
    sendSubscriptionMagicLinkEmail.mockRejectedValue(new Error('SMTP down'));

    const res = makeRes();
    await sendSubscriptionMagicLink(makeReq({ body: { email: 'donor@example.com' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devLink).toMatch(/\/link\//);
  });
});

// ===========================================================================
// verifySubscriptionMagicLink
// ===========================================================================

describe('verifySubscriptionMagicLink', () => {
  beforeEach(() => {
    admin.auth = jest.fn(() => ({
      createCustomToken: jest.fn().mockResolvedValue('custom-token-stub'),
    }));
  });

  it('returns 405 for non-POST requests', async () => {
    const res = makeRes();
    await verifySubscriptionMagicLink(makeReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 400 when token is missing', async () => {
    const res = makeRes();
    await verifySubscriptionMagicLink(makeReq({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when token is expired', async () => {
    verifyToken.mockRejectedValue(new Error('TOKEN_EXPIRED'));

    const res = makeRes();
    await verifySubscriptionMagicLink(makeReq({ body: { token: 'expired-tok' } }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 when token has already been consumed', async () => {
    verifyToken.mockRejectedValue(new Error('TOKEN_CONSUMED'));

    const res = makeRes();
    await verifySubscriptionMagicLink(makeReq({ body: { token: 'used-tok' } }), res);

    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with custom token on valid token', async () => {
    verifyToken.mockResolvedValue({ email: 'donor@example.com' });

    const res = makeRes();
    await verifySubscriptionMagicLink(makeReq({ body: { token: 'valid-tok' } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.email).toBe('donor@example.com');
    expect(res.body.token).toBe('custom-token-stub');
  });
});

// ===========================================================================
// getSubscriptionsByEmail
// ===========================================================================

describe('getSubscriptionsByEmail', () => {
  it('returns 405 for unsupported methods', async () => {
    stubAuth('donor@example.com');
    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'DELETE' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when no auth header is present', async () => {
    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    stubAuthFail();
    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'bad-token' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token was not issued by donor magic link', async () => {
    stubWrongPurposeAuth('donor@example.com');
    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'admin-token' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns empty array when donor has no subscriptions', async () => {
    stubAuth('nobody@example.com');
    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.subscriptions).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('returns subscriptions found via root donorEmail', async () => {
    stubAuth('donor@example.com');
    await seed('subscriptions', 'sub_root', {
      donorEmail: 'donor@example.com',
      customerId: 'cus_1',
      organizationId: 'org_1',
      status: 'active',
      amount: 1000,
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.subscriptions[0].id).toBe('sub_root');
  });

  it('returns subscriptions found via metadata.donorEmail', async () => {
    stubAuth('meta@example.com');
    await seed('subscriptions', 'sub_meta', {
      metadata: { donorEmail: 'meta@example.com' },
      customerId: 'cus_2',
      organizationId: 'org_1',
      status: 'active',
      amount: 500,
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
  });

  it('returns subscriptions found via root donorEmailNormalized', async () => {
    stubAuth('donor@example.com');
    await seed('subscriptions', 'sub_mixed_case', {
      donorEmail: 'Donor@Example.com',
      donorEmailNormalized: 'donor@example.com',
      customerId: 'cus_mixed',
      organizationId: 'org_1',
      status: 'active',
      amount: 500,
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.subscriptions[0].id).toBe('sub_mixed_case');
  });

  it('returns subscriptions found via metadata.donorEmailNormalized', async () => {
    stubAuth('nested@example.com');
    await seed('subscriptions', 'sub_nested_normalized', {
      metadata: {
        donorEmail: 'Nested@Example.com',
        donorEmailNormalized: 'nested@example.com',
      },
      customerId: 'cus_nested',
      organizationId: 'org_1',
      status: 'active',
      amount: 500,
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.subscriptions[0].id).toBe('sub_nested_normalized');
  });

  it('deduplicates subscriptions that appear in both queries', async () => {
    stubAuth('both@example.com');
    // Same doc matches both root and metadata query
    await seed('subscriptions', 'sub_both', {
      donorEmail: 'both@example.com',
      metadata: { donorEmail: 'both@example.com' },
      customerId: 'cus_3',
      organizationId: 'org_1',
      status: 'active',
      amount: 750,
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.body.count).toBe(1);
  });

  it('sorts active subscriptions before inactive ones', async () => {
    stubAuth('sorted@example.com');
    await seed('subscriptions', 'sub_canceled', {
      donorEmail: 'sorted@example.com',
      status: 'canceled',
      amount: 500,
      createdAt: admin.firestore.Timestamp.fromMillis(2000),
    });
    await seed('subscriptions', 'sub_active', {
      donorEmail: 'sorted@example.com',
      status: 'active',
      amount: 1000,
      createdAt: admin.firestore.Timestamp.fromMillis(1000),
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.body.subscriptions[0].id).toBe('sub_active');
    expect(res.body.subscriptions[1].id).toBe('sub_canceled');
  });

  it('sorts subscriptions with same status by newest createdAt', async () => {
    stubAuth('newest@example.com');
    await seed('subscriptions', 'sub_old', {
      donorEmail: 'newest@example.com',
      status: 'active',
      createdAt: admin.firestore.Timestamp.fromMillis(1000),
    });
    await seed('subscriptions', 'sub_new', {
      donorEmail: 'newest@example.com',
      status: 'active',
      createdAt: admin.firestore.Timestamp.fromMillis(3000),
    });

    const res = makeRes();
    await getSubscriptionsByEmail(makeReq({ method: 'GET', token: 'valid' }), res);

    expect(res.body.subscriptions[0].id).toBe('sub_new');
    expect(res.body.subscriptions[1].id).toBe('sub_old');
  });
});

// ===========================================================================
// createCustomerPortalSession
// ===========================================================================

describe('createCustomerPortalSession', () => {
  const VALID_SUB_ID = 'sub_portal_test';
  const DONOR_EMAIL = 'portal@example.com';
  const ORG_ID = 'org_portal';
  const CUSTOMER_ID = 'cus_portal123';
  const STRIPE_ACCOUNT_ID = 'acct_portal123';

  const seedValidData = async () => {
    await seed('subscriptions', VALID_SUB_ID, {
      donorEmail: DONOR_EMAIL,
      customerId: CUSTOMER_ID,
      organizationId: ORG_ID,
    });
    await seed('organizations', ORG_ID, {
      stripe: { accountId: STRIPE_ACCOUNT_ID },
    });
  };

  beforeEach(async () => {
    stubAuth(DONOR_EMAIL);
    await seedValidData();
    ensureStripeInitialized.mockReturnValue({
      billingPortal: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'bps_test',
            url: 'https://billing.stripe.com/session/test',
          }),
        },
      },
    });
  });

  it('returns 405 for non-POST requests', async () => {
    const res = makeRes();
    await createCustomerPortalSession(makeReq({ method: 'GET', token: 'valid' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when no auth header is present', async () => {
    const res = makeRes();
    await createCustomerPortalSession(makeReq({ body: { subscriptionId: VALID_SUB_ID } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    stubAuthFail();
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'bad' }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token was not issued by donor magic link', async () => {
    stubWrongPurposeAuth(DONOR_EMAIL);
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'admin-token' }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when subscriptionId is missing', async () => {
    const res = makeRes();
    await createCustomerPortalSession(makeReq({ body: {}, token: 'valid' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/subscription id/i);
  });

  it('returns 400 when subscriptionId is too short', async () => {
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'short' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when subscription does not exist', async () => {
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_nonexistent_id' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when authenticated email does not match subscription', async () => {
    stubAuth('attacker@example.com');
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/permission/i);
  });

  it('returns 403 for metadata.donorEmail mismatch too', async () => {
    await seed('subscriptions', 'sub_meta_only', {
      metadata: { donorEmail: 'real@example.com' },
      customerId: CUSTOMER_ID,
      organizationId: ORG_ID,
    });
    stubAuth('attacker@example.com');

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_meta_only' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it('returns 500 when subscription is missing customerId', async () => {
    await seed('subscriptions', 'sub_no_customer', {
      donorEmail: DONOR_EMAIL,
      organizationId: ORG_ID,
      // customerId intentionally omitted
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_no_customer' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it('returns 500 when organization does not exist', async () => {
    await seed('subscriptions', 'sub_bad_org', {
      donorEmail: DONOR_EMAIL,
      customerId: CUSTOMER_ID,
      organizationId: 'org_missing',
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_bad_org' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it('returns 500 when organization has no Stripe account configured', async () => {
    await seed('organizations', 'org_no_stripe', { stripe: {} });
    await seed('subscriptions', 'sub_no_stripe', {
      donorEmail: DONOR_EMAIL,
      customerId: CUSTOMER_ID,
      organizationId: 'org_no_stripe',
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_no_stripe' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it('returns 500 when Stripe account ID has invalid format', async () => {
    await seed('organizations', 'org_bad_acct', {
      stripe: { accountId: 'invalid_format' },
    });
    await seed('subscriptions', 'sub_bad_acct', {
      donorEmail: DONOR_EMAIL,
      customerId: CUSTOMER_ID,
      organizationId: 'org_bad_acct',
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_bad_acct' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it('returns 200 with portal URL on success', async () => {
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toBe('https://billing.stripe.com/session/test');
  });

  it('creates portal session on platform account (no stripeAccount param)', async () => {
    const stripeMock = ensureStripeInitialized();
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'valid' }),
      res,
    );

    const createCall = stripeMock.billingPortal.sessions.create.mock.calls[0][0];
    expect(createCall.customer).toBe(CUSTOMER_ID);
    // Must NOT include stripeAccount - customers live on platform account
    expect(createCall.stripeAccount).toBeUndefined();
  });

  it('accepts subscription with email in metadata.donorEmail', async () => {
    await seed('subscriptions', 'sub_meta_email', {
      metadata: { donorEmail: DONOR_EMAIL },
      customerId: CUSTOMER_ID,
      organizationId: ORG_ID,
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: 'sub_meta_email' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(200);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    // Freeze time so the window boundary is deterministic
    const frozenNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(frozenNow);

    // Seed 10 timestamps firmly inside the current window
    const timestamps = Array.from({ length: 10 }, (_, i) => frozenNow - 50000 + i);
    await seed('rate_limits', DONOR_EMAIL, {
      userId: DONOR_EMAIL,
      timestamps,
      updatedAt: frozenNow,
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'valid' }),
      res,
    );

    jest.spyOn(Date, 'now').mockRestore();
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/too many requests/i);
  });

  it('allows request after rate limit window expires', async () => {
    // Freeze time so the window boundary is deterministic
    const frozenNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(frozenNow);

    // All timestamps are firmly outside the 60s window
    const timestamps = Array.from({ length: 10 }, (_, i) => frozenNow - 120000 + i);
    await seed('rate_limits', DONOR_EMAIL, {
      userId: DONOR_EMAIL,
      timestamps,
      updatedAt: frozenNow - 120000,
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'valid' }),
      res,
    );

    jest.spyOn(Date, 'now').mockRestore();
    expect(res.statusCode).toBe(200);
  });

  it('handles Stripe API errors gracefully', async () => {
    const stripeError = new Error('No such customer');
    stripeError.type = 'StripeInvalidRequestError';
    stripeError.code = 'resource_missing';
    ensureStripeInitialized.mockReturnValue({
      billingPortal: {
        sessions: { create: jest.fn().mockRejectedValue(stripeError) },
      },
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: VALID_SUB_ID }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(404);
    // Must not expose internal error details
    expect(res.body.error).not.toContain('No such customer');
  });
});

// ===========================================================================
// getPaymentHistory
// ===========================================================================

describe('getPaymentHistory', () => {
  const DONOR_EMAIL = 'history@example.com';
  const SUB_ID = 'sub_history_001';

  const seedSub = async (overrides = {}) => {
    await seed('subscriptions', SUB_ID, {
      donorEmail: DONOR_EMAIL,
      customerId: 'cus_hist',
      organizationId: 'org_hist',
      campaignId: 'camp_hist',
      ...overrides,
    });
  };

  beforeEach(() => {
    stubAuth(DONOR_EMAIL);
  });

  it('returns 405 for GET requests without subscriptionId support', async () => {
    const res = makeRes();
    await getPaymentHistory(makeReq({ method: 'DELETE', token: 'valid' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('returns 401 when no auth header is present', async () => {
    const res = makeRes();
    await getPaymentHistory(makeReq({ method: 'POST', body: { subscriptionId: SUB_ID } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    stubAuthFail();
    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'bad' }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when token was not issued by donor magic link', async () => {
    stubWrongPurposeAuth(DONOR_EMAIL);
    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'admin-tok' }),
      res,
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when subscriptionId is missing', async () => {
    const res = makeRes();
    await getPaymentHistory(makeReq({ method: 'POST', body: {}, token: 'valid' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/subscription id/i);
  });

  it('returns 404 when subscription does not exist', async () => {
    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: 'sub_nonexistent_xyz' }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when authenticated email does not match subscription', async () => {
    await seedSub();
    stubAuth('attacker@example.com');
    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it('returns empty payments array when no donations exist for subscription', async () => {
    await seedSub();
    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.payments).toEqual([]);
    expect(res.body.count).toBe(0);
    expect(res.body.subscriptionId).toBe(SUB_ID);
  });

  it('returns donations linked by subscriptionId field', async () => {
    await seedSub();
    await seed('donations', 'don_1', {
      subscriptionId: SUB_ID,
      amount: 1000,
      currency: 'gbp',
      donorEmail: DONOR_EMAIL,
      campaignId: 'camp_hist',
      campaignTitleSnapshot: 'Help Dogs',
      isGiftAid: false,
      createdAt: admin.firestore.Timestamp.fromMillis(2000),
    });

    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'valid' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.payments[0].amount).toBe(1000);
    expect(res.body.payments[0].campaignTitle).toBe('Help Dogs');
    expect(res.body.payments[0].isGiftAid).toBe(false);
  });

  it('returns payments via email+campaignId fallback for legacy donations', async () => {
    await seedSub();
    await seed('donations', 'don_legacy', {
      // No subscriptionId field — legacy storage
      donorEmail: DONOR_EMAIL,
      campaignId: 'camp_hist',
      amount: 500,
      currency: 'gbp',
      isGiftAid: true,
      createdAt: admin.firestore.Timestamp.fromMillis(1000),
    });

    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'valid' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.payments[0].isGiftAid).toBe(true);
  });

  it('deduplicates donations that match both query patterns', async () => {
    await seedSub();
    await seed('donations', 'don_both', {
      subscriptionId: SUB_ID,
      donorEmail: DONOR_EMAIL,
      campaignId: 'camp_hist',
      amount: 750,
      currency: 'gbp',
      isGiftAid: false,
      createdAt: admin.firestore.Timestamp.fromMillis(1000),
    });

    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'valid' }),
      res,
    );

    expect(res.body.count).toBe(1);
  });

  it('sorts payments newest first', async () => {
    await seedSub();
    await seed('donations', 'don_old', {
      subscriptionId: SUB_ID,
      amount: 500,
      currency: 'gbp',
      createdAt: admin.firestore.Timestamp.fromMillis(1000),
    });
    await seed('donations', 'don_new', {
      subscriptionId: SUB_ID,
      amount: 1000,
      currency: 'gbp',
      createdAt: admin.firestore.Timestamp.fromMillis(5000),
    });

    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: SUB_ID }, token: 'valid' }),
      res,
    );

    expect(res.body.payments[0].id).toBe('don_new');
    expect(res.body.payments[1].id).toBe('don_old');
  });

  it('accepts subscription email stored in metadata.donorEmail', async () => {
    await seed('subscriptions', 'sub_meta_hist', {
      metadata: { donorEmail: DONOR_EMAIL },
      customerId: 'cus_mh',
      organizationId: 'org_hist',
      campaignId: 'camp_hist',
    });
    await seed('donations', 'don_meta', {
      subscriptionId: 'sub_meta_hist',
      amount: 800,
      currency: 'gbp',
      createdAt: admin.firestore.Timestamp.fromMillis(1000),
    });

    const res = makeRes();
    await getPaymentHistory(
      makeReq({ method: 'POST', body: { subscriptionId: 'sub_meta_hist' }, token: 'valid' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
  });
});

// ===========================================================================
// Rate limiter (Firestore transaction)
// ===========================================================================

describe('Firestore rate limiter', () => {
  const USER = 'ratelimit@example.com';
  const RL_SUB_ID = 'sub_rl_test_001'; // must be >= 10 chars

  // We test the rate limiter indirectly through createCustomerPortalSession
  // since checkRateLimit is not exported. The tests below verify the
  // Firestore document state after requests.

  beforeEach(async () => {
    stubAuth(USER);
    await seed('subscriptions', RL_SUB_ID, {
      donorEmail: USER,
      customerId: 'cus_rl',
      organizationId: 'org_rl',
    });
    await seed('organizations', 'org_rl', {
      stripe: { accountId: 'acct_rl123456' },
    });
    ensureStripeInitialized.mockReturnValue({
      billingPortal: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: 'bps_rl',
            url: 'https://billing.stripe.com/rl',
          }),
        },
      },
    });
  });

  it('records a timestamp in rate_limits after a successful request', async () => {
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: RL_SUB_ID }, token: 'valid' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const doc = admin.__getDoc('rate_limits', USER);
    expect(doc).toBeDefined();
    expect(doc.timestamps.length).toBe(1);
    expect(doc.userId).toBe(USER);
  });

  it('accumulates timestamps across multiple requests', async () => {
    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      await createCustomerPortalSession(
        makeReq({ body: { subscriptionId: RL_SUB_ID }, token: 'valid' }),
        res,
      );
      expect(res.statusCode).toBe(200);
    }

    const doc = admin.__getDoc('rate_limits', USER);
    expect(doc.timestamps.length).toBe(3);
  });

  it('blocks the 11th request within the same window', async () => {
    // Make 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const res = makeRes();
      await createCustomerPortalSession(
        makeReq({ body: { subscriptionId: RL_SUB_ID }, token: 'valid' }),
        res,
      );
      expect(res.statusCode).toBe(200);
    }

    // 11th request must be rejected
    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: RL_SUB_ID }, token: 'valid' }),
      res,
    );
    expect(res.statusCode).toBe(429);
  });

  it('prunes expired timestamps so old requests do not count', async () => {
    // Freeze time so the window boundary is deterministic
    const frozenNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(frozenNow);

    // Seed 9 timestamps firmly outside the 60s window
    const oldTimestamps = Array.from({ length: 9 }, (_, i) => frozenNow - 120000 + i);
    await seed('rate_limits', USER, {
      userId: USER,
      timestamps: oldTimestamps,
      updatedAt: frozenNow - 120000,
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: RL_SUB_ID }, token: 'valid' }),
      res,
    );

    jest.spyOn(Date, 'now').mockRestore();
    expect(res.statusCode).toBe(200);

    // Only the new timestamp should remain
    const doc = admin.__getDoc('rate_limits', USER);
    expect(doc.timestamps.length).toBe(1);
  });

  it('uses merge:true so extra fields on the document are preserved', async () => {
    // Pre-seed the document with an extra field
    await seed('rate_limits', USER, {
      userId: USER,
      timestamps: [],
      updatedAt: 0,
      customField: 'preserved',
    });

    const res = makeRes();
    await createCustomerPortalSession(
      makeReq({ body: { subscriptionId: RL_SUB_ID }, token: 'valid' }),
      res,
    );

    const doc = admin.__getDoc('rate_limits', USER);
    expect(doc.customField).toBe('preserved');
  });
});
