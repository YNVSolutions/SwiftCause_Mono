import { CheckCircle, Lock, Heart, ArrowLeft, RefreshCw, Calendar } from 'lucide-react';
import { Campaign, Donation } from '../../shared/types';
import PaymentForm from '../../widgets/payment-flow/PaymentForm';
import { formatCurrency } from '../../shared/lib/currencyFormatter';
import { Badge } from '../../shared/ui/badge';

interface PaymentScreenProps {
  campaign: Campaign;
  donation: Donation;
  isProcessing: boolean;
  error: string | null;
  handlePaymentSubmit: (
    amount: number,
    metadata: Record<string, unknown>,
    currency: string,
  ) => Promise<void>;
  onBack: () => void;
  organizationCurrency?: string;
}

export function PaymentScreen({
  campaign,
  donation,
  isProcessing,
  error,
  handlePaymentSubmit,
  onBack,
  organizationCurrency,
}: PaymentScreenProps) {
  // Get Gift Aid details from donation or sessionStorage as fallback
  const giftAidDetails =
    donation.giftAidDetails ||
    (() => {
      try {
        const storedGiftAidData = sessionStorage.getItem('giftAidData');
        return storedGiftAidData ? JSON.parse(storedGiftAidData) : null;
      } catch {
        return null;
      }
    })();

  const isGiftAid = donation.isGiftAid || false;
  const giftAidAmount = isGiftAid ? donation.amount * 0.25 : 0;
  const totalImpact = donation.amount + giftAidAmount;

  // Recurring payment details
  const isRecurring = donation.isRecurring || false;
  const recurringInterval = donation.recurringInterval || 'monthly';

  // Format recurring interval for display
  const intervalDisplayMap: Record<string, string> = {
    monthly: 'month',
    quarterly: 'quarter',
    yearly: 'year',
  };
  const intervalDisplay = intervalDisplayMap[recurringInterval] || 'month';

  // Calculate next charge date for recurring
  const getNextChargeDate = () => {
    const nextDate = new Date();
    if (recurringInterval === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (recurringInterval === 'quarterly') {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    return nextDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Calculate annual impact for recurring
  const getAnnualImpact = () => {
    if (!isRecurring) return donation.amount;
    const multiplier =
      recurringInterval === 'monthly' ? 12 : recurringInterval === 'quarterly' ? 4 : 1;
    return donation.amount * multiplier;
  };

  // Format amount without decimals
  const formatAmount = (amount: number) => formatCurrency(amount || 0);

  const handleSubmit = async () => {
    // Store complete Gift Aid data in sessionStorage for backup
    if (isGiftAid && giftAidDetails) {
      sessionStorage.setItem('completeGiftAidData', JSON.stringify(giftAidDetails));
    }

    const metadata = {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      donationAmount: donation.amount,
      organizationId: campaign.organizationId,
      isRecurring: donation.isRecurring,
      recurringInterval: donation.recurringInterval,
      isGiftAid: isGiftAid,
      giftAidAccepted: donation.giftAidAccepted || false, // Include explicit Gift Aid acceptance status
      giftAidDeclarationId: donation.giftAidDeclarationId || giftAidDetails?.declarationId || null,
      kioskId: donation.kioskId || null,
      // Add donor information
      donorEmail: donation.donorEmail || '',
      donorName:
        isGiftAid && giftAidDetails
          ? `${giftAidDetails.firstName} ${giftAidDetails.surname}`
          : donation.donorName || '',
      donorPhone: donation.donorPhone || null,
      ...(isGiftAid && giftAidDetails
        ? {
            // Gift Aid linkage metadata for declaration-first and fallback declaration creation paths.
            giftAidTitle: giftAidDetails.donorTitle || '',
            giftAidFirstName: giftAidDetails.firstName,
            giftAidSurname: giftAidDetails.surname,
            giftAidHouseNumber: giftAidDetails.houseNumber || '',
            giftAidAddressLine1: giftAidDetails.addressLine1,
            giftAidAddressLine2: giftAidDetails.addressLine2 || '',
            giftAidTown: giftAidDetails.town,
            giftAidPostcode: giftAidDetails.postcode,
            giftAidAmount: giftAidAmount.toString(),
            totalImpact: totalImpact.toString(),
            giftAidConsent: giftAidDetails.giftAidConsent.toString(),
            giftAidTaxpayer: giftAidDetails.ukTaxpayerConfirmation.toString(),
            giftAidDataProcessingConsent: String(giftAidDetails.dataProcessingConsent ?? false),
            giftAidHomeAddressConfirmed: String(giftAidDetails.homeAddressConfirmed ?? false),
            giftAidDeclarationText: giftAidDetails.declarationText,
            giftAidDeclarationTextVersion: giftAidDetails.declarationTextVersion || 'unknown',
            giftAidDeclarationDate: giftAidDetails.declarationDate,
            giftAidDonationDate: giftAidDetails.donationDate,
            giftAidTaxYear: giftAidDetails.taxYear,
            giftAidOrganizationId: giftAidDetails.organizationId,
          }
        : {}),
    };
    await handlePaymentSubmit(donation.amount, metadata, organizationCurrency || 'GBP');
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-white relative overflow-hidden font-lexend"
      aria-busy={isProcessing}
    >
      <button
        onClick={isProcessing ? undefined : onBack}
        disabled={isProcessing}
        className="absolute left-6 top-5 z-20 inline-flex items-center gap-2 text-[#0E8F5A] hover:text-[#0C8050] text-sm font-medium hover:underline underline-offset-4 disabled:opacity-60"
        title="Back"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
        Back
      </button>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pt-0 pb-6">
        <div className="w-full max-w-2xl md:max-w-3xl">
          <div className="bg-[#FFFBF7] rounded-[18px] border border-gray-200/50 shadow-[0_10px_28px_rgba(15,23,42,0.08)] overflow-hidden">
            {/* Campaign Header */}
            <div className="bg-[#0E8F5A] text-white px-5 py-3 text-center">
              <div className="text-center">
                <p className="text-white/85 text-[12px] uppercase tracking-wide mb-0.5 font-medium">
                  Donating to
                </p>
                <h2 className="text-[18px] sm:text-[20px] lg:text-[22px] font-semibold tracking-[-0.01em] leading-tight">
                  {campaign.title}
                </h2>
              </div>
              <div className="flex justify-center mt-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
                  <Heart className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 lg:p-7 bg-[#FFFBF7]">
              {/* Donation Summary Section */}
              <div className="mb-5">
                {/* Recurring Badge */}
                {isRecurring && (
                  <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-[#0E8F5A]/10 to-emerald-50 border border-[#0E8F5A]/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-[#0E8F5A] rounded-full flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[14px] sm:text-[15px] font-semibold text-slate-900">
                            Recurring Donation
                          </h3>
                          <Badge className="bg-[#0E8F5A] text-white text-[10px] px-2 py-0.5">
                            {recurringInterval === 'monthly'
                              ? 'Monthly'
                              : recurringInterval === 'quarterly'
                                ? 'Quarterly'
                                : 'Yearly'}
                          </Badge>
                        </div>
                        <p className="text-[12px] sm:text-[13px] text-slate-600 leading-relaxed">
                          Your card will be charged {formatAmount(donation.amount)} every{' '}
                          {intervalDisplay}.
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 text-[11px] sm:text-[12px] text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Next charge: {getNextChargeDate()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3.5">
                  {/* Donation Amount */}
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[14px] sm:text-[16px] text-slate-700 font-normal">
                        {isRecurring
                          ? `${recurringInterval === 'monthly' ? 'Monthly' : recurringInterval === 'quarterly' ? 'Quarterly' : 'Annual'} Amount`
                          : 'Donation Amount'}
                      </span>
                    </div>
                    <span className="text-[18px] sm:text-[20px] font-semibold text-slate-900">
                      {formatAmount(donation.amount)}
                      {isRecurring && (
                        <span className="text-[14px] text-slate-600">/{intervalDisplay}</span>
                      )}
                    </span>
                  </div>

                  {/* Gift Aid Section */}
                  {isGiftAid && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-[#0E8F5A]" />
                        <span className="text-[14px] sm:text-[16px] text-[#0E8F5A] font-semibold">
                          Gift Aid (25%)
                        </span>
                      </div>
                      <span className="text-[16px] sm:text-[18px] font-semibold text-[#0E8F5A]">
                        +{formatAmount(giftAidAmount)}
                      </span>
                    </div>
                  )}

                  {/* Total Impact */}
                  <div className="pt-3.5 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[16px] sm:text-[18px] font-semibold text-slate-900">
                          {isRecurring ? 'Total Impact Today' : 'Total Impact'}
                        </span>
                        {isRecurring && (
                          <span className="text-[11px] sm:text-[12px] text-slate-500 mt-0.5">
                            Annual impact:{' '}
                            {formatAmount(
                              getAnnualImpact() + (isGiftAid ? getAnnualImpact() * 0.25 : 0),
                            )}
                          </span>
                        )}
                      </div>
                      <span className="text-[20px] sm:text-[22px] font-semibold text-[#0E8F5A]">
                        {formatAmount(totalImpact)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gift Aid Declaration Details */}
                {isGiftAid && giftAidDetails && (
                  <div className="mt-3.5 p-3 sm:p-4 bg-gray-100/50 border border-gray-200/30 rounded-xl">
                    <div className="space-y-1.5">
                      <p className="text-[12px] sm:text-[14px] text-slate-700 font-normal leading-[1.55]">
                        <span className="font-semibold text-slate-900">Declaration:</span> I confirm
                        I have paid enough UK Income/Capital Gains Tax to cover all my Gift Aid
                        donations.
                      </p>
                      <p className="text-[12px] sm:text-[14px] text-slate-700 font-normal leading-[1.55]">
                        <span className="font-semibold text-slate-900">Details:</span>{' '}
                        {giftAidDetails.donorTitle ? `${giftAidDetails.donorTitle} ` : ''}
                        {giftAidDetails.firstName} {giftAidDetails.surname},{' '}
                        {giftAidDetails.postcode}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method Section */}
              <div className="mb-4">
                <div className="flex items-center mb-3">
                  <Lock className="h-4 w-4 text-[#0E8F5A] mr-2" />
                  <h2 className="text-[14px] sm:text-[16px] font-semibold text-slate-900">
                    Payment Method
                  </h2>
                </div>

                {/* Payment Form - Always mounted to keep Stripe Elements alive */}
                <div className="bg-gray-100/50 border border-gray-200/30 rounded-xl p-4 sm:p-5">
                  <PaymentForm loading={isProcessing} error={error} onSubmit={handleSubmit} />
                </div>
              </div>

              {/* Security Notice */}
              <div className="text-center text-slate-500 text-[12px] sm:text-[13px] font-normal">
                <p>Your payment information is encrypted and secure.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
