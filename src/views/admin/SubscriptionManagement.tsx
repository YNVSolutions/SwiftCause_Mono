import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { Input } from '../../shared/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/ui/table';
import { Alert, AlertDescription } from '../../shared/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../shared/ui/dialog';
import { Label } from '../../shared/ui/label';
import {
  RefreshCw,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  XCircle,
  CheckCircle,
  AlertCircle,
  Download,
  Building2,
  Eye,
} from 'lucide-react';
import {
  getRecurringStats,
  getSubscriptionsByOrganization,
  getSubscriptionsByOrganizationFiltered,
} from '../../entities/subscription/api/subscriptionApi';
import {
  exportSubscriptions,
  type SubscriptionExportRange,
} from '../../entities/subscription/api/subscriptionExportApi';
import { RecurringStatsResponse, Subscription } from '../../shared/types/subscription';
import { formatCurrencyFromMajor } from '../../shared/lib/currencyFormatter';
import { getSubscriptionDisplayInterval } from '../../entities/subscription/model/selectors';
import { SortableTableHeader } from './components/SortableTableHeader';
import {
  AdminSearchFilterHeader,
  AdminSearchFilterConfig,
} from './components/AdminSearchFilterHeader';
import { useTableSort } from '../../shared/lib/hooks/useTableSort';
import { AdminLayout } from './AdminLayout';
import { Screen, AdminSession, Permission } from '../../shared/types';
import { useToast } from '../../shared/ui/ToastProvider';

