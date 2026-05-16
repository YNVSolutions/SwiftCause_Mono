const admin = require('firebase-admin');
const cors = require('../middleware/cors');
const { verifyRecaptcha } = require('../utils/recaptcha');

const REGISTERED_NATIONS = new Set(['england_wales', 'scotland', 'northern_ireland']);
const ENTITY_TYPES = new Set(['registered_charity', 'cio', 'cic', 'other']);
const CONTACT_ROLES = new Set(['trustee', 'ceo', 'treasurer', 'fundraising', 'ops', 'other']);
const GIFT_AID_REGISTERED_VALUES = new Set(['yes', 'no', 'dont_know']);
const PRIMARY_SETTINGS = new Set([
  'mosque',
  'church',
  'temple',
  'scout',
  'pta',
  'charity_shop',
  'events',
  'other',
]);
const ESTIMATED_MONTHLY_VOLUME_BANDS = new Set(['0_500', '500_2k', '2k_10k', '10k_plus']);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;
const HMRC_CHARITY_REFERENCE_REGEX = /^[A-Z]{1,2}[0-9]{5}$/;
const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;
const UK_E164_REGEX = /^\+44[0-9]{9,10}$/;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateEnum = (value, allowedValues) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!allowedValues.has(normalized)) {
    return null;
  }
  return normalized;
};

