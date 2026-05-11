export type SubscriptionInterval = 'month' | 'year';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'unpaid';

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  campaignTitle: string | null;
  createdAt: string | Date | { seconds: number; nanoseconds?: number } | null;
  isGiftAid: boolean;
}

export interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  customerId: string;
  campaignId: string;
  organizationId: string;
  interval: SubscriptionInterval;
  intervalCount?: number;
  amount: number;
  currency: string;
  status: SubscriptionStatus;
  startedAt?: string | Date | { seconds: number; nanoseconds?: number } | null;
  lastPaymentAt?: string | Date | { seconds: number; nanoseconds?: number } | null;
  nextPaymentAt?: string | Date | { seconds: number; nanoseconds?: number } | null;
  canceledAt?: string | Date | { seconds: number; nanoseconds?: number } | null;
  cancelReason?: string | null;
  currentPeriodEnd: string | Date | { seconds: number; nanoseconds?: number };
  createdAt: string | Date | { seconds: number; nanoseconds?: number };
  updatedAt: string | Date | { seconds: number; nanoseconds?: number };
  lastFailedInvoice?: string;
  lastFailedAt?: string | Date | { seconds: number; nanoseconds?: number };
  metadata?: {
    donorEmail?: string;
    donorName?: string;
    platform?: string;
    [key: string]: unknown;
  };
}

export interface CreateSubscriptionRequest {
  amount: number;
  interval: SubscriptionInterval;
  intervalCount?: number;
  campaignId: string;
  donor: {
    email: string;
    name?: string;
    phone?: string;
  };
  paymentMethodId: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  clientSecret?: string;
  status: SubscriptionStatus;
  success?: boolean;
  message?: string;
  requiresAction?: boolean;
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
  cancelImmediately?: boolean;
  cancelReason?: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  message: string;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    canceledAt: number;
  };
}

export interface RecurringStatsQuery {
  from?: string | Date;
  to?: string | Date;
}

export interface RecurringTrendPoint {
  period: string; // YYYY-MM
  mrrMinor: number;
  cashCollectedMinor: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
}

export interface RecurringStatsSummary {
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  churnRatePercent: number;
  mrrMinor: number;
  arrMinor: number;
  recurringCashCollectedMinor: number;
  pastDueCount: number;
}

export interface RecurringStatsResponse {
  organizationId: string;
  from: string;
  to: string;
  summary: RecurringStatsSummary;
  trends: RecurringTrendPoint[];
}
