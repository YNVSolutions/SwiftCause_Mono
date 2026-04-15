import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../shared/ui/card';
import { Skeleton } from '../../../shared/ui/skeleton';
import { Progress } from '../../../shared/ui/progress';
import { Trophy, ArrowUpRight } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { formatCurrency as formatGbp, formatCurrencyFromMajor as formatGbpMajor } from '../../../shared/lib/currencyFormatter';

interface CampaignData {
  id: string;
  name: string;
  raised: number;
  goal: number;
  percentage: number;
  donationCount: number;
}

interface TopPerformingCampaignsProps {
  data?: CampaignData[];
  loading?: boolean;
  onViewDetails?: () => void;
  formatCurrency?: (amount: number) => string;
  className?: string;
}

export const TopPerformingCampaigns: React.FC<TopPerformingCampaignsProps> = ({
  data = [],
  loading = false,
  onViewDetails,
  formatCurrency = formatGbp,
  className = '',
}) => {
  if (loading) {
    return (
      <Card className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      <CardHeader className="p-6 pb-4 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mr-3">
                <Trophy className="w-4 h-4" />
              </div>
              Top Performing Campaigns
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 mt-1 ml-11">
              Campaigns ranked by completion percentage
            </CardDescription>
          </div>
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium"
            >
              <ArrowUpRight className="w-4 h-4 mr-1" />
              View All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-5">
        {data.length > 0 ? (
          <div className="space-y-6">
            {data.map((campaign, index) => {
              const goal = campaign.goal || 0;
              const raisedInGbp = (campaign.raised || 0) / 100;
              const displayPercentage =
                goal > 0 ? (raisedInGbp / goal) * 100 : 0;

              return (
              <div key={campaign.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-900 truncate text-sm leading-relaxed">
                        {campaign.name}
                      </h4>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-gray-600">
                      {Math.round(displayPercentage)}%
                    </p>
                  </div>
                </div>
                
                <Progress 
                  value={displayPercentage} 
                  className="h-1.5"
                />
                
                <div className="flex items-center justify-between text-xs text-gray-500 leading-relaxed">
                  <span className="font-medium">
                    {formatCurrency(campaign.raised)} of {formatGbpMajor(campaign.goal)}
                  </span>
                  <span className="text-gray-400">
                    {campaign.donationCount} donations
                  </span>
                </div>
              </div>
            );})}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Trophy className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-lg font-medium mb-2 text-gray-700">No Campaign Data</p>
            <p className="text-sm text-gray-500">Campaign performance will appear here once campaigns are created.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
