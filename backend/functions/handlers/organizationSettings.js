const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const DISPLAY_NAME_MAX_LENGTH = 40;
const THANK_YOU_MESSAGE_MAX_LENGTH = 140;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const getCallerProfile = async (uid) => {
  const callerDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!callerDoc.exists) {
    const error = new Error('Caller is not a valid user');
    error.code = 403;
    throw error;
  }

  return callerDoc.data() || {};
};

const hasOrgSettingsWriteAccess = (callerData) => {
  const role = typeof callerData?.role === 'string' ? callerData.role : '';
  const permissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];

  return (
    role === 'admin' ||
    role === 'super_admin' ||
    permissions.includes('manage_permissions') ||
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

const validateAndNormalizeSettingsPayload = (body) => {
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!organizationId) {
    const error = new Error('organizationId is required');
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
    settings: {
      displayName,
      logoUrl,
      idleImageUrl,
      accentColorHex,
      thankYouMessage,
    },
  };
};

const updateOrganizationSettings = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);
      const { organizationId, settings } = validateAndNormalizeSettingsPayload(req.body);
      const callerData = await getCallerProfile(auth.uid);

      if (!hasOrgSettingsWriteAccess(callerData)) {
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
