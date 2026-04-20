import React, { useCallback, useEffect, useState } from 'react';
import { User, MapPin, Check, CheckCircle } from 'lucide-react';
import { formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';
import { GiftAidDetails } from '@/entities/giftAid/model/types';
import { giftAidApi } from '@/entities/giftAid/api';
import { HMRC_DECLARATION_TEXT_VERSION, getHmrcDeclarationText } from '@/shared/config/constants';

interface GiftAidDetailsPanelProps {
  amount: number;
  currency: string;
  campaignTitle: string;
  organizationId: string;
  initialFullName?: string;
  initialDonorEmail?: string;
  collectDonorEmail?: boolean;
  enableAutoLookup?: boolean;
  onSubmit: (details: GiftAidDetails) => void;
  onBack: () => void;
}

// ─── Reusable MD3 outlined field wrapper ────────────────────────────────────
interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}
const Field: React.FC<FieldProps> = ({ label, required, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
  </div>
);

// Shared input class builder — MD3 outlined field with custom focus ring
const inputCls = (hasError?: boolean) =>
  [
    'w-full min-h-[48px] px-3 rounded-md bg-transparent text-sm text-gray-900',
    'border transition-colors outline-none',
    hasError
      ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent'
      : 'border-gray-400 focus:ring-2 focus:ring-[#008751] focus:border-transparent',
    'placeholder:text-gray-400',
  ].join(' ');

export const GiftAidDetailsPanel: React.FC<GiftAidDetailsPanelProps> = ({
  amount,
  currency,
  campaignTitle,
  organizationId,
  initialFullName = '',
  initialDonorEmail = '',
  collectDonorEmail = true,
  enableAutoLookup = true,
  onSubmit,
}) => {
  // Create a unique key for this form session
  const formStorageKey = `giftAidForm_${campaignTitle}_${amount}`;

  // Load saved form data from sessionStorage (session-only for security)
  const loadSavedFormData = () => {
    try {
      const saved = sessionStorage.getItem(formStorageKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const savedData = loadSavedFormData();

  const [donorTitle, setDonorTitle] = useState(savedData?.donorTitle || '');
  const [fullName, setFullName] = useState(savedData?.fullName || initialFullName);
  const [donorEmail, setDonorEmail] = useState(savedData?.donorEmail || initialDonorEmail);
  const [houseNumber, setHouseNumber] = useState(savedData?.houseNumber || '');
  const [addressLine1, setAddressLine1] = useState(savedData?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(savedData?.addressLine2 || '');
  const [town, setTown] = useState(savedData?.town || '');
  const [postcode, setPostcode] = useState(savedData?.postcode || '');

  const [claimGiftAid, setClaimGiftAid] = useState(savedData?.claimGiftAid || false);
  const [usingSavedConsent, setUsingSavedConsent] = useState(false);
  const [savedConsentDate, setSavedConsentDate] = useState<string | null>(null);
  const [lastLookupEmail, setLastLookupEmail] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState<{
    fullName?: string;
    donorEmail?: string;
    houseNumber?: string;
    addressLine1?: string;
    town?: string;
    postcode?: string;
    claimGiftAid?: string;
  }>({});

  // Save form data to sessionStorage whenever form fields change (session-only for security)
  useEffect(() => {
    const formData = {
      donorTitle,
      fullName,
      donorEmail,
      houseNumber,
      addressLine1,
      addressLine2,
      town,
      postcode,
      claimGiftAid,
    };

    try {
      sessionStorage.setItem(formStorageKey, JSON.stringify(formData));
    } catch (error) {
      console.warn('Failed to save form data to sessionStorage:', error);
    }
  }, [
    donorTitle,
    fullName,
    donorEmail,
    houseNumber,
    addressLine1,
    addressLine2,
    town,
    postcode,
    claimGiftAid,
    formStorageKey,
  ]);

  // Clear saved form data on successful submission
  const clearSavedFormData = () => {
    try {
      sessionStorage.removeItem(formStorageKey);
    } catch (error) {
      console.warn('Failed to clear saved form data:', error);
    }
  };

  const giftAidAmount = amount * 0.25;
  const totalWithGiftAid = amount + giftAidAmount;
  const declarationText = getHmrcDeclarationText(campaignTitle);

  const loadReusableGiftAidProfile = useCallback(
    async (emailInput: string) => {
      const normalizedEmail = emailInput.trim().toLowerCase();
      if (!normalizedEmail || normalizedEmail === lastLookupEmail) return;
      try {
        setPrefillLoading(true);
        setLastLookupEmail(normalizedEmail);
        const profile = await giftAidApi.getReusableGiftAidProfileByEmail(normalizedEmail);
        if (!profile) return;
        setDonorTitle(profile.donorTitle || '');
        setFullName(`${profile.firstName} ${profile.surname}`.trim() || initialFullName);
        setHouseNumber(profile.houseNumber || '');
        setAddressLine1(profile.addressLine1 || '');
        setAddressLine2(profile.addressLine2 || '');
        setTown(profile.town || '');
        setPostcode(profile.postcode || '');
        setDonorEmail(profile.donorEmail || normalizedEmail);
        setClaimGiftAid(true);
        setUsingSavedConsent(true);
        setSavedConsentDate(profile.declarationDate || null);
      } catch (error) {
        console.error('Unable to fetch reusable Gift Aid profile:', error);
      } finally {
        setPrefillLoading(false);
      }
    },
    [initialFullName, lastLookupEmail],
  );

  useEffect(() => {
    if (!enableAutoLookup || !initialDonorEmail.trim()) return;
    void loadReusableGiftAidProfile(initialDonorEmail);
  }, [initialDonorEmail, enableAutoLookup, loadReusableGiftAidProfile]);

  const formatAmount = (amt: number) => formatCurrencyFromMajor(amt, currency);

  const validateForm = () => {
    const e: typeof errors = {};
    if (!fullName.trim()) {
      e.fullName = 'Full name is required';
    } else if (fullName.trim().length < 3) {
      e.fullName = 'Full name must be at least 3 characters';
    } else if (fullName.trim().split(' ').filter(Boolean).length < 2) {
      e.fullName = 'Please enter both first name and surname';
    }
    if (collectDonorEmail || donorEmail.trim()) {
      if (!donorEmail.trim()) e.donorEmail = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail.trim()))
        e.donorEmail = 'Please enter a valid email address';
    }
    if (!addressLine1.trim()) e.addressLine1 = 'Address Line 1 is required';
    if (!town.trim()) e.town = 'Town/City is required';
    if (!postcode.trim()) {
      e.postcode = 'Postcode is required';
    } else if (!/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(postcode.trim())) {
      e.postcode = 'Please enter a valid UK postcode';
    }
    if (!claimGiftAid && !usingSavedConsent) {
      e.claimGiftAid = 'Please confirm you want to claim Gift Aid';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    const currentDate = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    const nameParts = fullName.trim().split(' ').filter(Boolean);
    const giftAidDetails: GiftAidDetails = {
      donorTitle: donorTitle.trim().slice(0, 4) || undefined,
      firstName: nameParts[0] || '',
      surname: nameParts.slice(1).join(' ') || '',
      houseNumber: houseNumber.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      town: town.trim(),
      postcode: postcode.trim().toUpperCase(),
      donorEmail: donorEmail.trim() || undefined,
      giftAidConsent: true,
      ukTaxpayerConfirmation: true,
      dataProcessingConsent: true,
      homeAddressConfirmed: true,
      declarationText,
      declarationTextVersion: HMRC_DECLARATION_TEXT_VERSION,
      declarationDate: currentDate,
      donationAmount: Math.round(amount * 100),
      donationDate: currentDate,
      organizationId,
      donationId: '',
      timestamp: currentDate,
      taxYear: `${currentYear}-${String(currentYear + 1).slice(-2)}`,
    };
    try {
      // Clear saved form data on successful submission
      clearSavedFormData();
      onSubmit(giftAidDetails);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col w-full max-w-xl md:max-w-[42rem] mx-auto max-h-full">
      {/* ── Impact header ─────────────────────────────────────────────────── */}
      <div className="bg-green-700 text-white px-6 py-4 text-center">
        <p className="text-xs uppercase tracking-widest text-green-100 mb-1">Your impact</p>
        <p className="text-xl font-medium">
          Boosting <span className="font-semibold">{formatAmount(amount)}</span> to{' '}
          <span className="font-semibold">{formatAmount(totalWithGiftAid)}</span>
        </p>
      </div>

      {/* ── Scrollable form body ───────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col grow min-h-0">
        <div
          className="grow min-h-0 overflow-y-auto px-6 py-5 space-y-6"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Campaign info banner */}
          <div className="bg-green-50 border border-green-200 rounded-full px-5 py-2.5 text-center w-fit mx-auto max-w-full">
            <p className="text-sm font-medium text-gray-900 leading-snug truncate">
              {campaignTitle}
            </p>
          </div>

          {/* Prefill banners */}
          {prefillLoading && (
            <div className="flex items-center gap-2 bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700">
              <div className="w-4 h-4 rounded-full border-2 border-green-600 border-t-transparent animate-spin shrink-0" />
              Checking for your saved Gift Aid details…
            </div>
          )}
          {usingSavedConsent && !prefillLoading && (
            <div className="bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700">
              ✓ Using your saved Gift Aid details
              {savedConsentDate
                ? ` from ${new Date(savedConsentDate).toLocaleDateString('en-GB')}`
                : ''}
              .
            </div>
          )}

          {/* ── Section 1: Personal info ─────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-4 h-4 text-green-700" />
              <h3 className="text-base font-medium text-gray-900">Donor details</h3>
            </div>

            {/* Title + Full Name */}
            <div className="grid grid-cols-[100px_1fr] gap-4">
              <Field label="Title">
                <select
                  value={donorTitle}
                  onChange={(e) => setDonorTitle(e.target.value)}
                  className={inputCls() + ' cursor-pointer'}
                >
                  <option value="">Select</option>
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Dr">Dr</option>
                </select>
              </Field>

              <Field label="Full Name" required error={errors.fullName}>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
                  }}
                  className={inputCls(!!errors.fullName)}
                  placeholder="e.g. Jane Smith"
                />
              </Field>
            </div>

            {/* Email */}
            {collectDonorEmail && (
              <Field label="Email Address" required error={errors.donorEmail}>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => {
                    setDonorEmail(e.target.value);
                    setLastLookupEmail('');
                    if (usingSavedConsent) {
                      setUsingSavedConsent(false);
                      setSavedConsentDate(null);
                      setClaimGiftAid(false);
                    }
                    if (errors.donorEmail) setErrors((p) => ({ ...p, donorEmail: undefined }));
                  }}
                  onBlur={() => void loadReusableGiftAidProfile(donorEmail)}
                  className={inputCls(!!errors.donorEmail)}
                  placeholder="e.g. jane@example.com"
                />
              </Field>
            )}
          </section>

          {/* ── Section 2: Home Address ───────────────────────────────────── */}
          <section className="space-y-4 mb-8">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-700" />
              <h3 className="text-base font-medium text-gray-900">Home Address</h3>
            </div>

            {/* HMRC address note */}
            <p className="text-sm text-gray-600 mt-1 mb-5">
              Please enter your home address. HMRC requires a home address (not a workplace or PO
              Box) to claim Gift Aid.
            </p>

            {/* House + Street */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="House Number / Name" error={errors.houseNumber}>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => {
                    setHouseNumber(e.target.value);
                    if (errors.houseNumber) setErrors((p) => ({ ...p, houseNumber: undefined }));
                  }}
                  className={inputCls(!!errors.houseNumber)}
                  placeholder="e.g. 42"
                />
              </Field>

              <Field label="Street Address" required error={errors.addressLine1}>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    if (errors.addressLine1) setErrors((p) => ({ ...p, addressLine1: undefined }));
                  }}
                  className={inputCls(!!errors.addressLine1)}
                  placeholder="e.g. Main Street"
                />
              </Field>
            </div>

            {/* Address Line 2 + Town */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Address Line 2">
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className={inputCls()}
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </Field>

              <Field label="Town / City" required error={errors.town}>
                <input
                  type="text"
                  value={town}
                  onChange={(e) => {
                    setTown(e.target.value);
                    if (errors.town) setErrors((p) => ({ ...p, town: undefined }));
                  }}
                  className={inputCls(!!errors.town)}
                  placeholder="e.g. London"
                />
              </Field>
            </div>

            {/* Postcode + Country */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="UK Postcode" required error={errors.postcode}>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => {
                    setPostcode(e.target.value.toUpperCase());
                    if (errors.postcode) setErrors((p) => ({ ...p, postcode: undefined }));
                  }}
                  className={inputCls(!!errors.postcode) + ' uppercase'}
                  placeholder="SW1A 1AA"
                  maxLength={8}
                />
              </Field>

              <Field label="Country">
                <input
                  type="text"
                  value="United Kingdom"
                  disabled
                  className="w-full min-h-[48px] px-3 rounded-md border border-gray-300 bg-gray-50 text-sm text-gray-500 cursor-not-allowed"
                />
              </Field>
            </div>
          </section>

          {/* ── Section 3: Gift Aid declaration ──────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-700" />
              <h3 className="text-base font-medium text-gray-900">Gift Aid Declaration</h3>
            </div>

            {/* ── Primary checkbox with mandatory legal text ─────────────── */}
            <div
              role="checkbox"
              aria-checked={claimGiftAid || usingSavedConsent}
              tabIndex={0}
              onClick={() => {
                if (usingSavedConsent) return;
                const next = !claimGiftAid;
                setClaimGiftAid(next);
                if (next) setErrors((p) => ({ ...p, claimGiftAid: undefined }));
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  if (usingSavedConsent) return;
                  const next = !claimGiftAid;
                  setClaimGiftAid(next);
                  if (next) setErrors((p) => ({ ...p, claimGiftAid: undefined }));
                }
              }}
              className={[
                'flex flex-col rounded-xl px-4 py-4 cursor-pointer select-none',
                'transition-colors duration-200 outline-none',
                'focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2',
                errors.claimGiftAid
                  ? 'bg-red-50'
                  : claimGiftAid || usingSavedConsent
                    ? 'bg-green-50'
                    : 'bg-gray-50',
              ].join(' ')}
            >
              {/* Checkbox + main label */}
              <div className="flex items-start gap-4">
                {/* MD3 checkbox */}
                <div
                  className={[
                    'mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                    claimGiftAid || usingSavedConsent
                      ? 'bg-[#008751] border-[#008751]'
                      : 'bg-white border-gray-400',
                  ].join(' ')}
                >
                  {(claimGiftAid || usingSavedConsent) && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 leading-snug">
                    Yes, claim Gift Aid to boost my donation by 25%
                  </p>
                </div>
              </div>

              {/* Mandatory HMRC legal declaration text - always visible */}
              <div className="ml-9 mt-2">
                <p className="text-sm text-gray-600 leading-relaxed">
                  I want to Gift Aid my donation and any donations I make in the future or have made
                  in the past 4 years to {campaignTitle.replace(/^Campaign Title:\s*/i, '')}. I am a
                  UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax
                  than the amount of Gift Aid claimed on all my donations in that tax year, it is my
                  responsibility to pay any difference.
                </p>
              </div>
            </div>

            {errors.claimGiftAid && (
              <p className="text-xs text-red-600 ml-1">{errors.claimGiftAid}</p>
            )}
          </section>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────────── */}
        <div className="px-6 pb-6 pt-4 bg-white border-t border-gray-100 space-y-3">
          <p className="text-sm text-gray-500 text-center mb-4">
            By proceeding, you consent to us securely processing your information to claim Gift Aid
            from HMRC.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className={[
              'w-full min-h-[48px] py-3.5 rounded-full font-medium text-base tracking-wide',
              'flex items-center justify-center gap-2',
              'transition-all duration-300 ease-in-out',
              claimGiftAid || usingSavedConsent
                ? 'bg-[#008751] text-white hover:bg-[#006b40] hover:shadow-md cursor-pointer'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none',
              submitting ? 'opacity-70 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {submitting && (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            )}
            Boost to {formatAmount(totalWithGiftAid)} &amp; Complete
          </button>
        </div>
      </form>
    </div>
  );
};
