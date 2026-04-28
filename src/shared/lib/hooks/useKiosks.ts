import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchKiosksPaginated, KioskFilters } from '../../../entities/kiosk/api/kioskApi';
import { usePagination, PAGE_SIZE } from './usePagination';

export function useKiosks(organizationId?: string, filters: KioskFilters = {}) {
  const pagination = usePagination();
  const queryClient = useQueryClient();

  // Stable primitive key â€” no objects, no JSON.stringify, no identity churn
  const statusKey = filters.status ?? 'all';
  const searchKey = (filters.searchTerm ?? '').trim().toLowerCase() || 'all';

  // Reset pagination ONLY when org or filter changes â€” prevents cursor reuse across query states
  useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, searchKey, organizationId]);

  // All segments are primitives â€” cursor.id is a string, statusKey is a string
  // This key changes correctly whenever cursor, filters, or org changes
  const queryKey = [
    'kiosks',
    organizationId,
    pagination.currentCursor?.id ?? 'page-1',
    statusKey,
    searchKey,
  ] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => {
      // Hard guard â€” enabled ensures this never runs, but we throw defensively
      // so queryFn never silently executes with invalid input
      if (!organizationId) {
        throw new Error('organizationId is required to fetch kiosks');
      }
      return fetchKiosksPaginated(organizationId, pagination.currentCursor, filters);
    },
    // Query is disabled entirely when organizationId is missing â€” aligned with queryFn guard
    enabled: !!organizationId,
    // Keeps previous page visible while next page loads â€” prevents flicker on navigation
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Sync pagination state after each successful fetch
  // Rapid "Next" clicks are safe â€” goNext is guarded by canGoNext in usePagination,
  // and queryKey reflects the cursor at the time of the click, so no stale cursor leaks
  useEffect(() => {
    if (data) {
      pagination.updatePage({
        lastDoc: data.lastDoc,
        hasNextPage: data.hasNextPage,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (process.env.NODE_ENV !== 'production' && error) {
    console.error('[useKiosks]', error);
  }

  // Predicate-based invalidation â€” only invalidates kiosk queries for this org,
  // leaving all other cached queries (campaigns, users, donations) untouched
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'kiosks' && q.queryKey[1] === organizationId,
    });
  }, [queryClient, organizationId]);

  return {
    kiosks: data?.kiosks ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? 'Failed to load kiosks. Please try again.' : null,
    pageNumber: pagination.pageNumber,
    canGoNext: pagination.canGoNext,
    canGoPrev: pagination.canGoPrev,
    goNext: pagination.goNext,
    goPrev: pagination.goPrev,
    pageSize: PAGE_SIZE,
    refresh,
  };
}
