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

const buildTimestampToken = (isoTimestamp) => {
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
      if (validationErrors.length > 0) {
        return res.status(400).send({
          error: 'Some Gift Aid declarations are missing required HMRC schedule fields.',
          validationErrors,
        });
      }

      const exportedAt = new Date().toISOString();
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
          rowCount: declarations.length,
          declarationIds: declarations.map((declaration) => declaration.id),
        });

      const batchId = batchRef.id;
      const timestampToken = buildTimestampToken(exportedAt);
      const hmrcFileName = `gift-aid-hmrc-schedule-${timestampToken}.csv`;
      const internalFileName = `gift-aid-internal-pence-${timestampToken}.csv`;
      const storageBasePath = `giftAidExports/${organizationId}/${batchId}`;
      const bucket = admin.storage().bucket();

      const hmrcCsv = buildHmrcScheduleCsv(declarations);
      const internalCsv = buildInternalGiftAidCsv(declarations);

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
        declarationIds: declarations.map((declaration) => declaration.id),
        batchId,
        actorId: auth.uid,
        exportedAt,
      });

      const giftAidTotalPence = declarations.reduce(
        (sum, declaration) => sum + (Number(declaration.giftAidAmount) || 0),
        0,
      );
      const donationTotalPence = declarations.reduce(
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
          updatedAt: exportedAt,
        },
        { merge: true },
      );

      return res.status(200).send({
        success: true,
        empty: false,
        batchId,
        rowCount: declarations.length,
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
              failedAt: new Date().toISOString(),
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

module.exports = {
  exportGiftAidDeclarations,
  downloadGiftAidExportBatchFile,
};
