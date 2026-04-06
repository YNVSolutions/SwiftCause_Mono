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
  // Constraint order MUST be: where → where → orderBy → orderBy → limit → startAfter
  // Firestore rejects queries where where() follows orderBy()
  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  // Status where() must precede all orderBy() calls
  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }

  // Dual orderBy guarantees stable page boundaries even when names collide.
  // Without __name__, two kiosks with identical names can appear on both pages
  // or be skipped entirely depending on Firestore's internal ordering.
  constraints.push(
    orderBy('name', 'asc'),
    orderBy('__name__', 'asc'),
    limit(PAGE_SIZE + 1), // fetch one extra to detect next page without a count query
  );

  // startAfter uses the raw DocumentSnapshot — never a derived or manually built cursor
  // Only applied when navigating past page 1; omitting it returns from the beginning
  if (cursor) {
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
      limit(PAGE_SIZE + 1),
    );
    snapshot = await getDocs(fallbackQ);
  }

  // Empty result — safe defaults, no undefined access
  if (snapshot.empty) {
    return { kiosks: [], lastDoc: null, hasNextPage: false };
  }
  const hasNextPage = snapshot.docs.length > PAGE_SIZE;

  // Slice off the probe document before returning — it must never reach the UI
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  // Spread data() then override id — avoids blindly trusting Firestore field named 'id'
  const kiosks: Kiosk[] = docs.map(
    (d) =>
      ({
        ...d.data(),
        id: d.id,
      }) as Kiosk,
  );

  return {
    kiosks,
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
