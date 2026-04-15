import React, { useState } from 'react';
import { ArrowUpDown, CheckCircle2, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { CampaignProgress, sortCampaignProgress } from '../lib/progressCalculations';
import { formatCurrency as formatGbp, formatCurrencyFromMajor as formatGbpMajor } from '../../../shared/lib/currencyFormatter';

interface CampaignProgressBarsProps {
  campaigns: CampaignProgress[];
  onCampaignClick?: (campaignId: string) => void;
  formatCurrency?: (amount: number) => string;
}

export const CampaignProgressBars: React.FC<CampaignProgressBarsProps> = ({
  campaigns,
  onCampaignClick,
  formatCurrency = formatGbp,
}) => {
  const [sortBy, setSortBy] = useState<'progress' | 'raised' | 'goal' | 'name'>('progress');
  
  const sortedCampaigns = sortCampaignProgress(campaigns, sortBy);

  const getStatusIcon = (status: CampaignProgress['status']) => {
    switch (status) {
      case 'exceeded':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'good':
        return <TrendingUp className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'critical':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const handleSort = () => {
    const sortOrder: Array<'progress' | 'raised' | 'goal' | 'name'> = ['progress', 'raised', 'goal', 'name'];
    const currentIndex = sortOrder.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % sortOrder.length;
    setSortBy(sortOrder[nextIndex]);
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'progress':
        return 'Progress %';
      case 'raised':
        return 'Amount Raised';
      case 'goal':
        return 'Goal Amount';
      case 'name':
        return 'Name';
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <p className="text-lg font-medium mb-2">No Campaigns Yet</p>
        <p className="text-sm">Start by creating your first fundraising campaign to track progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sort Control */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500">
          Showing {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={handleSort}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-gray-50"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          Sort by: {getSortLabel()}
        </button>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {sortedCampaigns.map((campaign) => (
          <div
            key={campaign.id}
            className={`group relative ${
              onCampaignClick ? 'cursor-pointer hover:bg-gray-50' : ''
            } p-3 rounded-lg transition-all border border-transparent hover:border-gray-200`}
            onClick={() => onCampaignClick?.(campaign.id)}
          >
            {/* Campaign Name and Status */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={campaign.statusColor}>
                  {getStatusIcon(campaign.status)}
                </div>
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  {campaign.name}
                </h4>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className={`text-sm font-bold ${campaign.statusColor}`}>
                  {campaign.percentage}%
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={`absolute top-0 left-0 h-full ${campaign.progressColor} transition-all duration-500 ease-out rounded-full`}
                style={{ width: `${Math.min(100, campaign.percentage)}%` }}
              >
                {/* Shimmer effect for active campaigns */}
                {campaign.status !== 'exceeded' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                )}
              </div>
            </div>

            {/* Amount Details */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">
                Raised: <span className="text-gray-900 font-semibold">{formatCurrency(campaign.raised)}</span>
              </span>
              <span className="text-gray-500">
                Goal: {formatGbpMajor(campaign.goal)}
              </span>
            </div>

            {/* Hover indicator */}
            {onCampaignClick && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-xs text-gray-600">0-33% Critical</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-600" />
          <span className="text-xs text-gray-600">34-66% Warning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-600" />
          <span className="text-xs text-gray-600">67-99% Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-600" />
          <span className="text-xs text-gray-600">100%+ Exceeded</span>
        </div>
      </div>
    </div>
  );
};