const normalizeUkPostcode = (value) => {
  const compact = normalizeString(value).toUpperCase().replace(/\s+/g, '');
  if (!compact || !UK_POSTCODE_REGEX.test(compact)) {
    return null;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};

const normalizeUkPhoneToE164 = (value) => {
  const raw = normalizeString(value);
  if (!raw) {
    return null;
  }

  const compact = raw.replace(/[\s().-]/g, '');
  let normalized;

  if (/^\+[0-9]+$/.test(compact)) {
    normalized = compact;
  } else if (/^00[0-9]+$/.test(compact)) {
    normalized = `+${compact.slice(2)}`;
  } else if (/^0[0-9]+$/.test(compact)) {
    normalized = `+44${compact.slice(1)}`;
  } else if (/^44[0-9]+$/.test(compact)) {
    normalized = `+${compact}`;
  } else if (/^[1-9][0-9]+$/.test(compact)) {
    normalized = `+44${compact}`;
  } else {
    return null;
  }

  if (!E164_REGEX.test(normalized)) {
    return null;
  }

  if (!UK_E164_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
};

const validateCharityNumberByNation = (charityNumber, registeredNation) => {
  if (registeredNation === 'england_wales') {
    return /^[0-9]{6,7}(?:-[0-9]+)?$/.test(charityNumber);
  }
  if (registeredNation === 'scotland') {
    return /^SC[0-9]{6}$/.test(charityNumber);
  }
  if (registeredNation === 'northern_ireland') {
    return /^NIC[0-9]{6}$/.test(charityNumber);
  }
  return false;
};

const normalizeOptionalHmrcReference = (value) => {
  const normalized = normalizeString(value).toUpperCase();
  return normalized || null;
};

const buildValidationResponse = (res, errors) => {
  return res.status(422).send({
    error: 'VALIDATION_FAILED',
    message: 'Signup payload contains invalid or missing fields',
    fieldErrors: errors,
  });
};

const validateSignupPayload = (body = {}) => {
  const fieldErrors = {};

  const legalName = normalizeString(body.legal_name);
  if (!legalName) {
    fieldErrors.legal_name = 'Legal name is required';
  }

  const registeredNation = validateEnum(body.registered_nation, REGISTERED_NATIONS);
  if (!registeredNation) {
    fieldErrors.registered_nation =
      'Registered nation must be one of england_wales, scotland, or northern_ireland';
  }

  const charityNumber = normalizeString(body.charity_number).toUpperCase();
  if (!charityNumber) {
    fieldErrors.charity_number = 'Charity number is required';
  } else if (registeredNation && !validateCharityNumberByNation(charityNumber, registeredNation)) {
    fieldErrors.charity_number = 'Charity number format is invalid for the selected nation';
  }

  const registeredPostcode = normalizeUkPostcode(body.registered_postcode);
  if (!registeredPostcode) {
    fieldErrors.registered_postcode = 'Please enter a valid UK postcode';
  }

  const entityType = validateEnum(body.entity_type, ENTITY_TYPES);
  if (!entityType) {
    fieldErrors.entity_type = 'Entity type must be one of registered_charity, cio, cic, or other';
  }

  const contactFullName = normalizeString(body.contact_full_name);
  if (!contactFullName) {
    fieldErrors.contact_full_name = 'Primary contact full name is required';
  }

  const contactRole = validateEnum(body.contact_role, CONTACT_ROLES);
  if (!contactRole) {
    fieldErrors.contact_role =
      'Contact role must be one of trustee, ceo, treasurer, fundraising, ops, or other';
  }

  const contactWorkEmail = normalizeString(body.contact_work_email).toLowerCase();
  if (!contactWorkEmail) {
    fieldErrors.contact_work_email = 'Primary contact work email is required';
  } else if (!EMAIL_REGEX.test(contactWorkEmail)) {
    fieldErrors.contact_work_email = 'Primary contact work email is invalid';
  }

  const contactPhone = normalizeUkPhoneToE164(body.contact_phone);
  if (!contactPhone) {
    fieldErrors.contact_phone = 'Please enter a valid UK phone number';
  }

  const authorisedSignatory = body.authorised_signatory === true;
  if (!authorisedSignatory) {
    fieldErrors.authorised_signatory = 'Authorised signatory confirmation is required';
  }

  const giftAidRegistered = validateEnum(body.gift_aid_registered, GIFT_AID_REGISTERED_VALUES);
  if (!giftAidRegistered) {
    fieldErrors.gift_aid_registered = 'Gift Aid registered must be yes, no, or dont_know';
  }

  const hmrcCharityReference = normalizeOptionalHmrcReference(body.hmrc_charity_reference);
  if (giftAidRegistered === 'yes') {
    if (!hmrcCharityReference) {
      fieldErrors.hmrc_charity_reference =
        'HMRC charity reference is required when Gift Aid registration is yes';
    } else if (!HMRC_CHARITY_REFERENCE_REGEX.test(hmrcCharityReference)) {
      fieldErrors.hmrc_charity_reference =
        'HMRC charity reference must be 1-2 letters followed by 5 digits';
    }
  }

  const primarySetting = validateEnum(body.primary_setting, PRIMARY_SETTINGS);
  if (!primarySetting) {
    fieldErrors.primary_setting =
      'Primary setting must be one of mosque, church, temple, scout, pta, charity_shop, events, or other';
  }

  const estimatedMonthlyVolumeBand = validateEnum(
    body.estimated_monthly_volume_band,
    ESTIMATED_MONTHLY_VOLUME_BANDS,
  );
  if (!estimatedMonthlyVolumeBand) {
    fieldErrors.estimated_monthly_volume_band =
      'Estimated monthly volume band must be one of 0_500, 500_2k, 2k_10k, or 10k_plus';
  }

  const termsAccepted = body.terms_accepted === true;
  if (!termsAccepted) {
    fieldErrors.terms_accepted = 'Terms acceptance is required';
  }

  const privacyAccepted = body.privacy_accepted === true;
  if (!privacyAccepted) {
    fieldErrors.privacy_accepted = 'Privacy acceptance is required';
  }

  const rawMarketingConsent = body.marketing_consent;
  const marketingConsent = rawMarketingConsent === true;
  if (rawMarketingConsent !== undefined && typeof rawMarketingConsent !== 'boolean') {
    fieldErrors.marketing_consent = 'Marketing consent must be a boolean value';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      fieldErrors,
      normalized: null,
    };
  }

  return {
    fieldErrors: null,
    normalized: {
      legal_name: legalName,
      charity_number: charityNumber,
      registered_nation: registeredNation,
      registered_postcode: registeredPostcode,
      entity_type: entityType,
      contact_full_name: contactFullName,
      contact_role: contactRole,
      contact_work_email: contactWorkEmail,
      contact_phone: contactPhone,
      authorised_signatory: true,
      gift_aid_registered: giftAidRegistered,
      hmrc_charity_reference: giftAidRegistered === 'yes' ? hmrcCharityReference : null,
      primary_setting: primarySetting,
      estimated_monthly_volume_band: estimatedMonthlyVolumeBand,
      terms_accepted: true,
      privacy_accepted: true,
      marketing_consent: marketingConsent,
    },
  };
};

/**
 * Handle user signup with reCAPTCHA verification.
 * This is called from the frontend before Firebase Auth signup.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @return {Promise<void>}
 */
const verifySignupRecaptcha = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const { recaptchaToken, email } = req.body;

      if (!recaptchaToken) {
        return res.status(400).send({
          error: 'reCAPTCHA verification required',
        });
      }

      if (!email) {
        return res.status(400).send({
          error: 'Email is required',
        });
      }

      // Verify reCAPTCHA
      const isValid = await verifyRecaptcha(recaptchaToken);

      if (!isValid) {
        return res.status(400).send({
          error: 'reCAPTCHA verification failed. Please try again.',
        });
      }

      // Check if email already exists
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        if (userRecord) {
          return res.status(400).send({
            error: 'Email already registered',
          });
        }
      } catch (error) {
        // User doesn't exist, which is what we want for signup
        if (error.code !== 'auth/user-not-found') {
          throw error;
        }
      }

      // reCAPTCHA verified and email available
      return res.status(200).send({
        success: true,
        message: 'Verification successful',
      });
    } catch (error) {
      console.error('Error in signup verification:', error);
      return res.status(500).send({
        error: error.message || 'Verification failed',
      });
    }
  });
};

/**
 * Validate and normalize signup payload on the server.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @return {Promise<void>}
 */
const validateSignupProfile = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const { fieldErrors, normalized } = validateSignupPayload(req.body || {});
      if (fieldErrors) {
        return buildValidationResponse(res, fieldErrors);
      }

      return res.status(200).send({
        success: true,
        data: normalized,
      });
    } catch (error) {
      console.error('Error validating signup payload:', error);
      return res.status(500).send({
        error: error.message || 'Signup validation failed',
      });
    }
  });
};

module.exports = {
  verifySignupRecaptcha,
  validateSignupProfile,
  validateSignupPayload,
  normalizeUkPostcode,
  normalizeUkPhoneToE164,
};
