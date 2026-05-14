jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));
jest.mock('../middleware/cors', () => (req, res, callback) => callback());

const admin = require('firebase-admin');
const {
  adminCreateDeviceProfile,
  adminListManagedDevices,
  adminUpdateManagedDeviceMetadata,
  adminQueueDeviceCommand,
  adminListDeviceCommands,
  adminListDeviceEvents,
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
  };

  return response;
};

const invokeHandler = async (handler, request) => {
  let done;
  const finished = new Promise((resolve) => {
    done = resolve;
  });

  const response = createResponse();
  response.send = (payload) => {
    response.body = payload;
    done();
    return response;
  };

  handler(request, response);
  await finished;
  return response;
};

const request = ({ method = 'POST', body = {}, query = {}, token = 'uid:user-1' } = {}) => ({
  method,
  body,
  query,
  headers: token
    ? {
        authorization: `Bearer ${token}`,
      }
    : {},
});

const seedUser = async (id = 'user-1', data = {}) => {
  await admin
    .firestore()
    .collection('users')
    .doc(id)
    .set({
      organizationId: 'org-1',
      role: 'manager',
      permissions: ['view_kiosks', 'edit_kiosk'],
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
      name: 'Lobby kiosk',
      ...data,
    });
};

const seedDevice = async (id = 'device-1', data = {}) => {
  await admin
    .firestore()
    .collection('managedDevices')
    .doc(id)
    .set({
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      status: 'online',
      deviceInfo: {
        model: 'Medium Tablet',
      },
      lastHeartbeatAt: { __type: 'timestamp', ms: 1000 },
      updatedAt: { __type: 'timestamp', ms: 1000 },
      lastError: null,
      ...data,
    });
};

