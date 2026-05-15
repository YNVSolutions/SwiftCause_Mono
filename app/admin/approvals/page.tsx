'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/lib/auth-provider';
import { ApprovalsPlaceholder } from '@/views/admin/ApprovalsPlaceholder';
import { Loader } from '@/shared/ui/Loader';
import { Screen } from '@/shared/types';

const ADMIN_ROUTES: Partial<Record<Screen, string>> = {
  admin: '/admin',
  'admin-dashboard': '/admin',
  'admin-campaigns': '/admin/campaigns',
  'admin-kiosks': '/admin/kiosks',
  'admin-donations': '/admin/donations',
  'admin-subscriptions': '/admin/subscriptions',
  'admin-gift-aid': '/admin/gift-aid',
  'admin-users': '/admin/users',
  'admin-bank-details': '/admin/bank-details',
  'admin-organization-settings': '/admin/organization-settings',
  'admin-stripe-account': '/admin/stripe-account',
  'admin-approvals': '/admin/approvals',
};

export default function AdminApprovalsPage() {
  const router = useRouter();
  const { currentAdminSession, hasPermission, handleLogout } = useAuth();

  const handleNavigate = (screen: Screen) => {
    const route = ADMIN_ROUTES[screen];
    if (route) router.push(route);
  };

  if (!currentAdminSession) {
    return <Loader />;
  }

  return (
    <ApprovalsPlaceholder
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userSession={currentAdminSession}
      hasPermission={hasPermission}
    />
  );
}
