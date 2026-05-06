const { buildUkTaxYearLabel, resolveUkTaxYearRange } = require('./giftAid');

describe('GASDS UK tax year boundary helpers', () => {
  it('buildUkTaxYearLabel keeps 5 April in previous tax year', () => {
    const date = new Date(Date.UTC(2026, 3, 5, 23, 59, 59, 999));
    expect(buildUkTaxYearLabel(date)).toBe('2025-2026');
  });

  it('buildUkTaxYearLabel moves 6 April into next tax year', () => {
    const date = new Date(Date.UTC(2026, 3, 6, 0, 0, 0, 0));
    expect(buildUkTaxYearLabel(date)).toBe('2026-2027');
  });

  it('resolveUkTaxYearRange returns exact UK boundaries', () => {
    const range = resolveUkTaxYearRange('2025-2026');
    expect(range).not.toBeNull();
    expect(range.start.toISOString()).toBe('2025-04-06T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-04-05T23:59:59.999Z');
  });

  it('resolveUkTaxYearRange rejects invalid labels', () => {
    expect(resolveUkTaxYearRange('2025-2027')).toBeNull();
    expect(resolveUkTaxYearRange('2025/2026')).toBeNull();
  });
});
