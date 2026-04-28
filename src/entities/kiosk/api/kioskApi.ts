import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { Kiosk } from '../model';
import { removeKioskFromAllCampaigns } from '../../../shared/lib/sync/campaignKioskSync';
import { PAGE_SIZE } from '../../../shared/lib/hooks/usePagination';

export interface KioskFilters {
  status?: 'all' | 'online' | 'offline' | 'maintenance';
  searchTerm?: string;
}

export interface KioskPage {
  kiosks: Kiosk[];
  lastDoc: DocumentSnapshot | null;
  hasNextPage: boolean;
}

/**
 * Required Firestore composite indexes:
 *
 * Without status filter:
 *   Collection: kiosks
 *   Fields: organizationId ASC, name ASC, __name__ ASC
 *
 * With status filter:
 *   Collection: kiosks
 *   Fields: organizationId ASC, status ASC, name ASC, __name__ ASC
 */
export async function fetchKiosksPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: KioskFilters = {},
): Promise<KioskPage> {
  const normalizedSearch = (filters.searchTerm || '').trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;

  const normalizeKiosk = (d: QueryDocumentSnapshot): Kiosk =>
    ({
      ...d.data(),
      id: d.id,
    }) as Kiosk;

  const matchesSearch = (kiosk: Kiosk): boolean => {
    if (!hasSearch) return true;
    const name = (kiosk.name || '').toLowerCase();
    const location = (kiosk.location || '').toLowerCase();
    const id = (kiosk.id || '').toLowerCase();
    return (
      name.includes(normalizedSearch) ||
      location.includes(normalizedSearch) ||
      id.includes(normalizedSearch)
    );
  };

  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('name', 'asc'), orderBy('__name__', 'asc'));

  if (!hasSearch) {
    constraints.push(limit(PAGE_SIZE + 1));
  }

  if (cursor && !hasSearch) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'kiosks'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'failed-precondition') throw err;
    if (filters.status && filters.status !== 'all') {
      console.warn('fetchKiosksPaginated: index not ready for filtered query, returning empty');
      return { kiosks: [], lastDoc: null, hasNextPage: false };
    }

    const fallbackQ = query(
      collection(db, 'kiosks'),
      where('organizationId', '==', organizationId),
    );
    snapshot = hasSearch
      ? await getDocs(fallbackQ)
      : await getDocs(query(fallbackQ, limit(PAGE_SIZE + 1)));
  }

  if (snapshot.empty) {
    return { kiosks: [], lastDoc: null, hasNextPage: false };
  }

  if (hasSearch) {
    const sortedDocs = [...snapshot.docs].sort((a, b) => {
      const nameA = ((a.data() as { name?: string }).name || '').toLowerCase();
      const nameB = ((b.data() as { name?: string }).name || '').toLowerCase();
      const nameComparison = nameA.localeCompare(nameB);
      if (nameComparison !== 0) return nameComparison;
      return a.id.localeCompare(b.id);
    });
    const matchingDocs = sortedDocs.filter((docSnap) => matchesSearch(normalizeKiosk(docSnap)));
    const startIndex = cursor
      ? matchingDocs.findIndex((docSnap) => docSnap.id === cursor.id) + 1
      : 0;
    const docs = matchingDocs.slice(startIndex, startIndex + PAGE_SIZE);
    const hasNextPage = startIndex + PAGE_SIZE < matchingDocs.length;

    return {
      kiosks: docs.map((d) => normalizeKiosk(d)),
      lastDoc: docs[docs.length - 1] ?? null,
      hasNextPage,
    };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  return {
    kiosks: docs.map((d) => normalizeKiosk(d)),
    lastDoc: docs[docs.length - 1] ?? null,
    hasNextPage,
  };
}

export const kioskApi = {
  // Get all kiosks
  async getKiosks(organizationId?: string): Promise<Kiosk[]> {
    try {
      let q;

      if (organizationId) {
        // When filtering by organizationId, don't use orderBy to avoid needing a composite index
        q = query(collection(db, 'kiosks'), where('organizationId', '==', organizationId));
      } else {
        q = query(collection(db, 'kiosks'), orderBy('name', 'asc'));
      }

      const querySnapshot = await getDocs(q);
      const kiosks = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Kiosk,
      );

      // Sort in memory when filtering by organizationId
      if (organizationId) {
        kiosks.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      return kiosks;
    } catch (error) {
      console.error('Error fetching kiosks:', error);
      throw error;
    }
  },

  // Get kiosk by ID
  async getKioskById(id: string): Promise<Kiosk | null> {
    try {
      const docRef = doc(db, 'kiosks', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Kiosk;
      }
      return null;
    } catch (error) {
      console.error('Error fetching kiosk:', error);
      throw error;
    }
  },

  // Create new kiosk
  async createKiosk(kiosk: Omit<Kiosk, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'kiosks'), {
        ...kiosk,
        status: 'offline',
        totalDonations: 0,
        totalRaised: 0,
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating kiosk:', error);
      throw error;
    }
  },

  // Update kiosk
  async updateKiosk(id: string, updates: Partial<Kiosk>): Promise<void> {
    try {
      const docRef = doc(db, 'kiosks', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating kiosk:', error);
      throw error;
    }
  },

  // Delete kiosk
  async deleteKiosk(id: string): Promise<void> {
    try {
      // Fetch the kiosk to get its assigned campaigns before deleting
      const docRef = doc(db, 'kiosks', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const assignedCampaigns: string[] = snap.data().assignedCampaigns || [];
        if (assignedCampaigns.length > 0) {
          await removeKioskFromAllCampaigns(id, assignedCampaigns);
        }
      }
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting kiosk:', error);
      throw error;
    }
  },

  // Update kiosk status
  async updateKioskStatus(id: string, status: Kiosk['status']): Promise<void> {
    try {
      const docRef = doc(db, 'kiosks', id);
      await updateDoc(docRef, {
        status,
        lastActive: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating kiosk status:', error);
      throw error;
    }
  },
};
