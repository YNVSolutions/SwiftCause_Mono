'use client';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Calendar, CheckCircle } from 'lucide-react';
import type { Subscription } from '@/shared/types/subscription';

interface SubscriptionCardProps {
  subscription: Subscription;
  onManage: (subscriptionId: string) => void;
}

export function SubscriptionCard({ subscription, onManage }: SubscriptionCardProps) {
  // Helper to safely get campaign title from metadata
  const getCampaignTitle = () => {
    const title = subscription.metadata?.campaignTitle;
    return typeof title === 'string' ? title : 'Recurring Donation';
  };

  // Helper to safely get organization name from metadata
  const getOrganizationName = () => {
    const name = subscription.metadata?.organizationName;
    return typeof name === 'string' ? name : subscription.organizationId;
  };

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'gbp' ? '£' : currency === 'usd' ? '$' : currency.toUpperCase();
    return `${symbol}${(amount / 100).toFixed(0)}`;
  };

  const formatInterval = (interval: string) => {
    return interval;
  };

  const formatDate = (
    timestamp: string | Date | { seconds: number; nanoseconds?: number } | undefined,
  ) => {
    if (!timestamp) return 'N/A';

    let date: Date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntil = (
    timestamp: string | Date | { seconds: number; nanoseconds?: number } | undefined,
  ) => {
    if (!timestamp) return null;

    let date: Date;
    if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      return null;
    }

    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isActive = subscription.status === 'active';
  const isCanceled = subscription.status === 'canceled';
  const daysUntilCharge =
    isActive && subscription.nextPaymentAt ? getDaysUntil(subscription.nextPaymentAt) : null;

  return (
    <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_2px_4px_rgba(0,0,0,0.06)] transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3.5">
          {/* Header with Title and Status Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[#111827] mb-1 leading-tight">
                {getCampaignTitle()}
              </h3>
              <p className="text-sm text-[#6B7280]">{getOrganizationName()}</p>
            </div>
            {isActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E6F4EA] text-[#137333] shrink-0">
                <CheckCircle className="w-3.5 h-3.5" />
                Active
              </span>
            )}
            {isCanceled && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#6B7280] shrink-0">
                Canceled
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="text-3xl font-bold text-[#111827]">
            {formatAmount(subscription.amount, subscription.currency)}
            <span className="text-base font-normal text-[#6B7280]">
              {' '}
              / {formatInterval(subscription.interval)}
            </span>
          </div>

          {isActive && (
            <>
              {/* Next Charge - Clean, No Box */}
              {subscription.nextPaymentAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-[#6B7280]" />
                  <span className="text-[#374151]">
                    Next charge:{' '}
                    <span className="font-medium">{formatDate(subscription.nextPaymentAt)}</span>
                    {daysUntilCharge !== null && daysUntilCharge <= 7 && (
                      <span className="text-[#6B7280]">
                        {' '}
                        · in {daysUntilCharge} {daysUntilCharge === 1 ? 'day' : 'days'}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Action Button - Outlined Style */}
              <div className="flex flex-col items-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-[1.5px]! border-[#0F7A5C]! text-[#0F7A5C]! bg-white! hover:bg-[#0F7A5C]! hover:text-white! hover:border-[#0F7A5C]! active:bg-[#0D6B4E]! active:border-[#0D6B4E]! active:text-white! h-11 font-medium rounded-xl text-base transition-all"
                  onClick={() => onManage(subscription.id)}
                >
                  Manage Subscription
                </Button>
                <p className="text-xs text-[#6B7280] text-center mt-2.5">
                  You can update or cancel your donation anytime
                </p>
              </div>
            </>
          )}

          {isCanceled && (
            <>
              {/* Canceled State - Clean */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-[#6B7280]" />
                <span className="text-[#374151]">
                  Last payment:{' '}
                  <span className="font-medium">{formatDate(subscription.currentPeriodEnd)}</span>
                </span>
              </div>

              {/* Restart Button */}
              <div className="flex flex-col items-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-[1.5px]! border-[#0F7A5C]! text-[#0F7A5C]! bg-white! hover:bg-[#0F7A5C]! hover:text-white! hover:border-[#0F7A5C]! active:bg-[#0D6B4E]! active:border-[#0D6B4E]! active:text-white! h-11 font-medium rounded-xl text-base transition-all"
                >
                  Restart donation
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
