'use client';

import { Screen, AdminSession, Permission } from '../../shared/types';
import { AdminLayout } from './AdminLayout';
import { ClipboardCheck } from 'lucide-react';

interface ApprovalsPlaceholderProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

export function ApprovalsPlaceholder({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: ApprovalsPlaceholderProps) {
  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      activeScreen="admin-approvals"
      headerTitle="Approvals"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <ClipboardCheck className="h-12 w-12 text-gray-300" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold text-gray-700">Approvals — coming soon</h1>
        <p className="max-w-sm text-sm text-gray-400">
          The charity approval queue will appear here. Check back once the next phase is complete.
        </p>
      </div>
    </AdminLayout>
  );
}
