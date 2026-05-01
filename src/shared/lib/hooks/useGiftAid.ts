import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchGiftAidPaginated,
  GiftAidFilters,
} from '../../../entities/giftAid/api/giftAidPaginatedApi';
import { usePagination, PAGE_SIZE } from './usePagination';

export function useGiftAid(organizationId?: string, filters: GiftAidFilters = {}) {
  const pagination = usePagination();
  const queryClient = useQueryClient();

  const statusKey = filters.status ?? 'all';
  const campaignKey = filters.campaignId ?? 'all';
  const donationDateKey = filters.donationDate ?? 'all';
  const searchKey = (filters.searchTerm ?? '').trim().toLowerCase() || 'all';

  // Reset to page 1 whenever filters or org change
  useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, campaignKey, donationDateKey, searchKey, organizationId]);

  const queryKey = [
    'gift-aid',
    organizationId,
    pagination.currentCursor?.id ?? 'page-1',
    statusKey,
    campaignKey,
    donationDateKey,
    searchKey,
  ] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required');
      return fetchGiftAidPaginated(organizationId, pagination.currentCursor, filters);
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
    console.error('[useGiftAid]', error);
  }

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'gift-aid' && q.queryKey[1] === organizationId,
    });
  }, [queryClient, organizationId]);

  return {
    declarations: data?.declarations ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? 'Failed to load Gift Aid declarations. Please try again.' : null,
    pageNumber: pagination.pageNumber,
    canGoNext: pagination.canGoNext,
    canGoPrev: pagination.canGoPrev,
    goNext: pagination.goNext,
    goPrev: pagination.goPrev,
    pageSize: PAGE_SIZE,
    refresh,
  };
}
