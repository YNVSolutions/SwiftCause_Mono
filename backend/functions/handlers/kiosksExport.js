const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const isSystemAdmin = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('system_admin');
};

const hasKioskExportPermission = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  return permissions.includes('view_kiosks') || permissions.includes('system_admin');
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

const ensureKioskExportAccess = async (auth, requestedOrganizationId) => {
  const callerData = await getCallerProfile(auth.uid);
  const callerOrganizationId =
    typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';

  if (!hasKioskExportPermission(callerData)) {
    const error = new Error('You do not have permission to export kiosks');
    error.code = 403;
    throw error;
  }

  if (!requestedOrganizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }

  if (!isSystemAdmin(callerData) && callerOrganizationId !== requestedOrganizationId) {
    const error = new Error('You can only export kiosks for your organization');
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

const toIsoDate = (value) => {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return '';
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

  return {
    searchTerm: searchTerm.toLowerCase(),
    status: status || 'all',
  };
};

const kioskMatchesFilters = (kiosk, filters) => {
  const matchesStatus = filters.status === 'all' || kiosk.status === filters.status;
  const matchesSearch =
    !filters.searchTerm ||
    (typeof kiosk.name === 'string' && kiosk.name.toLowerCase().includes(filters.searchTerm)) ||
    (typeof kiosk.location === 'string' &&
      kiosk.location.toLowerCase().includes(filters.searchTerm)) ||
    (typeof kiosk.id === 'string' && kiosk.id.toLowerCase().includes(filters.searchTerm));

  return matchesStatus && matchesSearch;
};

const buildKioskPerformanceMap = (donations) => {
  const map = new Map();

  donations.forEach((donation) => {
    const kioskId = typeof donation.kioskId === 'string' ? donation.kioskId.trim() : '';
    if (!kioskId) return;

    const existing = map.get(kioskId) || {
      totalRaised: 0,
      donorIds: new Set(),
    };

    existing.totalRaised += Number(donation.amount) || 0;
    if (donation.donorId) {
      existing.donorIds.add(String(donation.donorId));
    }

    map.set(kioskId, existing);
  });

  return map;
};

const EXPORT_HEADERS = [
  'name',
  'location',
  'status',
  'kioskId',
  'totalRaised',
  'totalDonations',
  'assignedCampaigns',
  'lastActive',
];

const exportKiosks = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const organizationId =
        typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      const requestedFilters = normalizeExportFilters(req.body?.filters);
      await ensureKioskExportAccess(auth, organizationId);

      const kiosksQuery = admin
        .firestore()
        .collection('kiosks')
        .where('organizationId', '==', organizationId);
      const kiosksSnapshotPromise =
        requestedFilters.status && requestedFilters.status !== 'all'
          ? kiosksQuery.where('status', '==', requestedFilters.status).get()
          : kiosksQuery.get();

      const [kiosksSnapshot, donationsSnapshot] = await Promise.all([
        kiosksSnapshotPromise,
        admin
          .firestore()
          .collection('donations')
          .where('organizationId', '==', organizationId)
          .get(),
      ]);

      const kiosks = kiosksSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((kiosk) => kioskMatchesFilters(kiosk, requestedFilters));
      const donations = donationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const performanceMap = buildKioskPerformanceMap(donations);

      const rows = kiosks.map((kiosk) => {
        const performance = performanceMap.get(kiosk.id);
        const assignedCount = Array.isArray(kiosk.assignedCampaigns)
          ? kiosk.assignedCampaigns.filter(Boolean).length
          : 0;

        return [
          kiosk.name || '',
          kiosk.location || '',
          kiosk.status || '',
          kiosk.id || '',
          performance?.totalRaised || 0,
          performance?.donorIds?.size || 0,
          assignedCount,
          toIsoDate(kiosk.lastActive),
        ];
      });

      const csvContent = buildCsv(rows, EXPORT_HEADERS);
      const timestampToken = buildTimestampToken(new Date());
      const fileName = `kiosks-${organizationId}-${timestampToken}.csv`;

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('Error exporting kiosks:', error);
      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to export kiosks',
      });
    }
  });
};

module.exports = {
  exportKiosks,
};
