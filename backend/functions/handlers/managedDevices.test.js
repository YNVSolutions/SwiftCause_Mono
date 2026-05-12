jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));
jest.mock('../middleware/cors', () => (req, res, callback) => callback());

const admin = require('firebase-admin');
const {
  kioskDeviceRegister,
  kioskDevicePolicy,
  kioskDeviceStatus,
  kioskDeviceHeartbeat,
  kioskApkDownload,
} = require('./managedDevices');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  return response;
};

const invokeHandler = async (handler, request) => {
  let done;
  const finished = new Promise((resolve) => {
    done = resolve;
  });

  const response = createResponse();
  const finish = (payload) => {
    response.body = payload;
    done();
    return response;
  };
  response.send = finish;
  response.json = finish;

  handler(request, response);
  await finished;
  return response;
};

const request = ({ method = 'POST', body = {}, query = {} } = {}) => ({
  method,
  body,
  query,
});

const seedEnrollment = async (id = 'enroll-1', data = {}) => {
  await admin
    .firestore()
    .collection('deviceEnrollments')
    .doc(id)
    .set({
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      status: 'active',
      ...data,
    });
};

const seedKiosk = async (id = 'kiosk-1', data = {}) => {
  await admin
    .firestore()
    .collection('kiosks')
    .doc(id)
    .set({
      organizationId: 'org-1',
      name: 'Main Entrance',
      assignedKioskApkId: 'apk-1',
      ...data,
    });
};

const seedApk = async (id = 'apk-1', data = {}) => {
  await admin
    .firestore()
    .collection('kioskApks')
    .doc(id)
    .set({
      organizationId: 'org-1',
      packageName: 'com.swiftcause.kiosk',
      versionCode: 7,
      versionName: '1.0.7',
      downloadUrl: 'https://example.test/swiftcause-kiosk.apk',
      checksumSha256: 'abc123',
      active: true,
      ...data,
    });
};

const registerDevice = async (overrides = {}) => {
  await seedEnrollment();
  return invokeHandler(
    kioskDeviceRegister,
    request({
      body: {
        enrollmentToken: 'enroll-1',
        controllerPackage: 'com.swiftcause.devicecontroller',
        androidId: 'android-123',
        model: 'Medium Tablet',
        manufacturer: 'Google',
        controllerVersion: '0.1.0',
        ...overrides,
      },
    }),
  );
};

describe('managed device APIs', () => {
  beforeEach(() => {
    admin.__reset();
    jest.clearAllMocks();
  });

  it('registers a managed device from an active enrollment', async () => {
    const res = await registerDevice();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      status: 'enrolled',
    });

    const device = admin.__getDoc('managedDevices', res.body.deviceId);
    expect(device).toMatchObject({
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      controllerPackage: 'com.swiftcause.devicecontroller',
      kioskPackage: 'com.swiftcause.kiosk',
      status: 'enrolled',
      deviceInfo: expect.objectContaining({
        androidId: 'android-123',
        model: 'Medium Tablet',
      }),
    });
  });

  it('updates the same managed device when it registers again', async () => {
    const first = await registerDevice({ model: 'Medium Tablet' });
    const second = await registerDevice({ model: 'Medium Tablet API 35' });

    expect(second.body.deviceId).toBe(first.body.deviceId);
    expect(admin.__getCollection('managedDevices')).toHaveLength(1);
    expect(admin.__getDoc('managedDevices', first.body.deviceId).deviceInfo.model).toBe(
      'Medium Tablet API 35',
    );
  });

  it('rejects unknown or revoked enrollment tokens', async () => {
    const unknown = await invokeHandler(
      kioskDeviceRegister,
      request({ body: { enrollmentToken: 'missing', androidId: 'android-123' } }),
    );
    expect(unknown.statusCode).toBe(401);

    await seedEnrollment('revoked', { status: 'revoked' });
    const revoked = await invokeHandler(
      kioskDeviceRegister,
      request({ body: { enrollmentToken: 'revoked', androidId: 'android-123' } }),
    );
    expect(revoked.statusCode).toBe(403);
  });

  it('returns kiosk policy and assigned APK metadata for a registered device', async () => {
    await seedKiosk();
    await seedApk();
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskDevicePolicy,
      request({ method: 'GET', query: { deviceId: registered.body.deviceId } }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      controllerPackage: 'com.swiftcause.devicecontroller',
      kioskPackage: 'com.swiftcause.kiosk',
      launchPackage: 'com.swiftcause.kiosk',
      heartbeatIntervalSeconds: 60,
      apk: {
        apkId: 'apk-1',
        packageName: 'com.swiftcause.kiosk',
        versionCode: 7,
      },
    });
  });

  it('records status updates and appends a device event', async () => {
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskDeviceStatus,
      request({
        body: {
          deviceId: registered.body.deviceId,
          status: 'kiosk_active',
          installStatus: 'installed',
          deviceOwner: true,
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getDoc('managedDevices', registered.body.deviceId)).toMatchObject({
      status: 'kiosk_active',
      installStatus: 'installed',
      deviceOwner: true,
    });
    expect(admin.__getCollection('deviceEvents')).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'STATUS_UPDATED',
          deviceId: registered.body.deviceId,
          status: 'kiosk_active',
        }),
      }),
    ]);
  });

  it('updates heartbeat state and appends a heartbeat event', async () => {
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskDeviceHeartbeat,
      request({
        body: {
          deviceId: registered.body.deviceId,
          batteryLevel: 82,
          networkType: 'wifi',
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      nextHeartbeatIntervalSeconds: 60,
    });
    expect(admin.__getDoc('managedDevices', registered.body.deviceId)).toMatchObject({
      status: 'online',
      batteryLevel: 82,
      networkType: 'wifi',
    });
    expect(admin.__getCollection('deviceEvents')[0].data).toMatchObject({
      type: 'HEARTBEAT',
      deviceId: registered.body.deviceId,
    });
  });

  it('rejects invalid status values', async () => {
    const registered = await registerDevice();
    const res = await invokeHandler(
      kioskDeviceStatus,
      request({ body: { deviceId: registered.body.deviceId, status: 'sideways' } }),
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns APK download metadata only for the assigned organization APK', async () => {
    await seedKiosk();
    await seedApk();
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskApkDownload,
      request({ method: 'GET', query: { deviceId: registered.body.deviceId, apkId: 'apk-1' } }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      apkId: 'apk-1',
      downloadUrl: 'https://example.test/swiftcause-kiosk.apk',
      checksumSha256: 'abc123',
    });

    await seedApk('other-apk', { organizationId: 'org-2' });
    const denied = await invokeHandler(
      kioskApkDownload,
      request({ method: 'GET', query: { deviceId: registered.body.deviceId, apkId: 'other-apk' } }),
    );
    expect(denied.statusCode).toBe(403);
  });
});
