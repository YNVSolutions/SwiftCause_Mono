import React from 'react';
import { formatCurrency, formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';
import { CampaignCardProps } from '../types';
import { getProgressPercentage, getTop3Amounts } from '../lib/campaignUtils';

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  currency,
  onSelectAmount,
  onDonate,
  onCardClick,
}) => {
  const progress = getProgressPercentage(campaign.raised || 0, campaign.goal);
  const top3Amounts = getTop3Amounts(campaign);

  const handleDonateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Go to details page
    onDonate();
  };

  const handleAmountClick = (e: React.MouseEvent, amount: number) => {
    e.stopPropagation();
    onSelectAmount(amount);
  };

  // Format amount without decimals
  const formatRaised = (amount: number) => formatCurrency(amount, currency);
  const formatGoal = (amount: number) => formatCurrencyFromMajor(amount, currency);

  return (
    <div
      onClick={onCardClick}
      className="group bg-white rounded-[28px] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer h-[470px] w-full max-w-[380px] mx-auto"
    >
      {/* Hero Cover Image */}
      <div className="relative h-[245px] overflow-hidden flex-shrink-0">
        <img
          src={campaign.coverImageUrl || '/campaign-fallback.svg'}
          alt={campaign.title}
          className="w-full h-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
      </div>

      {/* Campaign Info */}
      <div className="px-4 pt-4 pb-4 flex flex-col h-[225px]">
        {/* Campaign Title - Dominant */}
        <h2 className="text-lg font-bold text-slate-900 mb-3 leading-tight line-clamp-2 min-h-[2.75rem]">
          {campaign.title}
        </h2>

        <div className="flex flex-col gap-2 md:gap-3 lg:gap-3">
          {/* Progress Info */}
          <div className="flex items-center justify-between text-[13px] text-gray-600">
            <span className="font-medium text-gray-900 text-[13px]">
              {formatRaised(campaign.raised || 0)}
            </span>
            <span className="text-[12px] text-gray-500">
              Goal {formatGoal(campaign.goal)}
            </span>
            <span className="text-green-700 font-medium text-[13px]">{Math.round(progress)}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-[5px]">
            <div
              className="bg-[#0E8F5A] h-[5px] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>

          {/* Top 3 Amount Buttons */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 lg:gap-3">
            {top3Amounts.map((amount, index) => (
              <button
                key={index}
                onClick={(e) => handleAmountClick(e, amount)}
                className="h-10 rounded-xl bg-gray-100/50 text-[#0E8F5A] border border-[rgba(15,23,42,0.08)] font-semibold text-sm hover:bg-gray-100/70 hover:border-[rgba(15,23,42,0.12)] transition-colors duration-200"
              >
                {formatCurrencyFromMajor(amount, currency)}
              </button>
            ))}
          </div>

          {/* Donate Button - Dominant CTA */}
          <button
            onClick={handleDonateClick}
            className="w-full h-12 rounded-full font-bold text-base text-white bg-[#0E8F5A] hover:bg-[#0C8050] transition-colors duration-200 flex items-center justify-center shadow-sm md:mt-1 lg:mt-1"
          >
            Donate
          </button>
        </div>
      </div>
    </div>
  );
};
