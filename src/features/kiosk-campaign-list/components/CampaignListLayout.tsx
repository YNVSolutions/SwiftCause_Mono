import React from 'react';
import { formatCurrency, formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';
import { CampaignListLayoutProps } from '../types';
import { getTop3Amounts, getProgressPercentage } from '../lib/campaignUtils';
import { darkenHexColor, resolveAccentColor } from '../lib/brandUtils';

export const CampaignListLayout: React.FC<CampaignListLayoutProps> = ({
  campaigns,
  currency,
  accentColorHex,
  onSelectCampaign,
  onViewDetails,
}) => {
  const accentColor = resolveAccentColor(accentColorHex);
  const accentColorDark = darkenHexColor(accentColor, 0.12);

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
            onViewDetails(campaign);
          };

          return (
            <div key={campaign.id} className="campaign-float" style={getFloatStyle(campaign.id)}>
              <div
                onClick={() => onViewDetails(campaign)}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-[rgba(15,23,42,0.08)] cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={campaign.coverImageUrl || '/campaign-fallback.svg'}
                    alt={campaign.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <div className="p-6">
                  <h2 className="text-lg font-semibold text-[#0A0A0A] mb-2 line-clamp-1">
                    {campaign.title}
                  </h2>

                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span className="font-medium text-gray-900">
                      {formatRaised(campaign.raised || 0)}
                    </span>
                    <span className="text-xs text-gray-500">Goal {formatGoal(campaign.goal)}</span>
                    <span className="font-medium" style={{ color: accentColor }}>
                      {Math.round(progress)}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 mb-5">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ backgroundColor: accentColor, width: `${Math.min(100, progress)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {top3Amounts.map((amount, index) => (
                      <button
                        key={index}
                        onClick={(e) => handleAmountClick(e, amount)}
                        className="h-10 rounded-lg bg-gray-100/50 border border-[rgba(15,23,42,0.08)] font-medium text-sm hover:bg-gray-100/70 hover:border-[rgba(15,23,42,0.12)] transition-colors duration-200"
                        style={{ color: accentColor }}
                      >
                        {formatPredefined(amount)}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleDonateClick}
                    className="w-full h-11 rounded-lg font-medium text-white shadow-lg shadow-green-200/60 transition-all duration-200"
                    style={{ backgroundColor: accentColor }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = accentColorDark;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = accentColor;
                    }}
                  >
                    Donate
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