describe('managed device admin APIs', () => {
  beforeEach(() => {
    admin.__reset();
    jest.clearAllMocks();
  });

  it('rejects unauthenticated admin requests', async () => {
    const res = await invokeHandler(adminCreateDeviceProfile, request({ body: {}, token: null }));

    expect(res.statusCode).toBe(401);
  });

  it('rejects callers without kiosk-management permission', async () => {
    await seedUser('user-1', {
      role: 'viewer',
      permissions: ['view_kiosks'],
    });

    const res = await invokeHandler(adminCreateDeviceProfile, request());

    expect(res.statusCode).toBe(403);
  });

  it('creates an organization-scoped device profile for the caller organization', async () => {
    await seedUser();
    await seedKiosk();

    const res = await invokeHandler(
      adminCreateDeviceProfile,
      request({
        body: {
          kioskId: 'kiosk-1',
          label: 'Front desk tablet',
          apiBaseUrl: 'https://functions.example.test',
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      status: 'active',
      provisioningPayload: {
        enrollmentToken: expect.any(String),
        organizationId: 'org-1',
        kioskId: 'kiosk-1',
        controllerPackage: 'com.swiftcause.devicecontroller',
        apiBaseUrl: 'https://functions.example.test',
      },
    });
    expect(admin.__getDoc('deviceEnrollments', res.body.enrollmentToken)).toMatchObject({
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      label: 'Front desk tablet',
      status: 'active',
      createdBy: 'user-1',
    });
  });

  it('rejects profile creation for another organization', async () => {
    await seedUser();

    const res = await invokeHandler(
      adminCreateDeviceProfile,
      request({ body: { organizationId: 'org-2' } }),
    );

    expect(res.statusCode).toBe(403);
  });

  it('rejects protected APK and package fields when creating a profile', async () => {
    await seedUser();

    const res = await invokeHandler(
      adminCreateDeviceProfile,
      request({
        body: {
          assignedKioskApkId: 'apk-1',
          controllerPackage: 'com.attacker.controller',
        },
      }),
    );

    expect(res.statusCode).toBe(400);
  });

  it('requires kiosk preassignment to belong to the caller organization', async () => {
    await seedUser();
    await seedKiosk('other-kiosk', { organizationId: 'org-2' });

    const res = await invokeHandler(
      adminCreateDeviceProfile,
      request({ body: { kioskId: 'other-kiosk' } }),
    );

    expect(res.statusCode).toBe(403);
  });

  it('lists only caller-organization managed devices with optional kiosk filtering', async () => {
    await seedUser();
    await seedDevice('device-1', { kioskId: 'kiosk-1' });
    await seedDevice('device-2', { kioskId: 'kiosk-2' });
    await seedDevice('device-3', { organizationId: 'org-2', kioskId: 'kiosk-1' });

    const res = await invokeHandler(
      adminListManagedDevices,
      request({ method: 'GET', query: { kioskId: 'kiosk-1' } }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.devices).toEqual([
      expect.objectContaining({
        id: 'device-1',
        organizationId: 'org-1',
        kioskId: 'kiosk-1',
        status: 'online',
      }),
    ]);
  });

  it('returns managed devices newest-first with a bounded Firestore query result', async () => {
    await seedUser();
    const writes = [];
    for (let index = 0; index < 105; index += 1) {
      writes.push(
        seedDevice(`device-${index}`, {
          kioskId: 'kiosk-1',
          updatedAt: { __type: 'timestamp', ms: index },
        }),
      );
    }
    writes.push(
      seedDevice('other-org-newest', {
        organizationId: 'org-2',
        kioskId: 'kiosk-1',
        updatedAt: { __type: 'timestamp', ms: 1000 },
      }),
    );
    await Promise.all(writes);

    const res = await invokeHandler(
      adminListManagedDevices,
      request({ method: 'GET', query: { kioskId: 'kiosk-1' } }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.devices).toHaveLength(100);
    expect(res.body.devices[0]).toMatchObject({ id: 'device-104', organizationId: 'org-1' });
    expect(res.body.devices[res.body.devices.length - 1]).toMatchObject({
      id: 'device-5',
      organizationId: 'org-1',
    });
    expect(res.body.devices).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'other-org-newest' })]),
    );
  });

  it('updates editable placement metadata and same-org kiosk assignment', async () => {
    await seedUser();
    await seedKiosk('kiosk-2');
    await seedDevice();

    const res = await invokeHandler(
      adminUpdateManagedDeviceMetadata,
      request({
        body: {
          deviceId: 'device-1',
          displayName: 'Lobby tablet',
          placementLabel: 'Main lobby',
          placementNotes: 'Mounted beside reception',
          latitude: 51.5074,
          longitude: -0.1278,
          kioskId: 'kiosk-2',
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getDoc('managedDevices', 'device-1')).toMatchObject({
      displayName: 'Lobby tablet',
      placementLabel: 'Main lobby',
      placementNotes: 'Mounted beside reception',
      latitude: 51.5074,
      longitude: -0.1278,
      kioskId: 'kiosk-2',
      updatedBy: 'user-1',
    });
  });

  it('rejects protected metadata updates', async () => {
    await seedUser();
    await seedDevice();

    const res = await invokeHandler(
      adminUpdateManagedDeviceMetadata,
      request({
        body: {
          deviceId: 'device-1',
          organizationId: 'org-2',
          deviceSecretHash: 'leak',
        },
      }),
    );

    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid coordinates and cross-org kiosk assignment', async () => {
    await seedUser();
    await seedDevice();
    await seedKiosk('other-kiosk', { organizationId: 'org-2' });

    const invalidCoordinates = await invokeHandler(
      adminUpdateManagedDeviceMetadata,
      request({ body: { deviceId: 'device-1', latitude: 120, longitude: 0 } }),
    );
    expect(invalidCoordinates.statusCode).toBe(400);

    const crossOrgKiosk = await invokeHandler(
      adminUpdateManagedDeviceMetadata,
      request({ body: { deviceId: 'device-1', kioskId: 'other-kiosk' } }),
    );
    expect(crossOrgKiosk.statusCode).toBe(403);
  });

  it('queues only safe device commands for caller-organization devices', async () => {
    await seedUser();
    await seedDevice();

    const res = await invokeHandler(
      adminQueueDeviceCommand,
      request({
        body: {
          deviceId: 'device-1',
          commandType: 'restart_kiosk',
        },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(admin.__getCollection('deviceCommands')).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          deviceId: 'device-1',
          commandType: 'restart_kiosk',
          status: 'pending',
          queuedBy: 'user-1',
        }),
      }),
    ]);

    const denied = await invokeHandler(
      adminQueueDeviceCommand,
      request({
        body: {
          deviceId: 'device-1',
          commandType: 'factory_reset',
        },
      }),
    );
    expect(denied.statusCode).toBe(400);
  });

  it('rejects command and event listing for cross-org devices', async () => {
    await seedUser();
    await seedDevice('device-2', { organizationId: 'org-2' });

    const commands = await invokeHandler(
      adminListDeviceCommands,
      request({ method: 'GET', query: { deviceId: 'device-2' } }),
    );
    expect(commands.statusCode).toBe(403);

    const events = await invokeHandler(
      adminListDeviceEvents,
      request({ method: 'GET', query: { deviceId: 'device-2' } }),
    );
    expect(events.statusCode).toBe(403);
  });

  it('lists commands and events for caller-organization devices', async () => {
    await seedUser();
    await seedDevice();
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-1')
      .set({
        organizationId: 'org-1',
        deviceId: 'device-1',
        commandType: 'sync_policy',
        status: 'pending',
        queuedAt: { __type: 'timestamp', ms: 2000 },
      });
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-2')
      .set({
        organizationId: 'org-2',
        deviceId: 'device-1',
        commandType: 'sync_policy',
        status: 'pending',
        queuedAt: { __type: 'timestamp', ms: 3000 },
      });
    await admin
      .firestore()
      .collection('deviceCommands')
      .doc('command-3')
      .set({
        organizationId: 'org-1',
        deviceId: 'device-1',
        commandType: 'refresh_content',
        status: 'pending',
        queuedAt: { __type: 'timestamp', ms: 1000 },
      });
    await admin
      .firestore()
      .collection('deviceEvents')
      .doc('event-1')
      .set({
        organizationId: 'org-1',
        deviceId: 'device-1',
        type: 'HEARTBEAT',
        createdAt: { __type: 'timestamp', ms: 1000 },
      });
    await admin
      .firestore()
      .collection('deviceEvents')
      .doc('event-2')
      .set({
        organizationId: 'org-1',
        deviceId: 'device-1',
        type: 'STATUS',
        createdAt: { __type: 'timestamp', ms: 2000 },
      });
    await admin
      .firestore()
      .collection('deviceEvents')
      .doc('event-3')
      .set({
        organizationId: 'org-2',
        deviceId: 'device-1',
        type: 'STATUS',
        createdAt: { __type: 'timestamp', ms: 3000 },
      });

    const commands = await invokeHandler(
      adminListDeviceCommands,
      request({ method: 'GET', query: { deviceId: 'device-1' } }),
    );
    const events = await invokeHandler(
      adminListDeviceEvents,
      request({ method: 'GET', query: { deviceId: 'device-1' } }),
    );

    expect(commands.statusCode).toBe(200);
    expect(commands.body.commands).toEqual([
      expect.objectContaining({
        id: 'command-1',
        organizationId: 'org-1',
      }),
      expect.objectContaining({
        id: 'command-3',
        organizationId: 'org-1',
      }),
    ]);
    expect(events.statusCode).toBe(200);
    expect(events.body.events).toEqual([
      expect.objectContaining({
        id: 'event-2',
        type: 'STATUS',
      }),
      expect.objectContaining({
        id: 'event-1',
        type: 'HEARTBEAT',
      }),
    ]);
  });

  it('returns recent events newest-first and limits response size', async () => {
    await seedUser();
    await seedDevice();
    const writes = [];
    for (let index = 0; index < 30; index += 1) {
      writes.push(
        admin
          .firestore()
          .collection('deviceEvents')
          .doc(`event-${index}`)
          .set({
            organizationId: 'org-1',
            deviceId: 'device-1',
            type: 'STATUS',
            createdAt: { __type: 'timestamp', ms: index },
          }),
      );
    }
    await Promise.all(writes);

    const events = await invokeHandler(
      adminListDeviceEvents,
      request({ method: 'GET', query: { deviceId: 'device-1' } }),
    );

    expect(events.statusCode).toBe(200);
    expect(events.body.events).toHaveLength(25);
    expect(events.body.events[0]).toMatchObject({ id: 'event-29' });
    expect(events.body.events[events.body.events.length - 1]).toMatchObject({ id: 'event-5' });
  });
});
