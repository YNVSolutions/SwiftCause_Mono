import React from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';

interface GiftAidBoostPanelProps {
  amount: number;
  isCustomAmount: boolean;
  customAmountValue: string;
  onCustomAmountChange: (value: string) => void;
  currency: string;
  campaignTitle: string;
  onAccept: () => void;
  accentColorHex?: string;
}

export const GiftAidBoostPanel: React.FC<GiftAidBoostPanelProps> = ({
  amount,
  isCustomAmount,
  customAmountValue,
  onCustomAmountChange,
  currency,
  campaignTitle,
  onAccept,
  accentColorHex,
}) => {
  const accentColor =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
      ? accentColorHex.trim().toUpperCase()
      : '#0E8F5A';
  const currentAmount = isCustomAmount ? parseFloat(customAmountValue) || 0 : amount;
  const giftAidAmount = currentAmount * 0.25;
  const totalWithGiftAid = currentAmount + giftAidAmount;
  const isValidAmount = currentAmount > 0 && currentAmount <= 10000;

  const formatAmount = (amt: number) => formatCurrencyFromMajor(amt, currency);

  const getCurrencySymbol = () => '£';

  return (
    <div
      className="gift-aid-scroll bg-[#FFFBF7] rounded-[20px] border border-[rgba(15,23,42,0.08)] shadow-[0_12px_32px_rgba(15,23,42,0.08)] p-5 sm:p-6 md:p-6 lg:p-6 flex flex-col w-full max-w-2xl md:max-w-[40rem] mx-auto relative font-lexend max-h-[calc(100vh-64px)] sm:max-h-[calc(100vh-96px)] md:max-h-[calc(100vh-100px)] overflow-y-auto md:overflow-hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style jsx>{`
        .gift-aid-scroll::-webkit-scrollbar {
          display: none;
        }
        @media (min-height: 700px) {
          .gift-aid-scroll {
            overflow-y: hidden;
            max-height: none;
          }
        }
      `}</style>
      <div className="absolute -top-20 -right-16 h-40 w-40 rounded-full bg-white/40 blur-3xl opacity-60" />
      <div className="absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-white/40 blur-3xl opacity-70" />
      <div className="relative z-10">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 sm:gap-4">
          <div className="text-center">
            <h1 className="text-[18px] sm:text-[22px] font-semibold text-slate-900 tracking-[-0.01em]">
              Boost your donation
            </h1>
            <p className="text-[14px] sm:text-[16px] text-slate-700 font-normal leading-[1.5]">
              Turn your gift into even more impact in seconds.
            </p>
          </div>
          <div className="h-9 w-9" aria-hidden="true" />
        </div>
        <div className="h-px bg-gray-200 my-2.5 sm:my-3" />
      </div>

      {/* Icon */}
      <div className="flex justify-center mb-3 sm:mb-4 relative z-10">
        <div className="w-11 h-11 sm:w-14 sm:h-14 bg-gray-100/50 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100">
          <ArrowUp className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: accentColor }} />
        </div>
      </div>

      {/* Main Message */}
      <div className="text-center mb-3 sm:mb-4 relative z-10">
        {isCustomAmount ? (
          <div className="space-y-6">
            <h1 className="text-[20px] sm:text-[24px] lg:text-[30px] font-semibold text-slate-900 mb-2 sm:mb-3 tracking-[-0.01em] leading-[1.3]">
              Turn your donation into{' '}
              <span style={{ color: accentColor }}>
                {isValidAmount ? formatAmount(totalWithGiftAid) : formatAmount(0)}
              </span>{' '}
              for free
              <span style={{ color: accentColor }}>.</span>
            </h1>

            {/* Custom Amount Input */}
            <div className="max-w-sm mx-auto">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl sm:text-2xl font-medium">
                  {getCurrencySymbol()}
                </span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={customAmountValue}
                  onChange={(e) => onCustomAmountChange(e.target.value)}
                  className="w-full h-14 sm:h-16 pl-12 pr-4 text-center text-[26px] sm:text-[32px] font-semibold border-2 border-gray-200 rounded-lg focus:outline-none bg-white/90"
                  style={{
                    borderColor: customAmountValue ? `${accentColor}55` : undefined,
                    boxShadow: customAmountValue ? `0 0 0 1px ${accentColor}22` : undefined,
                  }}
                  placeholder="0"
                />
              </div>
              <p className="text-[14px] sm:text-[17px] text-slate-500 mt-2 sm:mt-3 font-normal">
                Enter amount between {getCurrencySymbol()}1 - {getCurrencySymbol()}10,000
              </p>
            </div>
          </div>
        ) : (
          <h1 className="text-[20px] sm:text-[24px] lg:text-[30px] font-semibold text-slate-900 mb-3 sm:mb-4 tracking-[-0.01em] leading-[1.3]">
            Turn your {formatAmount(currentAmount)} into{' '}
            <span style={{ color: accentColor }}>{formatAmount(totalWithGiftAid)}</span> for free
            <span style={{ color: accentColor }}>.</span>
          </h1>
        )}
      </div>

      {/* Campaign Info */}
      <div className="mb-3 sm:mb-4 p-2.5 sm:p-3.5 bg-gray-100/50 border border-[rgba(15,23,42,0.08)] rounded-xl text-center relative z-10">
        <div
          className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] mb-2 font-medium"
          style={{ color: accentColor }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Donating to
        </div>
        <p className="font-medium text-slate-900 text-[16px] sm:text-[18px] tracking-[-0.01em]">
          {campaignTitle}
        </p>
      </div>

      {/* UK Taxpayer Info - moved below donating to box */}
      <p className="text-slate-700 text-[14px] sm:text-[16px] leading-[1.6] text-center mb-4 sm:mb-5 relative z-10 font-normal">
        Are you a UK Taxpayer? We can reclaim{' '}
        <span className="font-semibold text-slate-900">25%</span>{' '}
        <span className="font-semibold text-slate-900">
          ({isValidAmount ? formatAmount(giftAidAmount) : formatAmount(0)})
        </span>{' '}
        from the government at no cost to you.
      </p>

      {/* Action Buttons */}
      <div className="space-y-2 sm:space-y-3 relative z-10">
        <button
          onClick={onAccept}
          disabled={!isValidAmount}
          className="w-full h-12 sm:h-14 rounded-full font-semibold text-[15px] sm:text-[17px] text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-[#0E8F5A] hover:brightness-[1.02] active:brightness-[0.98] shadow-[0_12px_32px_rgba(15,23,42,0.08)] tracking-[0.01em]"
          style={{ backgroundColor: accentColor }}
        >
          Yes, Boost My Donation
        </button>
      </div>

      {/* Additional Info */}
      <div className="mt-3 sm:mt-4 text-center relative z-10">
        <p className="text-[13px] sm:text-[14px] text-slate-500 leading-[1.6] font-normal">
          Gift Aid allows UK charities to reclaim tax on donations made by UK taxpayers, increasing
          the value of donations at no extra cost to the donor.
        </p>
      </div>
    </div>
  );
};
