jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));

const admin = require('firebase-admin');
const { createDonationDoc, ensureFirestoreTimestamp } = require('./donation');

// ---------------------------------------------------------------------------
// ensureFirestoreTimestamp
// ---------------------------------------------------------------------------

describe('ensureFirestoreTimestamp', () => {
  it('parses the human-readable Firestore display format', () => {
    // "20 April 2026 at 19:06:49 UTC+5:30" is what the Firestore console shows
    // for a Timestamp stored in IST. Node's Date cannot parse it natively.
    const result = ensureFirestoreTimestamp('20 April 2026 at 19:06:49 UTC+5:30');
    expect(result).not.toBeNull();
    expect(result.__type).toBe('timestamp');
    // 2026-04-20T19:06:49+05:30 === 2026-04-20T13:36:49Z → 1745155009000 ms
    expect(result.ms).toBe(new Date('2026-04-20T13:36:49Z').getTime());
  });

  it('returns null for a string that cannot be parsed in any known format', () => {
    // Should NOT fall back to Timestamp.now() — that would corrupt createdAt
    const result = ensureFirestoreTimestamp('not-a-date-at-all');
    expect(result).toBeNull();
  });

  it('returns a Timestamp unchanged when already a Firestore Timestamp', () => {
    const ts = admin.firestore.Timestamp.now();
    expect(ensureFirestoreTimestamp(ts)).toBe(ts);
  });

  it('converts a valid ISO string', () => {
    const result = ensureFirestoreTimestamp('2026-04-20T13:36:49Z');
    expect(result).not.toBeNull();
    expect(result.__type).toBe('timestamp');
    expect(result.ms).toBe(new Date('2026-04-20T13:36:49Z').getTime());
  });
});

// ---------------------------------------------------------------------------
// createDonationDoc — legacy timestamp healing
// ---------------------------------------------------------------------------

