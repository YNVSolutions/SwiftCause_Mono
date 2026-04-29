import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { Subscription, RecurringStatsQuery, RecurringStatsResponse } from '../model/types';
import { Donation } from '../../../shared/types/donation';
import { getSubscriptionDisplayInterval } from '../model/selectors';

const ACTIVE_STATUSES: Subscription['status'][] = ['active', 'trialing'];

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function toIsoDate(value: Date): string {
  return value.toISOString();
}

function toMonthKey(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getMonthStartUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonthsUtc(value: Date, months: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1, 0, 0, 0, 0));
}

function getNormalizedMonthlyAmountMinor(subscription: Subscription): number {
  if (subscription.interval === 'year') return subscription.amount / 12;
  if (subscription.intervalCount === 3) return subscription.amount / 3;
  return subscription.amount;
}

function isActiveAtDate(subscription: Subscription, at: Date): boolean {
  const startedAt = toDateSafe(subscription.startedAt) || toDateSafe(subscription.createdAt);
  if (!startedAt || startedAt > at) return false;

  const canceledAt = toDateSafe(subscription.canceledAt);
  if (canceledAt && canceledAt <= at) return false;

  return true;
}

/**
 * Get all subscriptions for a campaign
 */
export async function getSubscriptionsByCampaign(campaignId: string): Promise<Subscription[]> {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('campaignId', '==', campaignId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];
  } catch (error) {
    console.error('Error fetching subscriptions by campaign:', error);
    throw error;
  }
}

/**
 * Get all subscriptions for an organization
 */
export async function getSubscriptionsByOrganization(
  organizationId: string,
): Promise<Subscription[]> {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('organizationId', '==', organizationId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];
  } catch (error) {
    console.error('Error fetching subscriptions by organization:', error);
    throw error;
  }
}

interface SubscriptionFilters {
  status?: string;
  interval?: string;
  searchTerm?: string;
}

/**
 * Get organization subscriptions with backend-level status filtering
 * and service-level interval/search filtering.
 */
export async function getSubscriptionsByOrganizationFiltered(
  organizationId: string,
  filters: SubscriptionFilters = {},
): Promise<Subscription[]> {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const constraints: Parameters<typeof query>[1][] = [
      where('organizationId', '==', organizationId),
    ];

    if (filters.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    const q = query(subscriptionsRef, ...constraints);
    const querySnapshot = await getDocs(q);
    const subscriptions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];

    const normalizedSearch = (filters.searchTerm || '').trim().toLowerCase();

    return subscriptions.filter((subscription) => {
      const intervalLabel = getSubscriptionDisplayInterval(
        subscription.interval,
        subscription.intervalCount,
      );
      const matchesInterval =
        !filters.interval || filters.interval === 'all' || intervalLabel === filters.interval;
      const matchesSearch =
        !normalizedSearch ||
        (subscription.metadata?.donorName || '').toLowerCase().includes(normalizedSearch) ||
        (subscription.metadata?.donorEmail || '').toLowerCase().includes(normalizedSearch) ||
        (subscription.stripeSubscriptionId || '').toLowerCase().includes(normalizedSearch);
      return matchesInterval && matchesSearch;
    });
  } catch (error) {
    console.error('Error fetching filtered subscriptions by organization:', error);
    throw error;
  }
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(subscriptionId: string): Promise<Subscription | null> {
  try {
    const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
    const subscriptionDoc = await getDoc(subscriptionRef);

    if (!subscriptionDoc.exists()) {
      return null;
    }

    return {
      id: subscriptionDoc.id,
      ...subscriptionDoc.data(),
    } as Subscription;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
}

/**
 * Get subscriptions by donor email
 */
export async function getSubscriptionsByDonorEmail(email: string): Promise<Subscription[]> {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('metadata.donorEmail', '==', email));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];
  } catch (error) {
    console.error('Error fetching subscriptions by donor email:', error);
    throw error;
  }
}

/**
 * Get active subscriptions for a campaign
 */
export async function getActiveSubscriptionsByCampaign(
  campaignId: string,
): Promise<Subscription[]> {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(
      subscriptionsRef,
      where('campaignId', '==', campaignId),
      where('status', '==', 'active'),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];
  } catch (error) {
    console.error('Error fetching active subscriptions:', error);
    throw error;
  }
}

/**
 * Update subscription status locally (actual cancellation should be done via backend)
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: Subscription['status'],
): Promise<void> {
  try {
    const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
    await updateDoc(subscriptionRef, {
      status,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
}

/**
 * Calculate subscription statistics for a campaign
 */
