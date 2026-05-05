jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));

const admin = require('firebase-admin');
const {
  generateToken,
  hashToken,
  storeToken,
  verifyToken,
  cleanupExpiredTokens,
  deleteOldTokens,
  TOKEN_EXPIRY_MS,
} = require('./tokenManager');

const COLLECTION = 'subscriptionMagicLinkTokens';

const silenceLogs = () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('tokenManager', () => {
  beforeEach(() => {
    admin.__reset();
    jest.clearAllMocks();
    silenceLogs();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates unique 64-character hex tokens', () => {
    const first = generateToken();
    const second = generateToken();

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it('hashes tokens deterministically without returning the plain token', () => {
    const token = 'plain-token';
    const firstHash = hashToken(token);
    const secondHash = hashToken(token);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstHash).not.toBe(token);
  });

  it('stores only the hashed token and normalises email', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    const tokenHash = await storeToken('secret-token', {
      email: ' Donor@Example.com ',
      purpose: 'subscription_management',
    });

    expect(admin.__getDoc(COLLECTION, 'secret-token')).toBeUndefined();

    const stored = admin.__getDoc(COLLECTION, tokenHash);
    expect(stored.email).toBe('donor@example.com');
    expect(stored.purpose).toBe('subscription_management');
    expect(stored.status).toBe('active');
    expect(stored.expiresAt.toMillis()).toBe(now + TOKEN_EXPIRY_MS);
    expect(stored.consumedAt).toBeNull();
  });

  it('verifies and consumes an active token once', async () => {
    await storeToken('one-time-token', {
      email: 'donor@example.com',
      purpose: 'subscription_management',
    });

    const result = await verifyToken('one-time-token');
    expect(result).toEqual(
      expect.objectContaining({
        email: 'donor@example.com',
        purpose: 'subscription_management',
      }),
    );

    const stored = admin.__getDoc(COLLECTION, hashToken('one-time-token'));
    expect(stored.status).toBe('consumed');
    expect(stored.consumedAt.toMillis()).toEqual(expect.any(Number));

    await expect(verifyToken('one-time-token')).rejects.toThrow('TOKEN_CONSUMED');
  });

  it('rejects unknown tokens', async () => {
    await expect(verifyToken('missing-token')).rejects.toThrow('TOKEN_NOT_FOUND');
  });

  it('marks expired active tokens as expired during verification', async () => {
    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start);
    await storeToken('expired-token', {
      email: 'donor@example.com',
      purpose: 'subscription_management',
    });

    Date.now.mockReturnValue(start + TOKEN_EXPIRY_MS + 1);

    await expect(verifyToken('expired-token')).rejects.toThrow('TOKEN_EXPIRED');

    const stored = admin.__getDoc(COLLECTION, hashToken('expired-token'));
    expect(stored.status).toBe('expired');
  });

  it('marks expired active tokens during cleanup', async () => {
    const now = Date.now();
    const db = admin.firestore();
    await db
      .collection(COLLECTION)
      .doc('expired')
      .set({
        email: 'old@example.com',
        status: 'active',
        expiresAt: admin.firestore.Timestamp.fromMillis(now - 1),
      });
    await db
      .collection(COLLECTION)
      .doc('fresh')
      .set({
        email: 'fresh@example.com',
        status: 'active',
        expiresAt: admin.firestore.Timestamp.fromMillis(now + 10000),
      });

    const count = await cleanupExpiredTokens();

    expect(count).toBe(1);
    expect(admin.__getDoc(COLLECTION, 'expired').status).toBe('expired');
    expect(admin.__getDoc(COLLECTION, 'fresh').status).toBe('active');
  });

  it('deletes old consumed and expired tokens', async () => {
    const now = Date.now();
    const cutoffPast = admin.firestore.Timestamp.fromMillis(now - 31 * 24 * 60 * 60 * 1000);
    const recent = admin.firestore.Timestamp.fromMillis(now);
    const db = admin.firestore();

    await db.collection(COLLECTION).doc('old_consumed').set({
      status: 'consumed',
      consumedAt: cutoffPast,
    });
    await db.collection(COLLECTION).doc('old_expired').set({
      status: 'expired',
      expiresAt: cutoffPast,
    });
    await db.collection(COLLECTION).doc('recent_consumed').set({
      status: 'consumed',
      consumedAt: recent,
    });

    const count = await deleteOldTokens(30);

    expect(count).toBe(2);
    expect(admin.__getDoc(COLLECTION, 'old_consumed')).toBeUndefined();
    expect(admin.__getDoc(COLLECTION, 'old_expired')).toBeUndefined();
    expect(admin.__getDoc(COLLECTION, 'recent_consumed')).toBeDefined();
  });
});
