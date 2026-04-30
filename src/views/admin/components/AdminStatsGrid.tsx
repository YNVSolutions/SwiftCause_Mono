import React from 'react';

interface AdminStatsGridProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminStatsGrid({
  children,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6',
}: AdminStatsGridProps) {
  return <div className={className}>{children}</div>;
}