interface SubscriptionManagementProps {
  organizationId: string;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

type DateLike = string | Date | { seconds: number; nanoseconds?: number } | null | undefined;

interface SubscriptionStats {
  total: number;
  active: number;
  canceled: number;
  pastDue: number;
  churnRatePercent: number;
  recurringCashCollectedMinor: number;
  totalMonthlyRevenue: number;
  totalAnnualRevenue: number;
  averageAmount: number;
  windowLabel: string;
}

export function SubscriptionManagement({
  organizationId,
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: SubscriptionManagementProps) {
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [totalSubscriptionsCount, setTotalSubscriptionsCount] = useState(0);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [intervalFilter, setIntervalFilter] = useState('all');
  const [windowDays, setWindowDays] = useState('30');
  const [trends, setTrends] = useState<RecurringStatsResponse['trends']>([]);
  const [exportRange, setExportRange] = useState<SubscriptionExportRange>('current_month');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isMobileExportMenuOpen, setIsMobileExportMenuOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<
    | (Subscription & {
        donorName: string;
        donorEmail: string;
        intervalLabel: string;
        nextPayment: DateLike;
        createdAtTs: number;
        nextPaymentTs: number;
      })
    | null
  >(null);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const days = Number(windowDays);
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

      const [allSubs, filteredSubs, recurring] = await Promise.all([
        getSubscriptionsByOrganization(organizationId),
        getSubscriptionsByOrganizationFiltered(organizationId, {
          status: statusFilter,
          interval: intervalFilter,
          searchTerm: searchTerm.trim() || undefined,
        }),
        getRecurringStats(organizationId, { from, to }),
      ]);

      setTotalSubscriptionsCount(allSubs.length);
      setSubscriptions(filteredSubs);
      setTrends(recurring.trends);
      setStats({
        total: allSubs.length,
        active: recurring.summary.activeSubscriptions,
        canceled: recurring.summary.canceledSubscriptions,
        pastDue: recurring.summary.pastDueCount,
        churnRatePercent: recurring.summary.churnRatePercent,
        recurringCashCollectedMinor: recurring.summary.recurringCashCollectedMinor,
        totalMonthlyRevenue: recurring.summary.mrrMinor,
        totalAnnualRevenue: recurring.summary.arrMinor,
        averageAmount:
          recurring.summary.activeSubscriptions > 0
            ? recurring.summary.mrrMinor / recurring.summary.activeSubscriptions
            : 0,
        windowLabel: `Last ${days} days`,
      });
    } catch (err) {
      console.error('Error loading subscriptions:', err);
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [organizationId, windowDays, statusFilter, intervalFilter, searchTerm]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const getStatusBadge = (status: Subscription['status']) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Active' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, label: 'Past Due' },
      canceled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Canceled' },
      incomplete: {
        color: 'bg-orange-100 text-orange-800',
        icon: AlertCircle,
        label: 'Incomplete',
      },
      incomplete_expired: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Expired' },
      trialing: { color: 'bg-blue-100 text-blue-800', icon: Calendar, label: 'Trial' },
      unpaid: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Unpaid' },
    };

    const config = statusConfig[status] || statusConfig.active;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (date: DateLike) => {
    if (!date) return 'N/A';
    const d =
      typeof date === 'object' && date !== null && 'seconds' in date
        ? new Date(date.seconds * 1000)
        : new Date(date);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const toTimestamp = (date: DateLike) => {
    if (!date) return 0;
    if (date instanceof Date) {
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }
    if (typeof date === 'string') {
      const value = new Date(date).getTime();
      return Number.isNaN(value) ? 0 : value;
    }
    if (
      typeof date === 'object' &&
      date !== null &&
      'seconds' in date &&
      typeof date.seconds === 'number'
    ) {
      return date.seconds * 1000;
    }
    return 0;
  };

  const tableData = useMemo(() => {
    return subscriptions.map((sub) => {
      const donorName = sub.metadata?.donorName || 'Anonymous';
      const donorEmail = sub.metadata?.donorEmail || '';
      const intervalLabel = getSubscriptionDisplayInterval(sub.interval, sub.intervalCount);
      const nextPayment = sub.nextPaymentAt || sub.currentPeriodEnd;

      return {
        ...sub,
        donorName,
        donorEmail,
        intervalLabel,
        nextPayment,
        createdAtTs: toTimestamp(sub.createdAt),
        nextPaymentTs: toTimestamp(nextPayment),
      };
    });
  }, [subscriptions]);

  const { sortedData, sortKey, sortDirection, handleSort } = useTableSort({
    data: tableData,
    defaultSortKey: 'createdAtTs',
    defaultSortDirection: 'desc',
  });

  const intervalOptions = useMemo(() => {
    const unique = Array.from(new Set(tableData.map((s) => s.intervalLabel)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [tableData]);
  const searchFilterConfig: AdminSearchFilterConfig = {
    filters: [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        allOptionLabel: 'All statuses',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Trialing', value: 'trialing' },
          { label: 'Past due', value: 'past_due' },
          { label: 'Unpaid', value: 'unpaid' },
          { label: 'Incomplete', value: 'incomplete' },
          { label: 'Expired', value: 'incomplete_expired' },
          { label: 'Canceled', value: 'canceled' },
        ],
      },
      {
        key: 'intervalFilter',
        label: 'Interval',
        type: 'select',
        allOptionLabel: 'All intervals',
        options: intervalOptions.map((intervalLabel) => ({
          label: intervalLabel,
          value: intervalLabel,
        })),
      },
      {
        key: 'windowDays',
        label: 'Analytics window',
        type: 'select',
        includeAllOption: false,
        options: [
          { label: 'Last 30 days', value: '30' },
          { label: 'Last 90 days', value: '90' },
          { label: 'Last 180 days', value: '180' },
          { label: 'Last 365 days', value: '365' },
        ],
      },
    ],
  };

  const filterValues = {
    statusFilter,
    intervalFilter,
    windowDays,
  };

  const handleFilterChange = (key: string, value: unknown) => {
    if (typeof value !== 'string') return;
    switch (key) {
      case 'statusFilter':
        setStatusFilter(value);
        break;
      case 'intervalFilter':
        setIntervalFilter(value);
        break;
      case 'windowDays':
        setWindowDays(value);
        break;
    }
  };

  const handleExport = async () => {
    if (!hasPermission('export_subscriptions')) return;
    if (!organizationId) return;

    if (exportRange === 'custom' && (!exportStartDate || !exportEndDate)) {
      showToast('Select both start and end dates for custom range.', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      await exportSubscriptions({
        organizationId,
        range: exportRange,
        startDate: exportRange === 'custom' ? exportStartDate : undefined,
        endDate: exportRange === 'custom' ? exportEndDate : undefined,
        filters: {
          searchTerm,
          status: statusFilter,
          interval: intervalFilter,
        },
      });
      setIsMobileExportMenuOpen(false);
      showToast('Subscription export started. Your download should begin shortly.', 'success');
    } catch (exportError) {
      console.error('Subscription export failed:', exportError);
      const message =
        exportError instanceof Error ? exportError.message : 'Failed to export subscriptions.';
      showToast(message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      activeScreen="admin-subscriptions"
      headerTitle={
        <div className="flex flex-col">
          {userSession.user.organizationName && (
            <div className="flex items-center gap-1.5 mb-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 tracking-wide">
                {userSession.user.organizationName}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Subscriptions</h1>
        </div>
      }
      headerSubtitle="Manage recurring donations and lifecycle health"
      headerSearchPlaceholder="Search donor, email, subscription ID..."
      headerSearchValue={searchTerm}
      onHeaderSearchChange={setSearchTerm}
      headerTopRightActions={
        <div className="flex items-center gap-2">
          {hasPermission('export_subscriptions') ? (
            <>
              <div className="relative sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-[#064e3b] bg-transparent px-4 text-[#064e3b] transition-all duration-300 hover:border-emerald-600 hover:bg-emerald-50"
                  onClick={() => setIsMobileExportMenuOpen((current) => !current)}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                </Button>

                {isMobileExportMenuOpen ? (
                  <div className="absolute right-0 top-11 z-20 w-[280px] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-600">Export range</Label>
                      <select
                        value={exportRange}
                        onChange={(event) =>
                          setExportRange(event.target.value as SubscriptionExportRange)
                        }
                        className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="current_month">Current month</option>
                        <option value="past_month">Past month</option>
                        <option value="custom">Custom range</option>
                      </select>
                    </div>

                    {exportRange === 'custom' ? (
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        <div>
                          <Label className="mb-1 block text-xs font-medium text-gray-600">
                            Start
                          </Label>
                          <Input
                            type="date"
                            value={exportStartDate}
                            onChange={(event) => setExportStartDate(event.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs font-medium text-gray-600">
                            End
                          </Label>
                          <Input
                            type="date"
                            value={exportEndDate}
                            onChange={(event) => setExportEndDate(event.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 rounded-xl"
                        onClick={() => setIsMobileExportMenuOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 rounded-xl border-[#064e3b] text-[#064e3b] hover:bg-emerald-50"
                        onClick={handleExport}
                        disabled={isExporting}
                      >
                        {isExporting ? 'Exporting...' : 'Export'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:justify-end sm:gap-2">
                <div className="sm:min-w-[170px]">
                  <Label className="mb-1 block text-xs font-medium text-gray-600">
                    Export range
                  </Label>
                  <select
                    value={exportRange}
                    onChange={(event) =>
                      setExportRange(event.target.value as SubscriptionExportRange)
                    }
                    className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="current_month">Current month</option>
                    <option value="past_month">Past month</option>
                    <option value="custom">Custom range</option>
                  </select>
                </div>

                {exportRange === 'custom' ? (
                  <>
                    <div className="sm:min-w-[145px]">
                      <Label className="mb-1 block text-xs font-medium text-gray-600">Start</Label>
                      <Input
                        type="date"
                        value={exportStartDate}
                        onChange={(event) => setExportStartDate(event.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="sm:min-w-[145px]">
                      <Label className="mb-1 block text-xs font-medium text-gray-600">End</Label>
                      <Input
                        type="date"
                        value={exportEndDate}
                        onChange={(event) => setExportEndDate(event.target.value)}
                        className="h-9"
                      />
                    </div>
                  </>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-[#064e3b] bg-transparent px-4 text-[#064e3b] transition-all duration-300 hover:border-emerald-600 hover:bg-emerald-50 hover:shadow-md hover:shadow-emerald-900/10"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                </Button>
              </div>
            </>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6 sm:space-y-8">
        <main className="px-6 lg:px-8 pt-12 pb-8 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 lg:gap-6">
                  <Card className="rounded-3xl border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">
                          Active Subscriptions
                        </p>
                        <div className="mt-2">
                          <span className="text-2xl font-semibold text-gray-900">
                            {stats.active}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">of {stats.total} total</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">
                          Monthly Revenue
                        </p>
                        <div className="mt-2">
                          <span className="text-2xl font-semibold text-gray-900">
                            {formatCurrencyFromMajor(stats.totalMonthlyRevenue / 100)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">recurring</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">
                          Annual Revenue
                        </p>
                        <div className="mt-2">
                          <span className="text-2xl font-semibold text-gray-900">
                            {formatCurrencyFromMajor(stats.totalAnnualRevenue / 100)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">projected</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">
                          Average Amount
                        </p>
                        <div className="mt-2">
                          <span className="text-2xl font-semibold text-gray-900">
                            {formatCurrencyFromMajor(stats.averageAmount / 100)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">per month</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">Churn</p>
                        <div className="mt-2">
                          <span className="text-2xl font-semibold text-gray-900">
                            {stats.churnRatePercent.toFixed(2)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{stats.windowLabel}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-gray-100 shadow-sm">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">
                          Cash Collected
                        </p>
                        <div className="mt-2">
                          <span className="text-2xl font-semibold text-gray-900">
                            {formatCurrencyFromMajor(stats.recurringCashCollectedMinor / 100)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{stats.windowLabel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card className="rounded-3xl border border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle>Recurring Subscriptions</CardTitle>
                  <CardDescription>Manage all recurring donations</CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminSearchFilterHeader
                    config={searchFilterConfig}
                    filterValues={filterValues}
                    onFilterChange={handleFilterChange}
                    filterGridClassName="grid grid-cols-1 gap-3 md:grid-cols-3"
                    summaryText={`Showing ${sortedData.length} of ${totalSubscriptionsCount} subscriptions`}
                  />

                  {sortedData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <RefreshCw className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No subscriptions match your current filters</p>
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <SortableTableHeader
                                sortKey="donorName"
                                currentSortKey={sortKey}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                                className="p-3"
                              >
                                Donor
                              </SortableTableHeader>
                              <SortableTableHeader
                                sortKey="amount"
                                currentSortKey={sortKey}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                                className="p-3"
                              >
                                Amount
                              </SortableTableHeader>
                              <SortableTableHeader
                                sortKey="intervalLabel"
                                currentSortKey={sortKey}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                                className="p-3"
                              >
                                Interval
                              </SortableTableHeader>
                              <SortableTableHeader
                                sortKey="status"
                                currentSortKey={sortKey}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                                className="p-3"
                              >
                                Status
                              </SortableTableHeader>
                              <SortableTableHeader
                                sortKey="nextPaymentTs"
                                currentSortKey={sortKey}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                                className="p-3"
                              >
                                Next Payment
                              </SortableTableHeader>
                              <SortableTableHeader
                                sortKey="createdAtTs"
                                currentSortKey={sortKey}
                                currentSortDirection={sortDirection}
                                onSort={handleSort}
                                className="p-3"
                              >
                                Created
                              </SortableTableHeader>
                              <TableHead className="p-3">Started</TableHead>
                              <TableHead className="p-3">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedData.map((sub) => (
                              <TableRow key={sub.id}>
                                <TableCell className="p-3">
                                  <div>
                                    <div className="font-medium">
                                      {sub.metadata?.donorName || 'Anonymous'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {sub.metadata?.donorEmail || 'N/A'}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="p-3 font-semibold">
                                  {formatCurrencyFromMajor(sub.amount / 100)}
                                </TableCell>
                                <TableCell className="p-3">
                                  <Badge variant="outline">
                                    {getSubscriptionDisplayInterval(
                                      sub.interval,
                                      sub.intervalCount,
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className="p-3">{getStatusBadge(sub.status)}</TableCell>
                                <TableCell className="p-3 text-sm">
                                  {sub.status === 'active' || sub.status === 'trialing'
                                    ? formatDate(sub.nextPayment)
                                    : 'N/A'}
                                </TableCell>
                                <TableCell className="p-3 text-sm text-gray-500">
                                  {formatDate(sub.createdAt)}
                                </TableCell>
                                <TableCell className="p-3 text-sm text-gray-500">
                                  {formatDate(sub.startedAt)}
                                </TableCell>
                                <TableCell className="p-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedSubscription(sub)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="md:hidden space-y-4">
                        {sortedData.map((sub) => (
                          <Card
                            key={sub.id}
                            className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {sub.metadata?.donorName || 'Anonymous'}
                                  </div>
                                  <div className="text-sm text-gray-500 break-all">
                                    {sub.metadata?.donorEmail || 'N/A'}
                                  </div>
                                </div>
                                <div>{getStatusBadge(sub.status)}</div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-gray-500">Amount</p>
                                  <p className="font-semibold">
                                    {formatCurrencyFromMajor(sub.amount / 100)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Interval</p>
                                  <p className="font-semibold">
                                    {getSubscriptionDisplayInterval(
                                      sub.interval,
                                      sub.intervalCount,
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Next Payment</p>
                                  <p>
                                    {sub.status === 'active' || sub.status === 'trialing'
                                      ? formatDate(sub.nextPayment)
                                      : 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Created</p>
                                  <p>{formatDate(sub.createdAt)}</p>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-gray-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => setSelectedSubscription(sub)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle>Recurring Trend ({stats?.windowLabel || 'Current window'})</CardTitle>
                  <CardDescription>Monthly MRR and recurring cash trend</CardDescription>
                </CardHeader>
                <CardContent>
                  {trends.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No trend data available for this window.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead>MRR</TableHead>
                          <TableHead>Cash Collected</TableHead>
                          <TableHead>New Subscriptions</TableHead>
                          <TableHead>Canceled Subscriptions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trends.map((point) => (
                          <TableRow key={point.period}>
                            <TableCell>{point.period}</TableCell>
                            <TableCell>{formatCurrencyFromMajor(point.mrrMinor / 100)}</TableCell>
                            <TableCell>
                              {formatCurrencyFromMajor(point.cashCollectedMinor / 100)}
                            </TableCell>
                            <TableCell>{point.newSubscriptions}</TableCell>
                            <TableCell>{point.canceledSubscriptions}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>

      <Dialog
        open={!!selectedSubscription}
        onOpenChange={(open) => !open && setSelectedSubscription(null)}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
            <DialogDescription>
              Full lifecycle and billing metadata for this recurring donor.
            </DialogDescription>
          </DialogHeader>

          {selectedSubscription && (
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Donor</Label>
                <p className="text-sm text-gray-900 mt-1">{selectedSubscription.donorName}</p>
                <p className="text-sm text-gray-500 break-all">
                  {selectedSubscription.donorEmail || 'N/A'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Subscription Amount</Label>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {formatCurrencyFromMajor(selectedSubscription.amount / 100)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedSubscription.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Interval</Label>
                  <p className="text-sm text-gray-900 mt-1">{selectedSubscription.intervalLabel}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Next Payment</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(
                      selectedSubscription.nextPaymentAt || selectedSubscription.nextPayment,
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Started At</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(selectedSubscription.startedAt)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Current Period End</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(selectedSubscription.currentPeriodEnd)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Created At</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(selectedSubscription.createdAt)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Updated At</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDate(selectedSubscription.updatedAt)}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Cancel Reason</Label>
                <p className="text-sm text-gray-900 mt-1">
                  {selectedSubscription.cancelReason || 'N/A'}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Stripe Subscription ID</Label>
                <p className="text-xs text-gray-700 font-mono mt-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block break-all">
                  {selectedSubscription.stripeSubscriptionId}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
