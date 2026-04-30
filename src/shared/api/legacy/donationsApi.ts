import {
  collection,
  getDocs,
  DocumentData,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PAGE_SIZE } from '../../lib/hooks/usePagination';

interface FirestoreErrorLike {
  code?: string;
}

export interface DonationFilters {
  status?: string;
  campaignId?: string;
  isRecurring?: boolean;
  donationDate?: string; // YYYY-MM-DD
  searchTerm?: string;
}

export interface DonationPage {
  docs: QueryDocumentSnapshot[];
  data: DocumentData[];
  lastDoc: DocumentSnapshot | null;
  hasNextPage: boolean;
}

/**
 * Required Firestore composite indexes:
 *
 * Without filters:
 *   Collection: donations
 *   Fields: organizationId ASC, timestamp DESC, __name__ DESC
 *
 * With paymentStatus filter:
 *   Collection: donations
 *   Fields: organizationId ASC, paymentStatus ASC, timestamp DESC, __name__ DESC
 *
 * With campaignId filter:
 *   Collection: donations
 *   Fields: organizationId ASC, campaignId ASC, timestamp DESC, __name__ DESC
 */
export async function fetchDonationsPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: DonationFilters = {},
): Promise<DonationPage> {
  const normalizedSearch = (filters.searchTerm || '').trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const hasDateFilter = Boolean(filters.donationDate);
  const hasInMemoryFilters = hasSearch || hasDateFilter;

  const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }
    if (typeof value === 'object' && value !== null) {
      if (typeof (value as { toDate?: unknown }).toDate === 'function') {
        const dateValue = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(dateValue.getTime()) ? 0 : dateValue.getTime();
      }
      if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
        return ((value as { seconds: number }).seconds || 0) * 1000;
      }
    }
    return 0;
  };

  const toDateKey = (value: unknown): string => {
    const millis = toMillis(value);
    if (!millis) return '';
    const date = new Date(millis);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const matchesSearch = (docData: DocumentData): boolean => {
    if (!hasSearch) return true;
    const donorName = String(docData.donorName || '').toLowerCase();
    const paymentIntent = String(docData.stripePaymentIntentId || '').toLowerCase();
    const transactionId = String(docData.transactionId || '').toLowerCase();
    const campaignTitle = String(
      docData.campaignTitleSnapshot || docData.campaignTitle || '',
    ).toLowerCase();
    return (
      donorName.includes(normalizedSearch) ||
      paymentIntent.includes(normalizedSearch) ||
      transactionId.includes(normalizedSearch) ||
      campaignTitle.includes(normalizedSearch)
    );
  };

  const matchesDate = (docData: DocumentData): boolean => {
    if (!filters.donationDate) return true;
    return toDateKey(docData.timestamp) === filters.donationDate;
  };

  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('paymentStatus', '==', filters.status));
  }
  if (filters.campaignId && filters.campaignId !== 'all') {
    constraints.push(where('campaignId', '==', filters.campaignId));
  }
  if (filters.isRecurring !== undefined) {
    constraints.push(where('isRecurring', '==', filters.isRecurring));
  }

  constraints.push(orderBy('timestamp', 'desc'), orderBy('__name__', 'desc'));

  if (!hasInMemoryFilters) {
    constraints.push(limit(PAGE_SIZE + 1));
  }

  if (cursor && !hasInMemoryFilters) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'donations'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as FirestoreErrorLike)?.code;
    if (code !== 'failed-precondition') throw err;
    // Index still building — fall back to unfiltered query.
    // Only safe when no filters are active; with filters, return empty to avoid showing wrong data.
    const hasIndexedFilters =
      (filters.status && filters.status !== 'all') ||
      (filters.campaignId && filters.campaignId !== 'all') ||
      filters.isRecurring !== undefined;
    if (hasIndexedFilters) {
      console.warn('fetchDonationsPaginated: index not ready for filtered query, returning empty');
      return { docs: [], data: [], lastDoc: null, hasNextPage: false };
    }
    const fallbackQ = query(
      collection(db, 'donations'),
      where('organizationId', '==', organizationId),
    );
    snapshot = hasInMemoryFilters
      ? await getDocs(fallbackQ)
      : await getDocs(query(fallbackQ, limit(PAGE_SIZE + 1)));
  }

  if (snapshot.empty) {
    return { docs: [], data: [], lastDoc: null, hasNextPage: false };
  }

  if (hasInMemoryFilters) {
    const sortedDocs = [...snapshot.docs].sort((a, b) => {
      const aMillis = toMillis((a.data() as { timestamp?: unknown }).timestamp);
      const bMillis = toMillis((b.data() as { timestamp?: unknown }).timestamp);
      if (aMillis !== bMillis) return bMillis - aMillis;
      return b.id.localeCompare(a.id);
    });
    const matchingDocs = sortedDocs.filter((docSnap) => {
      const docData = docSnap.data();
      return matchesSearch(docData) && matchesDate(docData);
    });
    const startIndex = cursor
      ? matchingDocs.findIndex((docSnap) => docSnap.id === cursor.id) + 1
      : 0;
    const docs = matchingDocs.slice(startIndex, startIndex + PAGE_SIZE);
    const hasNextPage = startIndex + PAGE_SIZE < matchingDocs.length;
    return {
      docs,
      data: docs.map((d) => ({ ...d.data(), id: d.id })),
      lastDoc: docs[docs.length - 1] ?? null,
      hasNextPage,
    };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs = hasNextPage ? snapshot.docs.slice(0, PAGE_SIZE) : snapshot.docs;

  return {
    docs,
    data: docs.map((d) => ({ ...d.data(), id: d.id })),
    lastDoc: docs[docs.length - 1] ?? null,
    hasNextPage,
  };
}

// Kept for CSV export — fetches full dataset, not paginated
export async function fetchAllDonations(organizationId: string): Promise<DocumentData[]> {
  try {
    const orderedQuery = query(
      collection(db, 'donations'),
      where('organizationId', '==', organizationId),
      orderBy('timestamp', 'desc'),
    );
    const fallbackQuery = query(
      collection(db, 'donations'),
      where('organizationId', '==', organizationId),
    );

    let querySnapshot;
    try {
      querySnapshot = await getDocs(orderedQuery);
    } catch (orderedErr: unknown) {
      const err = orderedErr as FirestoreErrorLike;
      if (err?.code !== 'failed-precondition') throw orderedErr;
      querySnapshot = await getDocs(fallbackQuery);
    }

    if (querySnapshot.empty) return [];
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching donations:', error);
    throw new Error('Failed to fetch donation data.');
  }
}

export async function getDonationsByKiosk(kioskId: string) {
  const q = query(collection(db, 'donations'), where('kioskId', '==', kioskId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data());
}
