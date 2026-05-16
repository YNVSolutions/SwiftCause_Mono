'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/lib/auth-provider';
import { ApprovalsPlaceholder } from '@/views/admin/ApprovalsPlaceholder';
import { Loader } from '@/shared/ui/Loader';
import { Screen } from '@/shared/types';

export default function AdminApprovalsPage() {
  const router = useRouter();
  const { currentAdminSession, hasPermission, handleLogout } = useAuth();

  const handleNavigate = (screen: Screen) => {
    if (screen === 'admin' || screen === 'admin-dashboard') {
      router.push('/admin');
    } else {
      router.push(`/admin/${screen.replace('admin-', '')}`);
    }
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
