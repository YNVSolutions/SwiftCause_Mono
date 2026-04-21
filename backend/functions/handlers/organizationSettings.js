const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const DISPLAY_NAME_MAX_LENGTH = 40;
const THANK_YOU_MESSAGE_MAX_LENGTH = 140;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const LOGO_STORAGE_PATH_REGEX = /^organizations\/([^/]+)\/settings\/logo\//;
const IDLE_IMAGE_STORAGE_PATH_REGEX = /^organizations\/([^/]+)\/settings\/idleImage\//;
const IDENTITY_PERMISSION = 'change_org_identity';
const BRANDING_PERMISSION = 'change_org_branding';

const getCallerProfile = async (uid) => {
  const callerDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!callerDoc.exists) {
    const error = new Error('Caller is not a valid user');
    error.code = 403;
    throw error;
  }

  return callerDoc.data() || {};
};

const hasAnyOrgSettingsWriteAccess = (callerData) => {
  return (
    hasOrgSettingsWriteAccessForPermission(callerData, IDENTITY_PERMISSION) ||
    hasOrgSettingsWriteAccessForPermission(callerData, BRANDING_PERMISSION)
  );
};

const hasOrgSettingsWriteAccessForPermission = (callerData, permission) => {
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];

  return permissions.includes(permission) || permissions.includes('system_admin');
};

const normalizeOptionalString = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
};

const resolveOrganizationDisplayName = (organizationData) => {
  if (!organizationData || typeof organizationData !== 'object') {
    return '';
  }

  const settings =
    organizationData.settings && typeof organizationData.settings === 'object'
      ? organizationData.settings
      : null;

  if (settings && typeof settings.displayName === 'string' && settings.displayName.trim()) {
    return settings.displayName.trim();
  }

  if (typeof organizationData.name === 'string' && organizationData.name.trim()) {
    return organizationData.name.trim();
  }

  if (
    typeof organizationData.organizationName === 'string' &&
    organizationData.organizationName.trim()
  ) {
    return organizationData.organizationName.trim();
  }

  return '';
};

const validateAndNormalizeSettingsPayload = (body) => {
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!organizationId) {
    const error = new Error('organizationId is required');
    error.code = 400;
    throw error;
  }
  const section = body?.section;
  if (section !== undefined && section !== 'identity' && section !== 'branding') {
    const error = new Error("section must be either 'identity' or 'branding'");
    error.code = 400;
    throw error;
  }

  const settings = body?.settings || {};
  const displayName = typeof settings.displayName === 'string' ? settings.displayName.trim() : '';
  if (!displayName) {
    const error = new Error('displayName is required');
    error.code = 400;
    throw error;
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    const error = new Error(`displayName must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`);
    error.code = 400;
    throw error;
  }

  const accentColorHex =
    typeof settings.accentColorHex === 'string' ? settings.accentColorHex.trim() : '';
  if (!accentColorHex) {
    const error = new Error('accentColorHex is required');
    error.code = 400;
    throw error;
  }
  if (!HEX_COLOR_REGEX.test(accentColorHex)) {
    const error = new Error('accentColorHex must be a valid HEX color in #RRGGBB format');
    error.code = 400;
    throw error;
  }

  const logoUrl = normalizeOptionalString(settings.logoUrl);
  const idleImageUrl = normalizeOptionalString(settings.idleImageUrl);
  const thankYouMessage = normalizeOptionalString(settings.thankYouMessage);

  if (thankYouMessage && thankYouMessage.length > THANK_YOU_MESSAGE_MAX_LENGTH) {
    const error = new Error(
      `thankYouMessage must be ${THANK_YOU_MESSAGE_MAX_LENGTH} characters or fewer`,
    );
    error.code = 400;
    throw error;
  }

  if (logoUrl && !/^(https?:\/\/|gs:\/\/)/.test(logoUrl)) {
    const error = new Error('logoUrl must be an HTTP(S) or gs:// URL');
    error.code = 400;
    throw error;
  }

  if (idleImageUrl && !/^(https?:\/\/|gs:\/\/)/.test(idleImageUrl)) {
    const error = new Error('idleImageUrl must be an HTTP(S) or gs:// URL');
    error.code = 400;
    throw error;
  }

  const logoWidth = parseNumberOrNull(settings.logoWidth ?? body?.logoWidth);
  const logoHeight = parseNumberOrNull(settings.logoHeight ?? body?.logoHeight);
  if (logoUrl) {
    if (!logoWidth || !logoHeight || logoWidth <= 0 || logoHeight <= 0) {
      const error = new Error('logoWidth and logoHeight are required when logoUrl is provided');
      error.code = 400;
      throw error;
    }

    if (logoWidth !== logoHeight) {
      const error = new Error('Organization logo must use a 1:1 aspect ratio');
      error.code = 400;
      throw error;
    }
  }

  return {
    organizationId,
    section,
    settings: {
      displayName,
      logoUrl,
      idleImageUrl,
      accentColorHex,
      thankYouMessage,
    },
  };
};

