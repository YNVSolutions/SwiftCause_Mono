const admin = require('firebase-admin');
const crypto = require('crypto');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');
const {
  GIFT_AID_OPERATIONAL_STATUS,
  GIFT_AID_HMRC_CLAIM_STATUS,
} = require('../shared/giftAidContract');
const {
  buildHmrcScheduleCsv,
  buildInternalGiftAidCsv,
  validateGiftAidDeclarationsForHmrcSchedule,
} = require('../services/giftAidExport');

const DOWNLOAD_URL_TTL_MS = 1000 * 60 * 60;
const WRITE_BATCH_SIZE = 400;
const isUsingStorageEmulator = () => Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);

const hasGiftAidExportPermission = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];

  return permissions.includes('export_giftaid') || permissions.includes('system_admin');
};

const hasGiftAidBatchDownloadPermission = (callerData) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];

  return permissions.includes('download_giftaid_exports') || permissions.includes('system_admin');
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

const ensureGiftAidExportAccess = async (auth, requestedOrganizationId) => {
  const callerData = await getCallerProfile(auth.uid);
  const callerRole = typeof callerData.role === 'string' ? callerData.role : '';
  const callerOrganizationId =
    typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';
  const isPrivileged = callerRole === 'super_admin';

  if (!hasGiftAidExportPermission(callerData)) {
    const error = new Error('You do not have permission to export Gift Aid data');
    error.code = 403;
    throw error;
  }

  if (!requestedOrganizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }

  if (!isPrivileged && callerOrganizationId !== requestedOrganizationId) {
    const error = new Error('You can only export Gift Aid data for your organization');
    error.code = 403;
    throw error;
  }

  return callerData;
};

const ensureGiftAidBatchDownloadAccess = async (auth, requestedOrganizationId) => {
  const callerData = await getCallerProfile(auth.uid);
  const callerRole = typeof callerData.role === 'string' ? callerData.role : '';
  const callerOrganizationId =
    typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';
  const isPrivileged = callerRole === 'super_admin';

  if (!hasGiftAidBatchDownloadPermission(callerData)) {
    const error = new Error('You do not have permission to download Gift Aid exports');
    error.code = 403;
    throw error;
  }

  if (!requestedOrganizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }

  if (!isPrivileged && callerOrganizationId !== requestedOrganizationId) {
    const error = new Error('You can only download Gift Aid exports for your organization');
    error.code = 403;
    throw error;
  }

  return callerData;
};

const buildTimestampToken = (timestamp) => {
  // Convert Firestore Timestamp to ISO string if needed.
  // Duck-type on .toMillis() — works with both the real Admin SDK Timestamp
  // and the test mock, avoiding a broken instanceof check.
  const isoTimestamp =
    typeof timestamp === 'object' && timestamp !== null && typeof timestamp.toMillis === 'function'
      ? new Date(timestamp.toMillis()).toISOString()
      : timestamp;

  return isoTimestamp
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace('T', '-');
};

