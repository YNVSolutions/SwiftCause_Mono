import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { AdminSearchFilterConfig, AdminSearchFilterHeader } from './AdminSearchFilterHeader';
import { AdminRefreshButton } from './AdminRefreshButton';

interface AdminDataSectionProps {
  title: string;
  description: string;
  config: AdminSearchFilterConfig;
  filterValues: Record<string, unknown>;
  onFilterChange: (key: string, value: unknown) => void;
  summaryText?: React.ReactNode;
  actions?: React.ReactNode;
  onRefresh?: () => void | Promise<unknown>;
  refreshing?: boolean;
  showRefresh?: boolean;
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
  onRefresh,
  refreshing = false,
  showRefresh = true,
  showMobileActions = true,
  filterGridClassName,
  wrapperClassName,
  cardClassName = 'rounded-3xl border border-gray-100 shadow-sm',
  contentClassName,
  children,
}: AdminDataSectionProps) {
  const [isManualRefreshActive, setIsManualRefreshActive] = useState(false);
  const [isRefreshPending, setIsRefreshPending] = useState(false);
  const isRefreshing = refreshing || isRefreshPending;

  const handleRefresh = useCallback(() => {
    if (!onRefresh || isRefreshing) return;
    setIsManualRefreshActive(true);
    try {
      const result = onRefresh();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setIsRefreshPending(true);
        void (result as Promise<unknown>).finally(() => {
          setIsRefreshPending(false);
        });
      }
    } catch {
      setIsRefreshPending(false);
    }
  }, [onRefresh, isRefreshing]);

  useEffect(() => {
    if (!isManualRefreshActive) return;
    if (isRefreshing) return;

    const timeout = window.setTimeout(() => {
      setIsManualRefreshActive(false);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [isManualRefreshActive, isRefreshing]);

  const shouldShowRefresh = Boolean(onRefresh && showRefresh);
  const desktopRefreshAction = shouldShowRefresh ? (
    <AdminRefreshButton onRefresh={handleRefresh} refreshing={isRefreshing} />
  ) : null;
  const mobileRefreshAction = shouldShowRefresh ? (
    <AdminRefreshButton onRefresh={handleRefresh} refreshing={isRefreshing} />
  ) : null;
  const desktopActions =
    desktopRefreshAction && actions ? (
      <>
        {desktopRefreshAction}
        {actions}
      </>
    ) : (
      (desktopRefreshAction ?? actions)
    );

  return (
    <Card className={cardClassName}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {mobileRefreshAction ? <div className="sm:hidden">{mobileRefreshAction}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>
        <AdminSearchFilterHeader
          config={config}
          filterValues={filterValues}
          onFilterChange={onFilterChange}
          actions={desktopActions}
          mobileActions={actions ?? null}
          showMobileActions={showMobileActions}
          filterGridClassName={filterGridClassName}
          wrapperClassName={wrapperClassName}
          summaryText={summaryText}
        />
        <div className="relative">
          {isManualRefreshActive ? (
            <div className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-white/45 backdrop-blur-[1px]">
              <div className="absolute left-4 top-3 flex items-center gap-2 rounded-md border border-gray-200 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 shadow-sm">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 border-t-emerald-600 motion-safe:animate-spin" />
                <span>Refreshing data...</span>
              </div>
            </div>
          ) : null}
          <div
            className={
              isManualRefreshActive
                ? 'transition-opacity duration-200 opacity-70'
                : 'transition-opacity duration-200 opacity-100'
            }
          >
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
