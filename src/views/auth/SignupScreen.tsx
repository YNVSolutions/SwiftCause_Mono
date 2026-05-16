import React, { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Input } from '../../shared/ui/input';
import { Checkbox } from '../../shared/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';
import { checkEmailExists, checkOrganizationIdExists } from '../../shared/api/firestoreService';
import { useSignupDraft } from '../../shared/lib/hooks/useSignupDraft';
import type {
  ContactRole,
  EntityType,
  EstimatedMonthlyVolumeBand,
  GiftAidRegistered,
  PrimarySetting,
  RegisteredNation,
  SignupFormData,
} from '../../shared/types';

interface SignupScreenProps {
  onSignup: (data: SignupFormData) => Promise<void>;
  onBack: () => void;
  onLogin: () => void;
  onViewTerms: (step: number) => void;
  initialStep?: number;
}

type SignupStep = 1 | 2 | 3;
type SignupFormErrors = Partial<Record<keyof SignupFormData, string>>;

const registeredNationOptions: Array<{ value: RegisteredNation; label: string }> = [
  { value: 'england_wales', label: 'England & Wales' },
  { value: 'scotland', label: 'Scotland' },
  { value: 'northern_ireland', label: 'Northern Ireland' },
];

const entityTypeOptions: Array<{ value: EntityType; label: string }> = [
  { value: 'registered_charity', label: 'Registered Charity' },
  { value: 'cio', label: 'CIO' },
  { value: 'cic', label: 'CIC' },
  { value: 'other', label: 'Other' },
];

const contactRoleOptions: Array<{ value: ContactRole; label: string }> = [
  { value: 'trustee', label: 'Trustee' },
  { value: 'ceo', label: 'CEO' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'ops', label: 'Operations' },
  { value: 'other', label: 'Other' },
];

const giftAidRegisteredOptions: Array<{ value: GiftAidRegistered; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'dont_know', label: "Don't know" },
];

const primarySettingOptions: Array<{ value: PrimarySetting; label: string }> = [
  { value: 'mosque', label: 'Mosque' },
  { value: 'church', label: 'Church' },
  { value: 'temple', label: 'Temple' },
  { value: 'scout', label: 'Scout group' },
  { value: 'pta', label: 'PTA' },
  { value: 'charity_shop', label: 'Charity shop' },
  { value: 'events', label: 'Events' },
  { value: 'other', label: 'Other' },
];

const volumeBandOptions: Array<{ value: EstimatedMonthlyVolumeBand; label: string }> = [
  { value: '0_500', label: 'GBP 0-500' },
  { value: '500_2k', label: 'GBP 500-2,000' },
  { value: '2k_10k', label: 'GBP 2,000-10,000' },
  { value: '10k_plus', label: 'GBP 10,000+' },
];

const HMRC_REFERENCE_REGEX = /^[A-Z]{1,2}[0-9]{5}$/;
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;
const UK_E164_REGEX = /^\+44[0-9]{9,10}$/;

const normalizeUkPostcode = (value: string): string | null => {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!compact || !UK_POSTCODE_REGEX.test(compact)) {
    return null;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};

const normalizeUkPhoneToE164 = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const compact = raw.replace(/[\s().-]/g, '');
  let normalized = '';

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

  if (!E164_REGEX.test(normalized) || !UK_E164_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
};

const validateCharityNumberByNation = (
  charityNumber: string,
  registeredNation: string,
): boolean => {
  const upper = charityNumber.trim().toUpperCase();
  if (registeredNation === 'england_wales') {
    return /^[0-9]{6,7}(?:-[0-9]+)?$/.test(upper);
  }
  if (registeredNation === 'scotland') {
    return /^SC[0-9]{6}$/.test(upper);
  }
  if (registeredNation === 'northern_ireland') {
    return /^NIC[0-9]{6}$/.test(upper);
  }
  return false;
};

const getCharityNumberHint = (registeredNation: SignupFormData['registered_nation']): string => {
  if (registeredNation === 'scotland') {
    return 'Format: SC123456';
  }
  if (registeredNation === 'northern_ireland') {
    return 'Format: NIC123456';
  }
  return 'Format: 6-7 digits, optional subsidiary suffix (e.g. 123456-1)';
};

const generateOrganizationId = (legalName: string): string => {
  return legalName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const isPasswordValid = (password: string): boolean => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  );
};

