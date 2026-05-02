'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { HandHeart, Loader2, ArrowLeft, Heart, FileText, Shield } from 'lucide-react';
import { SubscriptionCard } from '@/features/subscription-management/ui/SubscriptionCard';
import type { Subscription } from '@/shared/types/subscription';

export function ManageDashboardScreen() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail] = useState('r***@gmail.com'); // TODO: Get from auth

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      setError('');

      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/subscriptions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      setError('Failed to load subscriptions. Please try again.');
      console.error('Error loading subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async (subscriptionId: string) => {
    try {
      // Call API to create Stripe portal session
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const data = await response.json();

      // Redirect to Stripe portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Error creating portal session:', err);
      setError('Failed to open subscription management. Please try again.');
    }
  };

  // Calculate total monthly donations
  const calculateMonthlyTotal = () => {
    const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'active');
    const total = activeSubscriptions.reduce((sum, sub) => sum + sub.amount, 0);
    return total;
  };

  // Get next charge date
  const getNextChargeDate = () => {
    const activeSubscriptions = subscriptions.filter(
      (sub) => sub.status === 'active' && sub.nextPaymentAt,
    );
    if (activeSubscriptions.length === 0) return null;

    const nextDates = activeSubscriptions
      .map((sub) => {
        if (
          sub.nextPaymentAt &&
          typeof sub.nextPaymentAt === 'object' &&
          'seconds' in sub.nextPaymentAt
        ) {
          return new Date(sub.nextPaymentAt.seconds * 1000);
        }
        return null;
      })
      .filter((date) => date !== null) as Date[];

    if (nextDates.length === 0) return null;
    return new Date(Math.min(...nextDates.map((d) => d.getTime())));
  };

  const formatCurrency = (amount: number) => {
    return `£${(amount / 100).toFixed(0)}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const monthlyTotal = calculateMonthlyTotal();
  const nextChargeDate = getNextChargeDate();

  return (
    <div className="min-h-screen bg-[#EEEFF3] pb-24">
      {/* Header - Material Design Style */}
      <div className="bg-white border-b border-[#e0e0e0] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.push('/manage')}
              className="flex items-center justify-center w-10 h-10 -ml-2 text-[#5f6368] hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[20px] font-medium text-[#202124] leading-tight">Your donations</h1>
          </div>
          <p className="text-[13px] text-[#5f6368] ml-11">{userEmail}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : error ? (
          <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardContent className="pt-6 px-6 pb-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-red-600">{error}</p>
                <Button onClick={loadSubscriptions} variant="outline" className="h-11">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : subscriptions.length === 0 ? (
          <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <CardContent className="pt-8 px-6 pb-8">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100">
                  <HandHeart className="w-10 h-10 text-gray-300" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    No active donations found
                  </h3>
                  <p className="text-sm text-gray-600 max-w-sm mx-auto">
                    If you've donated before, try using a different email address or contact support
                    for assistance in locating your records.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Card */}
            <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-4">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <p className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">
                    Total monthly donations
                  </p>
                  <p className="text-4xl font-bold text-[#111827]">
                    {formatCurrency(monthlyTotal)}
                  </p>
                  {nextChargeDate && (
                    <p className="text-sm text-[#374151] pt-2">
                      Next total charge:{' '}
                      <span className="font-medium">{formatDate(nextChargeDate)}</span>
                      {getDaysUntil(nextChargeDate) <= 7 && (
                        <span className="text-[#6B7280]">
                          {' '}
                          · in {getDaysUntil(nextChargeDate)} days
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Subscription Cards */}
            <div className="space-y-3">
              {subscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  onManage={handleManageSubscription}
                />
              ))}
            </div>

            {/* Trust Indicator */}
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                <Shield className="w-4 h-4" />
                <span>Donations are securely processed by Stripe</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-1 py-2">
            <button className="flex flex-col items-center gap-1 py-2 px-4 rounded-lg bg-[#E8F5F1] text-[#047857]">
              <Heart className="w-5 h-5 fill-current" />
              <span className="text-xs font-medium">Donations</span>
            </button>
            <button className="flex flex-col items-center gap-1 py-2 px-4 text-gray-500 hover:text-gray-700">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-medium">Payment History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
