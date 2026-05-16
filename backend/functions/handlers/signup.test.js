jest.mock('../middleware/cors', () => (req, res, callback) => callback());
jest.mock('../utils/recaptcha', () => ({
  verifyRecaptcha: jest.fn(),
}));

const mockGetUserByEmail = jest.fn();
jest.mock('firebase-admin', () => ({
  auth: () => ({
    getUserByEmail: mockGetUserByEmail,
  }),
}));

const { verifyRecaptcha } = require('../utils/recaptcha');
const { validateSignupProfile, verifySignupRecaptcha, validateSignupPayload } = require('./signup');

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

const validPayload = {
  legal_name: 'Hope Relief Trust',
  charity_number: '123456',
  registered_nation: 'england_wales',
  registered_postcode: 'sw1a1aa',
  entity_type: 'registered_charity',
  contact_full_name: 'Amira Patel',
  contact_role: 'trustee',
  contact_work_email: 'admin@hope.org.uk',
  contact_phone: '07911 123456',
  authorised_signatory: true,
  gift_aid_registered: 'yes',
  hmrc_charity_reference: 'ab12345',
  primary_setting: 'mosque',
  estimated_monthly_volume_band: '500_2k',
  terms_accepted: true,
  privacy_accepted: true,
  marketing_consent: false,
};

describe('signup validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes a valid payload', () => {
    const { fieldErrors, normalized } = validateSignupPayload(validPayload);

    expect(fieldErrors).toBeNull();
    expect(normalized).toMatchObject({
      legal_name: 'Hope Relief Trust',
      charity_number: '123456',
      registered_nation: 'england_wales',
      registered_postcode: 'SW1A 1AA',
      contact_work_email: 'admin@hope.org.uk',
      contact_phone: '+447911123456',
      hmrc_charity_reference: 'AB12345',
      terms_accepted: true,
      privacy_accepted: true,
      marketing_consent: false,
    });
  });

  it('requires HMRC reference when Gift Aid is yes', () => {
    const payload = {
      ...validPayload,
      hmrc_charity_reference: '',
    };

    const { fieldErrors, normalized } = validateSignupPayload(payload);

    expect(normalized).toBeNull();
    expect(fieldErrors).toMatchObject({
      hmrc_charity_reference: expect.stringContaining('required'),
    });
  });

  it('stores HMRC reference as null when Gift Aid is not yes', () => {
    const payload = {
      ...validPayload,
      gift_aid_registered: 'no',
      hmrc_charity_reference: 'ZZ99999',
    };

    const { fieldErrors, normalized } = validateSignupPayload(payload);

    expect(fieldErrors).toBeNull();
    expect(normalized.hmrc_charity_reference).toBeNull();
  });

  it('rejects charity number mismatched with selected nation', () => {
    const payload = {
      ...validPayload,
      registered_nation: 'scotland',
      charity_number: '123456',
    };

    const { fieldErrors, normalized } = validateSignupPayload(payload);

    expect(normalized).toBeNull();
    expect(fieldErrors).toMatchObject({
      charity_number: expect.stringContaining('invalid'),
    });
  });

  it('rejects invalid UK phone numbers', () => {
    const payload = {
      ...validPayload,
      contact_phone: '123',
    };

    const { fieldErrors, normalized } = validateSignupPayload(payload);

    expect(normalized).toBeNull();
    expect(fieldErrors).toMatchObject({
      contact_phone: expect.stringContaining('valid UK phone'),
    });
  });
});

describe('validateSignupProfile handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 with field errors for invalid payloads', async () => {
    const req = {
      method: 'POST',
      body: {
        ...validPayload,
        terms_accepted: false,
      },
      headers: {},
    };

    const res = await invokeHandler(validateSignupProfile, req);

    expect(res.statusCode).toBe(422);
    expect(res.body).toMatchObject({
      error: 'VALIDATION_FAILED',
      fieldErrors: {
        terms_accepted: expect.any(String),
      },
    });
  });

  it('returns normalized payload for valid submissions', async () => {
    const req = {
      method: 'POST',
      body: validPayload,
      headers: {},
    };

    const res = await invokeHandler(validateSignupProfile, req);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        registered_postcode: 'SW1A 1AA',
        contact_phone: '+447911123456',
        hmrc_charity_reference: 'AB12345',
      },
    });
  });
});

describe('verifySignupRecaptcha handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects failed recaptcha checks', async () => {
    verifyRecaptcha.mockResolvedValue(false);

    const req = {
      method: 'POST',
      body: {
        recaptchaToken: 'test-token',
        email: 'admin@hope.org.uk',
      },
      headers: {},
    };

    const res = await invokeHandler(verifySignupRecaptcha, req);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: expect.stringContaining('reCAPTCHA verification failed'),
    });
  });

  it('succeeds when recaptcha is valid and email is unused', async () => {
    verifyRecaptcha.mockResolvedValue(true);
    mockGetUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });

    const req = {
      method: 'POST',
      body: {
        recaptchaToken: 'test-token',
        email: 'admin@hope.org.uk',
      },
      headers: {},
    };

    const res = await invokeHandler(verifySignupRecaptcha, req);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
    });
  });
});
