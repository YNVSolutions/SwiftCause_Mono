import React from 'react';
import { formatCurrency, formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';
import { CampaignCarouselProps } from '../types';
import { getTop3Amounts, getProgressPercentage } from '../lib/campaignUtils';

export const CampaignCarousel: React.FC<CampaignCarouselProps> = ({
  campaigns,
  currency,
  onSelectCampaign,
  onViewDetails,
}) => {
  if (campaigns.length === 0) return null;

  const getFloatStyle = (seedValue: string) => {
    let hash = 0;
    for (let i = 0; i < seedValue.length; i += 1) {
      hash = (hash * 31 + seedValue.charCodeAt(i)) % 100000;
    }
    const x = (hash % 7) - 3;
    const y = (Math.floor(hash / 7) % 7) - 3;
    const duration = 6 + (hash % 5);
    const delay = (hash % 30) / 10;
    return {
      '--float-x': `${x}px`,
      '--float-y': `${y}px`,
      '--float-duration': `${duration}s`,
      '--float-delay': `${delay}s`,
    } as React.CSSProperties;
  };

  // Format amount without decimals
  const formatRaised = (amount: number) => formatCurrency(amount, currency);
  const formatPredefined = (amount: number) => formatCurrencyFromMajor(amount, currency);
  const formatGoal = (amount: number) => formatCurrencyFromMajor(amount, currency);

  return (
    <>
      <style>{`
        .campaign-float {
          animation-name: campaignFloat;
          animation-duration: var(--float-duration, 7s);
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-delay: var(--float-delay, 0s);
          will-change: transform;
        }
        @keyframes campaignFloat {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(var(--float-x, 0px), var(--float-y, 0px)); }
        }
      `}</style>
      <div className="w-full max-w-lg mx-auto">
        <div className="space-y-6">
          {campaigns.map((campaign) => {
            const top3Amounts = getTop3Amounts(campaign);
            const progress = getProgressPercentage(campaign.raised || 0, campaign.goal);

            const handleAmountClick = (e: React.MouseEvent, amount: number) => {
              e.stopPropagation();
              onSelectCampaign(campaign, amount);
            };

            const handleDonateClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              // Go to details page
              onViewDetails(campaign);
            };

            return (
              <div key={campaign.id} className="campaign-float" style={getFloatStyle(campaign.id)}>
                <div
                  onClick={() => onViewDetails(campaign)}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-[rgba(15,23,42,0.08)] cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {/* Campaign Image */}
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={campaign.coverImageUrl || '/campaign-fallback.svg'}
                      alt={campaign.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Campaign Info */}
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-[#0A0A0A] mb-2">
                      {campaign.title}
                    </h2>

                    {/* Progress Info */}
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span className="font-medium text-gray-900">
                        {formatRaised(campaign.raised || 0)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Goal {formatGoal(campaign.goal)}
                      </span>
                      <span className="text-[#0E8F5A] font-medium">{Math.round(progress)}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-5">
                      <div
                        className="bg-[#0E8F5A] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>

                    {/* Amount Buttons */}
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {top3Amounts.map((amount, index) => (
                        <button
                          key={index}
                          onClick={(e) => handleAmountClick(e, amount)}
                          className="h-10 rounded-lg bg-gray-100/50 text-[#0E8F5A] border border-[rgba(15,23,42,0.08)] font-medium text-sm hover:bg-gray-100/70 hover:border-[rgba(15,23,42,0.12)] transition-colors duration-200"
                        >
                          {formatPredefined(amount)}
                        </button>
                      ))}
                    </div>

                    {/* Donate Button */}
                    <button
                      onClick={handleDonateClick}
                      className="w-full h-11 rounded-lg font-medium text-white bg-[#0E8F5A] hover:bg-[#0C8050] shadow-lg shadow-green-200/60 transition-all duration-200"
                    >
                      Donate
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
