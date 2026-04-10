const HMRC_SCHEDULE_HEADERS = [
  'Title',
  'First name or initial',
  'Last name',
  'House name or number',
  'Postcode',
  'Aggregated donations',
  'Sponsored event',
  'Donation date',
  'Amount',
];

const INTERNAL_EXPORT_HEADERS = [
  'Title',
  'Donor First Name',
  'Donor Surname',
  'House Number',
  'Address Line 1',
  'Address Line 2',
  'Town',
  'Postcode',
  'Donation Amount (Pence)',
  'Gift Aid Amount (Pence)',
  'Donation Date',
  'Tax Year',
  'Campaign Title',
  'Donation ID',
];

const sanitizeSpreadsheetFormula = (value) => {
  if (typeof value !== 'string') return value;
  if (/^[\t\r\n ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
};

const escapeCsvValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  const stringValue = String(sanitizeSpreadsheetFormula(value));
  if (
    stringValue.includes('"') ||
    stringValue.includes(',') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const formatHmrcDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const formatIsoDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatPoundsFromPence = (amountPence) => {
  if (!Number.isFinite(amountPence)) {
    return null;
  }

  return (amountPence / 100).toFixed(2);
};

const buildMissingFieldList = (declaration) => {
  const missing = [];

  if (!String(declaration.donorFirstName || '').trim()) missing.push('donorFirstName');
  if (!String(declaration.donorSurname || '').trim()) missing.push('donorSurname');
  if (!String(declaration.donorHouseNumber || '').trim()) missing.push('donorHouseNumber');
  if (!String(declaration.donorPostcode || '').trim()) missing.push('donorPostcode');
  if (!declaration.donationDate || !formatHmrcDate(declaration.donationDate))
    missing.push('donationDate');
  if (!Number.isFinite(declaration.donationAmount) || declaration.donationAmount <= 0)
    missing.push('donationAmount');

  return missing;
};

const validateGiftAidDeclarationsForHmrcSchedule = (declarations) => {
  return declarations
    .map((declaration) => ({
      declarationId: declaration.id,
      donationId: declaration.donationId || null,
      missingFields: buildMissingFieldList(declaration),
    }))
    .filter((entry) => entry.missingFields.length > 0);
};

const sortDeclarationsForExport = (declarations) => {
  return [...declarations].sort((left, right) => {
    const leftDate = Date.parse(left.donationDate || '');
    const rightDate = Date.parse(right.donationDate || '');

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return String(left.id).localeCompare(String(right.id));
  });
};

const buildHmrcScheduleCsv = (declarations) => {
  const rows = sortDeclarationsForExport(declarations).map((declaration) => {
    const hmrcDate = formatHmrcDate(declaration.donationDate);
    const amount = formatPoundsFromPence(declaration.donationAmount);

    if (!hmrcDate || !amount) {
      throw new Error(`Unable to format HMRC export row for declaration ${declaration.id}`);
    }

    return [
      escapeCsvValue(declaration.donorTitle || ''),
      escapeCsvValue(declaration.donorFirstName || ''),
      escapeCsvValue(declaration.donorSurname || ''),
      escapeCsvValue(declaration.donorHouseNumber || ''),
      escapeCsvValue(declaration.donorPostcode || ''),
      escapeCsvValue(''),
      escapeCsvValue(''),
      escapeCsvValue(hmrcDate),
      escapeCsvValue(amount),
    ];
  });

  return [HMRC_SCHEDULE_HEADERS, ...rows].map((row) => row.join(',')).join('\n');
};

const buildInternalGiftAidCsv = (declarations) => {
  const rows = sortDeclarationsForExport(declarations).map((declaration) => {
    const donationDate = formatIsoDate(declaration.donationDate);

    if (!donationDate) {
      throw new Error(`Unable to format internal export row for declaration ${declaration.id}`);
    }

    return [
      escapeCsvValue(declaration.donorTitle || ''),
      escapeCsvValue(declaration.donorFirstName || ''),
      escapeCsvValue(declaration.donorSurname || ''),
      escapeCsvValue(declaration.donorHouseNumber || ''),
      escapeCsvValue(declaration.donorAddressLine1 || ''),
      escapeCsvValue(declaration.donorAddressLine2 || ''),
      escapeCsvValue(declaration.donorTown || ''),
      escapeCsvValue(declaration.donorPostcode || ''),
      escapeCsvValue(declaration.donationAmount),
      escapeCsvValue(declaration.giftAidAmount),
      escapeCsvValue(donationDate),
      escapeCsvValue(declaration.taxYear || ''),
      escapeCsvValue(declaration.campaignTitle || ''),
      escapeCsvValue(declaration.donationId || ''),
    ];
  });

  return [INTERNAL_EXPORT_HEADERS, ...rows].map((row) => row.join(',')).join('\n');
};

module.exports = {
  HMRC_SCHEDULE_HEADERS,
  INTERNAL_EXPORT_HEADERS,
  buildHmrcScheduleCsv,
  buildInternalGiftAidCsv,
  formatHmrcDate,
  formatPoundsFromPence,
  validateGiftAidDeclarationsForHmrcSchedule,
};