const createCsvStorageFile = async ({ bucket, storagePath, fileName, csvContent }) => {
  const file = bucket.file(storagePath);
  await file.save(csvContent, {
    contentType: 'text/csv; charset=utf-8',
    metadata: {
      contentDisposition: `attachment; filename="${fileName}"`,
      cacheControl: 'private, max-age=0, no-transform',
    },
  });

  let downloadUrl = null;
  if (!isUsingStorageEmulator()) {
    try {
      [downloadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + DOWNLOAD_URL_TTL_MS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Gift Aid export could not generate signed URL; falling back to storage path.', {
        storagePath,
        message,
      });
    }
  }

  return {
    fileName,
    storagePath,
    downloadUrl,
    sha256: crypto.createHash('sha256').update(csvContent).digest('hex'),
    sizeBytes: Buffer.byteLength(csvContent, 'utf8'),
  };
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const updateDeclarationsAsExported = async ({ declarationIds, batchId, actorId, exportedAt }) => {
  const db = admin.firestore();
  const chunks = chunkArray(declarationIds, WRITE_BATCH_SIZE);

  for (const ids of chunks) {
    const batch = db.batch();
    ids.forEach((declarationId) => {
      const ref = db.collection('giftAidDeclarations').doc(declarationId);
      batch.set(
        ref,
        {
          operationalStatus: GIFT_AID_OPERATIONAL_STATUS.EXPORTED,
          hmrcClaimStatus: GIFT_AID_HMRC_CLAIM_STATUS.INCLUDED,
          exportedAt,
          exportBatchId: batchId,
          exportActorId: actorId,
          updatedAt: exportedAt,
        },
        { merge: true },
      );
    });
    await batch.commit();
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
  if (value === undefined || value === null) return '';
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

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildUkTaxYearLabel = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const startYear = month > 4 || (month === 4 && day >= 6) ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

const resolveUkTaxYearRange = (taxYear) => {
  const value = typeof taxYear === 'string' ? taxYear.trim() : '';
  const match = /^(\d{4})-(\d{4})$/.exec(value);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear !== startYear + 1) {
    return null;
  }

  const start = new Date(Date.UTC(startYear, 3, 6, 0, 0, 0, 0));
  const end = new Date(Date.UTC(endYear, 3, 5, 23, 59, 59, 999));
  return { start, end, label: value };
};

const resolveDonationDate = (donation) => {
  return (
    toDate(donation.paymentCompletedAt) ||
    toDate(donation.timestamp) ||
    toDate(donation.createdAt) ||
    null
  );
};

const resolveCampaignMode = (donation) => {
  const direct = typeof donation.campaign_mode === 'string' ? donation.campaign_mode.trim() : '';
  if (direct) return direct.toUpperCase();

  const camel = typeof donation.campaignMode === 'string' ? donation.campaignMode.trim() : '';
  if (camel) return camel.toUpperCase();

  const metadataSnake =
    typeof donation?.metadata?.campaign_mode === 'string'
      ? donation.metadata.campaign_mode.trim()
      : '';
  if (metadataSnake) return metadataSnake.toUpperCase();

  const metadataCamel =
    typeof donation?.metadata?.campaignMode === 'string'
      ? donation.metadata.campaignMode.trim()
      : '';
  if (metadataCamel) return metadataCamel.toUpperCase();

  return 'DONATION';
};

const resolveLocationSnapshot = (donation) => {
  const snapshot =
    donation && typeof donation.location_snapshot === 'object' ? donation.location_snapshot : null;
  if (!snapshot) return null;
  return {
    name: typeof snapshot.name === 'string' ? snapshot.name.trim() : '',
    postcode: typeof snapshot.postcode === 'string' ? snapshot.postcode.trim() : '',
    addressLine1: typeof snapshot.addressLine1 === 'string' ? snapshot.addressLine1.trim() : '',
  };
};

const buildGasdsCsv = (rows) => {
  const headers = [
    'donation_id',
    'amount',
    'date',
    'method',
    'location_name',
    'postcode',
    'address_line1',
    'tax_year',
    'campaign_mode',
    'is_gasds_eligible',
  ];

  const csvRows = rows.map((row) =>
    [
      row.donation_id,
      row.amount,
      row.date,
      row.method,
      row.location_name,
      row.postcode,
      row.address_line1,
      row.tax_year,
      row.campaign_mode,
      row.is_gasds_eligible,
    ]
      .map(escapeCsvValue)
      .join(','),
  );

  return [headers.join(','), ...csvRows].join('\n');
};

const fetchCapturedDeclarations = async (organizationId) => {
  const snapshot = await admin
    .firestore()
    .collection('giftAidDeclarations')
    .where('organizationId', '==', organizationId)
    .where('operationalStatus', '==', GIFT_AID_OPERATIONAL_STATUS.CAPTURED)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

const resolveBatchFile = (batchData, fileKind) => {
  if (fileKind === 'hmrc') {
    return batchData.hmrcFile || null;
  }

  if (fileKind === 'internal') {
    return batchData.internalFile || null;
  }

  return null;
};

const exportGiftAidDeclarations = (req, res) => {
  cors(req, res, async () => {
    let batchRef = null;

    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const organizationId =
        typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      const callerData = await ensureGiftAidExportAccess(auth, organizationId);
      const declarations = await fetchCapturedDeclarations(organizationId);

      if (declarations.length === 0) {
        return res.status(200).send({
          success: true,
          empty: true,
          rowCount: 0,
          message: 'No captured Gift Aid declarations are available to export.',
        });
      }

      const validationErrors = validateGiftAidDeclarationsForHmrcSchedule(declarations);
      const invalidDeclarationIds = new Set(
        validationErrors.map((validationError) => validationError.declarationId),
      );
      const exportableDeclarations = declarations.filter(
        (declaration) => !invalidDeclarationIds.has(declaration.id),
      );
      const skippedCount = declarations.length - exportableDeclarations.length;
      const validationErrorPreview = validationErrors.slice(0, 50);

      if (exportableDeclarations.length === 0) {
        return res.status(400).send({
          error: 'Some Gift Aid declarations are missing required HMRC schedule fields.',
          validationErrors: validationErrorPreview,
          validationErrorCount: validationErrors.length,
        });
      }

      const exportedAt = admin.firestore.Timestamp.now();
      batchRef = await admin
        .firestore()
        .collection('giftAidExportBatches')
        .add({
          organizationId,
          status: 'pending',
          createdAt: exportedAt,
          createdByUserId: auth.uid,
          createdByEmail: auth.email || callerData.email || null,
          createdByName: callerData.username || null,
          formatVersion: 'hmrc-schedule-v1',
          scope: {
            operationalStatus: GIFT_AID_OPERATIONAL_STATUS.CAPTURED,
            exportPath: 'standard-uk-schedule',
          },
          rowCount: exportableDeclarations.length,
          skippedCount,
          declarationIds: exportableDeclarations.map((declaration) => declaration.id),
          validationErrors: validationErrors.length > 0 ? validationErrorPreview : [],
          validationErrorCount: validationErrors.length,
        });

      const batchId = batchRef.id;
      const timestampToken = buildTimestampToken(exportedAt);
      const hmrcFileName = `gift-aid-hmrc-schedule-${timestampToken}.csv`;
      const internalFileName = `gift-aid-internal-pence-${timestampToken}.csv`;
      const storageBasePath = `giftAidExports/${organizationId}/${batchId}`;
      const bucket = admin.storage().bucket();

      const hmrcCsv = buildHmrcScheduleCsv(exportableDeclarations);
      const internalCsv = buildInternalGiftAidCsv(exportableDeclarations);

      const hmrcFile = await createCsvStorageFile({
        bucket,
        storagePath: `${storageBasePath}/${hmrcFileName}`,
        fileName: hmrcFileName,
        csvContent: hmrcCsv,
      });
      const internalFile = await createCsvStorageFile({
        bucket,
        storagePath: `${storageBasePath}/${internalFileName}`,
        fileName: internalFileName,
        csvContent: internalCsv,
      });

      await updateDeclarationsAsExported({
        declarationIds: exportableDeclarations.map((declaration) => declaration.id),
        batchId,
        actorId: auth.uid,
        exportedAt,
      });

      const giftAidTotalPence = exportableDeclarations.reduce(
        (sum, declaration) => sum + (Number(declaration.giftAidAmount) || 0),
        0,
      );
      const donationTotalPence = exportableDeclarations.reduce(
        (sum, declaration) => sum + (Number(declaration.donationAmount) || 0),
        0,
      );

      await batchRef.set(
        {
          batchId,
          status: 'completed',
          completedAt: exportedAt,
          hmrcFile,
          internalFile,
          giftAidTotalPence,
          donationTotalPence,
          skippedCount,
          validationErrors: validationErrors.length > 0 ? validationErrorPreview : [],
          validationErrorCount: validationErrors.length,
          updatedAt: exportedAt,
        },
        { merge: true },
      );

      return res.status(200).send({
        success: true,
        empty: false,
        batchId,
        rowCount: exportableDeclarations.length,
        skippedCount,
        validationErrors: validationErrors.length > 0 ? validationErrorPreview : [],
        validationErrorCount: validationErrors.length,
        message:
          skippedCount > 0
            ? `Exported ${exportableDeclarations.length} declaration(s). Skipped ${skippedCount} declaration(s) missing HMRC fields.`
            : undefined,
        exportedAt,
        hmrcFile,
        internalFile,
      });
    } catch (error) {
      console.error('Error exporting Gift Aid declarations:', error);

      if (batchRef) {
        try {
          await batchRef.set(
            {
              status: 'failed',
              failureMessage: error.message || 'Gift Aid export failed',
              failedAt: admin.firestore.Timestamp.now(),
            },
            { merge: true },
          );
        } catch (batchError) {
          console.error('Failed to update Gift Aid export batch status:', batchError);
        }
      }

      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to export Gift Aid declarations',
      });
    }
  });
};

