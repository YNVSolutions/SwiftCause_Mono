import {
  collection, query, where, orderBy, limit, startAfter,
  getDocs, DocumentSnapshot, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { GiftAidDeclaration } from '../model';
import { PAGE_SIZE } from '../../../shared/lib/hooks/usePagination';

export interface GiftAidFilters {
  status?: string; // 'all' | 'captured' | 'exported'
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
 * With status filter:
 *   Collection: giftAidDeclarations
 *   Fields: organizationId ASC, operationalStatus ASC, donationDate DESC, __name__ DESC
 */
export async function fetchGiftAidPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: GiftAidFilters = {}
): Promise<GiftAidPage> {
  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('operationalStatus', '==', filters.status));
  }

  constraints.push(
    orderBy('donationDate', 'desc'),
    orderBy('__name__', 'desc'),
    limit(PAGE_SIZE + 1),
  );

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'giftAidDeclarations'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'failed-precondition') throw err;
    if (filters.status && filters.status !== 'all') {
      console.warn('fetchGiftAidPaginated: index not ready for filtered query, returning empty');
      return { declarations: [], lastDoc: null, hasNextPage: false };
    }
    const fallbackQ = query(
      collection(db, 'giftAidDeclarations'),
      where('organizationId', '==', organizationId),
      limit(PAGE_SIZE + 1),
    );
    snapshot = await getDocs(fallbackQ);
  }

  if (snapshot.empty) {
    return { declarations: [], lastDoc: null, hasNextPage: false };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  const declarations: GiftAidDeclaration[] = docs.map(d => ({
    ...d.data(),
    id: d.id,
  } as GiftAidDeclaration));

  return {
    declarations,
    lastDoc: docs[docs.length - 1] ?? null,
    hasNextPage,
  };
}
