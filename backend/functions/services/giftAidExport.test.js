const {
  buildHmrcScheduleCsv,
  buildInternalGiftAidCsv,
  validateGiftAidDeclarationsForHmrcSchedule,
} = require('./giftAidExport');

const createDeclaration = (overrides = {}) => ({
  id: 'ga_1',
  donationId: 'don_1',
  donorTitle: '',
  donorFirstName: 'Jane',
  donorSurname: 'Donor',
  donorHouseNumber: '14',
  donorAddressLine1: 'High Street',
  donorAddressLine2: '',
  donorTown: 'Leeds',
  donorPostcode: 'LS1 1AA',
  donationAmount: 1234,
  giftAidAmount: 308,
  donationDate: '2026-04-03T10:20:30.000Z',
  taxYear: '2025-26',
  campaignTitle: 'Spring Appeal',
  ...overrides,
});

describe('giftAidExport formatters', () => {
  it('builds the HMRC schedule CSV in the expected column order', () => {
    const csv = buildHmrcScheduleCsv([
      createDeclaration({
        donorTitle: 'Mrs',
      }),
    ]);

    expect(csv).toBe(
      [
        'Title,First name or initial,Last name,House name or number,Postcode,Aggregated donations,Sponsored event,Donation date,Amount',
        'Mrs,Jane,Donor,14,LS1 1AA,,,03/04/26,12.34',
      ].join('\n'),
    );
  });

  it('builds the internal export in pence-based format', () => {
    const csv = buildInternalGiftAidCsv([
      createDeclaration({
        donorTitle: 'Ms',
      }),
    ]);

    expect(csv).toBe(
      [
        'Title,Donor First Name,Donor Surname,House Number,Address Line 1,Address Line 2,Town,Postcode,Donation Amount (Pence),Gift Aid Amount (Pence),Donation Date,Tax Year,Campaign Title,Donation ID',
        'Ms,Jane,Donor,14,High Street,,Leeds,LS1 1AA,1234,308,2026-04-03,2025-26,Spring Appeal,don_1',
      ].join('\n'),
    );
  });

  it('neutralizes spreadsheet formulas in HMRC CSV fields', () => {
    const csv = buildHmrcScheduleCsv([
      createDeclaration({
        donorTitle: '=Admin',
        donorFirstName: ' +cmd',
        donorSurname: '-2+2',
        donorHouseNumber: '@A1',
        donorPostcode: '\t=SUM(1,1)',
      }),
    ]);

    expect(csv).toBe(
      [
        'Title,First name or initial,Last name,House name or number,Postcode,Aggregated donations,Sponsored event,Donation date,Amount',
        "'=Admin,' +cmd,'-2+2,'@A1,\"\t'=SUM(1,1)\",,,03/04/26,12.34",
      ].join('\n'),
    );
  });

  it('neutralizes spreadsheet formulas in internal CSV fields and keeps numbers unchanged', () => {
    const csv = buildInternalGiftAidCsv([
      createDeclaration({
        donorTitle: '=Ms',
        donorFirstName: '+Jane',
        donorSurname: '-Donor',
        donorHouseNumber: '@14',
        donorAddressLine1: ' =Main Road',
        donorTown: '\t@Leeds',
        donorPostcode: '=LS1 1AA',
        campaignTitle: '@Spring Appeal',
        donationId: '=don_1',
        donationAmount: 1234,
        giftAidAmount: 308,
      }),
    ]);

    expect(csv).toBe(
      [
        'Title,Donor First Name,Donor Surname,House Number,Address Line 1,Address Line 2,Town,Postcode,Donation Amount (Pence),Gift Aid Amount (Pence),Donation Date,Tax Year,Campaign Title,Donation ID',
        "'=Ms,'+Jane,'-Donor,'@14,' =Main Road,,\"\t'@Leeds\",'=LS1 1AA,1234,308,2026-04-03,2025-26,'@Spring Appeal,'=don_1",
      ].join('\n'),
    );
  });

  it('reports missing HMRC-required fields without blocking blank title', () => {
    const errors = validateGiftAidDeclarationsForHmrcSchedule([
      createDeclaration({
        donorTitle: '',
      }),
      createDeclaration({
        id: 'ga_2',
        donorFirstName: '',
        donationAmount: 0,
      }),
    ]);

    expect(errors).toEqual([
      {
        declarationId: 'ga_2',
        donationId: 'don_1',
        missingFields: ['donorFirstName', 'donationAmount'],
      },
    ]);
  });
});
