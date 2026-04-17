const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const isSystemAdmin = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('system_admin');
};

const hasDonationExportPermission = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('export_donations') || permissions.includes('system_admin');
};

const getCallerProfile = async (uid) => {
  const callerDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!callerDoc.exists) {
    const error = new Error('Caller is not a valid user');
    error.code = 403;
    throw error;
  }

  return callerDoc.data() || {};
};

const ensureDonationExportAccess = async (auth, requestedOrganizationId) => {
  const callerData = await getCallerProfile(auth.uid);
  const callerOrganizationId =
    typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';

  if (!hasDonationExportPermission(callerData)) {
    const error = new Error('You do not have permission to export donations');
    error.code = 403;
    throw error;
  }

  if (!requestedOrganizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }

  if (!isSystemAdmin(callerData) && callerOrganizationId !== requestedOrganizationId) {
    const error = new Error('You can only export donations for your organization');
    error.code = 403;
    throw error;
  }

  return callerData;
};

const parseDateOnly = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const validated = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (
    validated.getUTCFullYear() !== year ||
    validated.getUTCMonth() !== month - 1 ||
    validated.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

const buildUtcStart = (dateParts) => {
  return new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0, 0));
};

const buildUtcEnd = (dateParts) => {
  return new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 23, 59, 59, 999));
};

const resolveDateRange = ({ range, startDate, endDate }) => {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();

  if (range === 'current_month') {
    const start = new Date(Date.UTC(utcYear, utcMonth, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(utcYear, utcMonth + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  if (range === 'past_month') {
    const targetMonth = utcMonth - 1;
    const year = targetMonth < 0 ? utcYear - 1 : utcYear;
    const month = targetMonth < 0 ? 11 : targetMonth;
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  if (range === 'custom') {
    const startParts = parseDateOnly(startDate);
    const endParts = parseDateOnly(endDate);
    if (!startParts || !endParts) {
      const error = new Error('startDate and endDate are required for custom range');
      error.code = 400;
      throw error;
    }
    const start = buildUtcStart(startParts);
    const end = buildUtcEnd(endParts);
    if (end < start) {
      const error = new Error('endDate must be on or after startDate');
      error.code = 400;
      throw error;
    }
    return { start, end };
  }

  const error = new Error('range must be current_month, past_month, or custom');
  error.code = 400;
  throw error;
};

const asDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const getEffectiveTimestamp = (donation) => {
  return (
    asDate(donation.paymentCompletedAt) || asDate(donation.timestamp) || asDate(donation.createdAt)
  );
};

const isRecurringDonation = (donation) => {
  if (donation.isRecurring) return true;
  if (donation.subscriptionId) return true;
  if (donation.recurringInterval) return true;
  if (typeof donation.transactionId === 'string' && donation.transactionId.startsWith('sub_')) {
    return true;
  }
  return false;
};

const getCampaignDisplayName = (donation) => {
  const snapshotTitle = String(
    donation.campaignTitleSnapshot || donation.campaignTitle || '',
  ).trim();
  return snapshotTitle || 'Deleted Campaign';
};

const normalizeExportFilters = (rawFilters) => {
  const filters = rawFilters && typeof rawFilters === 'object' ? rawFilters : {};
  const searchTerm = typeof filters.searchTerm === 'string' ? filters.searchTerm.trim() : '';
  const status = typeof filters.status === 'string' ? filters.status.trim() : 'all';
  const campaignId = typeof filters.campaignId === 'string' ? filters.campaignId.trim() : 'all';
  const recurring = typeof filters.recurring === 'string' ? filters.recurring.trim() : 'all';
  const date = typeof filters.date === 'string' ? filters.date.trim() : '';

  return {
    searchTerm: searchTerm.toLowerCase(),
    status: status || 'all',
    campaignId: campaignId || 'all',
    recurring: recurring.toLowerCase() || 'all',
    date,
  };
};

const donationMatchesFilters = (donation, filters) => {
  const donorName = String(donation?.donorName || '').toLowerCase();
  const paymentIntentId = String(donation?.stripePaymentIntentId || '').toLowerCase();
  const transactionId = String(donation?.transactionId || '').toLowerCase();
  const campaignName = getCampaignDisplayName(donation).toLowerCase();
  const donationDate = getEffectiveTimestamp(donation);

  const matchesSearch =
    !filters.searchTerm ||
    donorName.includes(filters.searchTerm) ||
    paymentIntentId.includes(filters.searchTerm) ||
    transactionId.includes(filters.searchTerm) ||
    campaignName.includes(filters.searchTerm);
  const matchesStatus = filters.status === 'all' || donation.paymentStatus === filters.status;
  const matchesCampaign =
    filters.campaignId === 'all' || String(donation.campaignId || '') === filters.campaignId;

  const recurring = isRecurringDonation(donation);
  const matchesRecurring =
    filters.recurring === 'all' ||
    (filters.recurring === 'recurring' && recurring) ||
    (filters.recurring === 'one_time' && !recurring);

  const matchesDate =
    !filters.date ||
    (donationDate ? donationDate.toISOString().slice(0, 10) === filters.date : false);

  return matchesSearch && matchesStatus && matchesCampaign && matchesRecurring && matchesDate;
};

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

const buildCsv = (rows, headers) => {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
};

const buildExportRows = (donations) => {
  return donations.map((donation) => {
    const effectiveDate = getEffectiveTimestamp(donation);
    const isoTimestamp = effectiveDate ? effectiveDate.toISOString() : '';
    const transactionId =
      donation.stripePaymentIntentId || donation.transactionId || donation.id || '';

    return [
      donation.donorName || 'Anonymous',
      donation.donorEmail || '',
      getCampaignDisplayName(donation),
      donation.amount || 0,
      donation.currency || '',
      donation.paymentStatus || '',
      donation.isGiftAid ? 'Yes' : 'No',
      isRecurringDonation(donation) ? 'Yes' : 'No',
      donation.recurringInterval || '',
      donation.subscriptionId || '',
      donation.invoiceId || '',
      transactionId,
      donation.platform || '',
      isoTimestamp,
    ];
  });
};

const EXPORT_HEADERS = [
  'donorName',
  'donorEmail',
  'campaign',
  'amount',
  'currency',
  'paymentStatus',
  'isGiftAid',
  'isRecurring',
  'recurringInterval',
  'subscriptionId',
  'invoiceId',
  'transactionId',
  'platform',
  'timestamp',
];

const exportDonations = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const organizationId =
        typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      await ensureDonationExportAccess(auth, organizationId);

      const range = typeof req.body?.range === 'string' ? req.body.range : '';
      const requestedFilters = normalizeExportFilters(req.body?.filters);
      const { start, end } = resolveDateRange({
        range,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate,
      });

      const snapshot = await admin
        .firestore()
        .collection('donations')
        .where('organizationId', '==', organizationId)
        .get();

      const donations = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const filtered = donations.filter((donation) => {
        const effectiveDate = getEffectiveTimestamp(donation);
        if (!effectiveDate) return false;
        if (effectiveDate < start || effectiveDate > end) return false;
        return donationMatchesFilters(donation, requestedFilters);
      });

      const rows = buildExportRows(filtered);
      const csvContent = buildCsv(rows, EXPORT_HEADERS);

      const startToken = start.toISOString().slice(0, 10).replace(/-/g, '');
      const endToken = end.toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `donations-${range}-${startToken}-${endToken}.csv`;

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('Error exporting donations:', error);
      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to export donations',
      });
    }
  });
};

module.exports = {
  exportDonations,
};
