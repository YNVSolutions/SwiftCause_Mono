import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Location } from '../../../entities/location/model';
import { getLocationsByOrgId } from '../../../entities/location/api/locationApi';

/**
 * Hook to fetch locations for an organization
 * Caches results and automatically refetches when organizationId changes
 */
export function useLocations(organizationId?: string) {
  const queryClient = useQueryClient();

  const {
    data: locations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['locations', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('organizationId is required to fetch locations');
      }
      return await getLocationsByOrgId(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'locations' && q.queryKey[1] === organizationId,
    });
  };

  return {
    locations: (locations || []) as Location[],
    loading: isLoading,
    error,
    refetch,
    refresh,
  };
}
