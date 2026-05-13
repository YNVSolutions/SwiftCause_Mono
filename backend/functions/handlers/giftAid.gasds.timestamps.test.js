const { resolveDonationDate } = require('./giftAid');

describe('GASDS donation date resolution with mixed timestamp fields', () => {
  it('prefers paymentCompletedAt over timestamp and createdAt', () => {
    const donation = {
      paymentCompletedAt: '2026-04-05T12:00:00.000Z',
      timestamp: '2026-04-04T12:00:00.000Z',
      createdAt: '2026-04-03T12:00:00.000Z',
    };
    expect(resolveDonationDate(donation)?.toISOString()).toBe('2026-04-05T12:00:00.000Z');
  });

  it('falls back to timestamp when createdAt is missing', () => {
    const donation = {
      timestamp: '2026-04-04T12:00:00.000Z',
    };
    expect(resolveDonationDate(donation)?.toISOString()).toBe('2026-04-04T12:00:00.000Z');
  });

  it('handles Firestore-like Timestamp objects via toDate()', () => {
    const donation = {
      createdAt: {
        toDate: () => new Date('2026-04-02T12:00:00.000Z'),
      },
    };
    expect(resolveDonationDate(donation)?.toISOString()).toBe('2026-04-02T12:00:00.000Z');
  });

  it('returns null when no parseable date exists', () => {
    expect(resolveDonationDate({ createdAt: 'not-a-date' })).toBeNull();
  });
});
