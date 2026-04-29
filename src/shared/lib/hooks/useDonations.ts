import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDonationsPaginated } from './donationsService';
import { DonationFilters } from '../../api/legacy/donationsApi';
import { usePagination, PAGE_SIZE } from './usePagination';

export function useDonations(organizationId?: string, filters: DonationFilters = {}) {
  const pagination = usePagination();
  const queryClient = useQueryClient();

  // Stable primitive keys â€” no objects in query key
  const statusKey = filters.status ?? 'all';
  const campaignKey = filters.campaignId ?? 'all';
  const recurringKey =
    filters.isRecurring === undefined ? 'all' : filters.isRecurring ? 'recurring' : 'one_time';
  const dateKey = filters.donationDate ?? 'all';
  const searchKey = (filters.searchTerm ?? '').trim().toLowerCase() || 'all';

  useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, campaignKey, recurringKey, dateKey, searchKey, organizationId]);

  const queryKey = [
    'donations',
    organizationId,
    pagination.currentCursor?.id ?? 'page-1',
    statusKey,
    campaignKey,
    recurringKey,
    dateKey,
    searchKey,
  ] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required');
      return getDonationsPaginated(organizationId, pagination.currentCursor, filters);
    },
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data) {
      pagination.updatePage({ lastDoc: data.lastDoc, hasNextPage: data.hasNextPage });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (process.env.NODE_ENV !== 'production' && error) {
    console.error('[useDonations]', error);
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'donations' && q.queryKey[1] === organizationId,
    });
  }, [queryClient, organizationId]);

  return {
    donations: data?.data ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? 'Failed to load donations. Please try again.' : null,
    pageNumber: pagination.pageNumber,
    canGoNext: pagination.canGoNext,
    canGoPrev: pagination.canGoPrev,
    goNext: pagination.goNext,
    goPrev: pagination.goPrev,
    pageSize: PAGE_SIZE,
    refresh,
  };
}
