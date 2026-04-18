const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const isSystemAdmin = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('system_admin');
};

const hasSubscriptionExportPermission = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('export_subscriptions') || permissions.includes('system_admin');
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

const ensureSubscriptionExportAccess = async (auth, requestedOrganizationId) => {
  const callerData = await getCallerProfile(auth.uid);
  const callerOrganizationId =
    typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';

  if (!hasSubscriptionExportPermission(callerData)) {
    const error = new Error('You do not have permission to export subscriptions');
    error.code = 403;
    throw error;
  }

  if (!requestedOrganizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }

  if (!isSystemAdmin(callerData) && callerOrganizationId !== requestedOrganizationId) {
    const error = new Error('You can only export subscriptions for your organization');
    error.code = 403;
    throw error;
  }
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

const sanitizeSpreadsheetFormula = (value) => {
  if (typeof value !== 'string') return value;
  if (/^[\t\r\n ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
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

const formatDate = (value) => {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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

const getSubscriptionDisplayInterval = (subscription) => {
  if (subscription.interval === 'year') return 'Yearly';
  if (subscription.intervalCount === 3) return 'Quarterly';
  return 'Monthly';
};

const normalizeExportFilters = (rawFilters) => {
  const filters = rawFilters && typeof rawFilters === 'object' ? rawFilters : {};
  const searchTerm = typeof filters.searchTerm === 'string' ? filters.searchTerm.trim() : '';
  const status = typeof filters.status === 'string' ? filters.status.trim() : 'all';
  const interval = typeof filters.interval === 'string' ? filters.interval.trim() : 'all';

  return {
    searchTerm: searchTerm.toLowerCase(),
    status: status || 'all',
    interval: interval.toLowerCase() || 'all',
  };
};

const subscriptionMatchesFilters = (subscription, filters) => {
  const donorName = String(subscription?.metadata?.donorName || 'Anonymous').toLowerCase();
  const donorEmail = String(subscription?.metadata?.donorEmail || '').toLowerCase();
  const stripeSubscriptionId = String(subscription?.stripeSubscriptionId || '').toLowerCase();
  const intervalLabel = getSubscriptionDisplayInterval(subscription).toLowerCase();

  const matchesSearch =
    !filters.searchTerm ||
    donorName.includes(filters.searchTerm) ||
    donorEmail.includes(filters.searchTerm) ||
    stripeSubscriptionId.includes(filters.searchTerm);
  const matchesStatus = filters.status === 'all' || subscription.status === filters.status;
  const matchesInterval = filters.interval === 'all' || intervalLabel === filters.interval;

  return matchesSearch && matchesStatus && matchesInterval;
};

const EXPORT_HEADERS = [
  'donorName',
  'donorEmail',
  'stripeSubscriptionId',
  'status',
  'amountMinor',
  'amountDisplay',
  'interval',
  'nextPayment',
  'startedAt',
  'createdAt',
  'canceledAt',
  'cancelReason',
];

const exportSubscriptions = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const organizationId =
        typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      await ensureSubscriptionExportAccess(auth, organizationId);

      const range = typeof req.body?.range === 'string' ? req.body.range : '';
      const requestedFilters = normalizeExportFilters(req.body?.filters);
      const { start, end } = resolveDateRange({
        range,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate,
      });

      const snapshot = await admin
        .firestore()
        .collection('subscriptions')
        .where('organizationId', '==', organizationId)
        .get();

      const subscriptions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const filtered = subscriptions.filter((subscription) => {
        const createdAt = asDate(subscription.createdAt);
        if (!createdAt) return false;
        if (createdAt < start || createdAt > end) return false;
        return subscriptionMatchesFilters(subscription, requestedFilters);
      });

      const rows = filtered.map((subscription) => {
        const amountMinor = Number(subscription.amount) || 0;
        const donorName = subscription?.metadata?.donorName || 'Anonymous';
        const donorEmail = subscription?.metadata?.donorEmail || 'N/A';
        const nextPayment = subscription.nextPaymentAt || subscription.currentPeriodEnd;

        return [
          donorName,
          donorEmail,
          subscription.stripeSubscriptionId || '',
          subscription.status || '',
          amountMinor,
          (amountMinor / 100).toFixed(2),
          getSubscriptionDisplayInterval(subscription),
          formatDate(nextPayment) || 'N/A',
          formatDate(subscription.startedAt) || 'N/A',
          formatDate(subscription.createdAt) || 'N/A',
          formatDate(subscription.canceledAt) || 'N/A',
          subscription.cancelReason || '',
        ];
      });

      const startToken = start.toISOString().slice(0, 10).replace(/-/g, '');
      const endToken = end.toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `subscriptions-${range}-${startToken}-${endToken}.csv`;
      const csvContent = buildCsv(rows, EXPORT_HEADERS);

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('Error exporting subscriptions:', error);
      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to export subscriptions',
      });
    }
  });
};

module.exports = {
  exportSubscriptions,
};