const downloadGiftAidExportBatchFile = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const batchId = typeof req.body?.batchId === 'string' ? req.body.batchId.trim() : '';
      const fileKind = typeof req.body?.fileKind === 'string' ? req.body.fileKind.trim() : '';

      if (!batchId) {
        return res.status(400).send({ error: 'batchId is required' });
      }

      if (fileKind !== 'hmrc' && fileKind !== 'internal') {
        return res.status(400).send({ error: "fileKind must be 'hmrc' or 'internal'" });
      }

      const batchSnapshot = await admin
        .firestore()
        .collection('giftAidExportBatches')
        .doc(batchId)
        .get();

      if (!batchSnapshot.exists) {
        return res.status(404).send({ error: 'Gift Aid export batch not found' });
      }

      const batchData = batchSnapshot.data() || {};
      const organizationId =
        typeof batchData.organizationId === 'string' ? batchData.organizationId.trim() : '';

      await ensureGiftAidBatchDownloadAccess(auth, organizationId);

      const fileMeta = resolveBatchFile(batchData, fileKind);
      const storagePath =
        typeof fileMeta?.storagePath === 'string' ? fileMeta.storagePath.trim() : '';
      const fileName = typeof fileMeta?.fileName === 'string' ? fileMeta.fileName.trim() : '';

      if (!storagePath || !fileName) {
        return res.status(404).send({ error: 'Requested Gift Aid export file is unavailable' });
      }

      const storageFile = admin.storage().bucket().file(storagePath);
      const [exists] = await storageFile.exists();

      if (!exists) {
        return res
          .status(404)
          .send({ error: 'Gift Aid export file could not be found in storage' });
      }

      const [buffer] = await storageFile.download();

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Error downloading Gift Aid export batch file:', error);

      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to download Gift Aid export batch file',
      });
    }
  });
};

