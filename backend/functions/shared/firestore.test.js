jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));

const admin = require('firebase-admin');
const { claimWebhookEvent, markEventProcessed } = require('./firestore');

describe('webhook event locking', () => {
  beforeEach(() => {
    admin.__reset();
  });

  it('claims the same webhook event exactly once under parallel delivery', async () => {
    const [first, second] = await Promise.all([
      claimWebhookEvent('evt_1', 'payment_intent.succeeded', { objectId: 'pi_1' }),
      claimWebhookEvent('evt_1', 'payment_intent.succeeded', { objectId: 'pi_1' }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(admin.__getDoc('webhook_events', 'evt_1')).toMatchObject({
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      objectId: 'pi_1',
      status: 'processing',
      attempts: 1,
    });
  });

  it('acknowledges replayed processed events without reopening the lock', async () => {
    await claimWebhookEvent('evt_2', 'invoice.paid', { objectId: 'in_1' });
    await markEventProcessed('evt_2', { objectId: 'in_1' });

    const claimedAgain = await claimWebhookEvent('evt_2', 'invoice.paid', {
      objectId: 'in_1',
    });

    expect(claimedAgain).toBe(false);
    expect(admin.__getDoc('webhook_events', 'evt_2')).toMatchObject({
      status: 'processed',
      objectId: 'in_1',
    });
  });
});