describe('createDonationDoc — legacy timestamp healing', () => {
  beforeEach(() => {
    admin.__reset();
  });

  it('heals a parseable legacy createdAt/timestamp string on enrichment', async () => {
    // Seed a document with the human-readable string format
    await createDonationDoc({
      transactionId: 'pi_legacy_heal',
      campaignId: 'camp_heal',
      organizationId: 'org_1',
      amount: 1000,
      currency: 'gbp',
      donorName: 'Anonymous',
      metadata: { source: 'payment_intent' },
    });

    // Manually overwrite timestamps with the legacy string format
    const store = admin.__getDoc('donations', 'pi_legacy_heal');
    const collections = require('../testUtils/mockFirebaseAdmin').__getCollection;
    // Directly mutate via the mock's internal store by re-seeding
    const mockAdmin = require('../testUtils/mockFirebaseAdmin');
    mockAdmin.__reset();
    // Re-create with legacy string timestamps injected via metadata
    // (metadata spread is sanitized for timestamp keys, so we write directly)
    const db = admin.firestore();
    await db.collection('donations').doc('pi_legacy_heal').set({
      transactionId: 'pi_legacy_heal',
      campaignId: 'camp_heal',
      amount: 1000,
      createdAt: '20 April 2026 at 19:06:49 UTC+5:30',
      timestamp: '20 April 2026 at 19:06:49 UTC+5:30',
    });

    // Trigger enrichment — should heal the string timestamps
    await createDonationDoc({
      transactionId: 'pi_legacy_heal',
      campaignId: 'camp_heal',
      organizationId: 'org_1',
      amount: 1000,
      currency: 'gbp',
      donorName: 'Anonymous',
      donorEmail: 'healed@example.com',
      metadata: { source: 'invoice_paid' },
    });

    const doc = admin.__getDoc('donations', 'pi_legacy_heal');
    expect(doc.createdAt).toMatchObject({
      __type: 'timestamp',
      ms: new Date('2026-04-20T13:36:49Z').getTime(),
    });
    expect(doc.timestamp).toMatchObject({
      __type: 'timestamp',
      ms: new Date('2026-04-20T13:36:49Z').getTime(),
    });
    expect(doc.enrichedByWebhook).toBe(true);
  });

  it('preserves an unparseable legacy createdAt string without overwriting it', async () => {
    const db = admin.firestore();
    await db.collection('donations').doc('pi_unparseable').set({
      transactionId: 'pi_unparseable',
      campaignId: 'camp_x',
      amount: 500,
      createdAt: 'totally-invalid-date',
      timestamp: 'totally-invalid-date',
    });

    // Trigger enrichment with a new field so patch is non-empty
    await createDonationDoc({
      transactionId: 'pi_unparseable',
      campaignId: 'camp_x',
      organizationId: 'org_x',
      amount: 500,
      currency: 'gbp',
      donorName: 'Anonymous',
      donorEmail: 'new@example.com',
      metadata: { source: 'invoice_paid' },
    });

    const doc = admin.__getDoc('donations', 'pi_unparseable');
    // createdAt and timestamp must NOT have been overwritten with Timestamp.now()
    expect(doc.createdAt).toBe('totally-invalid-date');
    expect(doc.timestamp).toBe('totally-invalid-date');
    // But the new field was still enriched
    expect(doc.donorEmail).toBe('new@example.com');
    expect(doc.enrichedByWebhook).toBe(true);
  });

  it('does not write updatedAt or enrichedByWebhook on a no-op retry', async () => {
    await createDonationDoc({
      transactionId: 'pi_noop',
      campaignId: 'camp_noop',
      organizationId: 'org_1',
      amount: 750,
      currency: 'gbp',
      donorName: 'Full Name',
      donorEmail: 'full@example.com',
      isRecurring: true,
      recurringInterval: 'monthly',
      subscriptionId: 'sub_noop',
      invoiceId: 'in_noop',
      metadata: { campaignTitleSnapshot: 'Camp', source: 'stripe_webhook' },
    });

    const before = admin.__getDoc('donations', 'pi_noop');
    expect(before.enrichedByWebhook).toBeUndefined();

    // Exact same call — nothing is missing, so patch should be empty
    await createDonationDoc({
      transactionId: 'pi_noop',
      campaignId: 'camp_noop',
      organizationId: 'org_1',
      amount: 750,
      currency: 'gbp',
      donorName: 'Full Name',
      donorEmail: 'full@example.com',
      isRecurring: true,
      recurringInterval: 'monthly',
      subscriptionId: 'sub_noop',
      invoiceId: 'in_noop',
      metadata: { campaignTitleSnapshot: 'Camp', source: 'stripe_webhook' },
    });

    const after = admin.__getDoc('donations', 'pi_noop');
    expect(after.enrichedByWebhook).toBeUndefined();
    expect(after.updatedAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createDonationDoc — original tests
// ---------------------------------------------------------------------------

describe('createDonationDoc', () => {
  beforeEach(() => {
    admin.__reset();
  });

  it('creates one donation and one campaign increment under concurrent writes', async () => {
    const donationData = {
      transactionId: 'pi_parallel',
      campaignId: 'camp_1',
      organizationId: 'org_1',
      amount: 2500,
      currency: 'gbp',
      donorName: 'Donor One',
      donorEmail: 'donor@example.com',
      isRecurring: true,
      recurringInterval: 'monthly',
      subscriptionId: 'sub_1',
      invoiceId: 'in_1',
      metadata: {
        campaignTitleSnapshot: 'Campaign One',
        source: 'stripe_webhook',
      },
    };

    await Promise.all([createDonationDoc(donationData), createDonationDoc(donationData)]);

    expect(admin.__getCollection('donations')).toHaveLength(1);
    expect(admin.__getDoc('donations', 'pi_parallel')).toMatchObject({
      transactionId: 'pi_parallel',
      amount: 2500,
      campaignId: 'camp_1',
      subscriptionId: 'sub_1',
      invoiceId: 'in_1',
    });
    expect(admin.__getDoc('campaigns', 'camp_1')).toMatchObject({
      raised: 2500,
      donationCount: 1,
    });
  });

  it('enriches an existing donation without incrementing campaign stats again', async () => {
    await createDonationDoc({
      transactionId: 'pi_enrich',
      campaignId: 'camp_2',
      organizationId: 'org_2',
      amount: 1000,
      currency: 'gbp',
      donorName: 'Anonymous',
      isRecurring: false,
      metadata: {
        source: 'payment_intent',
      },
    });

    await createDonationDoc({
      transactionId: 'pi_enrich',
      campaignId: 'camp_2',
      organizationId: 'org_2',
      amount: 1000,
      currency: 'gbp',
      donorName: 'Jane Donor',
      donorEmail: 'jane@example.com',
      isRecurring: true,
      recurringInterval: 'monthly',
      subscriptionId: 'sub_2',
      invoiceId: 'in_2',
      metadata: {
        campaignTitleSnapshot: 'Campaign Two',
        source: 'invoice_paid',
      },
    });

    expect(admin.__getDoc('donations', 'pi_enrich')).toMatchObject({
      donorName: 'Anonymous',
      donorEmail: 'jane@example.com',
      isRecurring: true,
      recurringInterval: 'monthly',
      subscriptionId: 'sub_2',
      invoiceId: 'in_2',
      campaignTitleSnapshot: 'Campaign Two',
      enrichedByWebhook: true,
    });
    expect(admin.__getDoc('campaigns', 'camp_2')).toMatchObject({
      raised: 1000,
      donationCount: 1,
    });
  });
});
