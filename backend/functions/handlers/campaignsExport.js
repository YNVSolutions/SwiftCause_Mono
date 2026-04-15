const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const isSystemAdmin = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('system_admin');
};

const hasCampaignExportPermission = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('view_campaigns') || permissions.includes('system_admin');
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

const ensureCampaignExportAccess = async (auth, requestedOrganizationId) => {
  const callerData = await getCallerProfile(auth.uid);
  const callerOrganizationId =
    typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';

  if (!hasCampaignExportPermission(callerData)) {
    const error = new Error('You do not have permission to export campaigns');
    error.code = 403;
    throw error;
  }

  if (!requestedOrganizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }

  if (!isSystemAdmin(callerData) && callerOrganizationId !== requestedOrganizationId) {
    const error = new Error('You can only export campaigns for your organization');
    error.code = 403;
    throw error;
  }
};

const sanitizeSpreadsheetFormula = (value) => {
  if (typeof value !== 'string') return value;
  if (/^[\t\r\n ]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
};

const serializeValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const escapeCsvValue = (value) => {
  const stringValue = String(sanitizeSpreadsheetFormula(serializeValue(value)));
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

const buildTimestampToken = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}Z`;
};

const normalizeExportFilters = (rawFilters) => {
  const filters = rawFilters && typeof rawFilters === 'object' ? rawFilters : {};
  const searchTerm = typeof filters.searchTerm === 'string' ? filters.searchTerm.trim() : '';
  const status = typeof filters.status === 'string' ? filters.status.trim() : 'all';
  const category = typeof filters.category === 'string' ? filters.category.trim() : 'all';
  const dateRange = typeof filters.dateRange === 'string' ? filters.dateRange.trim() : 'all';

  return {
    searchTerm: searchTerm.toLowerCase(),
    status: status || 'all',
    category: category || 'all',
    dateRange: dateRange || 'all',
  };
};

const getDateRangeStart = (range) => {
  const today = new Date();
  switch (range) {
    case 'last30':
      return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'last90':
      return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'last365':
      return new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
};

const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const campaignMatchesFilters = (campaign, filters) => {
  const matchesSearch =
    !filters.searchTerm ||
    (typeof campaign.title === 'string' &&
      campaign.title.toLowerCase().includes(filters.searchTerm)) ||
    (typeof campaign.description === 'string' &&
      campaign.description.toLowerCase().includes(filters.searchTerm)) ||
    (Array.isArray(campaign.tags) &&
      campaign.tags.some(
        (tag) => typeof tag === 'string' && tag.toLowerCase().includes(filters.searchTerm),
      ));

  const matchesStatus = filters.status === 'all' || campaign.status === filters.status;
  const matchesCategory = filters.category === 'all' || campaign.category === filters.category;
  const dateRangeStart = getDateRangeStart(filters.dateRange);
  const campaignEndDate = toDateValue(campaign.endDate);
  const matchesDate = !dateRangeStart || !campaignEndDate || campaignEndDate >= dateRangeStart;

  return matchesSearch && matchesStatus && matchesCategory && matchesDate;
};

const exportCampaigns = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const organizationId =
        typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      const requestedCampaignIds = Array.isArray(req.body?.campaignIds)
        ? req.body.campaignIds
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => Boolean(value))
        : null;
      const requestedFilters = normalizeExportFilters(req.body?.filters);
      await ensureCampaignExportAccess(auth, organizationId);

      const snapshot = await admin
        .firestore()
        .collection('campaigns')
        .where('organizationId', '==', organizationId)
        .get();

      const requestedCampaignIdSet = requestedCampaignIds ? new Set(requestedCampaignIds) : null;
      const requestedCampaignIndex = requestedCampaignIds
        ? new Map(requestedCampaignIds.map((id, index) => [id, index]))
        : null;
      const campaigns = snapshot.docs
        .map((doc) => ({ ...doc.data(), id: doc.id }))
        .filter((campaign) => {
          if (!requestedCampaignIdSet) return true;
          return requestedCampaignIdSet.has(campaign.id);
        })
        .filter((campaign) => campaignMatchesFilters(campaign, requestedFilters));

      if (requestedCampaignIndex) {
        campaigns.sort(
          (a, b) =>
            (requestedCampaignIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (requestedCampaignIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
        );
      }
      const headers = campaigns.length > 0 ? Object.keys(campaigns[0]) : ['id'];
      const rows = campaigns.map((campaign) => headers.map((header) => campaign[header]));
      const csvContent = buildCsv(rows, headers);

      const timestampToken = buildTimestampToken(new Date());
      const fileName = `campaigns-${organizationId}-${timestampToken}.csv`;

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('Error exporting campaigns:', error);
      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to export campaigns',
      });
    }
  });
};

module.exports = {
  exportCampaigns,
};
