import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { GiftAidDeclaration } from '../model';
import { PAGE_SIZE } from '../../../shared/lib/hooks/usePagination';

export interface GiftAidFilters {
  status?: string; // 'all' | 'captured' | 'exported'
  campaignId?: string; // campaign document id
  donationDate?: string; // YYYY-MM-DD
  searchTerm?: string;
}

export interface GiftAidPage {
  declarations: GiftAidDeclaration[];
  lastDoc: DocumentSnapshot | null;
  hasNextPage: boolean;
}

/**
 * Required Firestore composite indexes:
 *
 * Without status filter:
 *   Collection: giftAidDeclarations
 *   Fields: organizationId ASC, donationDate DESC, __name__ DESC
 *
 * With status/campaign/date filters:
 *   Collection: giftAidDeclarations
 *   Fields: organizationId ASC, operationalStatus ASC, campaignId ASC, donationDate DESC, __name__ DESC
 */
export async function fetchGiftAidPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: GiftAidFilters = {},
): Promise<GiftAidPage> {
  const normalizedSearch = (filters.searchTerm || '').trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  const matchesSearch = (declaration: GiftAidDeclaration): boolean => {
    if (!hasSearch) return true;
    const donorName = `${declaration.donorFirstName || ''} ${declaration.donorSurname || ''}`
      .trim()
      .toLowerCase();
    const campaignTitle = (declaration.campaignTitle || '').toLowerCase();
    return donorName.includes(normalizedSearch) || campaignTitle.includes(normalizedSearch);
  };

  const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      const seconds = (value as { seconds?: unknown }).seconds;
      if (typeof seconds === 'number') return seconds * 1000;
    }
    return 0;
  };

  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('operationalStatus', '==', filters.status));
  }
  if (filters.campaignId && filters.campaignId !== 'all') {
    constraints.push(where('campaignId', '==', filters.campaignId));
  }
  if (filters.donationDate) {
    // donationDate is stored as an ISO-like string; use prefix range for the selected day
    constraints.push(where('donationDate', '>=', filters.donationDate));
    constraints.push(where('donationDate', '<=', `${filters.donationDate}\uf8ff`));
  }

  constraints.push(orderBy('donationDate', 'desc'), orderBy('__name__', 'desc'));

  if (!hasSearch) {
    constraints.push(limit(PAGE_SIZE + 1));
  }

  if (cursor && !hasSearch) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'giftAidDeclarations'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'failed-precondition') throw err;
    const hasServerFilters =
      (filters.status && filters.status !== 'all') ||
      (filters.campaignId && filters.campaignId !== 'all') ||
      Boolean(filters.donationDate);
    if (hasServerFilters) {
      console.warn('fetchGiftAidPaginated: index not ready for filtered query, returning empty');
      return { declarations: [], lastDoc: null, hasNextPage: false };
    }
    const fallbackQ = query(
      collection(db, 'giftAidDeclarations'),
      where('organizationId', '==', organizationId),
    );
    snapshot = hasSearch
      ? await getDocs(fallbackQ)
      : await getDocs(query(fallbackQ, limit(PAGE_SIZE + 1)));
  }

  if (snapshot.empty) {
    return { declarations: [], lastDoc: null, hasNextPage: false };
  }

  if (hasSearch) {
    const sortedDocs = [...snapshot.docs].sort((a, b) => {
      const aMillis = toMillis((a.data() as { donationDate?: unknown }).donationDate);
      const bMillis = toMillis((b.data() as { donationDate?: unknown }).donationDate);
      if (aMillis !== bMillis) return bMillis - aMillis;
      return b.id.localeCompare(a.id);
    });
    const matchingDocs = sortedDocs.filter((docSnap) => {
      const declaration = {
        ...docSnap.data(),
        id: docSnap.id,
      } as GiftAidDeclaration;
      return matchesSearch(declaration);
    });
    const startIndex = cursor
      ? matchingDocs.findIndex((docSnap) => docSnap.id === cursor.id) + 1
      : 0;
    const docs = matchingDocs.slice(startIndex, startIndex + PAGE_SIZE);
    const hasNextPage = startIndex + PAGE_SIZE < matchingDocs.length;

    return {
      declarations: docs.map((d) => ({ ...d.data(), id: d.id }) as GiftAidDeclaration),
      lastDoc: docs[docs.length - 1] ?? null,
      hasNextPage,
    };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  const declarations: GiftAidDeclaration[] = docs.map(
    (d) =>
      ({
        ...d.data(),
        id: d.id,
      }) as GiftAidDeclaration,
  );

  return {
    declarations,
    lastDoc: docs[docs.length - 1] ?? null,
    hasNextPage,
  };
}
