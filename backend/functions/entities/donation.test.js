jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));

const admin = require('firebase-admin');
const { createDonationDoc } = require('./donation');

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
