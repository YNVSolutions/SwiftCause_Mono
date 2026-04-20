'use client';

import { useRouter } from 'next/navigation';
import { OrganizationSettings } from '@/views/admin/OrganizationSettings';
import { useAuth } from '@/shared/lib/auth-provider';

export default function AdminOrganizationSettingsPage() {
  const router = useRouter();
  const { currentAdminSession, hasPermission, handleLogout, handleOrganizationSwitch } = useAuth();

  const handleNavigate = (screen: string) => {
    if (screen === 'admin' || screen === 'admin-dashboard') {
      router.push('/admin');
    } else {
      const route = screen.replace('admin-', '');
      router.push(`/admin/${route}`);
    }
  };

  if (!currentAdminSession) {
    return null;
  }

  return (
    <OrganizationSettings
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userSession={currentAdminSession}
      hasPermission={hasPermission}
      onOrganizationSwitch={handleOrganizationSwitch}
    />
  );
}
