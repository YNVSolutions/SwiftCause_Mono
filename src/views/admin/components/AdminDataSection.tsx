import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { AdminSearchFilterConfig, AdminSearchFilterHeader } from './AdminSearchFilterHeader';

interface AdminDataSectionProps {
  title: string;
  description: string;
  config: AdminSearchFilterConfig;
  filterValues: Record<string, unknown>;
  onFilterChange: (key: string, value: unknown) => void;
  summaryText?: React.ReactNode;
  actions?: React.ReactNode;
  showMobileActions?: boolean;
  filterGridClassName?: string;
  wrapperClassName?: string;
  cardClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function AdminDataSection({
  title,
  description,
  config,
  filterValues,
  onFilterChange,
  summaryText,
  actions,
  showMobileActions = true,
  filterGridClassName,
  wrapperClassName,
  cardClassName = 'rounded-3xl border border-gray-100 shadow-sm',
  contentClassName,
  children,
}: AdminDataSectionProps) {
  return (
    <Card className={cardClassName}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={contentClassName}>
        <AdminSearchFilterHeader
          config={config}
          filterValues={filterValues}
          onFilterChange={onFilterChange}
          actions={actions}
          showMobileActions={showMobileActions}
          filterGridClassName={filterGridClassName}
          wrapperClassName={wrapperClassName}
          summaryText={summaryText}
        />
        {children}
      </CardContent>
    </Card>
  );
}
