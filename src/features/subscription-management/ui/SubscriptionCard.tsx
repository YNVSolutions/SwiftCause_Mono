'use client';

import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { CheckCircle } from 'lucide-react';
import type { Subscription, SubscriptionStatus } from '@/shared/types/subscription';

interface SubscriptionCardProps {
  subscription: Subscription;
  onManage: (subscriptionId: string) => void;
}

export function SubscriptionCard({ subscription, onManage }: SubscriptionCardProps) {
  const getCampaignTitle = () => {
    const title = subscription.metadata?.campaignTitle;
    return typeof title === 'string' ? title : 'Recurring Donation';
  };

  const getOrganizationName = () => {
    const name = subscription.metadata?.organizationName;
    return typeof name === 'string' ? name : subscription.organizationId;
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / 100);
  };

  const formatInterval = (interval: string, intervalCount = 1) => {
    if (intervalCount <= 1) return interval;
    return `${intervalCount} ${interval}s`;
  };

  const getStatusLabel = (status: SubscriptionStatus) => {
    return status
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const isActive = subscription.status === 'active';
  const isTrialing = subscription.status === 'trialing';
  const canManage = isActive || isTrialing;

  return (
    <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-[0_2px_4px_rgba(0,0,0,0.06)] transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[#111827] mb-1 leading-tight">
                {getCampaignTitle()}
              </h3>
              <p className="text-sm text-[#6B7280]">Organization: {getOrganizationName()}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${
                isActive ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#F3F4F6] text-[#6B7280]'
              }`}
            >
              {isActive && <CheckCircle className="w-3.5 h-3.5" />}
              {getStatusLabel(subscription.status)}
            </span>
          </div>

          <div className="text-3xl font-bold text-[#111827]">
            {formatAmount(subscription.amount, subscription.currency)}
            <span className="text-base font-normal text-[#6B7280]">
              {' '}
              / {formatInterval(subscription.interval, subscription.intervalCount)}
            </span>
          </div>

          <div className="flex flex-col items-center pt-1">
            {canManage ? (
              <>
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
              </>
            ) : (
              <p className="text-xs text-[#6B7280] text-center py-1">This subscription has ended</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
