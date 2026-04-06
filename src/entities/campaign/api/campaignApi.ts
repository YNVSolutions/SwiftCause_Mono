import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, deleteDoc, orderBy,
  limit, startAfter, DocumentSnapshot, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { Campaign } from '../model';
import { PAGE_SIZE } from '../../../shared/lib/hooks/usePagination';

export interface CampaignFilters {
  status?: string;
}

export interface CampaignPage {
  campaigns: Campaign[];
  lastDoc: DocumentSnapshot | null;
  hasNextPage: boolean;
}

/**
 * Required Firestore composite indexes:
 *
 * Without filters:
 *   Collection: campaigns
 *   Fields: organizationId ASC, createdAt DESC, __name__ DESC
 *
 * With status filter:
 *   Collection: campaigns
 *   Fields: organizationId ASC, status ASC, createdAt DESC, __name__ DESC
 */
export async function fetchCampaignsPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: CampaignFilters = {}
): Promise<CampaignPage> {
  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'desc'),
    limit(PAGE_SIZE + 1),
  );

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'campaigns'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'failed-precondition') throw err;
    if (filters.status && filters.status !== 'all') {
      console.warn('fetchCampaignsPaginated: index not ready for filtered query, returning empty');
      return { campaigns: [], lastDoc: null, hasNextPage: false };
    }
    const fallbackQ = query(
      collection(db, 'campaigns'),
      where('organizationId', '==', organizationId),
      limit(PAGE_SIZE + 1),
    );
    snapshot = await getDocs(fallbackQ);
  }

  if (snapshot.empty) {
    return { campaigns: [], lastDoc: null, hasNextPage: false };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  return {
    campaigns: docs.map(d => ({ ...d.data(), id: d.id } as Campaign)),
    lastDoc: docs[docs.length - 1] ?? null,
    hasNextPage,
  };
}

export const campaignApi = {
  // Get all campaigns
  async getCampaigns(organizationId?: string): Promise<Campaign[]> {
    try {
      let q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
      
      if (organizationId) {
        q = query(
          collection(db, 'campaigns'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Campaign));
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  },

  // Get campaign by ID
  async getCampaignById(id: string): Promise<Campaign | null> {
    try {
      const docRef = doc(db, 'campaigns', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as Campaign;
      }
      return null;
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw error;
    }
  },

  // Create new campaign
  async createCampaign(campaign: Omit<Campaign, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'campaigns'), {
        ...campaign,
        createdAt: new Date().toISOString(),
        status: 'active'
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  },

  // Update campaign
  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
    try {
      const docRef = doc(db, 'campaigns', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  },

  // Delete campaign
  async deleteCampaign(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'campaigns', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  },

  // Get campaigns for kiosk
  async getCampaignsForKiosk(kioskId: string, organizationId?: string): Promise<Campaign[]> {
    try {
      const campaigns = await this.getCampaigns(organizationId);
      return campaigns.filter(campaign => 
        campaign.isGlobal || campaign.assignedKiosks?.includes(kioskId)
      );
    } catch (error) {
      console.error('Error fetching campaigns for kiosk:', error);
      throw error;
    }
  }
};
