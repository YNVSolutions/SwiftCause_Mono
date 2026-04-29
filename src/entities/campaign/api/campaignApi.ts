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
import { Campaign } from '../model';
import { PAGE_SIZE } from '../../../shared/lib/hooks/usePagination';

export interface CampaignFilters {
  status?: string;
  category?: string;
  dateRange?: 'all' | 'last30' | 'last90' | 'last365';
  searchTerm?: string;
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
  filters: CampaignFilters = {},
): Promise<CampaignPage> {
  const normalizedSearch = (filters.searchTerm || '').trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const hasDateRange = Boolean(filters.dateRange && filters.dateRange !== 'all');
  const hasInMemoryFilters = hasSearch || hasDateRange;

  const getDateRangeStart = (range?: CampaignFilters['dateRange']): Date | null => {
    if (!range || range === 'all') return null;
    const today = new Date();
    switch (range) {
      case 'last30':
        return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'last90':
        return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'last365':
        return new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  };

  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === 'object' && value !== null) {
      if (typeof (value as { toDate?: unknown }).toDate === 'function') {
        const dateValue = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(dateValue.getTime()) ? null : dateValue;
      }
      if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
        const dateValue = new Date((value as { seconds: number }).seconds * 1000);
        return Number.isNaN(dateValue.getTime()) ? null : dateValue;
      }
    }
    return null;
  };

  const toMillis = (value: unknown): number => {
    const dateValue = toDate(value);
    return dateValue ? dateValue.getTime() : 0;
  };

  const matchesSearch = (campaign: Campaign): boolean => {
    if (!hasSearch) return true;
    const title = (campaign.title || '').toLowerCase();
    const description = (campaign.description || '').toLowerCase();
    const tags = Array.isArray(campaign.tags)
      ? campaign.tags.map((tag) => String(tag).toLowerCase())
      : [];
    return (
      title.includes(normalizedSearch) ||
      description.includes(normalizedSearch) ||
      tags.some((tag) => tag.includes(normalizedSearch))
    );
  };

  const dateRangeStart = getDateRangeStart(filters.dateRange);
  const matchesDateRange = (campaign: Campaign): boolean => {
    if (!dateRangeStart) return true;
    const campaignEndDate = toDate(campaign.endDate);
    return !campaignEndDate || campaignEndDate >= dateRangeStart;
  };

  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.status && filters.status !== 'all') {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.category && filters.category !== 'all') {
    constraints.push(where('category', '==', filters.category));
  }

  constraints.push(orderBy('createdAt', 'desc'), orderBy('__name__', 'desc'));

  if (!hasInMemoryFilters) {
    constraints.push(limit(PAGE_SIZE + 1));
  }

  if (cursor && !hasInMemoryFilters) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'campaigns'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'failed-precondition') throw err;
    const hasIndexedFilters =
      (filters.status && filters.status !== 'all') ||
      (filters.category && filters.category !== 'all');
    if (hasIndexedFilters) {
      console.warn('fetchCampaignsPaginated: index not ready for filtered query, returning empty');
      return { campaigns: [], lastDoc: null, hasNextPage: false };
    }
    const fallbackQ = query(
      collection(db, 'campaigns'),
      where('organizationId', '==', organizationId),
    );
    snapshot = hasInMemoryFilters
      ? await getDocs(fallbackQ)
      : await getDocs(query(fallbackQ, limit(PAGE_SIZE + 1)));
  }

  if (snapshot.empty) {
    return { campaigns: [], lastDoc: null, hasNextPage: false };
  }

  if (hasInMemoryFilters) {
    const sortedDocs = [...snapshot.docs].sort((a, b) => {
      const aMillis = toMillis((a.data() as { createdAt?: unknown }).createdAt);
      const bMillis = toMillis((b.data() as { createdAt?: unknown }).createdAt);
      if (aMillis !== bMillis) return bMillis - aMillis;
      return b.id.localeCompare(a.id);
    });
    const matchingDocs = sortedDocs.filter((docSnap) => {
      const campaign = { ...docSnap.data(), id: docSnap.id } as Campaign;
      return matchesSearch(campaign) && matchesDateRange(campaign);
    });
    const startIndex = cursor
      ? matchingDocs.findIndex((docSnap) => docSnap.id === cursor.id) + 1
      : 0;
    const docs = matchingDocs.slice(startIndex, startIndex + PAGE_SIZE);
    const hasNextPage = startIndex + PAGE_SIZE < matchingDocs.length;
    return {
      campaigns: docs.map((d) => ({ ...d.data(), id: d.id }) as Campaign),
      lastDoc: docs[docs.length - 1] ?? null,
      hasNextPage,
    };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  return {
    campaigns: docs.map((d) => ({ ...d.data(), id: d.id }) as Campaign),
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
          orderBy('createdAt', 'desc'),
        );
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Campaign,
      );
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
          ...docSnap.data(),
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
        status: 'active',
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
      return campaigns.filter(
        (campaign) => campaign.isGlobal || campaign.assignedKiosks?.includes(kioskId),
      );
    } catch (error) {
      console.error('Error fetching campaigns for kiosk:', error);
      throw error;
    }
  },
};
