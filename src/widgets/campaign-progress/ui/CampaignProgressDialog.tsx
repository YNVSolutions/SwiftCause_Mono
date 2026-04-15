import React, { useState } from 'react';
import { X, Target, TrendingUp, Search, Filter, CheckCircle2, AlertCircle, AlertTriangle, ArrowUpDown } from 'lucide-react';
import { CampaignProgress, sortCampaignProgress } from '../lib/progressCalculations';
import { formatCurrency as formatGbp, formatCurrencyFromMajor as formatGbpMajor } from '../../../shared/lib/currencyFormatter';

interface CampaignProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: CampaignProgress[];
  onCampaignClick?: (campaignId: string) => void;
  formatCurrency?: (amount: number) => string;
}

export const CampaignProgressDialog: React.FC<CampaignProgressDialogProps> = ({
  isOpen,
  onClose,
  campaigns,
  onCampaignClick,
  formatCurrency = formatGbp,
}) => {
  const [sortBy, setSortBy] = useState<'progress' | 'raised' | 'goal' | 'name'>('progress');
  const [filterStatus, setFilterStatus] = useState<'all' | 'critical' | 'warning' | 'good' | 'exceeded'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || campaign.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const sortedCampaigns = sortCampaignProgress(filteredCampaigns, sortBy);

  // Calculate summary stats
  const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);
  const totalGoal = campaigns.reduce((sum, c) => sum + c.goal, 0);
  const overallProgress =
    totalGoal > 0 ? Math.round(((totalRaised / 100) / totalGoal) * 100) : 0;
  const completedCount = campaigns.filter((c) => c.status === 'exceeded').length;
  const criticalCount = campaigns.filter((c) => c.status === 'critical').length;

  const getStatusIcon = (status: CampaignProgress['status']) => {
    switch (status) {
      case 'exceeded':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'good':
        return <TrendingUp className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getStatusLabel = (status: CampaignProgress['status']) => {
    switch (status) {
      case 'exceeded':
        return 'Exceeded';
      case 'good':
        return 'On Track';
      case 'warning':
        return 'Needs Attention';
      case 'critical':
        return 'Critical';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Campaign Progress Overview</h2>
              <p className="text-sm text-gray-600 mt-1">Detailed view of all campaign goals and progress</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-medium text-gray-600 mb-1">Total Campaigns</div>
                <p className="text-2xl font-bold text-gray-800">{campaigns.length}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-medium text-gray-600 mb-1">Overall Progress</div>
                <p className="text-2xl font-bold text-gray-800">{overallProgress}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(totalRaised)} / {formatGbpMajor(totalGoal)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-medium text-gray-600 mb-1">Completed</div>
                <p className="text-2xl font-bold text-gray-800">{completedCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {campaigns.length > 0 ? Math.round((completedCount / campaigns.length) * 100) : 0}% of total
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="text-xs font-medium text-gray-600 mb-1">Need Attention</div>
                <p className="text-2xl font-bold text-gray-800">{criticalCount}</p>
                <p className="text-xs text-gray-500 mt-1">Critical campaigns</p>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
                />
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm bg-white"
                >
                  <option value="all">All Status</option>
                  <option value="exceeded">Exceeded</option>
                  <option value="good">On Track</option>
                  <option value="warning">Needs Attention</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Sort */}
              <button
                onClick={handleSort}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>Sort: {getSortLabel()}</span>
              </button>
            </div>

            {/* Campaign Progress Chart */}
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Campaign Progress Distribution</h3>
                <div className="text-sm text-gray-500">Top 10 campaigns by progress</div>
              </div>
              
              <div className="space-y-4">
                {sortedCampaigns.slice(0, 10).map((campaign, index) => (
                  <div key={campaign.id} className="flex items-center gap-4">
                    <div className="w-4 text-xs text-gray-500 text-right">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">{campaign.name}</span>
                        <span className="text-sm font-semibold text-gray-700">{campaign.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            campaign.status === 'exceeded'
                              ? 'bg-slate-600'
                              : campaign.status === 'good'
                              ? 'bg-stone-600'
                              : campaign.status === 'warning'
                              ? 'bg-neutral-600'
                              : 'bg-gray-600'
                          }`}
                          style={{ width: `${Math.min(100, campaign.percentage)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 w-20 text-right">
                      {formatCurrency(campaign.raised)}
                    </div>
                  </div>
                ))}
              </div>
              
              {sortedCampaigns.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm">No campaign data available</div>
                </div>
              )}
            </div>

            {/* Campaign Cards */}
            <div className="space-y-3">
              {sortedCampaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Target className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-base font-medium mb-2 text-gray-700">No campaigns found</p>
                  <p className="text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
                </div>
              ) : (
                sortedCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`group relative ${
                      onCampaignClick ? 'cursor-pointer hover:shadow-sm' : ''
                    } p-5 rounded-xl transition-all border ${
                      campaign.status === 'exceeded'
                        ? 'border-slate-100 bg-slate-50/30'
                        : campaign.status === 'good'
                        ? 'border-gray-100 bg-gray-50/30'
                        : campaign.status === 'warning'
                        ? 'border-stone-100 bg-stone-50/30'
                        : 'border-neutral-100 bg-neutral-50/30'
                    }`}
                    onClick={() => onCampaignClick?.(campaign.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={campaign.statusColor}>
                          {getStatusIcon(campaign.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-gray-900 mb-1">{campaign.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                              campaign.status === 'exceeded'
                                ? 'bg-slate-100 text-slate-700'
                                : campaign.status === 'good'
                                ? 'bg-gray-100 text-gray-700'
                                : campaign.status === 'warning'
                                ? 'bg-stone-100 text-stone-700'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}>
                              {getStatusLabel(campaign.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0 ml-4">
                        <span className={`text-xl font-bold ${campaign.statusColor}`}>
                          {campaign.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                      <div
                        className={`absolute top-0 left-0 h-full ${campaign.progressColor} transition-all duration-500 ease-out rounded-full`}
                        style={{ width: `${Math.min(100, campaign.percentage)}%` }}
                      />
                    </div>

                    {/* Amount Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Raised</div>
                        <div className="text-base font-semibold text-gray-900">{formatCurrency(campaign.raised)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Goal</div>
                        <div className="text-base font-semibold text-gray-900">{formatGbpMajor(campaign.goal)}</div>
                      </div>
                    </div>

                    {/* Remaining amount */}
                    {campaign.status !== 'exceeded' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-600">
                          Remaining: <span className="font-medium text-gray-900">{formatGbpMajor(campaign.goal - (campaign.raised / 100))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Results count */}
            {sortedCampaigns.length > 0 && (
              <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-100">
                Showing {sortedCampaigns.length} of {campaigns.length} campaigns
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
