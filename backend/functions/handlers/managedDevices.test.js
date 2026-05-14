jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));
jest.mock('../middleware/cors', () => (req, res, callback) => callback());

const admin = require('firebase-admin');
const {
  kioskDeviceRegister,
  kioskDevicePolicy,
  kioskDeviceStatus,
  kioskDeviceHeartbeat,
  kioskApkDownload,
  kioskDeviceCommands,
  kioskDeviceCommandResult,
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
  headers: {},
});

const withDeviceSecret = (req, deviceSecret) => ({
  ...req,
  headers: {
    ...(req.headers || {}),
    authorization: `Bearer ${deviceSecret}`,
  },
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

const getDeviceEvents = (deviceId, type) =>
  admin
    .__getCollection('deviceEvents')
    .filter((event) => event.data.deviceId === deviceId && (!type || event.data.type === type));

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
    expect(res.body.deviceSecret).toEqual(expect.any(String));

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
    expect(device.deviceSecretHash).toEqual(expect.any(String));
    expect(device.deviceSecret).toBeUndefined();
    expect(getDeviceEvents(res.body.deviceId, 'REGISTERED')).toHaveLength(1);
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

  it('pins controller package when deriving device identity', async () => {
    const first = await registerDevice({ controllerPackage: 'com.attacker.controller' });
    const second = await registerDevice({ controllerPackage: 'com.swiftcause.devicecontroller' });

    expect(second.body.deviceId).toBe(first.body.deviceId);
    expect(admin.__getCollection('managedDevices')).toHaveLength(1);
    expect(admin.__getDoc('managedDevices', first.body.deviceId).controllerPackage).toBe(
      'com.swiftcause.devicecontroller',
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
      withDeviceSecret(
        request({ method: 'GET', query: { deviceId: registered.body.deviceId } }),
        registered.body.deviceSecret,
      ),
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
    expect(getDeviceEvents(registered.body.deviceId, 'POLICY_FETCHED')).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            apkId: 'apk-1',
          }),
        }),
      }),
    ]);
  });

  it('rejects policy requests without the device secret', async () => {
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskDevicePolicy,
      request({ method: 'GET', query: { deviceId: registered.body.deviceId } }),
    );

    expect(res.statusCode).toBe(401);
  });

  it('records status updates and appends a device event', async () => {
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            status: 'kiosk_active',
            installStatus: 'installed',
            deviceOwner: true,
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getDoc('managedDevices', registered.body.deviceId)).toMatchObject({
      status: 'kiosk_active',
      installStatus: 'installed',
      deviceOwner: true,
    });
    expect(getDeviceEvents(registered.body.deviceId, 'STATUS_UPDATED')).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'STATUS_UPDATED',
          deviceId: registered.body.deviceId,
          status: 'kiosk_active',
        }),
      }),
    ]);
  });

  it('rejects status updates with an invalid device secret', async () => {
    const registered = await registerDevice();
    const res = await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({ body: { deviceId: registered.body.deviceId, status: 'online' } }),
        'wrong-secret',
      ),
    );

    expect(res.statusCode).toBe(401);
  });

  it('preserves existing status detail fields when a partial update omits them', async () => {
    const registered = await registerDevice();

    await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            status: 'install_failed',
            installStatus: 'failed',
            launchStatus: 'blocked',
            deviceOwner: true,
            error: 'Package installer blocked',
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    const res = await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            status: 'online',
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getDoc('managedDevices', registered.body.deviceId)).toMatchObject({
      status: 'online',
      installStatus: 'failed',
      launchStatus: 'blocked',
      deviceOwner: true,
      lastError: 'Package installer blocked',
    });
  });

  it('clears optional status detail fields when null is explicitly provided', async () => {
    const registered = await registerDevice();

    await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            status: 'install_failed',
            installStatus: 'failed',
            launchStatus: 'blocked',
            error: 'Package installer blocked',
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    const res = await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            status: 'online',
            installStatus: null,
            launchStatus: null,
            error: null,
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getDoc('managedDevices', registered.body.deviceId)).toMatchObject({
      status: 'online',
      installStatus: null,
      launchStatus: null,
      lastError: null,
    });
  });

  it('updates heartbeat state and appends a heartbeat event', async () => {
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskDeviceHeartbeat,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            batteryLevel: 82,
            networkType: 'wifi',
          },
        }),
        registered.body.deviceSecret,
      ),
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
    expect(getDeviceEvents(registered.body.deviceId, 'HEARTBEAT')[0].data).toMatchObject({
      type: 'HEARTBEAT',
      deviceId: registered.body.deviceId,
    });
  });

  it('rejects invalid status values', async () => {
    const registered = await registerDevice();
    const res = await invokeHandler(
      kioskDeviceStatus,
      withDeviceSecret(
        request({ body: { deviceId: registered.body.deviceId, status: 'sideways' } }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(400);
  });

  it('returns APK download metadata only for the assigned organization APK', async () => {
    await seedKiosk();
    await seedApk();
    const registered = await registerDevice();

    const res = await invokeHandler(
      kioskApkDownload,
      withDeviceSecret(
        request({ method: 'GET', query: { deviceId: registered.body.deviceId, apkId: 'apk-1' } }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      apkId: 'apk-1',
      downloadUrl: 'https://example.test/swiftcause-kiosk.apk',
      checksumSha256: 'abc123',
    });
    expect(getDeviceEvents(registered.body.deviceId, 'APK_DOWNLOAD_METADATA')).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            apkId: 'apk-1',
            packageName: 'com.swiftcause.kiosk',
          }),
        }),
      }),
    ]);

    await seedApk('other-apk', { organizationId: 'org-2' });
    const denied = await invokeHandler(
      kioskApkDownload,
      withDeviceSecret(
        request({
          method: 'GET',
          query: { deviceId: registered.body.deviceId, apkId: 'other-apk' },
        }),
        registered.body.deviceSecret,
      ),
    );
    expect(denied.statusCode).toBe(403);
  });

  it('rejects same-org APK IDs that are not assigned to the device policy', async () => {
    await seedKiosk();
    await seedApk();
    await seedApk('same-org-unassigned-apk', {
      organizationId: 'org-1',
      versionCode: 8,
      downloadUrl: 'https://example.test/unassigned.apk',
    });
    const registered = await registerDevice();

    const denied = await invokeHandler(
      kioskApkDownload,
      withDeviceSecret(
        request({
          method: 'GET',
          query: {
            deviceId: registered.body.deviceId,
            apkId: 'same-org-unassigned-apk',
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    expect(denied.statusCode).toBe(403);
  });

  it('returns pending device commands for an authenticated device only', async () => {
    const registered = await registerDevice();
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-1')
      .set({
        organizationId: 'org-1',
        deviceId: registered.body.deviceId,
        commandType: 'sync_policy',
        status: 'pending',
        queuedAt: { __type: 'timestamp', ms: 1000 },
      });
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-2')
      .set({
        organizationId: 'org-1',
        deviceId: registered.body.deviceId,
        commandType: 'restart_kiosk',
        status: 'succeeded',
        queuedAt: { __type: 'timestamp', ms: 2000 },
      });
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-3')
      .set({
        organizationId: 'org-2',
        deviceId: registered.body.deviceId,
        commandType: 'sync_policy',
        status: 'pending',
        queuedAt: { __type: 'timestamp', ms: 3000 },
      });

    const res = await invokeHandler(
      kioskDeviceCommands,
      withDeviceSecret(
        request({ method: 'GET', query: { deviceId: registered.body.deviceId } }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.commands).toEqual([
      expect.objectContaining({
        id: 'command-1',
        commandType: 'sync_policy',
        status: 'pending',
      }),
    ]);
  });

  it('rejects command pickup without a valid device secret', async () => {
    const registered = await registerDevice();

    const missing = await invokeHandler(
      kioskDeviceCommands,
      request({ method: 'GET', query: { deviceId: registered.body.deviceId } }),
    );
    const invalid = await invokeHandler(
      kioskDeviceCommands,
      withDeviceSecret(
        request({ method: 'GET', query: { deviceId: registered.body.deviceId } }),
        'wrong-secret',
      ),
    );

    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
  });

  it('records command results and appends a command result event', async () => {
    const registered = await registerDevice();
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-1')
      .set({
        organizationId: 'org-1',
        deviceId: registered.body.deviceId,
        commandType: 'restart_kiosk',
        status: 'pending',
        queuedAt: { __type: 'timestamp', ms: 1000 },
      });

    const res = await invokeHandler(
      kioskDeviceCommandResult,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            commandId: 'command-1',
            status: 'succeeded',
            message: 'Kiosk relaunched',
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getDoc('deviceCommands', 'command-1')).toMatchObject({
      status: 'succeeded',
      resultMessage: 'Kiosk relaunched',
    });
    expect(getDeviceEvents(registered.body.deviceId, 'COMMAND_RESULT')).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            commandId: 'command-1',
            commandType: 'restart_kiosk',
            status: 'succeeded',
          }),
        }),
      }),
    ]);
  });

  it('rejects command results for commands assigned to another device or organization', async () => {
    const registered = await registerDevice();
    await admin.firestore().collection('deviceCommands').doc('other-device-command').set({
      organizationId: 'org-1',
      deviceId: 'other-device',
      commandType: 'sync_policy',
      status: 'pending',
    });
    await admin.firestore().collection('deviceCommands').doc('other-org-command').set({
      organizationId: 'org-2',
      deviceId: registered.body.deviceId,
      commandType: 'sync_policy',
      status: 'pending',
    });

    const otherDevice = await invokeHandler(
      kioskDeviceCommandResult,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            commandId: 'other-device-command',
            status: 'failed',
          },
        }),
        registered.body.deviceSecret,
      ),
    );
    const otherOrg = await invokeHandler(
      kioskDeviceCommandResult,
      withDeviceSecret(
        request({
          body: {
            deviceId: registered.body.deviceId,
            commandId: 'other-org-command',
            status: 'failed',
          },
        }),
        registered.body.deviceSecret,
      ),
    );

    expect(otherDevice.statusCode).toBe(403);
    expect(otherOrg.statusCode).toBe(403);
  });
});
