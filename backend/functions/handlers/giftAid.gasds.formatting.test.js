const {
  resolveCampaignMode,
  resolveGasdsIneligibilityReason,
  resolveLocationSnapshot,
  buildGasdsCsv,
  escapeCsvValue,
} = require('./giftAid');

describe('GASDS formatting and eligibility helpers', () => {
  it('resolves campaign mode from supported field fallbacks', () => {
    expect(resolveCampaignMode({ campaign_mode: 'activity' })).toBe('ACTIVITY');
    expect(resolveCampaignMode({ campaignMode: 'donation' })).toBe('DONATION');
    expect(resolveCampaignMode({ metadata: { campaign_mode: 'activity' } })).toBe('ACTIVITY');
    expect(resolveCampaignMode({ metadata: { campaignMode: 'donation' } })).toBe('DONATION');
    expect(resolveCampaignMode({})).toBe('DONATION');
  });

  it('computes ineligibility reasons correctly', () => {
    expect(resolveGasdsIneligibilityReason({ amountMajor: 31, campaignMode: 'DONATION' })).toBe(
      'over_30',
    );
    expect(resolveGasdsIneligibilityReason({ amountMajor: 20, campaignMode: 'ACTIVITY' })).toBe(
      'non_donation_mode',
    );
    expect(resolveGasdsIneligibilityReason({ amountMajor: 31, campaignMode: 'ACTIVITY' })).toBe(
      'over_30_and_non_donation_mode',
    );
    expect(resolveGasdsIneligibilityReason({ amountMajor: 20, campaignMode: 'DONATION' })).toBe('');
  });

  it('resolves location snapshot with addressLine1 fallback to city', () => {
    expect(
      resolveLocationSnapshot({
        location_snapshot: {
          name: 'Hall',
          postcode: 'AB12',
          addressLine1: '1 High Street',
          city: 'London',
        },
      }),
    ).toEqual({
      name: 'Hall',
      postcode: 'AB12',
      addressLine1: '1 High Street',
    });

    expect(
      resolveLocationSnapshot({
        location_snapshot: {
          name: 'Hall',
          postcode: 'AB12',
          city: 'London',
        },
      }),
    ).toEqual({
      name: 'Hall',
      postcode: 'AB12',
      addressLine1: 'London',
    });
  });

  it('guards spreadsheet formulas and escapes CSV safely', () => {
    expect(escapeCsvValue('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvValue('+cmd')).toBe("'+cmd");
    expect(escapeCsvValue('-1+2')).toBe("'-1+2");
    expect(escapeCsvValue('@A1')).toBe("'@A1");
    expect(escapeCsvValue('normal,text')).toBe('"normal,text"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('builds GASDS CSV with expected headers and row values', () => {
    const csv = buildGasdsCsv([
      {
        donation_id: 'pi_1',
        amount: '25.00',
        date: '2026-04-05T00:00:00.000Z',
        method: 'kiosk',
        location_name: 'My Hall',
        postcode: 'AB12',
        address_line1: '1 Street',
        tax_year: '2025-2026',
        campaign_mode: 'DONATION',
        is_gasds_eligible: 'true',
        gift_aid_matched_in_same_year: 'true',
        reason_not_eligible: '',
      },
    ]);

    const lines = csv.split('\n');
    expect(lines[0]).toContain('donation_id');
    expect(lines[0]).toContain('reason_not_eligible');
    expect(lines[1]).toContain('pi_1');
    expect(lines[1]).toContain('25.00');
    expect(lines[1]).toContain('DONATION');
  });
});
