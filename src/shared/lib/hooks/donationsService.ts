import {
  fetchAllDonations,
  fetchDonationsPaginated,
  DonationFilters,
} from '../../api/legacy/donationsApi';
import { Donation } from '../../types';
import { DocumentData } from 'firebase/firestore';
import { DocumentSnapshot } from 'firebase/firestore';

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
};

function formatTimestamp(timestamp: TimestampLike | Date | string | null | undefined): string {
  if (!timestamp) return '';
  if (typeof (timestamp as TimestampLike).toDate === 'function') {
    return (timestamp as TimestampLike).toDate!().toISOString();
  }
  if (typeof (timestamp as TimestampLike).seconds === 'number') {
    return new Date((timestamp as TimestampLike).seconds! * 1000).toISOString();
  }
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  return '';
}

// Full fetch — used for CSV export only
export async function getDonations(organizationId: string): Promise<Donation[]> {
  try {
    const rawDonations = await fetchAllDonations(organizationId);
    return rawDonations.map((d: DocumentData) => ({
      ...d,
      timestamp: formatTimestamp(d.timestamp as TimestampLike | string),
    })) as Donation[];
  } catch (error) {
    console.error('Error in donations service:', error);
    throw new Error('Could not retrieve donation data. Please try again.');
  }
}

// Paginated fetch — used for the admin table
export async function getDonationsPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: DonationFilters = {},
) {
  const result = await fetchDonationsPaginated(organizationId, cursor, filters);
  return {
    ...result,
    data: result.data.map((d: DocumentData) => ({
      ...d,
      timestamp: formatTimestamp(d.timestamp as TimestampLike | string),
    })) as Donation[],
  };
}