export function SignupScreen({
  onSignup,
  onBack,
  onLogin,
  onViewTerms,
  initialStep,
}: SignupScreenProps) {
  const [currentStep, setCurrentStep] = useState<SignupStep>(() => {
    const parsed = Number(initialStep);
    if (parsed === 1 || parsed === 2 || parsed === 3) {
      return parsed;
    }
    return 1;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<SignupFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingOrganization, setIsCheckingOrganization] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [formData, setFormData] = useState<SignupFormData>({
    email: '',
    organizationId: '',
    password: '',
    confirmPassword: '',
    currency: 'GBP',
    legal_name: '',
    charity_number: '',
    registered_nation: '',
    registered_postcode: '',
    entity_type: '',
    contact_full_name: '',
    contact_role: '',
    contact_work_email: '',
    contact_phone: '',
    authorised_signatory: false,
    gift_aid_registered: '',
    hmrc_charity_reference: '',
    primary_setting: '',
    estimated_monthly_volume_band: '',
    terms_accepted: false,
    privacy_accepted: false,
    marketing_consent: false,
    recaptchaToken: undefined,
  });

  const { draft, saveDraft, clearDraft, isHydrated } = useSignupDraft<{
    formData: SignupFormData;
    currentStep: SignupStep;
  }>('signupDraft', 5 * 60 * 1000);

  useEffect(() => {
    const parsed = Number(initialStep);
    if (parsed === 1 || parsed === 2 || parsed === 3) {
      setCurrentStep(parsed);
    }
  }, [initialStep]);

  useEffect(() => {
    if (!draft?.formData) return;

    setFormData((prev) => {
      const next = draft.formData;
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });

    if (
      !initialStep &&
      (draft.currentStep === 1 || draft.currentStep === 2 || draft.currentStep === 3)
    ) {
      setCurrentStep(draft.currentStep);
    }

    setRecaptchaToken(null);
  }, [draft, initialStep]);

  useEffect(() => {
    if (!isHydrated) return;
    saveDraft({ formData, currentStep });
  }, [formData, currentStep, saveDraft, isHydrated]);

  const updateFormData = (
    field: keyof SignupFormData,
    value: SignupFormData[keyof SignupFormData],
  ) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === 'contact_work_email' && typeof value === 'string') {
        next.email = value;
      }

      if (field === 'legal_name' && typeof value === 'string') {
        next.organizationId = generateOrganizationId(value);
      }

      return next;
    });

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleEmailBlur = async () => {
    const email = formData.contact_work_email.trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      return;
    }

    setIsCheckingEmail(true);
    try {
      const exists = await checkEmailExists(email);
      if (exists) {
        setErrors((prev) => ({
          ...prev,
          contact_work_email:
            'This email is already registered. Please sign in or use a different work email.',
        }));
      }
    } catch (error) {
      console.error('Error checking email:', error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleLegalNameBlur = async () => {
    const legalName = formData.legal_name.trim();
    if (!legalName) {
      return;
    }

    setIsCheckingOrganization(true);
    try {
      const organizationId = generateOrganizationId(legalName);
      const exists = await checkOrganizationIdExists(organizationId);
      if (exists) {
        setErrors((prev) => ({
          ...prev,
          legal_name:
            'An organization with this legal name already exists. Please use the registered legal entity name.',
        }));
      }
    } catch (error) {
      console.error('Error checking organization name:', error);
    } finally {
      setIsCheckingOrganization(false);
    }
  };

  const validateStep = async (step: SignupStep): Promise<boolean> => {
    const nextErrors: SignupFormErrors = {};

    if (step === 1) {
      if (!formData.legal_name.trim()) {
        nextErrors.legal_name = 'Legal name is required';
      }

      if (!formData.registered_nation) {
        nextErrors.registered_nation = 'Registered nation is required';
      }

      if (!formData.charity_number.trim()) {
        nextErrors.charity_number = 'Charity number is required';
      } else if (
        formData.registered_nation &&
        !validateCharityNumberByNation(formData.charity_number, formData.registered_nation)
      ) {
        nextErrors.charity_number = 'Charity number format is invalid for the selected nation';
      }

      if (!formData.registered_postcode.trim()) {
        nextErrors.registered_postcode = 'Registered postcode is required';
      } else if (!normalizeUkPostcode(formData.registered_postcode)) {
        nextErrors.registered_postcode = 'Please enter a valid UK postcode';
      }

      if (!formData.entity_type) {
        nextErrors.entity_type = 'Entity type is required';
      }

      if (!formData.contact_full_name.trim()) {
        nextErrors.contact_full_name = 'Primary contact full name is required';
      }

      if (!formData.contact_role) {
        nextErrors.contact_role = 'Primary contact role is required';
      }

      const contactEmail = formData.contact_work_email.trim().toLowerCase();
      if (!contactEmail) {
        nextErrors.contact_work_email = 'Primary contact work email is required';
      } else if (!EMAIL_REGEX.test(contactEmail)) {
        nextErrors.contact_work_email = 'Please enter a valid work email address';
      } else {
        try {
          const exists = await checkEmailExists(contactEmail);
          if (exists) {
            nextErrors.contact_work_email =
              'This email is already registered. Please sign in or use a different work email.';
          }
        } catch (error) {
          console.error('Error checking email:', error);
        }
      }

      if (!formData.contact_phone.trim()) {
        nextErrors.contact_phone = 'Primary contact phone is required';
      } else if (!normalizeUkPhoneToE164(formData.contact_phone)) {
        nextErrors.contact_phone = 'Please enter a valid UK phone number';
      }

      if (formData.legal_name.trim()) {
        const organizationId = generateOrganizationId(formData.legal_name);
        if (!organizationId) {
          nextErrors.legal_name = 'Please enter a valid legal name';
        } else {
          try {
            const exists = await checkOrganizationIdExists(organizationId);
            if (exists) {
              nextErrors.legal_name =
                'An organization with this legal name already exists. Please use the registered legal entity name.';
            }
          } catch (error) {
            console.error('Error checking organization name:', error);
          }
        }
      }
    }

    if (step === 2) {
      if (!formData.gift_aid_registered) {
        nextErrors.gift_aid_registered = 'Gift Aid registration status is required';
      }

      if (formData.gift_aid_registered === 'yes') {
        const hmrcRef = formData.hmrc_charity_reference.trim().toUpperCase();
        if (!hmrcRef) {
          nextErrors.hmrc_charity_reference =
            'HMRC charity reference is required when Gift Aid registration is yes';
        } else if (!HMRC_REFERENCE_REGEX.test(hmrcRef)) {
          nextErrors.hmrc_charity_reference =
            'HMRC charity reference must be 1-2 letters followed by 5 digits';
        }
      }

      if (!formData.primary_setting) {
        nextErrors.primary_setting = 'Primary setting is required';
      }

      if (!formData.estimated_monthly_volume_band) {
        nextErrors.estimated_monthly_volume_band = 'Estimated monthly volume band is required';
      }

      if (!formData.authorised_signatory) {
        nextErrors.authorised_signatory = 'You must confirm authorised-signatory status';
      }

      if (!formData.terms_accepted) {
        nextErrors.terms_accepted = 'You must accept the Terms of Service';
      }

      if (!formData.privacy_accepted) {
        nextErrors.privacy_accepted = 'You must accept the Privacy Policy';
      }
    }

    if (step === 3) {
      if (!formData.password) {
        nextErrors.password = 'Password is required';
      } else if (!isPasswordValid(formData.password)) {
        nextErrors.password =
          'Password must be 8+ chars and include uppercase, lowercase, number, and special character';
      }

      if (!formData.confirmPassword) {
        nextErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match';
      }

      if (!recaptchaToken) {
        nextErrors.recaptchaToken = 'Please complete the reCAPTCHA verification';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = async () => {
    setIsValidating(true);
    try {
      const valid = await validateStep(currentStep);
      if (valid) {
        setCurrentStep((prev) => (prev === 1 ? 2 : 3));
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => (prev === 3 ? 2 : 1));
  };

  const handleSubmit = async () => {
    const valid = await validateStep(3);
    if (!valid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedPostcode =
        normalizeUkPostcode(formData.registered_postcode) || formData.registered_postcode;
      const normalizedHmrcRef = formData.hmrc_charity_reference.trim().toUpperCase();
      const signupPayload: SignupFormData = {
        ...formData,
        email: formData.contact_work_email.trim().toLowerCase(),
        contact_work_email: formData.contact_work_email.trim().toLowerCase(),
        charity_number: formData.charity_number.trim().toUpperCase(),
        registered_postcode: normalizedPostcode,
        contact_phone: formData.contact_phone.trim(),
        hmrc_charity_reference: formData.gift_aid_registered === 'yes' ? normalizedHmrcRef : '',
        organizationId: generateOrganizationId(formData.legal_name),
        recaptchaToken: recaptchaToken || undefined,
      };

      await onSignup(signupPayload);
      clearDraft();
    } catch (error) {
      setIsSubmitting(false);
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
      setRecaptchaToken(null);
      throw error;
    }
  };

  const signatoryName = formData.legal_name.trim() || 'this charity';
  const progress = Math.round((currentStep / 3) * 100);

  return (
    <div className="min-h-screen bg-[#F3F1EA] font-lexend">
      <main className="min-h-screen lg:grid lg:grid-cols-[0.78fr_1fr]">
        <div className="relative hidden overflow-hidden bg-gradient-to-b from-[#0f5132] to-[#064e3b] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <button
            onClick={() => {
              clearDraft();
              onBack();
            }}
            className="group relative z-10 flex items-center gap-2 text-left text-white/90 transition hover:text-white"
          >
            <span className="flex h-12 w-12 items-center justify-center">
              <Image
                src="/logo.png"
                alt="SwiftCause logo"
                width={40}
                height={40}
                className="rounded-xl transition-transform duration-300 group-hover:scale-105"
              />
            </span>
            <span className="font-lexend text-2xl font-bold tracking-tight text-stone-50">
              SwiftCause
            </span>
          </button>

          <div className="relative z-10 space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Charity onboarding with compliance-ready signup.
            </h2>
            <p className="max-w-md text-base text-emerald-100/80">
              Complete identity, contact, HMRC readiness, and consent details so your organization
              can move into review and onboarding without follow-up data requests.
            </p>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-200">
                Progress
              </p>
              <p className="mt-2 text-3xl font-bold">Step {currentStep} of 3</p>
              <p className="mt-1 text-sm text-emerald-100/80">{progress}% complete</p>
            </div>
          </div>

          <div className="relative z-10 rounded-2xl border border-white/20 bg-white/10 p-5 text-sm text-emerald-100/85">
            Tip: use your official register details exactly as recorded to avoid manual corrections
            later.
          </div>
        </div>

        <div className="flex items-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-8 text-center lg:text-left">
              <h1 className="text-3xl font-bold text-slate-900">Create your SwiftCause account</h1>
              <p className="mt-2 text-sm text-slate-500">
                All required fields support super admin review, Stripe onboarding, and Gift Aid
                export readiness.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold uppercase tracking-wide text-[#064e3b]">
                    Step {currentStep} of 3
                  </span>
                  <span className="font-semibold text-slate-400">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#064e3b] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {currentStep === 1 && 'Charity identity and contact'}
                  {currentStep === 2 && 'HMRC readiness and consents'}
                  {currentStep === 3 && 'Account security'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {currentStep === 1 &&
                    'Capture legal registration details and your primary contact data.'}
                  {currentStep === 2 &&
                    'Confirm Gift Aid status, use case, and legal/privacy consent statements.'}
                  {currentStep === 3 && 'Set password and complete reCAPTCHA to finish signup.'}
                </p>
              </div>

              {currentStep === 1 && (
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleNext();
                  }}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="legal_name"
                      >
                        Legal Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="legal_name"
                        value={formData.legal_name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('legal_name', e.target.value)
                        }
                        onBlur={handleLegalNameBlur}
                        placeholder="Enter registered legal name"
                        disabled={isCheckingOrganization}
                        className={`h-11 ${errors.legal_name ? 'border-red-500' : ''}`}
                      />
                      {errors.legal_name && (
                        <p className="mt-1 text-xs text-red-600">{errors.legal_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Registered Nation <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                        {registeredNationOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="radio"
                              name="registered_nation"
                              checked={formData.registered_nation === option.value}
                              onChange={() => updateFormData('registered_nation', option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {errors.registered_nation && (
                        <p className="mt-1 text-xs text-red-600">{errors.registered_nation}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="charity_number"
                      >
                        Charity Number <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="charity_number"
                        value={formData.charity_number}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('charity_number', e.target.value)
                        }
                        placeholder="Enter charity number"
                        className={`h-11 ${errors.charity_number ? 'border-red-500' : ''}`}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {getCharityNumberHint(formData.registered_nation)}
                      </p>
                      {errors.charity_number && (
                        <p className="mt-1 text-xs text-red-600">{errors.charity_number}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="registered_postcode"
                      >
                        Registered Postcode <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="registered_postcode"
                        value={formData.registered_postcode}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('registered_postcode', e.target.value.toUpperCase())
                        }
                        placeholder="SW1A 1AA"
                        className={`h-11 uppercase ${errors.registered_postcode ? 'border-red-500' : ''}`}
                      />
                      {errors.registered_postcode && (
                        <p className="mt-1 text-xs text-red-600">{errors.registered_postcode}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Entity Type <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                        {entityTypeOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="radio"
                              name="entity_type"
                              checked={formData.entity_type === option.value}
                              onChange={() => updateFormData('entity_type', option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {errors.entity_type && (
                        <p className="mt-1 text-xs text-red-600">{errors.entity_type}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="contact_full_name"
                      >
                        Primary Contact Full Name <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="contact_full_name"
                        value={formData.contact_full_name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('contact_full_name', e.target.value)
                        }
                        placeholder="Enter full name"
                        className={`h-11 ${errors.contact_full_name ? 'border-red-500' : ''}`}
                      />
                      {errors.contact_full_name && (
                        <p className="mt-1 text-xs text-red-600">{errors.contact_full_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Primary Contact Role <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.contact_role}
                        onValueChange={(value) =>
                          updateFormData('contact_role', value as ContactRole)
                        }
                      >
                        <SelectTrigger
                          className={`h-11 ${errors.contact_role ? 'border-red-500' : ''}`}
                        >
                          <SelectValue placeholder="Select contact role" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactRoleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.contact_role && (
                        <p className="mt-1 text-xs text-red-600">{errors.contact_role}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="contact_work_email"
                      >
                        Primary Contact Work Email <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="contact_work_email"
                        type="email"
                        value={formData.contact_work_email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('contact_work_email', e.target.value)
                        }
                        onBlur={handleEmailBlur}
                        placeholder="admin@charity.org.uk"
                        disabled={isCheckingEmail}
                        className={`h-11 ${errors.contact_work_email ? 'border-red-500' : ''}`}
                      />
                      {errors.contact_work_email && (
                        <p className="mt-1 text-xs text-red-600">{errors.contact_work_email}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="contact_phone"
                      >
                        Primary Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="contact_phone"
                        value={formData.contact_phone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('contact_phone', e.target.value)
                        }
                        placeholder="07xxxxxxxxx"
                        className={`h-11 ${errors.contact_phone ? 'border-red-500' : ''}`}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Saved in E.164 format with UK default (for example +447911123456).
                      </p>
                      {errors.contact_phone && (
                        <p className="mt-1 text-xs text-red-600">{errors.contact_phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isValidating || isCheckingEmail || isCheckingOrganization}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#064e3b] px-6 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isValidating ? 'Validating...' : 'Continue'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {currentStep === 2 && (
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleNext();
                  }}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Gift Aid Registered <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                        {giftAidRegisteredOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 text-sm text-slate-700"
                          >
                            <input
                              type="radio"
                              name="gift_aid_registered"
                              checked={formData.gift_aid_registered === option.value}
                              onChange={() => updateFormData('gift_aid_registered', option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      {errors.gift_aid_registered && (
                        <p className="mt-1 text-xs text-red-600">{errors.gift_aid_registered}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="hmrc_charity_reference"
                      >
                        HMRC Charity Reference{' '}
                        {formData.gift_aid_registered === 'yes' ? (
                          <span className="text-red-500">*</span>
                        ) : (
                          <span className="text-slate-400">
                            (optional unless Gift Aid registered = yes)
                          </span>
                        )}
                      </label>
                      <Input
                        id="hmrc_charity_reference"
                        value={formData.hmrc_charity_reference}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateFormData('hmrc_charity_reference', e.target.value.toUpperCase())
                        }
                        placeholder="AB12345"
                        className={`h-11 uppercase ${errors.hmrc_charity_reference ? 'border-red-500' : ''}`}
                      />
                      {errors.hmrc_charity_reference && (
                        <p className="mt-1 text-xs text-red-600">{errors.hmrc_charity_reference}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Primary Setting <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.primary_setting}
                        onValueChange={(value) =>
                          updateFormData('primary_setting', value as PrimarySetting)
                        }
                      >
                        <SelectTrigger
                          className={`h-11 ${errors.primary_setting ? 'border-red-500' : ''}`}
                        >
                          <SelectValue placeholder="Select primary setting" />
                        </SelectTrigger>
                        <SelectContent>
                          {primarySettingOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.primary_setting && (
                        <p className="mt-1 text-xs text-red-600">{errors.primary_setting}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Estimated Monthly Volume <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.estimated_monthly_volume_band}
                        onValueChange={(value) =>
                          updateFormData(
                            'estimated_monthly_volume_band',
                            value as EstimatedMonthlyVolumeBand,
                          )
                        }
                      >
                        <SelectTrigger
                          className={`h-11 ${errors.estimated_monthly_volume_band ? 'border-red-500' : ''}`}
                        >
                          <SelectValue placeholder="Select expected monthly volume" />
                        </SelectTrigger>
                        <SelectContent>
                          {volumeBandOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.estimated_monthly_volume_band && (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.estimated_monthly_volume_band}
                        </p>
                      )}
                    </div>

                    <div className="space-y-4 rounded-lg border border-slate-200 p-4 md:col-span-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="authorised_signatory"
                          checked={formData.authorised_signatory}
                          onCheckedChange={(checked) =>
                            updateFormData('authorised_signatory', checked === true)
                          }
                        />
                        <label htmlFor="authorised_signatory" className="text-sm text-slate-700">
                          I confirm I am authorised by the trustees to enter into this agreement on
                          behalf of {signatoryName}.
                        </label>
                      </div>
                      {errors.authorised_signatory && (
                        <p className="text-xs text-red-600">{errors.authorised_signatory}</p>
                      )}

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="terms_accepted"
                          checked={formData.terms_accepted}
                          onCheckedChange={(checked) =>
                            updateFormData('terms_accepted', checked === true)
                          }
                        />
                        <label htmlFor="terms_accepted" className="text-sm text-slate-700">
                          I accept the{' '}
                          <button
                            type="button"
                            className="font-semibold text-[#064e3b] hover:underline"
                            onClick={() => onViewTerms(currentStep)}
                          >
                            Terms of Service
                          </button>
                          .
                        </label>
                      </div>
                      {errors.terms_accepted && (
                        <p className="text-xs text-red-600">{errors.terms_accepted}</p>
                      )}

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="privacy_accepted"
                          checked={formData.privacy_accepted}
                          onCheckedChange={(checked) =>
                            updateFormData('privacy_accepted', checked === true)
                          }
                        />
                        <label htmlFor="privacy_accepted" className="text-sm text-slate-700">
                          I accept the Privacy Policy.
                        </label>
                      </div>
                      {errors.privacy_accepted && (
                        <p className="text-xs text-red-600">{errors.privacy_accepted}</p>
                      )}

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="marketing_consent"
                          checked={formData.marketing_consent}
                          onCheckedChange={(checked) =>
                            updateFormData('marketing_consent', checked === true)
                          }
                        />
                        <label htmlFor="marketing_consent" className="text-sm text-slate-700">
                          I would like to receive marketing updates (optional).
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isValidating}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#064e3b] px-6 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isValidating ? 'Validating...' : 'Continue'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {currentStep === 3 && (
                <form
                  className="space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="password"
                      >
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateFormData('password', e.target.value)
                          }
                          placeholder="Enter password"
                          className={`h-11 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500"
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-xs text-red-600">{errors.password}</p>
                      )}
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-semibold text-slate-700"
                        htmlFor="confirmPassword"
                      >
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateFormData('confirmPassword', e.target.value)
                          }
                          placeholder="Confirm password"
                          className={`h-11 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500"
                        >
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Password must contain at least 8 characters, one uppercase letter, one lowercase
                    letter, one number, and one special character.
                  </div>

                  <div className="flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}
                      onChange={(token: string | null) => {
                        setRecaptchaToken(token);
                        if (errors.recaptchaToken) {
                          setErrors((prev) => ({ ...prev, recaptchaToken: undefined }));
                        }
                      }}
                      onExpired={() => setRecaptchaToken(null)}
                      onErrored={() => setRecaptchaToken(null)}
                    />
                  </div>
                  {errors.recaptchaToken && (
                    <p className="text-center text-xs text-red-600">{errors.recaptchaToken}</p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handlePrevious}
                      className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        !isPasswordValid(formData.password) ||
                        formData.password !== formData.confirmPassword ||
                        !recaptchaToken
                      }
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-[#064e3b] px-6 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating account...' : 'Create account'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <button
                onClick={() => {
                  clearDraft();
                  onLogin();
                }}
                className="font-semibold text-[#064e3b] hover:underline"
              >
                Log in
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
