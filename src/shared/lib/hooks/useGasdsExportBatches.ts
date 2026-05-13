import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGasdsExportBatchesPaginated } from '../../../entities/giftAid/api';
import { usePagination } from './usePagination';

const DEFAULT_GASDS_EXPORT_HISTORY_PAGE_SIZE = 5;

export function useGasdsExportBatches(
  organizationId?: string,
  pageSize = DEFAULT_GASDS_EXPORT_HISTORY_PAGE_SIZE,
) {
  const pagination = usePagination();
  const queryClient = useQueryClient();

  useEffect(() => {
    pagination.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const queryKey = [
    'gasds-export-batches',
    organizationId,
    pagination.currentCursor?.id ?? 'page-1',
    pageSize,
  ] as const;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () => {
      if (!organizationId) throw new Error('organizationId is required');
      return fetchGasdsExportBatchesPaginated(organizationId, pagination.currentCursor, pageSize);
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
    console.error('[useGasdsExportBatches]', error);
  }

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] === 'gasds-export-batches' && q.queryKey[1] === organizationId,
    });
  }, [queryClient, organizationId]);

  const goFirst = useCallback(() => {
    pagination.reset();
  }, [pagination]);

  return {
    exportBatches: data?.batches ?? [],
    loading: isLoading,
    fetching: isFetching,
    error: error ? 'Failed to load GASDS export history. Please try again.' : null,
    pageNumber: pagination.pageNumber,
    canGoNext: pagination.canGoNext,
    canGoPrev: pagination.canGoPrev,
    goFirst,
    goNext: pagination.goNext,
    goPrev: pagination.goPrev,
    pageSize,
    refresh,
  };
}
