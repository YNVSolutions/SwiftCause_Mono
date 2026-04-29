import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  className = 'text-center py-8 text-gray-500',
}: AdminEmptyStateProps) {
  return (
    <div className={className}>
      <Icon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
      <p className="text-lg font-medium mb-2">{title}</p>
      {description ? <p className="text-sm mb-4">{description}</p> : null}
    </div>
  );
}
