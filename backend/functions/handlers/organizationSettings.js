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
  const role = typeof callerData?.role === 'string' ? callerData.role : '';
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];

  return (
    role === 'admin' ||
    role === 'super_admin' ||
    permissions.includes(permission) ||
    permissions.includes('system_admin')
  );
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

const normalizeDisplayName = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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

const ensureDisplayNameAvailable = async (
  organizationId,
  nextDisplayName,
  currentOrganizationData,
) => {
  const nextNormalizedName = normalizeDisplayName(nextDisplayName);
  if (!nextNormalizedName) {
    return;
  }

  const currentNormalizedName = normalizeDisplayName(
    resolveOrganizationDisplayName(currentOrganizationData),
  );
  if (nextNormalizedName === currentNormalizedName) {
    return;
  }

  const organizationsSnapshot = await admin.firestore().collection('organizations').get();
  const hasConflict = organizationsSnapshot.docs.some((organizationDoc) => {
    if (organizationDoc.id === organizationId) {
      return false;
    }

    const candidateDisplayName = resolveOrganizationDisplayName(organizationDoc.data() || {});
    const candidateNormalizedName = normalizeDisplayName(candidateDisplayName);
    return candidateNormalizedName && candidateNormalizedName === nextNormalizedName;
  });

  if (hasConflict) {
    const error = new Error(
      'Organization display name already exists. Please choose a different name.',
    );
    error.code = 409;
    throw error;
  }
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

const extractStoragePathFromUrl = (url) => {
  if (!url) {
    return null;
  }

  try {
    if (url.startsWith('gs://')) {
      const withoutPrefix = url.replace(/^gs:\/\/[^/]+\//, '');
      return withoutPrefix || null;
    }

    const parsedUrl = new URL(url);
    const objectPathParam = parsedUrl.searchParams.get('name');
    if (objectPathParam) {
      return decodeURIComponent(objectPathParam);
    }

    const marker = '/o/';
    const markerIndex = parsedUrl.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    const encodedPath = parsedUrl.pathname.slice(markerIndex + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
};

const assertAssetBelongsToOrganization = (url, organizationId, pathRegex, fieldName) => {
  if (!url) {
    return;
  }

  const storagePath = extractStoragePathFromUrl(url);
  const match = storagePath ? storagePath.match(pathRegex) : null;

  if (!match || match[1] !== organizationId) {
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

      await ensureDisplayNameAvailable(
        organizationId,
        settings.displayName,
        currentOrganizationData,
      );

      const updatedAt = new Date().toISOString();
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
