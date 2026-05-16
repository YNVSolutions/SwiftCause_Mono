import { useAuth } from '../auth-provider';

export type SuperAdminAccessStatus = 'loading' | 'allowed' | 'unauthenticated' | 'forbidden';

export function checkSuperAdminAccess(
  userRole: string | null | undefined,
  isLoading: boolean,
): SuperAdminAccessStatus {
  if (isLoading) return 'loading';
  if (!userRole) return 'unauthenticated';
  if (userRole === 'super_admin') return 'allowed';
  return 'forbidden';
}

export function useRequireSuperAdmin(): SuperAdminAccessStatus {
  const { userRole, isLoadingAuth } = useAuth();
  return checkSuperAdminAccess(userRole, isLoadingAuth);
}