const exportGasdsCsv = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const organizationId =
        typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
      await ensureGiftAidExportAccess(auth, organizationId);

      const taxYear = typeof req.body?.taxYear === 'string' ? req.body.taxYear.trim() : '';
      const resolvedTaxYear = resolveUkTaxYearRange(taxYear);
      if (!resolvedTaxYear) {
        return res.status(400).send({ error: 'taxYear must be in YYYY-YYYY format' });
      }

      const requestedLocationIds = Array.isArray(req.body?.locationIds)
        ? req.body.locationIds
            .map((value) => (typeof value === 'string' ? value.trim() : ''))
            .filter(Boolean)
        : [];

      if (requestedLocationIds.length === 0) {
        return res.status(400).send({ error: 'At least one location must be selected' });
      }

      const snapshot = await admin
        .firestore()
        .collection('donations')
        .where('organizationId', '==', organizationId)
        .get();

      const selectedLocationIds = new Set(requestedLocationIds);
      const rows = [];
      for (const doc of snapshot.docs) {
        const donation = doc.data() || {};
        const locationId =
          typeof donation.location_id === 'string' ? donation.location_id.trim() : null;
        if (!locationId || !selectedLocationIds.has(locationId)) continue;

        const donationDate = resolveDonationDate(donation);
        if (!donationDate) continue;
        if (donationDate < resolvedTaxYear.start || donationDate > resolvedTaxYear.end) continue;

        const taxYearLabel = buildUkTaxYearLabel(donationDate);
        if (!taxYearLabel || taxYearLabel !== resolvedTaxYear.label) continue;

        const campaignMode = resolveCampaignMode(donation);
        const amount = Number(donation.amount);
        const amountMajor = Number.isFinite(amount) ? amount : 0;
        const isEligible = amountMajor <= 30 && campaignMode === 'DONATION';
        const locationSnapshot = resolveLocationSnapshot(donation);

        rows.push({
          donation_id: donation.transactionId || donation.stripePaymentIntentId || doc.id,
          amount: amountMajor.toFixed(2),
          date: donationDate.toISOString(),
          method: donation.platform || 'unknown',
          location_name: locationSnapshot?.name || '',
          postcode: locationSnapshot?.postcode || '',
          address_line1: locationSnapshot?.addressLine1 || '',
          tax_year: resolvedTaxYear.label,
          campaign_mode: campaignMode,
          is_gasds_eligible: isEligible ? 'true' : 'false',
        });
      }

      rows.sort((left, right) => left.date.localeCompare(right.date));
      const csvContent = buildGasdsCsv(rows);
      const fileName = `gasds-${organizationId}-${resolvedTaxYear.label}.csv`;

      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      return res.status(200).send(csvContent);
    } catch (error) {
      console.error('Error exporting GASDS csv:', error);
      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to export GASDS csv',
      });
    }
  });
};

module.exports = {
  exportGiftAidDeclarations,
  downloadGiftAidExportBatchFile,
  exportGasdsCsv,
};
