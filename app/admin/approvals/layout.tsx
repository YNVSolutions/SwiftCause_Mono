'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useRequireSuperAdmin,
  SuperAdminAccessStatus,
} from '@/shared/lib/guards/requireSuperAdmin';
import { Loader } from '@/shared/ui/Loader';

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useRequireSuperAdmin();
  // Defer access decisions to after an effect confirms the status, preventing
  // React 18 concurrent renders from flashing a stale 'forbidden' state.
  const [confirmedStatus, setConfirmedStatus] = useState<SuperAdminAccessStatus>('loading');

  useEffect(() => {
    setConfirmedStatus(status);
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (confirmedStatus === 'loading' || confirmedStatus === 'unauthenticated') {
    return <Loader />;
  }

  if (confirmedStatus === 'forbidden') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-6xl font-bold text-gray-300">403</p>
          <h1 className="mt-4 text-2xl font-semibold text-gray-800">Access denied</h1>
          <p className="mt-2 text-gray-500">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
