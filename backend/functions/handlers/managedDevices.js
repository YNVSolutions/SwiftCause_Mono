const crypto = require('crypto');
const admin = require('firebase-admin');
const cors = require('../middleware/cors');

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

const timestamp = () => admin.firestore.Timestamp.now();

const sendError = (res, code, message) => res.status(code).send({ error: message });

const requiredString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${fieldName} is required`);
    error.code = 400;
    throw error;
  }

  return value.trim();
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
      const controllerPackage = req.body?.controllerPackage || CONTROLLER_PACKAGE;
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
        controllerPackage,
        androidId,
        serialNumber,
      });
      const now = timestamp();
      const device = {
        organizationId: enrollment.organizationId,
        kioskId: enrollment.kioskId || null,
        enrollmentId: enrollmentToken,
        controllerPackage,
        kioskPackage: enrollment.kioskPackage || KIOSK_PACKAGE,
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
      const device = await getDevice(deviceId);
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

      const device = await getDevice(deviceId);
      const update = {
        status,
        installStatus: req.body?.installStatus || null,
        launchStatus: req.body?.launchStatus || null,
        deviceOwner: Boolean(req.body?.deviceOwner),
        lastError: req.body?.error || null,
        lastStatusAt: timestamp(),
        updatedAt: timestamp(),
      };

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
      const device = await getDevice(deviceId);
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
      const device = await getDevice(deviceId);
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

module.exports = {
  kioskDeviceRegister,
  kioskDevicePolicy,
  kioskDeviceStatus,
  kioskDeviceHeartbeat,
  kioskApkDownload,
};
