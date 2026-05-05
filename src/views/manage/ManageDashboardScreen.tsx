'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { HandHeart, Loader2, ArrowLeft, Shield, CheckCircle, Heart, FileText } from 'lucide-react';
import { SubscriptionCard } from '@/features/subscription-management/ui/SubscriptionCard';
import type { Subscription, Payment } from '@/shared/types/subscription';
import { FUNCTION_URLS } from '@/shared/config/functions';

// ---------------------------------------------------------------------------
// SummaryCard
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  subscriptions: Subscription[];
}

function SummaryCard({ subscriptions }: SummaryCardProps) {
  const active = subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing');
  const currency = subscriptions[0]?.currency?.toUpperCase() || 'GBP';

  const intervals = [...new Set(active.map((s) => s.interval))];
  const label =
    intervals.length === 1 && intervals[0] === 'year'
      ? 'Total yearly donations'
      : intervals.length === 1 && intervals[0] === 'month'
        ? 'Total monthly donations'
        : 'Total active donations';

  const total = active.reduce((sum, s) => sum + s.amount, 0);
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(total / 100);

  return (
    <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <CardContent className="p-5 space-y-1">
        <p className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">{label}</p>
        <p className="text-4xl font-bold text-[#111827]">{formatted}</p>
        <p className="text-xs text-[#6B7280] pt-1">
          {active.length} active {active.length === 1 ? 'subscription' : 'subscriptions'}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getIdToken = async () => {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  if (!auth.currentUser) throw new Error('Not authenticated');
  return auth.currentUser.getIdToken();
};

const formatPaymentDate = (
  ts: string | Date | { seconds: number; nanoseconds?: number } | null | undefined,
) => {
  if (!ts) return null;
  let date: Date;
  if (typeof ts === 'string') date = new Date(ts);
  else if (ts instanceof Date) date = ts;
  else if (typeof ts === 'object' && 'seconds' in ts) date = new Date(ts.seconds * 1000);
  else return null;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ---------------------------------------------------------------------------
// ManageDashboardScreen
// ---------------------------------------------------------------------------

export function ManageDashboardScreen() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'donations' | 'history'>('donations');
  const [managingId, setManagingId] = useState<string | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // -------------------------------------------------------------------------
  // Load subscriptions
  // -------------------------------------------------------------------------
  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();

      if (!auth.currentUser) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Auth timeout')), 5000);
          const unsubscribe = auth.onAuthStateChanged((user) => {
            clearTimeout(timeout);
            unsubscribe();
            if (user) resolve(user);
            else reject(new Error('Not authenticated'));
          });
        });
      }

      const idToken = await auth.currentUser!.getIdToken();
      setUserEmail(auth.currentUser!.email || sessionStorage.getItem('donor_email') || '');

      const res = await fetch(FUNCTION_URLS.getSubscriptionsByEmail, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please request a new link.');
          sessionStorage.removeItem('donor_auth_token');
          sessionStorage.removeItem('donor_email');
          return;
        }
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      if (err instanceof Error && err.message === 'Not authenticated') {
        setError('Session expired. Please request a new link.');
        sessionStorage.removeItem('donor_auth_token');
        sessionStorage.removeItem('donor_email');
      } else {
        setError('Failed to load subscriptions. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  // -------------------------------------------------------------------------
  // Load payment history
  // -------------------------------------------------------------------------
  const loadPaymentHistory = useCallback(async (subs: Subscription[]) => {
    if (subs.length === 0) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const idToken = await getIdToken();
      const results = await Promise.all(
        subs.map((sub) =>
          fetch(FUNCTION_URLS.getPaymentHistory, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ subscriptionId: sub.id }),
          }).then((r) => (r.ok ? r.json() : { payments: [] })),
        ),
      );

      const seen = new Set<string>();
      const all: Payment[] = results
        .flatMap((r) => r.payments || [])
        .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      all.sort((a, b) => {
        const toMs = (ts: Payment['createdAt']) => {
          if (!ts) return 0;
          if (typeof ts === 'string') return new Date(ts).getTime();
          if (ts instanceof Date) return ts.getTime();
          if ('seconds' in ts) return ts.seconds * 1000;
          return 0;
        };
        return toMs(b.createdAt) - toMs(a.createdAt);
      });

      setPayments(all);
      setHistoryLoaded(true);
    } catch {
      setHistoryError('Could not load payment history. Please try again.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleTabChange = (tab: 'donations' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history' && !historyLoaded && subscriptions.length > 0) {
      loadPaymentHistory(subscriptions);
    }
  };

  // -------------------------------------------------------------------------
  // Manage subscription → Stripe portal
  // -------------------------------------------------------------------------
  const handleManageSubscription = async (subscriptionId: string) => {
    setManagingId(subscriptionId);
    try {
      const idToken = await getIdToken();
      const res = await fetch(FUNCTION_URLS.createCustomerPortalSession, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ subscriptionId }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Session expired. Please request a new link.');
          setManagingId(null);
          return;
        }
        if (res.status === 403) {
          setError('You do not have permission to manage this subscription.');
          setManagingId(null);
          return;
        }
        throw new Error('Failed to create portal session');
      }

      const data = await res.json();
      if (data.url) {
        // Keep the overlay up until the browser has navigated away
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to open subscription management. Please try again.');
      setManagingId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#EEEFF3] pb-24 lg:pb-12">
      {/* Header */}
      <div className="bg-white border-b border-[#e0e0e0] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-10 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.push('/manage')}
              className="flex items-center justify-center w-10 h-10 -ml-2 text-[#5f6368] hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[20px] font-medium text-[#202124] leading-tight">Your donations</h1>
            {/* Email in header on desktop */}
            <p className="hidden lg:block text-sm text-[#5f6368] ml-auto">{userEmail}</p>
          </div>
          {/* Email below title on mobile */}
          <p className="lg:hidden text-[13px] text-[#5f6368] ml-11">{userEmail}</p>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 lg:px-10 pt-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : error ? (
          <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 max-w-md mx-auto">
            <CardContent className="pt-6 px-6 pb-6 text-center space-y-4">
              <p className="text-sm text-red-600">{error}</p>
              {error.includes('Session expired') ? (
                <Button
                  onClick={() => router.push('/manage')}
                  className="h-11 bg-[#047857] hover:bg-[#065f46] text-white"
                >
                  Request new link
                </Button>
              ) : (
                <Button onClick={loadSubscriptions} variant="outline" className="h-11">
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        ) : subscriptions.length === 0 ? (
          <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200 max-w-md mx-auto">
            <CardContent className="pt-8 px-6 pb-8 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100">
                <HandHeart className="w-10 h-10 text-gray-300" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No subscriptions found</h3>
                <p className="text-sm text-gray-600 max-w-sm mx-auto">
                  If you've donated before, try a different email address or contact support.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* ----------------------------------------------------------------
             Main layout: sidebar (desktop) + content
          ---------------------------------------------------------------- */
          <div className="lg:flex lg:gap-8 lg:items-start">
            {/* ---- Sidebar (desktop only) ---- */}
            <aside className="hidden lg:flex lg:flex-col lg:w-72 xl:w-80 shrink-0 gap-4 sticky top-24">
              <SummaryCard subscriptions={subscriptions} />

              {/* Desktop tab nav */}
              <nav className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                <button
                  onClick={() => handleTabChange('donations')}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-sm font-medium transition-colors border-b border-gray-100 ${
                    activeTab === 'donations'
                      ? 'bg-[#E8F5F1] text-[#047857]'
                      : 'text-[#374151] hover:bg-gray-50'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${activeTab === 'donations' ? 'fill-current' : ''}`} />
                  Donations
                  <span className="ml-auto text-xs font-semibold bg-[#F3F4F6] text-[#6B7280] px-2 py-0.5 rounded-full">
                    {subscriptions.length}
                  </span>
                </button>
                <button
                  onClick={() => handleTabChange('history')}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'bg-[#E8F5F1] text-[#047857]'
                      : 'text-[#374151] hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Payment History
                </button>
              </nav>

              <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Donations are securely processed by Stripe</span>
              </div>
            </aside>

            {/* ---- Main content ---- */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Summary card — mobile only (shown inline above cards) */}
              <div className="lg:hidden">
                <SummaryCard subscriptions={subscriptions} />
              </div>

              {activeTab === 'donations' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {subscriptions.map((sub) => (
                      <SubscriptionCard
                        key={sub.id}
                        subscription={sub}
                        onManage={handleManageSubscription}
                      />
                    ))}
                  </div>

                  {/* Stripe badge — mobile only (desktop has it in sidebar) */}
                  <div className="mt-4 text-center lg:hidden">
                    <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                      <Shield className="w-4 h-4" />
                      <span>Donations are securely processed by Stripe</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Payment History */
                <div className="space-y-3">
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    </div>
                  ) : historyError ? (
                    <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200">
                      <CardContent className="pt-6 px-6 pb-6 text-center space-y-3">
                        <p className="text-sm text-red-600">{historyError}</p>
                        <Button
                          onClick={() => loadPaymentHistory(subscriptions)}
                          variant="outline"
                          className="h-10"
                        >
                          Try Again
                        </Button>
                      </CardContent>
                    </Card>
                  ) : payments.length === 0 ? (
                    <Card className="bg-white rounded-2xl border-[1.5px] border-gray-200">
                      <CardContent className="pt-8 px-6 pb-8 text-center space-y-3">
                        <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                        <p className="text-sm text-gray-600">No payments recorded yet.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] px-1">
                        {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
                      </p>

                      {/* Mobile: stacked cards — Desktop: table-style card */}
                      <div className="hidden lg:block bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
                        <div className="grid grid-cols-[1fr_auto_auto] text-xs font-semibold uppercase tracking-wide text-[#6B7280] px-6 py-3 border-b border-gray-100 bg-gray-50">
                          <span>Campaign</span>
                          <span className="text-right pr-8">Date</span>
                          <span className="text-right">Amount</span>
                        </div>
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="grid grid-cols-[1fr_auto_auto] items-center px-6 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                          >
                            <div className="min-w-0 pr-4">
                              <p className="text-sm font-medium text-[#111827] truncate">
                                {payment.campaignTitle || 'Donation'}
                              </p>
                              {payment.isGiftAid && (
                                <span className="text-[11px] text-[#047857] font-medium">
                                  + Gift Aid
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-[#6B7280] pr-8 tabular-nums">
                              {formatPaymentDate(payment.createdAt) ?? 'N/A'}
                            </p>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#111827] tabular-nums">
                                {new Intl.NumberFormat('en-GB', {
                                  style: 'currency',
                                  currency: payment.currency?.toUpperCase() || 'GBP',
                                  maximumFractionDigits: 2,
                                }).format(payment.amount / 100)}
                              </p>
                              <span className="inline-flex items-center gap-1 text-xs text-[#137333]">
                                <CheckCircle className="w-3 h-3" />
                                Paid
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Mobile stacked cards */}
                      <div className="lg:hidden space-y-2">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between px-4 py-3.5 gap-3 bg-white rounded-2xl border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[#111827]">
                                {formatPaymentDate(payment.createdAt) ?? 'N/A'}
                              </p>
                              {payment.campaignTitle && (
                                <p className="text-xs text-[#6B7280] truncate mt-0.5">
                                  {payment.campaignTitle}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              <p className="text-sm font-bold text-[#111827] tabular-nums">
                                {new Intl.NumberFormat('en-GB', {
                                  style: 'currency',
                                  currency: payment.currency?.toUpperCase() || 'GBP',
                                  maximumFractionDigits: 2,
                                }).format(payment.amount / 100)}
                              </p>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="inline-flex items-center gap-1 text-xs text-[#137333]">
                                  <CheckCircle className="w-3 h-3" />
                                  Paid
                                </span>
                                {payment.isGiftAid && (
                                  <span className="text-[10px] text-[#6B7280]">· Gift Aid</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 text-center lg:hidden">
                        <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                          <Shield className="w-4 h-4" />
                          <span>Donations are securely processed by Stripe</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full-screen loading overlay — shown while opening Stripe portal */}
      {managingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#EEEFF3]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Redirecting to Stripe…</h2>
            <p className="text-gray-500">
              You'll be taken to a secure page to manage your donation
            </p>
          </div>
        </div>
      )}

      {/* Bottom nav — mobile only */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-1 py-2">
            <button
              onClick={() => handleTabChange('donations')}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'donations'
                  ? 'bg-[#E8F5F1] text-[#047857]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Heart className={`w-5 h-5 ${activeTab === 'donations' ? 'fill-current' : ''}`} />
              <span className="text-xs font-medium">Donations</span>
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-[#E8F5F1] text-[#047857]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-medium">Payment History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