const STORAGE_HOST_WHITELIST = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

const getAllowedStorageBuckets = () => {
  const configuredBucket = admin.app()?.options?.storageBucket;
  const envBucket = process.env.FIREBASE_STORAGE_BUCKET;
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
  const projectDerivedBuckets = projectId
    ? [`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`]
    : [];

  return new Set([configuredBucket, envBucket, ...projectDerivedBuckets].filter(Boolean));
};

const extractStorageReferenceFromUrl = (url) => {
  if (!url) {
    return null;
  }

  try {
    if (url.startsWith('gs://')) {
      const withoutPrefix = url.replace(/^gs:\/\//, '');
      const firstSlashIndex = withoutPrefix.indexOf('/');
      if (firstSlashIndex === -1) {
        return null;
      }

      const bucket = withoutPrefix.slice(0, firstSlashIndex);
      const path = withoutPrefix.slice(firstSlashIndex + 1);
      if (!bucket || !path) {
        return null;
      }

      return { bucket, path };
    }

    const parsedUrl = new URL(url);
    if (!STORAGE_HOST_WHITELIST.has(parsedUrl.hostname)) {
      return null;
    }

    // Firebase download URL shape: /v0/b/<bucket>/o/<encodedPath>
    const firebaseBucketMatch = parsedUrl.pathname.match(/^\/v0\/b\/([^/]+)\/o\/?/);
    const queryPath = parsedUrl.searchParams.get('name');
    if (firebaseBucketMatch && queryPath) {
      return {
        bucket: firebaseBucketMatch[1],
        path: decodeURIComponent(queryPath),
      };
    }

    if (firebaseBucketMatch) {
      const marker = '/o/';
      const markerIndex = parsedUrl.pathname.indexOf(marker);
      const encodedPath =
        markerIndex >= 0 ? parsedUrl.pathname.slice(markerIndex + marker.length) : '';
      if (encodedPath) {
        return {
          bucket: firebaseBucketMatch[1],
          path: decodeURIComponent(encodedPath),
        };
      }
    }

    // GCS URL shape: https://storage.googleapis.com/<bucket>/<path>
    if (parsedUrl.hostname === 'storage.googleapis.com') {
      const parts = parsedUrl.pathname.replace(/^\/+/, '').split('/');
      if (parts.length >= 2) {
        const [bucket, ...objectParts] = parts;
        const path = decodeURIComponent(objectParts.join('/'));
        if (bucket && path) {
          return { bucket, path };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
};

const assertAssetBelongsToOrganization = (url, organizationId, pathRegex, fieldName) => {
  if (!url) {
    return;
  }

  const storageRef = extractStorageReferenceFromUrl(url);
  const match = storageRef?.path ? storageRef.path.match(pathRegex) : null;
  const allowedBuckets = getAllowedStorageBuckets();
  const isAllowedBucket = storageRef?.bucket && allowedBuckets.has(storageRef.bucket);

  if (!match || match[1] !== organizationId || !isAllowedBucket) {
    const error = new Error(`${fieldName} must reference an uploaded asset for this organization`);
    error.code = 400;
    throw error;
  }
};

const normalizeHexColor = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toUpperCase();
};

const normalizeIdentityField = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const resolveSettingsForDiff = (organizationData) => {
  if (!organizationData || typeof organizationData !== 'object') {
    return {};
  }
  if (!organizationData.settings || typeof organizationData.settings !== 'object') {
    return {};
  }

  return organizationData.settings;
};

const updateOrganizationSettings = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const { organizationId, section, settings } = validateAndNormalizeSettingsPayload(req.body);
      assertAssetBelongsToOrganization(
        settings.logoUrl,
        organizationId,
        LOGO_STORAGE_PATH_REGEX,
        'logoUrl',
      );
      assertAssetBelongsToOrganization(
        settings.idleImageUrl,
        organizationId,
        IDLE_IMAGE_STORAGE_PATH_REGEX,
        'idleImageUrl',
      );
      const callerData = await getCallerProfile(auth.uid);

      if (!hasAnyOrgSettingsWriteAccess(callerData)) {
        return res.status(403).send({
          error: 'You do not have permission to update organization settings',
        });
      }

      const callerRole = typeof callerData.role === 'string' ? callerData.role : '';
      const callerOrganizationId =
        typeof callerData.organizationId === 'string' ? callerData.organizationId.trim() : '';
      const callerPermissions = Array.isArray(callerData.permissions) ? callerData.permissions : [];
      const isPrivileged =
        callerRole === 'super_admin' || callerPermissions.includes('system_admin');

      if (!isPrivileged && callerOrganizationId !== organizationId) {
        return res.status(403).send({
          error: 'You can only update settings for your organization',
        });
      }

      const orgRef = admin.firestore().collection('organizations').doc(organizationId);
      const orgSnapshot = await orgRef.get();
      if (!orgSnapshot.exists) {
        return res.status(404).send({ error: 'Organization not found' });
      }

      const currentOrganizationData = orgSnapshot.data() || {};
      const currentSettings = resolveSettingsForDiff(currentOrganizationData);
      const identityChanged =
        normalizeIdentityField(settings.displayName) !==
          normalizeIdentityField(resolveOrganizationDisplayName(currentOrganizationData)) ||
        normalizeIdentityField(settings.thankYouMessage) !==
          normalizeIdentityField(currentSettings.thankYouMessage);
      const brandingChanged =
        normalizeHexColor(settings.accentColorHex) !==
          normalizeHexColor(currentSettings.accentColorHex) ||
        normalizeOptionalString(settings.logoUrl) !==
          normalizeOptionalString(currentSettings.logoUrl) ||
        normalizeOptionalString(settings.idleImageUrl) !==
          normalizeOptionalString(currentSettings.idleImageUrl);

      if (section === 'identity' && brandingChanged) {
        return res.status(400).send({
          error: 'Branding fields cannot be changed when section is identity',
        });
      }

      if (section === 'branding' && identityChanged) {
        return res.status(400).send({
          error: 'Identity fields cannot be changed when section is branding',
        });
      }

      if (
        identityChanged &&
        !hasOrgSettingsWriteAccessForPermission(callerData, IDENTITY_PERMISSION)
      ) {
        return res.status(403).send({
          error: 'You do not have permission to change organization identity',
        });
      }

      if (
        brandingChanged &&
        !hasOrgSettingsWriteAccessForPermission(callerData, BRANDING_PERMISSION)
      ) {
        return res.status(403).send({
          error: 'You do not have permission to change organization branding',
        });
      }

      const updatedAt = admin.firestore.Timestamp.now();
      await orgRef.set(
        {
          settings: {
            ...settings,
            updatedAt,
            updatedBy: auth.uid,
          },
        },
        { merge: true },
      );

      return res.status(200).send({
        success: true,
        organizationId,
        settings: {
          ...settings,
          updatedAt,
          updatedBy: auth.uid,
        },
      });
    } catch (error) {
      console.error('Error updating organization settings:', error);
      const statusCode = Number.isInteger(error.code) ? error.code : 500;
      return res.status(statusCode).send({
        error: error.message || 'Failed to update organization settings',
      });
    }
  });
};

module.exports = {
  updateOrganizationSettings,
};