export async function getSubscriptionStats(organizationId: string) {
  try {
    const recurring = await getRecurringStats(organizationId);
    const subscriptions = await getSubscriptionsByOrganization(organizationId);
    return {
      total: subscriptions.length,
      active: recurring.summary.activeSubscriptions,
      canceled: recurring.summary.canceledSubscriptions,
      pastDue: recurring.summary.pastDueCount,
      totalMonthlyRevenue: recurring.summary.mrrMinor,
      totalAnnualRevenue: recurring.summary.arrMinor,
      averageAmount:
        recurring.summary.activeSubscriptions > 0
          ? recurring.summary.mrrMinor / recurring.summary.activeSubscriptions
          : 0,
    };
  } catch (error) {
    console.error('Error calculating subscription stats:', error);
    throw error;
  }
}

/**
 * Unified recurring stats service for admin dashboard/subscription pages.
 */
export async function getRecurringStats(
  organizationId: string,
  options: RecurringStatsQuery = {},
): Promise<RecurringStatsResponse> {
  const defaultTo = new Date();
  const defaultFrom = new Date(defaultTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = toDateSafe(options.from) || defaultFrom;
  const toDate = toDateSafe(options.to) || defaultTo;

  if (fromDate >= toDate) {
    throw new Error('Invalid date range: "from" must be before "to".');
  }

  const subscriptions = await getSubscriptionsByOrganization(organizationId);

  const donationsRef = collection(db, 'donations');
  const donationsQuery = query(
    donationsRef,
    where('organizationId', '==', organizationId),
    where('isRecurring', '==', true),
    where('timestamp', '>=', Timestamp.fromDate(fromDate)),
    where('timestamp', '<', Timestamp.fromDate(toDate)),
  );
  const donationsSnapshot = await getDocs(donationsQuery);
  const recurringDonations = donationsSnapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Donation)
    .filter((d) => d.paymentStatus === 'success');

  const activeSubscriptions = subscriptions.filter((s) =>
    ACTIVE_STATUSES.includes(s.status),
  ).length;

  const newSubscriptions = subscriptions.filter((s) => {
    const startedAt = toDateSafe(s.startedAt) || toDateSafe(s.createdAt);
    return !!startedAt && startedAt >= fromDate && startedAt < toDate;
  }).length;

  const canceledSubscriptions = subscriptions.filter((s) => {
    const canceledAt = toDateSafe(s.canceledAt);
    return !!canceledAt && canceledAt >= fromDate && canceledAt < toDate;
  }).length;

  const activeAtWindowStart = subscriptions.filter((s) => isActiveAtDate(s, fromDate)).length;
  const churnRatePercent =
    activeAtWindowStart > 0
      ? Number(((canceledSubscriptions / activeAtWindowStart) * 100).toFixed(2))
      : 0;

  const mrrMinor = subscriptions
    .filter((s) => ACTIVE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + getNormalizedMonthlyAmountMinor(s), 0);
  const arrMinor = mrrMinor * 12;

  const recurringCashCollectedMinor = recurringDonations.reduce(
    (sum, d) => sum + (d.amount || 0),
    0,
  );
  const pastDueCount = subscriptions.filter((s) => s.status === 'past_due').length;

  const monthStart = getMonthStartUtc(fromDate);
  const monthEndExclusive = addMonthsUtc(getMonthStartUtc(toDate), 1);
  const trends: RecurringStatsResponse['trends'] = [];
  for (
    let bucket = new Date(monthStart);
    bucket < monthEndExclusive;
    bucket = addMonthsUtc(bucket, 1)
  ) {
    const nextBucket = addMonthsUtc(bucket, 1);
    const period = toMonthKey(bucket);

    const bucketNew = subscriptions.filter((s) => {
      const startedAt = toDateSafe(s.startedAt) || toDateSafe(s.createdAt);
      return !!startedAt && startedAt >= bucket && startedAt < nextBucket;
    }).length;

    const bucketCanceled = subscriptions.filter((s) => {
      const canceledAt = toDateSafe(s.canceledAt);
      return !!canceledAt && canceledAt >= bucket && canceledAt < nextBucket;
    }).length;

    const bucketMrr = subscriptions
      .filter((s) => isActiveAtDate(s, new Date(nextBucket.getTime() - 1)))
      .reduce((sum, s) => sum + getNormalizedMonthlyAmountMinor(s), 0);

    const bucketCash = recurringDonations.reduce((sum, d) => {
      const ts = toDateSafe(d.timestamp);
      if (!ts) return sum;
      return ts >= bucket && ts < nextBucket ? sum + (d.amount || 0) : sum;
    }, 0);

    trends.push({
      period,
      mrrMinor: bucketMrr,
      cashCollectedMinor: bucketCash,
      newSubscriptions: bucketNew,
      canceledSubscriptions: bucketCanceled,
    });
  }

  return {
    organizationId,
    from: toIsoDate(fromDate),
    to: toIsoDate(toDate),
    summary: {
      activeSubscriptions,
      newSubscriptions,
      canceledSubscriptions,
      churnRatePercent,
      mrrMinor,
      arrMinor,
      recurringCashCollectedMinor,
      pastDueCount,
    },
    trends,
  };
}
