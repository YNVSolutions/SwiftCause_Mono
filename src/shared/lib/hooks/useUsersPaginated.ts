import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchUsersPaginated, UserFilters } from '../../../entities/user/api/userApi';
import { usePagination, PAGE_SIZE } from './usePagination';

export function useUsersPaginated(organizationId?: string, filters: UserFilters = {}) {
  const pagination = usePagination();
  const queryClient = useQueryClient();

  const roleKey = filters.role ?? 'all';
  const searchKey = (filters.searchTerm ?? '').trim().toLowerCase() || 'all';

  useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleKey, searchKey, organizationId]);

  const queryKey = [
    'users-paginated',
    organizationId,
    pagination.currentCursor?.id ?? 'page-1',
    roleKey,
    searchKey,
  ] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required');
      return fetchUsersPaginated(organizationId, pagination.currentCursor, filters);
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
    console.error('[useUsersPaginated]', error);
  }

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'users-paginated' && q.queryKey[1] === organizationId,
    });
  }, [queryClient, organizationId]);

  return {
    users: data?.users ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? 'Failed to load users. Please try again.' : null,
    pageNumber: pagination.pageNumber,
    canGoNext: pagination.canGoNext,
    canGoPrev: pagination.canGoPrev,
    goNext: pagination.goNext,
    goPrev: pagination.goPrev,
    pageSize: PAGE_SIZE,
    refresh,
  };
}
