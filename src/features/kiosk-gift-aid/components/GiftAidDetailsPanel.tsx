import React, { useCallback, useEffect, useState } from 'react';
import { User, MapPin, ArrowRight, Check, CheckCircle } from 'lucide-react';
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
  const [donorTitle, setDonorTitle] = useState('');
  const [fullName, setFullName] = useState(initialFullName);
  const [donorEmail, setDonorEmail] = useState(initialDonorEmail);
  const [houseNumber, setHouseNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');

  const [giftAidConsent, setGiftAidConsent] = useState(false);
  const [ukTaxpayerConfirmation, setUkTaxpayerConfirmation] = useState(false);
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false);
  const [homeAddressConfirmed, setHomeAddressConfirmed] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
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
    giftAidConsent?: string;
    ukTaxpayerConfirmation?: string;
    dataProcessingConsent?: string;
    homeAddressConfirmed?: string;
  }>({});

  const giftAidAmount = amount * 0.25;
  const totalWithGiftAid = amount + giftAidAmount;
  const declarationText = getHmrcDeclarationText(campaignTitle);

  const loadReusableGiftAidProfile = useCallback(
    async (emailInput: string) => {
      const normalizedEmail = emailInput.trim().toLowerCase();
      if (!normalizedEmail || normalizedEmail === lastLookupEmail) {
        return;
      }

      try {
        setPrefillLoading(true);
        setLastLookupEmail(normalizedEmail);
        const profile = await giftAidApi.getReusableGiftAidProfileByEmail(normalizedEmail);
        if (!profile) {
          return;
        }

        setDonorTitle(profile.donorTitle || '');
        const mergedName = `${profile.firstName} ${profile.surname}`.trim();
        setFullName(mergedName || initialFullName);
        setHouseNumber(profile.houseNumber || '');
        setAddressLine1(profile.addressLine1 || '');
        setAddressLine2(profile.addressLine2 || '');
        setTown(profile.town || '');
        setPostcode(profile.postcode || '');
        setDonorEmail(profile.donorEmail || normalizedEmail);
        setGiftAidConsent(true);
        setUkTaxpayerConfirmation(true);
        setDataProcessingConsent(true);
        setHomeAddressConfirmed(true);
        setDeclarationAccepted(true);
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
    if (!enableAutoLookup) return;
    if (initialDonorEmail.trim()) {
      void loadReusableGiftAidProfile(initialDonorEmail);
    }
  }, [initialDonorEmail, enableAutoLookup, loadReusableGiftAidProfile]);

  const formatAmount = (amt: number) => formatCurrencyFromMajor(amt, currency);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters';
    } else {
      const nameParts = fullName
        .trim()
        .split(' ')
        .filter((part) => part.length > 0);
      if (nameParts.length < 2) {
        newErrors.fullName = 'Please enter both first name and surname';
      }
    }

    if (collectDonorEmail || donorEmail.trim()) {
      if (!donorEmail.trim()) {
        newErrors.donorEmail = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail.trim())) {
        newErrors.donorEmail = 'Please enter a valid email address';
      }
    }

    if (!addressLine1.trim()) {
      newErrors.addressLine1 = 'Address Line 1 is required';
    }

    if (!town.trim()) {
      newErrors.town = 'Town/City is required';
    }

    if (!postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    } else {
      const normalizedPostcode = postcode.trim().toUpperCase();
      if (!/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(normalizedPostcode)) {
        newErrors.postcode = 'Please enter a valid UK postcode';
      }
    }

    if (!declarationAccepted && !usingSavedConsent) {
      if (!giftAidConsent) {
        newErrors.giftAidConsent = 'Gift Aid consent is required';
      }
      if (!ukTaxpayerConfirmation) {
        newErrors.ukTaxpayerConfirmation = 'UK taxpayer confirmation is required';
      }
      if (!dataProcessingConsent) {
        newErrors.dataProcessingConsent = 'Data processing consent is required';
      }
      if (!homeAddressConfirmed) {
        newErrors.homeAddressConfirmed = 'Home address confirmation is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    const currentDate = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    const taxYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    const normalizedDonorTitle = donorTitle.trim().slice(0, 4);

    const nameParts = fullName
      .trim()
      .split(' ')
      .filter((part) => part.length > 0);
    const firstName = nameParts[0] || '';
    const surname = nameParts.slice(1).join(' ') || '';

    // Normalize postcode before storage
    const normalizedPostcode = postcode.trim().toUpperCase();

    const giftAidDetails: GiftAidDetails = {
      donorTitle: normalizedDonorTitle || undefined,
      firstName,
      surname,
      houseNumber: houseNumber.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      town: town.trim(),
      postcode: normalizedPostcode,
      donorEmail: donorEmail.trim() || undefined,
      giftAidConsent: usingSavedConsent ? true : giftAidConsent,
      ukTaxpayerConfirmation: usingSavedConsent ? true : ukTaxpayerConfirmation,
      dataProcessingConsent: usingSavedConsent ? true : dataProcessingConsent,
      homeAddressConfirmed: usingSavedConsent ? true : homeAddressConfirmed,
      declarationText,
      declarationTextVersion: HMRC_DECLARATION_TEXT_VERSION,
      declarationDate: currentDate,
      donationAmount: Math.round(amount * 100), // Convert GBP pounds to pence for HMRC compliance
      donationDate: currentDate,
      organizationId,
      donationId: '', // Intentionally empty: populated after donation creation to enforce 1:1 Gift Aid ↔ Donation mapping
      timestamp: currentDate,
      taxYear,
    };

    try {
      onSubmit(giftAidDetails);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FFFCF9] rounded-[22px] border border-[rgba(15,23,42,0.07)] shadow-[0_18px_42px_rgba(15,23,42,0.10)] overflow-hidden flex flex-col w-full max-w-xl md:max-w-[42rem] lg:max-w-[42rem] mx-auto font-lexend max-h-full">
      {/* Header */}
      <div className="bg-[#0E8F5A] text-white px-4 sm:px-6 py-3.5 sm:py-4 text-center relative sticky top-0 z-10">
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/90 mb-1">
          Your impact
        </p>
        <h2 className="text-[17px] sm:text-[20px] font-semibold tracking-[-0.01em] leading-[1.2]">
          Boosting {formatAmount(amount)} to {formatAmount(totalWithGiftAid)}
        </h2>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="px-4 sm:px-5 py-3 sm:py-3.5 grow flex flex-col min-h-0"
      >
        <div
          className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4 hide-scrollbar gift-aid-details-scroll"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style jsx>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {/* Campaign Info */}
          <div className="mb-3 p-3 bg-[#EEF7F2] border border-[#BFE2CF] rounded-[18px] text-center">
            <p className="text-[10px] text-[#0E8F5A] font-medium tracking-[0.16em] uppercase">
              Donating to
            </p>
            <p className="font-medium text-slate-900 mt-1 tracking-[-0.01em] text-[14px] sm:text-[15px] leading-[1.3]">
              {campaignTitle}
            </p>
          </div>

          {prefillLoading && (
            <div className="mb-3 p-3 bg-[#EEF7F2] border border-[#BFE2CF] rounded-[14px] text-[#0E8F5A] text-[12px] sm:text-[13px]">
              Checking for your saved Gift Aid details...
            </div>
          )}

          {usingSavedConsent && !prefillLoading && (
            <div className="mb-3 p-3 bg-[#EEF7F2] border border-[#BFE2CF] rounded-[14px] text-[#0E8F5A] text-[12px] sm:text-[13px]">
              Using your saved Gift Aid details and future-consent
              {savedConsentDate
                ? ` from ${new Date(savedConsentDate).toLocaleDateString('en-GB')}`
                : ''}
              .
            </div>
          )}

          <div className="space-y-5">
            {/* Section 1: Donor details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 pb-2">
                <User className="w-4 h-4 text-[#0E8F5A]" />
                <h3 className="text-[16px] sm:text-[17px] font-semibold text-slate-900 tracking-[-0.01em]">
                  Donor details
                </h3>
              </div>

              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Title
                  </label>
                  <select
                    value={donorTitle}
                    onChange={(e) => setDonorTitle(e.target.value)}
                    className={`w-full h-10 px-2 border-0 border-b-2 border-slate-200 focus:border-[#0E8F5A] focus:ring-0 text-[14px] sm:text-[15px] font-normal focus:outline-none transition-all bg-transparent appearance-none cursor-pointer ${!donorTitle ? 'text-slate-400' : 'text-slate-900'}`}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '12px',
                    }}
                  >
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="Mr">Mr</option>
                    <option value="Ms">Ms</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Dr">Dr</option>
                  </select>
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Full Name <span className="text-slate-900">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
                    }}
                    className={`w-full h-10 px-2 border-0 border-b-2 text-[14px] sm:text-[15px] font-normal focus:outline-none focus:ring-0 transition-all bg-transparent ${
                      errors.fullName
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0E8F5A]'
                    }`}
                    placeholder="e.g. John Smith"
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-[12px] sm:text-[14px] mt-0.5 font-normal">
                      {errors.fullName}
                    </p>
                  )}
                </div>
              </div>

              {collectDonorEmail && (
                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Email Address <span className="text-slate-900">*</span>
                  </label>
                  <input
                    type="email"
                    value={donorEmail}
                    onChange={(e) => {
                      setDonorEmail(e.target.value);
                      setLastLookupEmail('');
                      if (usingSavedConsent) {
                        setUsingSavedConsent(false);
                        setSavedConsentDate(null);
                        setDeclarationAccepted(false);
                      }
                      if (errors.donorEmail)
                        setErrors((prev) => ({ ...prev, donorEmail: undefined }));
                    }}
                    onBlur={() => {
                      void loadReusableGiftAidProfile(donorEmail);
                    }}
                    className={`w-full h-10 px-2 border-0 border-b-2 text-[14px] sm:text-[15px] font-normal focus:outline-none focus:ring-0 transition-all bg-transparent ${
                      errors.donorEmail
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0E8F5A]'
                    }`}
                    placeholder="e.g. your@email.com"
                  />
                  {errors.donorEmail && (
                    <p className="text-red-500 text-[12px] sm:text-[14px] mt-0.5 font-normal">
                      {errors.donorEmail}
                    </p>
                  )}
                </div>
              )}

              {/* House Number and Address Line 1 - side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    House Number
                  </label>
                  <input
                    type="text"
                    value={houseNumber}
                    onChange={(e) => {
                      setHouseNumber(e.target.value);
                      if (errors.houseNumber)
                        setErrors((prev) => ({ ...prev, houseNumber: undefined }));
                    }}
                    className={`w-full h-10 px-2 border-0 border-b-2 text-[14px] sm:text-[15px] font-normal focus:outline-none focus:ring-0 transition-all bg-transparent ${
                      errors.houseNumber
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0E8F5A]'
                    }`}
                    placeholder="e.g. 123"
                  />
                  {errors.houseNumber && (
                    <p className="text-red-500 text-[12px] sm:text-[14px] mt-0.5 font-normal">
                      {errors.houseNumber}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Street Address <span className="text-slate-900">*</span>
                  </label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => {
                      setAddressLine1(e.target.value);
                      if (errors.addressLine1)
                        setErrors((prev) => ({ ...prev, addressLine1: undefined }));
                    }}
                    className={`w-full h-10 px-2 border-0 border-b-2 text-[14px] sm:text-[15px] font-normal focus:outline-none focus:ring-0 transition-all bg-transparent ${
                      errors.addressLine1
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0E8F5A]'
                    }`}
                    placeholder="e.g. Main Street"
                  />
                  {errors.addressLine1 && (
                    <p className="text-red-500 text-[12px] sm:text-[14px] mt-0.5 font-normal">
                      {errors.addressLine1}
                    </p>
                  )}
                </div>
              </div>

              {/* Address Line 2 and Town - side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="w-full h-10 px-2 border-0 border-b-2 border-slate-200 focus:border-[#0E8F5A] focus:ring-0 text-[14px] sm:text-[15px] font-normal focus:outline-none transition-all bg-transparent"
                    placeholder="Apartment, suite, etc."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Town/City <span className="text-slate-900">*</span>
                  </label>
                  <input
                    type="text"
                    value={town}
                    onChange={(e) => {
                      setTown(e.target.value);
                      if (errors.town) setErrors((prev) => ({ ...prev, town: undefined }));
                    }}
                    className={`w-full h-10 px-2 border-0 border-b-2 text-[14px] sm:text-[15px] font-normal focus:outline-none focus:ring-0 transition-all bg-transparent ${
                      errors.town
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0E8F5A]'
                    }`}
                    placeholder="e.g. London"
                  />
                  {errors.town && (
                    <p className="text-red-500 text-[12px] sm:text-[14px] mt-0.5 font-normal">
                      {errors.town}
                    </p>
                  )}
                </div>
              </div>

              {/* UK Postcode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[12px] sm:text-[14px] font-medium text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      UK Postcode <span className="text-slate-900">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => {
                      const normalizedPostcode = e.target.value.trim().toUpperCase();
                      setPostcode(normalizedPostcode);
                      if (errors.postcode) setErrors((prev) => ({ ...prev, postcode: undefined }));
                    }}
                    className={`w-full h-10 px-2 border-0 border-b-2 text-[14px] sm:text-[15px] font-normal uppercase focus:outline-none focus:ring-0 transition-all bg-transparent ${
                      errors.postcode
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-slate-200 focus:border-[#0E8F5A]'
                    }`}
                    placeholder="E.G. SW1A 1AA"
                    maxLength={8}
                  />
                  {errors.postcode && (
                    <p className="text-red-500 text-[12px] sm:text-[14px] mt-0.5 font-normal">
                      {errors.postcode}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[12px] sm:text-[14px] font-medium text-slate-600">
                    Country
                  </label>
                  <input
                    type="text"
                    value="United Kingdom"
                    disabled
                    className="w-full h-10 px-2 border-0 border-b-2 border-slate-200 bg-transparent text-gray-500 cursor-not-allowed text-[14px] sm:text-[15px] font-normal"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Gift Aid declaration */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 pb-2">
                <CheckCircle className="w-4 h-4 text-[#0E8F5A]" />
                <h3 className="text-[16px] sm:text-[17px] font-semibold text-slate-900 tracking-[-0.01em]">
                  Gift Aid Declaration
                </h3>
              </div>

              {/* Gift Aid Consent */}
              <div
                className={`p-4 sm:p-5 rounded-xl transition-all cursor-pointer ${
                  errors.giftAidConsent
                    ? 'border-2 border-red-400 bg-red-50'
                    : 'bg-blue-50/50 border border-blue-200'
                }`}
                onClick={() => {
                  if (usingSavedConsent) return;
                  setGiftAidConsent(!giftAidConsent);
                  if (errors.giftAidConsent)
                    setErrors((prev) => ({ ...prev, giftAidConsent: undefined }));
                }}
              >
                <div className="flex items-start">
                  <div
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                      giftAidConsent || usingSavedConsent
                        ? 'bg-[#0E8F5A] border-[#0E8F5A]'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {(giftAidConsent || usingSavedConsent) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-[13px] sm:text-[14px] font-semibold text-slate-900 mb-1">
                      Gift Aid Declaration
                    </p>
                    <p className="text-[12px] sm:text-[13px] text-slate-700 leading-[1.55]">
                      I want to Gift Aid my donation and any donations I make in the future or have
                      made in the past 4 years to{' '}
                      <span className="font-semibold">{campaignTitle}</span>.
                    </p>
                  </div>
                </div>
                {errors.giftAidConsent && (
                  <p className="text-red-500 text-xs mt-2 ml-8">{errors.giftAidConsent}</p>
                )}
              </div>

              {/* UK Taxpayer Confirmation */}
              <div
                className={`p-4 sm:p-5 rounded-xl transition-all cursor-pointer ${
                  errors.ukTaxpayerConfirmation
                    ? 'border-2 border-red-400 bg-red-50'
                    : 'bg-yellow-50/50 border border-yellow-200'
                }`}
                onClick={() => {
                  if (usingSavedConsent) return;
                  setUkTaxpayerConfirmation(!ukTaxpayerConfirmation);
                  if (errors.ukTaxpayerConfirmation)
                    setErrors((prev) => ({ ...prev, ukTaxpayerConfirmation: undefined }));
                }}
              >
                <div className="flex items-start">
                  <div
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                      ukTaxpayerConfirmation || usingSavedConsent
                        ? 'bg-[#0E8F5A] border-[#0E8F5A]'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {(ukTaxpayerConfirmation || usingSavedConsent) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-[13px] sm:text-[14px] font-semibold text-slate-900 mb-1">
                      UK Taxpayer Confirmation
                    </p>
                    <p className="text-[12px] sm:text-[13px] text-slate-700 leading-[1.55]">
                      I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital
                      Gains Tax than the amount of Gift Aid claimed on all my donations in that tax
                      year it is my responsibility to pay any difference.
                    </p>
                  </div>
                </div>
                {errors.ukTaxpayerConfirmation && (
                  <p className="text-red-500 text-xs mt-2 ml-8">{errors.ukTaxpayerConfirmation}</p>
                )}
              </div>

              {/* Data Processing Consent */}
              <div
                className={`p-4 sm:p-5 rounded-xl transition-all cursor-pointer ${
                  errors.dataProcessingConsent
                    ? 'border-2 border-red-400 bg-red-50'
                    : 'bg-purple-50/50 border border-purple-200'
                }`}
                onClick={() => {
                  if (usingSavedConsent) return;
                  setDataProcessingConsent(!dataProcessingConsent);
                  if (errors.dataProcessingConsent)
                    setErrors((prev) => ({ ...prev, dataProcessingConsent: undefined }));
                }}
              >
                <div className="flex items-start">
                  <div
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                      dataProcessingConsent || usingSavedConsent
                        ? 'bg-[#0E8F5A] border-[#0E8F5A]'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {(dataProcessingConsent || usingSavedConsent) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-[13px] sm:text-[14px] font-semibold text-slate-900 mb-1">
                      Data Processing Consent
                    </p>
                    <p className="text-[12px] sm:text-[13px] text-slate-700 leading-[1.55]">
                      I agree to my data being used to process this Gift Aid claim.
                    </p>
                  </div>
                </div>
                {errors.dataProcessingConsent && (
                  <p className="text-red-500 text-xs mt-2 ml-8">{errors.dataProcessingConsent}</p>
                )}
              </div>

              {/* Home Address Confirmation */}
              <div
                className={`p-4 sm:p-5 rounded-xl transition-all cursor-pointer ${
                  errors.homeAddressConfirmed
                    ? 'border-2 border-red-400 bg-red-50'
                    : 'bg-gray-50 border border-gray-200'
                }`}
                onClick={() => {
                  if (usingSavedConsent) return;
                  setHomeAddressConfirmed(!homeAddressConfirmed);
                  if (errors.homeAddressConfirmed)
                    setErrors((prev) => ({ ...prev, homeAddressConfirmed: undefined }));
                }}
              >
                <div className="flex items-start">
                  <div
                    className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all mt-0.5 ${
                      homeAddressConfirmed || usingSavedConsent
                        ? 'bg-[#0E8F5A] border-[#0E8F5A]'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {(homeAddressConfirmed || usingSavedConsent) && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>
                  <div className="ml-3 sm:ml-4 flex-1">
                    <p className="text-[13px] sm:text-[14px] font-semibold text-slate-900 mb-1">
                      Home Address Confirmation
                    </p>
                    <p className="text-[12px] sm:text-[13px] text-slate-700 leading-[1.55]">
                      I confirm this is my home address (not work or delivery address).
                    </p>
                  </div>
                </div>
                {errors.homeAddressConfirmed && (
                  <p className="text-red-500 text-xs mt-2 ml-8">{errors.homeAddressConfirmed}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Button */}
        <div className="mt-4 sm:mt-5 space-y-2 sticky bottom-0 z-10 bg-[#FFFCF9] pt-3">
          <button
            type="submit"
            disabled={
              submitting ||
              ((!giftAidConsent ||
                !ukTaxpayerConfirmation ||
                !dataProcessingConsent ||
                !homeAddressConfirmed) &&
                !usingSavedConsent)
            }
            className="w-full h-12 sm:h-13 rounded-[16px] font-semibold text-[15px] sm:text-[16px] text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center bg-[#0E8F5A] hover:brightness-[1.02] active:brightness-[0.98] shadow-[0_10px_24px_rgba(14,143,90,0.28)] tracking-[0.005em]"
          >
            {submitting ? 'Sending...' : 'Send Declaration'}
            {!submitting && <ArrowRight className="w-4 h-4 ml-2" />}
          </button>
        </div>
      </form>
    </div>
  );
};
