'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/lib/auth-provider';
import { ApprovalsPlaceholder } from '@/views/admin/ApprovalsPlaceholder';

export default function AdminApprovalsPage() {
  const router = useRouter();
  const { currentAdminSession, hasPermission, handleLogout } = useAuth();

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
    <ApprovalsPlaceholder
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userSession={currentAdminSession}
      hasPermission={hasPermission}
    />
  );
}
