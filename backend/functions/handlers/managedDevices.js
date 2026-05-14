const crypto = require('crypto');
const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyAuth } = require('../middleware/auth');

const CONTROLLER_PACKAGE = 'com.swiftcause.devicecontroller';
const KIOSK_PACKAGE = 'com.swiftcause.kiosk';
const HEARTBEAT_INTERVAL_SECONDS = 60;
const ALLOWED_DEVICE_STATUSES = new Set([
  'enrolled',
  'online',
  'offline',
  'installing',
  'install_failed',
  'kiosk_active',
  'error',
]);
const ALLOWED_ADMIN_COMMANDS = new Set([
  'sync_policy',
  'restart_kiosk',
  'refresh_content',
  'clear_error',
]);
const MANAGED_DEVICE_LIST_LIMIT = 100;
const DEVICE_COMMAND_LIST_LIMIT = 50;
const DEVICE_EVENT_LIST_LIMIT = 25;
const PROTECTED_ADMIN_FIELDS = new Set([
  'apkId',
  'assignedKioskApkId',
  'kioskApkId',
  'packageName',
  'controllerPackage',
  'kioskPackage',
  'launchPackage',
  'deviceSecret',
  'deviceSecretHash',
  'organizationId',
  'policy',
  'lockTaskPolicy',
]);

const timestamp = () => admin.firestore.Timestamp.now();

const sendError = (res, code, message) => res.status(code).send({ error: message });

const hashSecret = (secret) => crypto.createHash('sha256').update(secret).digest('hex');

const createDeviceSecret = () => crypto.randomBytes(32).toString('base64url');

const getDeviceSecret = (req) => {
  const authHeader =
    typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) {
    return bearerMatch[1].trim();
  }

  return typeof req.headers?.['x-device-secret'] === 'string'
    ? req.headers['x-device-secret'].trim()
    : '';
};

const requiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${fieldName} is required`);
    error.code = 400;
    throw error;
  }

  return value.trim();
};

const optionalString = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value.trim() || null : null;
};

const rejectProtectedFields = (payload, allowed = []) => {
  const allowedFields = new Set(allowed);
  const blocked = Object.keys(payload || {}).filter(
    (key) => PROTECTED_ADMIN_FIELDS.has(key) && !allowedFields.has(key),
  );
  if (blocked.length > 0) {
    const error = new Error(`Protected fields cannot be updated: ${blocked.join(', ')}`);
    error.code = 400;
    throw error;
  }
};

const validateCoordinate = (value, fieldName, min, max) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    const error = new Error(`${fieldName} must be a number between ${min} and ${max}`);
    error.code = 400;
    throw error;
  }
  return value;
};

const buildDeviceId = ({ organizationId, controllerPackage, androidId, serialNumber }) => {
  const deviceKey = androidId || serialNumber;
  const hash = crypto
    .createHash('sha256')
    .update(`${organizationId}:${controllerPackage}:${deviceKey}`)
    .digest('hex')
    .slice(0, 24);

  return `device_${hash}`;
};

const getDevice = async (deviceId) => {
  const doc = await admin.firestore().collection('managedDevices').doc(deviceId).get();
  if (!doc.exists) {
    const error = new Error('Managed device not found');
    error.code = 404;
    throw error;
  }

  return { id: doc.id, ...doc.data() };
};

const getCaller = async (req) => {
  const auth = await verifyAuth(req);
  const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();
  if (!callerDoc.exists) {
    const error = new Error('Caller is not a valid user');
    error.code = 403;
    throw error;
  }

  const caller = callerDoc.data() || {};
  const permissions = Array.isArray(caller.permissions) ? caller.permissions : [];
  const canManageDevices =
    caller.role === 'admin' ||
    caller.role === 'super_admin' ||
    permissions.includes('system_admin') ||
    permissions.includes('create_kiosk') ||
    permissions.includes('edit_kiosk');
  if (!canManageDevices) {
    const error = new Error('You do not have permission to manage devices');
    error.code = 403;
    throw error;
  }
  if (!caller.organizationId) {
    const error = new Error('Caller organization is required');
    error.code = 403;
    throw error;
  }

  return {
    uid: auth.uid,
    organizationId: caller.organizationId,
    role: caller.role,
    permissions,
  };
};

const getKioskForCaller = async (kioskId, callerOrganizationId) => {
  const kioskDoc = await admin.firestore().collection('kiosks').doc(kioskId).get();
  if (!kioskDoc.exists) {
    const error = new Error('Kiosk not found');
    error.code = 404;
    throw error;
  }

  const kiosk = kioskDoc.data() || {};
  if (kiosk.organizationId !== callerOrganizationId) {
    const error = new Error('Kiosk is not in caller organization');
    error.code = 403;
    throw error;
  }

  return { id: kioskDoc.id, ...kiosk };
};

const getDeviceForCaller = async (deviceId, callerOrganizationId) => {
  const device = await getDevice(deviceId);
  if (device.organizationId !== callerOrganizationId) {
    const error = new Error('Device is not in caller organization');
    error.code = 403;
    throw error;
  }
  return device;
};

const serializeDevice = (device) => ({
  id: device.id,
  organizationId: device.organizationId,
  kioskId: device.kioskId || null,
  status: device.status || null,
  displayName: device.displayName || null,
  placementLabel: device.placementLabel || null,
  placementNotes: device.placementNotes || null,
  latitude: device.latitude ?? null,
  longitude: device.longitude ?? null,
  lastHeartbeatAt: device.lastHeartbeatAt || null,
  lastPolicyFetchAt: device.lastPolicyFetchAt || null,
  lastStatusAt: device.lastStatusAt || null,
  lastError: device.lastError || null,
  installStatus: device.installStatus || null,
  launchStatus: device.launchStatus || null,
  deviceOwner: device.deviceOwner ?? null,
  deviceInfo: device.deviceInfo || {},
});

const getCollectionRows = async (collectionName) => {
  const snapshot = await admin.firestore().collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const mapQueryRows = (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

const getAuthenticatedDevice = async (req, deviceId) => {
  const device = await getDevice(deviceId);
  const deviceSecret = getDeviceSecret(req);
  if (
    !deviceSecret ||
    !device.deviceSecretHash ||
    hashSecret(deviceSecret) !== device.deviceSecretHash
  ) {
    const error = new Error('Invalid device credentials');
    error.code = 401;
    throw error;
  }

  return device;
};

const getAssignedApk = async (device) => {
  if (device.assignedKioskApkId) {
    const apkDoc = await admin
      .firestore()
      .collection('kioskApks')
      .doc(device.assignedKioskApkId)
      .get();
    return apkDoc.exists ? { id: apkDoc.id, ...apkDoc.data() } : null;
  }

  if (device.kioskId) {
    const kioskDoc = await admin.firestore().collection('kiosks').doc(device.kioskId).get();
    if (kioskDoc.exists) {
      const kiosk = kioskDoc.data();
      const apkId = kiosk.assignedKioskApkId || kiosk.kioskApkId;
      if (apkId) {
        const apkDoc = await admin.firestore().collection('kioskApks').doc(apkId).get();
        return apkDoc.exists ? { id: apkDoc.id, ...apkDoc.data() } : null;
      }
    }
  }

  const apkSnapshot = await admin.firestore().collection('kioskApks').get();
  const activeApk = apkSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .find(
      (apk) =>
        apk.organizationId === device.organizationId &&
        apk.packageName === KIOSK_PACKAGE &&
        apk.active !== false,
    );

  return activeApk || null;
};

const appendDeviceEvent = async (type, device, payload = {}) => {
  await admin
    .firestore()
    .collection('deviceEvents')
    .add({
      type,
      organizationId: device.organizationId,
      kioskId: device.kioskId || null,
      deviceId: device.id,
      payload,
      status: payload.status || null,
      createdAt: timestamp(),
    });
};

const kioskDeviceRegister = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
      }

      const enrollmentToken = requiredString(req.body?.enrollmentToken, 'enrollmentToken');
      const androidId = typeof req.body?.androidId === 'string' ? req.body.androidId.trim() : '';
      const serialNumber =
        typeof req.body?.serialNumber === 'string' ? req.body.serialNumber.trim() : '';
      if (!androidId && !serialNumber) {
        return sendError(res, 400, 'androidId or serialNumber is required');
      }

      const enrollmentDoc = await admin
        .firestore()
        .collection('deviceEnrollments')
        .doc(enrollmentToken)
        .get();
      if (!enrollmentDoc.exists) {
        return sendError(res, 401, 'Invalid enrollment token');
      }

      const enrollment = enrollmentDoc.data();
      if (enrollment.status !== 'active') {
        return sendError(res, 403, 'Enrollment is not active');
      }

      const deviceId = buildDeviceId({
        organizationId: enrollment.organizationId,
        controllerPackage: CONTROLLER_PACKAGE,
        androidId,
        serialNumber,
      });
      const now = timestamp();
      const deviceSecret = createDeviceSecret();
      const device = {
        organizationId: enrollment.organizationId,
        kioskId: enrollment.kioskId || null,
        enrollmentId: enrollmentToken,
        controllerPackage: CONTROLLER_PACKAGE,
        kioskPackage: enrollment.kioskPackage || KIOSK_PACKAGE,
        deviceSecretHash: hashSecret(deviceSecret),
        status: 'enrolled',
        deviceInfo: {
          androidId: androidId || null,
          serialNumber: serialNumber || null,
          model: req.body?.model || null,
          manufacturer: req.body?.manufacturer || null,
          controllerVersion: req.body?.controllerVersion || null,
        },
        lastRegisteredAt: now,
        updatedAt: now,
      };

      await admin
        .firestore()
        .collection('managedDevices')
        .doc(deviceId)
        .set(device, { merge: true });

      return res.status(200).send({
        success: true,
        deviceId,
        deviceSecret,
        organizationId: device.organizationId,
        kioskId: device.kioskId,
        status: device.status,
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to register device');
    }
  });
};

const kioskDevicePolicy = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
      }

      const deviceId = requiredString(req.query?.deviceId, 'deviceId');
      const device = await getAuthenticatedDevice(req, deviceId);
      const apk = await getAssignedApk(device);

      await admin.firestore().collection('managedDevices').doc(deviceId).set(
        {
          lastPolicyFetchAt: timestamp(),
          updatedAt: timestamp(),
        },
        { merge: true },
      );

      return res.status(200).send({
        success: true,
        deviceId,
        organizationId: device.organizationId,
        kioskId: device.kioskId || null,
        controllerPackage: device.controllerPackage || CONTROLLER_PACKAGE,
        kioskPackage: device.kioskPackage || KIOSK_PACKAGE,
        launchPackage: device.kioskPackage || KIOSK_PACKAGE,
        heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
        apk: apk
          ? {
              apkId: apk.id,
              packageName: apk.packageName,
              versionCode: apk.versionCode,
              versionName: apk.versionName || null,
              checksumSha256: apk.checksumSha256 || null,
            }
          : null,
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to fetch device policy');
    }
  });
};

const kioskDeviceStatus = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
      }

      const deviceId = requiredString(req.body?.deviceId, 'deviceId');
      const status = requiredString(req.body?.status, 'status');
      if (!ALLOWED_DEVICE_STATUSES.has(status)) {
        return sendError(res, 400, 'Invalid device status');
      }

      const device = await getAuthenticatedDevice(req, deviceId);
      const update = {
        status,
        lastStatusAt: timestamp(),
        updatedAt: timestamp(),
      };
      if (Object.prototype.hasOwnProperty.call(req.body, 'installStatus')) {
        update.installStatus = req.body.installStatus;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'launchStatus')) {
        update.launchStatus = req.body.launchStatus;
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'deviceOwner')) {
        update.deviceOwner = req.body.deviceOwner === null ? null : Boolean(req.body.deviceOwner);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'error')) {
        update.lastError = req.body.error;
      }

      await admin
        .firestore()
        .collection('managedDevices')
        .doc(deviceId)
        .set(update, { merge: true });
      await appendDeviceEvent('STATUS_UPDATED', { id: deviceId, ...device }, update);

      return res.status(200).send({
        success: true,
        deviceId,
        status,
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to update device status');
    }
  });
};

const kioskDeviceHeartbeat = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
      }

      const deviceId = requiredString(req.body?.deviceId, 'deviceId');
      const device = await getAuthenticatedDevice(req, deviceId);
      const update = {
        status: 'online',
        batteryLevel: req.body?.batteryLevel ?? null,
        networkType: req.body?.networkType || null,
        lastHeartbeatAt: timestamp(),
        updatedAt: timestamp(),
      };

      await admin
        .firestore()
        .collection('managedDevices')
        .doc(deviceId)
        .set(update, { merge: true });
      await appendDeviceEvent('HEARTBEAT', { id: deviceId, ...device }, update);

      return res.status(200).send({
        success: true,
        deviceId,
        nextHeartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to record heartbeat');
    }
  });
};

const kioskApkDownload = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
      }

      const deviceId = requiredString(req.query?.deviceId, 'deviceId');
      const apkId = requiredString(req.query?.apkId, 'apkId');
      const device = await getAuthenticatedDevice(req, deviceId);
      const assignedApk = await getAssignedApk(device);
      if (!assignedApk || assignedApk.id !== apkId) {
        return sendError(res, 403, 'APK is not assigned to this device');
      }

      const apkDoc = await admin.firestore().collection('kioskApks').doc(apkId).get();
      if (!apkDoc.exists) {
        return sendError(res, 404, 'APK not found');
      }

      const apk = apkDoc.data();
      if (apk.organizationId !== device.organizationId) {
        return sendError(res, 403, 'APK is not assigned to this organization');
      }

      return res.status(200).send({
        success: true,
        apkId,
        packageName: apk.packageName,
        versionCode: apk.versionCode,
        versionName: apk.versionName || null,
        downloadUrl: apk.downloadUrl || null,
        checksumSha256: apk.checksumSha256 || null,
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to resolve APK download');
    }
  });
};

const adminCreateDeviceProfile = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
      }

      const caller = await getCaller(req);
      rejectProtectedFields(req.body || {}, ['organizationId']);
      const requestedOrganizationId = optionalString(req.body?.organizationId);
      if (requestedOrganizationId && requestedOrganizationId !== caller.organizationId) {
        return sendError(res, 403, 'You can only create profiles for your organization');
      }

      const kioskId = optionalString(req.body?.kioskId);
      if (kioskId) {
        await getKioskForCaller(kioskId, caller.organizationId);
      }

      const enrollmentToken = crypto.randomBytes(24).toString('base64url');
      const now = timestamp();
      const label = optionalString(req.body?.label);
      await admin
        .firestore()
        .collection('deviceEnrollments')
        .doc(enrollmentToken)
        .set({
          organizationId: caller.organizationId,
          kioskId: kioskId || null,
          label,
          status: 'active',
          createdBy: caller.uid,
          createdAt: now,
          updatedAt: now,
        });

      const provisioningPayload = {
        enrollmentToken,
        organizationId: caller.organizationId,
        kioskId: kioskId || null,
        controllerPackage: CONTROLLER_PACKAGE,
        apiBaseUrl: optionalString(req.body?.apiBaseUrl),
      };

      return res.status(200).send({
        success: true,
        enrollmentToken,
        organizationId: caller.organizationId,
        kioskId: kioskId || null,
        status: 'active',
        provisioningPayload,
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to create device profile');
    }
  });
};

const adminListManagedDevices = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
      }

      const caller = await getCaller(req);
      const kioskId = optionalString(req.query?.kioskId);
      let query = admin
        .firestore()
        .collection('managedDevices')
        .where('organizationId', '==', caller.organizationId);
      if (kioskId) {
        query = query.where('kioskId', '==', kioskId);
      }
      const snapshot = await query
        .orderBy('updatedAt', 'desc')
        .limit(MANAGED_DEVICE_LIST_LIMIT)
        .get();
      const devices = mapQueryRows(snapshot).map(serializeDevice);

      return res.status(200).send({ success: true, devices });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to list managed devices');
    }
  });
};

const adminUpdateManagedDeviceMetadata = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
      }

      const caller = await getCaller(req);
      rejectProtectedFields(req.body || {});
      const deviceId = requiredString(req.body?.deviceId, 'deviceId');
      await getDeviceForCaller(deviceId, caller.organizationId);

      const update = {
        updatedBy: caller.uid,
        updatedAt: timestamp(),
      };

      if (Object.prototype.hasOwnProperty.call(req.body, 'displayName')) {
        update.displayName = optionalString(req.body.displayName);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'placementLabel')) {
        update.placementLabel = optionalString(req.body.placementLabel);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'placementNotes')) {
        update.placementNotes = optionalString(req.body.placementNotes);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'latitude')) {
        update.latitude = validateCoordinate(req.body.latitude, 'latitude', -90, 90);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'longitude')) {
        update.longitude = validateCoordinate(req.body.longitude, 'longitude', -180, 180);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'kioskId')) {
        const kioskId = optionalString(req.body.kioskId);
        if (kioskId) {
          await getKioskForCaller(kioskId, caller.organizationId);
        }
        update.kioskId = kioskId;
      }

      await admin
        .firestore()
        .collection('managedDevices')
        .doc(deviceId)
        .set(update, { merge: true });

      return res.status(200).send({ success: true, deviceId });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to update device metadata');
    }
  });
};

const adminQueueDeviceCommand = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return sendError(res, 405, 'Method not allowed');
      }

      const caller = await getCaller(req);
      const deviceId = requiredString(req.body?.deviceId, 'deviceId');
      const commandType = requiredString(req.body?.commandType, 'commandType');
      if (!ALLOWED_ADMIN_COMMANDS.has(commandType)) {
        return sendError(res, 400, 'Unsupported device command');
      }

      const device = await getDeviceForCaller(deviceId, caller.organizationId);
      const commandRef = await admin
        .firestore()
        .collection('deviceCommands')
        .add({
          organizationId: caller.organizationId,
          kioskId: device.kioskId || null,
          deviceId,
          commandType,
          status: 'pending',
          queuedBy: caller.uid,
          queuedAt: timestamp(),
          updatedAt: timestamp(),
        });

      return res.status(200).send({
        success: true,
        commandId: commandRef.id,
        status: 'pending',
      });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to queue device command');
    }
  });
};

const adminListDeviceCommands = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
      }

      const caller = await getCaller(req);
      const deviceId = requiredString(req.query?.deviceId, 'deviceId');
      await getDeviceForCaller(deviceId, caller.organizationId);
      const snapshot = await admin
        .firestore()
        .collection('deviceCommands')
        .where('organizationId', '==', caller.organizationId)
        .where('deviceId', '==', deviceId)
        .orderBy('queuedAt', 'desc')
        .limit(DEVICE_COMMAND_LIST_LIMIT)
        .get();
      const commands = mapQueryRows(snapshot);

      return res.status(200).send({ success: true, commands });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to list device commands');
    }
  });
};

const adminListDeviceEvents = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'GET') {
        return sendError(res, 405, 'Method not allowed');
      }

      const caller = await getCaller(req);
      const deviceId = requiredString(req.query?.deviceId, 'deviceId');
      await getDeviceForCaller(deviceId, caller.organizationId);
      const snapshot = await admin
        .firestore()
        .collection('deviceEvents')
        .where('organizationId', '==', caller.organizationId)
        .where('deviceId', '==', deviceId)
        .orderBy('createdAt', 'desc')
        .limit(DEVICE_EVENT_LIST_LIMIT)
        .get();
      const events = mapQueryRows(snapshot);

      return res.status(200).send({ success: true, events });
    } catch (error) {
      return sendError(res, error.code || 500, error.message || 'Failed to list device events');
    }
  });
};

module.exports = {
  kioskDeviceRegister,
  kioskDevicePolicy,
  kioskDeviceStatus,
  kioskDeviceHeartbeat,
  kioskApkDownload,
  adminCreateDeviceProfile,
  adminListManagedDevices,
  adminUpdateManagedDeviceMetadata,
  adminQueueDeviceCommand,
  adminListDeviceCommands,
  adminListDeviceEvents,
};
