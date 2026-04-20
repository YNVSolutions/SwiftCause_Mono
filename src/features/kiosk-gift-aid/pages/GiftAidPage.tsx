import React, { useState } from 'react';
import { Campaign } from '@/shared/types';
import { GiftAidDetails } from '@/entities/giftAid/model/types';
import { giftAidApi } from '@/entities/giftAid/api';
import { HMRC_DECLARATION_TEXT_VERSION, getHmrcDeclarationText } from '@/shared/config/constants';
import { ArrowLeft } from 'lucide-react';
import { GiftAidBoostPanel, GiftAidDetailsPanel } from '../components';

interface GiftAidPageProps {
  campaign: Campaign;
  amount: number;
  isCustomAmount: boolean;
  currency: string;
  initialDonorName?: string;
  initialDonorEmail?: string;
  accentColorHex?: string;
  onAcceptGiftAid: (details: GiftAidDetails) => void;
  onBack: () => void;
}

export const GiftAidPage: React.FC<GiftAidPageProps> = ({
  campaign,
  amount,
  isCustomAmount,
  currency,
  initialDonorName = '',
  initialDonorEmail = '',
  accentColorHex,
  onAcceptGiftAid,
  onBack,
}) => {
  const accentColor =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
      ? accentColorHex.trim().toUpperCase()
      : '#0E8F5A';
  const [showDetails, setShowDetails] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [checkingSavedProfile, setCheckingSavedProfile] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [donorEmail, setDonorEmail] = useState(initialDonorEmail);
  const [customAmountValue, setCustomAmountValue] = useState(amount.toString());
  const [finalAmount, setFinalAmount] = useState(amount);

  const currentAmount = isCustomAmount ? parseFloat(customAmountValue) || 0 : amount;

  const handleAcceptBoost = () => {
    setFinalAmount(currentAmount);
    setEmailError(null);
    setShowEmailGate(true);
  };

  const handleDetailsSubmit = (details: GiftAidDetails) => {
    onAcceptGiftAid(details);
  };

  const handleBackFromDetails = () => {
    setShowDetails(false);
    setShowEmailGate(true);
  };
  const handleEmailContinue = async () => {
    const normalizedEmail = donorEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setCheckingSavedProfile(true);
    setEmailError(null);
    try {
      const existingProfile = await giftAidApi.getReusableGiftAidProfileByEmail(normalizedEmail);

      if (existingProfile) {
        const nowIso = new Date().toISOString();
        const year = new Date().getFullYear();
        const taxYear = `${year}-${(year + 1).toString().slice(-2)}`;
        const autoDetails: GiftAidDetails = {
          donorTitle: existingProfile.donorTitle?.trim() || undefined,
          firstName: existingProfile.firstName,
          surname: existingProfile.surname,
          houseNumber: existingProfile.houseNumber || '',
          addressLine1: existingProfile.addressLine1,
          addressLine2: existingProfile.addressLine2 || undefined,
          town: existingProfile.town,
          postcode: existingProfile.postcode,
          donorEmail: normalizedEmail,
          giftAidConsent: true,
          ukTaxpayerConfirmation: true,
          dataProcessingConsent: true,
          homeAddressConfirmed: true,
          declarationText: getHmrcDeclarationText(campaign.title),
          declarationTextVersion: HMRC_DECLARATION_TEXT_VERSION,
          declarationDate: nowIso,
          donationAmount: Math.round(currentAmount * 100),
          donationDate: nowIso,
          organizationId: campaign.organizationId || '',
          donationId: '',
          timestamp: nowIso,
          taxYear,
        };
        onAcceptGiftAid(autoDetails);
        return;
      }

      setShowEmailGate(false);
      setShowDetails(true);
    } catch (error) {
      console.error('Error checking existing Gift Aid profile:', error);
      setEmailError('Could not check existing Gift Aid profile. Please try again.');
    } finally {
      setCheckingSavedProfile(false);
    }
  };

  return (
    <div className="fixed inset-0 h-[100dvh] bg-gradient-to-b from-[#F1FAF6] via-white to-[#F1FAF6] overflow-hidden">
      <button
        type="button"
        onClick={
          showDetails
            ? handleBackFromDetails
            : showEmailGate
              ? () => setShowEmailGate(false)
              : onBack
        }
        className="absolute left-4 sm:left-6 top-4 sm:top-5 z-20 inline-flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4"
        style={{ color: accentColor }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-white/40 blur-3xl opacity-70" />
      <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-white/40 blur-3xl opacity-60" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-white/40 blur-3xl opacity-90" />

      {/* Main Content */}
      <main className="relative z-10 h-full w-full flex items-center justify-center px-3 sm:px-4 py-8 sm:py-10 md:py-10">
        {!showEmailGate && !showDetails && (
          <div
            className="h-full w-full max-h-[calc(100vh-96px)] overflow-hidden"
            style={{ maxHeight: 'calc(100dvh - 96px)' }}
          >
            <div className="px-3 sm:px-4 h-full flex items-center justify-center">
              <div className="max-w-lg sm:max-w-xl md:max-w-[46rem] mx-auto w-full h-full">
                <GiftAidBoostPanel
                  amount={amount}
                  isCustomAmount={isCustomAmount}
                  customAmountValue={customAmountValue}
                  onCustomAmountChange={setCustomAmountValue}
                  currency={currency}
                  campaignTitle={campaign.title}
                  accentColorHex={accentColor}
                  onAccept={handleAcceptBoost}
                />
              </div>
            </div>
          </div>
        )}

        {showEmailGate && !showDetails && (
          <div className="w-full max-w-xl bg-[#FFFCF9] rounded-[22px] border border-[rgba(15,23,42,0.07)] shadow-[0_18px_42px_rgba(15,23,42,0.10)] p-5 sm:p-6">
            <h2 className="text-[20px] sm:text-[24px] font-semibold text-slate-900 mb-2">
              Gift Aid email check
            </h2>
            <p className="text-slate-600 text-[14px] sm:text-[15px] mb-4">
              Enter your email so we can check if we already have your Gift Aid details and
              future-consent.
            </p>
            <label className="block text-[12px] sm:text-[14px] font-medium text-slate-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={donorEmail}
              onChange={(e) => {
                setDonorEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className="w-full h-11 px-4 rounded-[14px] border border-slate-200 focus:border-[#0E8F5A] focus:ring-2 focus:ring-[#0E8F5A]/10 text-[14px] sm:text-[15px] bg-white outline-none"
              placeholder="e.g. your@email.com"
              style={{
                borderColor: donorEmail ? `${accentColor}66` : undefined,
                boxShadow: donorEmail ? `0 0 0 1px ${accentColor}22` : undefined,
              }}
            />
            {emailError && (
              <p className="text-red-500 text-[12px] sm:text-[13px] mt-2">{emailError}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEmailGate(false);
                  setEmailError(null);
                }}
                className="flex-1 h-11 rounded-[14px] border border-slate-200 text-slate-700 font-medium"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleEmailContinue}
                disabled={checkingSavedProfile}
                className="flex-1 h-11 rounded-[14px] bg-[#0E8F5A] text-white font-semibold disabled:opacity-60"
                style={{ backgroundColor: accentColor }}
              >
                {checkingSavedProfile ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {showDetails && (
          <div
            className="h-full w-full max-h-[calc(100vh-96px)] overflow-hidden"
            style={{ maxHeight: 'calc(100dvh - 96px)' }}
          >
            <div className="px-3 sm:px-4 h-full flex items-center justify-center">
              <div className="max-w-lg sm:max-w-xl md:max-w-[46rem] mx-auto w-full h-full">
                <GiftAidDetailsPanel
                  amount={finalAmount}
                  currency={currency}
                  campaignTitle={campaign.title}
                  organizationId={campaign.organizationId || ''}
                  accentColorHex={accentColor}
                  initialFullName={initialDonorName}
                  initialDonorEmail={donorEmail}
                  collectDonorEmail={false}
                  enableAutoLookup={false}
                  onSubmit={handleDetailsSubmit}
                  onBack={handleBackFromDetails}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
