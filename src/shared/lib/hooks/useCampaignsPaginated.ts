import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCampaignsPaginated,
  CampaignFilters,
} from '../../../entities/campaign/api/campaignApi';
import { usePagination, PAGE_SIZE } from './usePagination';

export function useCampaignsPaginated(organizationId?: string, filters: CampaignFilters = {}) {
  const pagination = usePagination();
  const queryClient = useQueryClient();

  const statusKey = filters.status ?? 'all';
  const categoryKey = filters.category ?? 'all';
  const dateRangeKey = filters.dateRange ?? 'all';
  const searchKey = (filters.searchTerm ?? '').trim().toLowerCase() || 'all';

  useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, categoryKey, dateRangeKey, searchKey, organizationId]);

  const queryKey = [
    'campaigns-paginated',
    organizationId,
    pagination.currentCursor?.id ?? 'page-1',
    statusKey,
    categoryKey,
    dateRangeKey,
    searchKey,
  ] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required');
      return fetchCampaignsPaginated(organizationId, pagination.currentCursor, filters);
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
    console.error('[useCampaignsPaginated]', error);
  }

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'campaigns-paginated' && q.queryKey[1] === organizationId,
    });
  }, [queryClient, organizationId]);

  return {
    campaigns: data?.campaigns ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? 'Failed to load campaigns. Please try again.' : null,
    pageNumber: pagination.pageNumber,
    canGoNext: pagination.canGoNext,
    canGoPrev: pagination.canGoPrev,
    goNext: pagination.goNext,
    goPrev: pagination.goPrev,
    pageSize: PAGE_SIZE,
    refresh,
  };
}
