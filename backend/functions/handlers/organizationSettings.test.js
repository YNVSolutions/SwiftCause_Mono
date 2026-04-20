jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));
jest.mock('../middleware/cors', () => (req, res, callback) => callback());
jest.mock('../middleware/auth', () => ({
  verifyAuth: jest.fn(),
}));

const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');
const { updateOrganizationSettings } = require('./organizationSettings');

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

const createRequest = (body) => ({
  method: 'POST',
  body,
  headers: {
    authorization: 'Bearer test-token',
  },
});

const invokeHandler = async (request) => {
  let done;
  const finished = new Promise((resolve) => {
    done = resolve;
  });

  const response = createResponse();
  const originalSend = response.send.bind(response);
  response.send = (payload) => {
    originalSend(payload);
    done();
    return response;
  };

  updateOrganizationSettings(request, response);
  await finished;
  return response;
};

const seedOrganization = async (id, data = {}) => {
  const defaults = {
    name: id,
    settings: {
      displayName: id,
      logoUrl: null,
      idleImageUrl: null,
      accentColorHex: '#0E8F5A',
      thankYouMessage: null,
    },
  };
  await admin
    .firestore()
    .collection('organizations')
    .doc(id)
    .set({ ...defaults, ...data });
};

const seedUser = async (uid, data = {}) => {
  await admin
    .firestore()
    .collection('users')
    .doc(uid)
    .set({
      role: 'admin',
      organizationId: 'org-1',
      permissions: [],
      ...data,
    });
};

describe('updateOrganizationSettings', () => {
  beforeEach(() => {
    admin.__reset();
    jest.clearAllMocks();
    verifyAuth.mockResolvedValue({ uid: 'user-1' });
    process.env.GCLOUD_PROJECT = 'swiftcause-app';
  });

  it('allows duplicate display names across organizations', async () => {
    await seedOrganization('org-1', {
      settings: {
        displayName: 'Org One',
        logoUrl: null,
        idleImageUrl: null,
        accentColorHex: '#0E8F5A',
        thankYouMessage: null,
      },
    });
    await seedOrganization('org-2', {
      settings: {
        displayName: 'Taken Name',
        logoUrl: null,
        idleImageUrl: null,
        accentColorHex: '#0E8F5A',
        thankYouMessage: null,
      },
    });
    await seedUser('user-1', {
      permissions: ['change_org_identity', 'change_org_branding'],
    });

    const req = createRequest({
      organizationId: 'org-1',
      section: 'identity',
      settings: {
        displayName: 'Taken Name',
        accentColorHex: '#0E8F5A',
        logoUrl: null,
        idleImageUrl: null,
        thankYouMessage: null,
      },
    });
    const res = await invokeHandler(req);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      organizationId: 'org-1',
      settings: expect.objectContaining({
        displayName: 'Taken Name',
      }),
    });
  });

  it('rejects storage URLs from non-project buckets even if path shape matches', async () => {
    await seedOrganization('org-1');
    await seedUser('user-1', {
      permissions: ['change_org_identity', 'change_org_branding'],
    });

    const req = createRequest({
      organizationId: 'org-1',
      section: 'branding',
      settings: {
        displayName: 'org-1',
        accentColorHex: '#0E8F5A',
        logoUrl:
          'https://firebasestorage.googleapis.com/v0/b/attacker-bucket.appspot.com/o/organizations%2Forg-1%2Fsettings%2Flogo%2Ffake.png?alt=media',
        idleImageUrl: null,
        thankYouMessage: null,
        logoWidth: 1024,
        logoHeight: 1024,
      },
    });
    const res = await invokeHandler(req);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: 'logoUrl must reference an uploaded asset for this organization',
    });
  });

  it('enforces identity permission separately from branding permission', async () => {
    await seedOrganization('org-1');
    await seedUser('user-1', {
      role: 'admin',
      permissions: ['change_org_branding'],
    });

    const req = createRequest({
      organizationId: 'org-1',
      section: 'identity',
      settings: {
        displayName: 'New Org Name',
        accentColorHex: '#0E8F5A',
        logoUrl: null,
        idleImageUrl: null,
        thankYouMessage: null,
      },
    });
    const res = await invokeHandler(req);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      error: 'You do not have permission to change organization identity',
    });
  });

  it('allows branding-only updates when caller has branding permission', async () => {
    await seedOrganization('org-1');
    await seedUser('user-1', {
      role: 'admin',
      permissions: ['change_org_branding'],
    });

    const req = createRequest({
      organizationId: 'org-1',
      section: 'branding',
      settings: {
        displayName: 'org-1',
        accentColorHex: '#123ABC',
        logoUrl: null,
        idleImageUrl: null,
        thankYouMessage: null,
      },
    });
    const res = await invokeHandler(req);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      organizationId: 'org-1',
      settings: expect.objectContaining({
        accentColorHex: '#123ABC',
      }),
    });
  });
});
