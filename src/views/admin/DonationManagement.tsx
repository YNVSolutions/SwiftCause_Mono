import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Card, CardContent } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../shared/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog';
import {
  Download,
  RefreshCw,
  DollarSign,
  Users,
  TrendingUp,
  Heart,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
  Building2,
  Gift,
} from 'lucide-react';
import { Skeleton } from '../../shared/ui/skeleton'; // Import Skeleton
import { Ghost } from 'lucide-react'; // Import Ghost
import { Screen, AdminSession, Permission, Donation } from '../../shared/types';
import {
  exportDonations,
  type DonationExportRange,
} from '../../entities/donation/api/donationExportApi';
import { useDonations } from '../../shared/lib/hooks/useDonations';
import { PaginationControls } from '../../shared/ui/PaginationControls';
import {
  AdminSearchFilterHeader,
  AdminSearchFilterConfig,
} from './components/AdminSearchFilterHeader';
import { SortableTableHeader } from './components/SortableTableHeader';
import { useTableSort } from '../../shared/lib/hooks/useTableSort';
import { formatCurrency } from '../../shared/lib/currencyFormatter';
import { useToast } from '../../shared/ui/ToastProvider';

import { getAllCampaigns } from '../../shared/api';
import { AdminLayout } from './AdminLayout';
import { useOrganization } from '../../shared/lib/hooks/useOrganization';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../shared/lib/firebase';
import { Kiosk } from '../../shared/types';

interface FetchedDonation extends Omit<Donation, 'timestamp'> {
  id: string;
  amount: number;
  campaignId: string;
  campaignTitleSnapshot?: string;
  campaignTitle?: string;
  currency: string;
  donorId: string;
  donorName: string;
  isGiftAid: boolean;
  paymentStatus: string;
  platform: string;
  stripePaymentIntentId: string;
  transactionId?: string;
  timestamp: string;
  timestampTs?: number;
  kioskId?: string;
}

interface Campaign {
  id: string;
  title: string;
}

interface DonationManagementProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

function parseDonationDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDonationDate(value?: string, withLeadingZero = true): string {
  const parsed = parseDonationDate(value);
  if (!parsed) return 'N/A';

  return parsed.toLocaleDateString('en-GB', {
    day: withLeadingZero ? '2-digit' : 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DonationManagement({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: DonationManagementProps) {
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);

  useOrganization(userSession.user.organizationId ?? null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [recurringFilter, setRecurringFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [selectedDonation, setSelectedDonation] = useState<FetchedDonation | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [exportRange, setExportRange] = useState<DonationExportRange>('current_month');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isMobileExportMenuOpen, setIsMobileExportMenuOpen] = useState(false);

  const {
    donations: pagedDonations,
    loading,
    fetching,
    error,
    pageNumber,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    pageSize,
    refresh: refreshDonations,
  } = useDonations(userSession.user.organizationId, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    campaignId: campaignFilter !== 'all' ? campaignFilter : undefined,
    // isRecurring handled client-side to avoid needing compound indexes
  });

  const fetchAllData = useCallback(async () => {
    try {
      const kiosksRef = collection(db, 'kiosks');
      const kiosksQuery = query(
        kiosksRef,
        where('organizationId', '==', userSession.user.organizationId || ''),
      );
      const kiosksSnapshot = await getDocs(kiosksQuery);
      const kiosksData = kiosksSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Kiosk[];

      const campaignData = await getAllCampaigns(userSession.user.organizationId || '');
      setCampaigns(campaignData as Campaign[]);
      setKiosks(kiosksData);
    } catch (err) {
      console.error('Error fetching campaigns/kiosks:', err);
    }
  }, [userSession.user.organizationId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const campaignMap = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        acc[campaign.id] = campaign.title;
        return acc;
      },
      {} as Record<string, string>,
    );
  }, [campaigns]);

  const kioskMap = useMemo(() => {
    return kiosks.reduce(
      (acc, kiosk) => {
        acc[kiosk.id] = kiosk;
        return acc;
      },
      {} as Record<string, Kiosk>,
    );
  }, [kiosks]);

  const getCampaignDisplayName = (donation: FetchedDonation) => {
    const snapshotTitle = (donation.campaignTitleSnapshot || donation.campaignTitle || '').trim();

    if (snapshotTitle) {
      return snapshotTitle;
    }

    if (donation.campaignId && campaignMap[donation.campaignId]) {
      return campaignMap[donation.campaignId];
    }

    return 'Deleted Campaign';
  };

  const isRecurringDonation = (donation: FetchedDonation) => {
    if (donation.isRecurring) return true;
    if (donation.subscriptionId) return true;
    if (donation.recurringInterval) return true;
    if (typeof donation.transactionId === 'string' && donation.transactionId.startsWith('sub_'))
      return true;
    return false;
  };

  // Configuration for AdminSearchFilterHeader
  const searchFilterConfig: AdminSearchFilterConfig = {
    filters: [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Success', value: 'success' },
          { label: 'Pending', value: 'pending' },
          { label: 'Failed', value: 'failed' },
        ],
      },
      {
        key: 'campaignFilter',
        label: 'Campaign',
        type: 'select',
        options: campaigns.map((campaign) => ({ label: campaign.title, value: campaign.id })),
      },
      {
        key: 'recurringFilter',
        label: 'Recurring',
        type: 'select',
        options: [
          { label: 'Recurring', value: 'recurring' },
          { label: 'One-time', value: 'one_time' },
        ],
      },
      {
        key: 'dateFilter',
        label: 'Filter by date',
        type: 'date',
      },
    ],
  };

  const filterValues = {
    statusFilter,
    campaignFilter,
    recurringFilter,
    dateFilter,
  };

  const handleFilterChange = (key: string, value: string | Date | undefined) => {
    switch (key) {
      case 'statusFilter':
        setStatusFilter(typeof value === 'string' ? value : 'all');
        break;
      case 'campaignFilter':
        setCampaignFilter(typeof value === 'string' ? value : 'all');
        break;
      case 'dateFilter':
        setDateFilter(value instanceof Date ? value : undefined);
        break;
      case 'recurringFilter':
        setRecurringFilter(typeof value === 'string' ? value : 'all');
        break;
    }
  };

  const filteredDonationsData = pagedDonations
    .filter((donation: Donation) => {
      const campaignName = getCampaignDisplayName(donation as FetchedDonation);
      const d = donation as FetchedDonation;
      const matchesSearch =
        !searchTerm ||
        (d.donorName && d.donorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.stripePaymentIntentId &&
          d.stripePaymentIntentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.transactionId && d.transactionId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        campaignName.toLowerCase().includes(searchTerm.toLowerCase());
      const donationDate = parseDonationDate(d.timestamp);
      const matchesDate =
        !dateFilter ||
        (donationDate ? donationDate.toDateString() === dateFilter.toDateString() : false);
      const recurring = isRecurringDonation(d);
      const matchesRecurring =
        recurringFilter === 'all' ||
        (recurringFilter === 'recurring' && recurring) ||
        (recurringFilter === 'one_time' && !recurring);
      return matchesSearch && matchesDate && matchesRecurring;
    })
    .map((donation: Donation) => {
      const d = donation as FetchedDonation;
      return {
        ...d,
        timestampTs: parseDonationDate(d.timestamp)?.getTime() || 0,
      } as FetchedDonation;
    });

  const {
    sortedData: filteredDonations,
    sortKey,
    sortDirection,
    handleSort,
  } = useTableSort({
    data: filteredDonationsData,
    defaultSortKey: 'timestampTs',
    defaultSortDirection: 'desc',
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-green-100 text-green-800">
            Success
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-yellow-100 text-yellow-800">
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-red-100 text-red-800">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const totalStats = {
    totalAmount: filteredDonations.reduce(
      (sum, d) => sum + (d.paymentStatus === 'success' ? d.amount || 0 : 0),
      0,
    ),
    totalDonations: filteredDonations.length,
    completedDonations: filteredDonations.filter((d) => d.paymentStatus === 'success').length,
    avgDonation:
      filteredDonations.length > 0
        ? filteredDonations.reduce((sum, d) => sum + (d.amount || 0), 0) / filteredDonations.length
        : 0,
  };

  const handleExportDonations = async () => {
    // Guard rails:
    // 1) Only users with export permission can export.
    // 2) Organization must be selected.
    if (!hasPermission('export_donations')) return;
    if (!userSession.user.organizationId) return;

    if (exportRange === 'custom' && (!exportStartDate || !exportEndDate)) {
      showToast('Select both start and end dates for custom range.', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      // Backend handles time filtering and CSV generation.
      // The response is a CSV file which we immediately download.
      await exportDonations({
        organizationId: userSession.user.organizationId,
        range: exportRange,
        startDate: exportRange === 'custom' ? exportStartDate : undefined,
        endDate: exportRange === 'custom' ? exportEndDate : undefined,
        filters: {
          searchTerm,
          status: statusFilter,
          campaignId: campaignFilter,
          recurring: recurringFilter,
          date: dateFilter ? dateFilter.toISOString().slice(0, 10) : undefined,
        },
      });
      setIsMobileExportMenuOpen(false);
      showToast('Donation export started. Your download should begin shortly.', 'success');
    } catch (exportError) {
      console.error('Donation export failed:', exportError);
      const message =
        exportError instanceof Error ? exportError.message : 'Failed to export donations.';
      showToast(message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewDetails = (donation: FetchedDonation) => {
    setSelectedDonation(donation);
    setIsDetailsDialogOpen(true);
  };

  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      activeScreen="admin-donations"
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
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Donations</h1>
        </div>
      }
      headerSubtitle="Track and analyze donation transactions"
      headerSearchPlaceholder="Search donations..."
      headerSearchValue={searchTerm}
      onHeaderSearchChange={setSearchTerm}
      headerTopRightActions={
        hasPermission('export_donations') ? (
          <div className="flex w-full justify-end">
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
                        setExportRange(event.target.value as DonationExportRange)
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
                        <Label className="mb-1 block text-xs font-medium text-gray-600">End</Label>
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
                      onClick={handleExportDonations}
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
                <Label className="mb-1 block text-xs font-medium text-gray-600">Export range</Label>
                <select
                  value={exportRange}
                  onChange={(event) => setExportRange(event.target.value as DonationExportRange)}
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
                onClick={handleExportDonations}
                disabled={isExporting}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6 sm:space-y-8">
        <main className="px-6 lg:px-8 pt-12 pb-8">
          {/* Stat Cards Section */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="rounded-3xl border border-gray-100 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Total Raised</p>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(totalStats.totalAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-gray-100 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Total Donations</p>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-gray-900">
                      {totalStats.totalDonations}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-gray-100 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-400">Completed</p>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-gray-900">
                      {totalStats.completedDonations}
                    </span>
                  </div>
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
                    Average Donation
                  </p>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(totalStats.avgDonation)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Unified Header Component */}
          <AdminSearchFilterHeader
            config={searchFilterConfig}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            actions={
              <Button
                variant="outline"
                onClick={refreshDonations}
                disabled={loading}
                aria-label="Refresh"
                className="border-[#064e3b]/20 text-[#064e3b] hover:bg-[#064e3b]/10 hover:text-[#064e3b] hover:border-[#064e3b]/30"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} sm:mr-2`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            }
          />

          {/* Modern Table Container - Desktop */}
          <Card className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm mt-6 hidden md:block">
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-4 p-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4 py-4 border-b border-gray-100">
                      <Skeleton className="h-10 w-full col-span-1" />
                      <Skeleton className="h-10 w-full col-span-1" />
                      <Skeleton className="h-10 w-full col-span-1" />
                      <Skeleton className="h-10 w-full col-span-1" />
                      <Skeleton className="h-10 w-full col-span-1" />
                      <Skeleton className="h-10 w-full col-span-1" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-red-600">
                  <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                  <p className="text-lg">{error}</p>
                </div>
              ) : filteredDonations.length > 0 ? (
                <div className="overflow-hidden">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          sortKey="donorName"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[20%]"
                        >
                          Donor
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortKey="campaignId"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[20%]"
                        >
                          Campaign
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortKey="amount"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[14%]"
                        >
                          Amount
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortKey="kioskId"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[12%]"
                        >
                          Kiosk
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortKey="paymentStatus"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[12%]"
                        >
                          Status
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortKey="timestampTs"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[12%]"
                        >
                          Date
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="actions"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3 w-[10%]"
                        >
                          Actions
                        </SortableTableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDonations.map((donation) => {
                        const kiosk =
                          donation.kioskId && kioskMap[donation.kioskId]
                            ? kioskMap[donation.kioskId]
                            : null;
                        return (
                          <TableRow
                            key={donation.id}
                            className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 align-middle"
                          >
                            <TableCell className="p-3 align-middle">
                              <span
                                className="text-sm font-medium text-gray-900 block truncate max-w-[220px]"
                                title={donation.donorName || 'Anonymous'}
                              >
                                {donation.donorName || 'Anonymous'}
                              </span>
                            </TableCell>

                            <TableCell className="p-3 align-middle">
                              <p
                                className="text-sm font-medium text-gray-900 truncate max-w-[220px]"
                                title={getCampaignDisplayName(donation)}
                              >
                                {getCampaignDisplayName(donation)}
                              </p>
                            </TableCell>

                            <TableCell className="p-3 align-middle">
                              <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 tabular-nums">
                                <span className="inline-flex w-6 flex-col items-start justify-center gap-1">
                                  {isRecurringDonation(donation) ? (
                                    <span
                                      className="inline-flex items-center rounded-md bg-sky-50 px-1.5 py-0.5 text-sky-700 ring-1 ring-sky-600/20"
                                      title="Recurring donation"
                                    >
                                      <CreditCard className="h-3 w-3" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 invisible">
                                      <CreditCard className="h-3 w-3" />
                                    </span>
                                  )}
                                  {donation.isGiftAid ? (
                                    <span
                                      className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-purple-700 ring-1 ring-purple-600/20"
                                      title="Gift Aid donation"
                                    >
                                      <Gift className="h-3 w-3" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 invisible">
                                      <Gift className="h-3 w-3" />
                                    </span>
                                  )}
                                </span>
                                <span>{formatCurrency(donation.amount || 0)}</span>
                              </div>
                            </TableCell>

                            <TableCell className="p-3 align-middle">
                              {kiosk ? (
                                <span
                                  className="text-sm font-medium text-gray-900 block truncate"
                                  title={kiosk.name}
                                >
                                  {kiosk.name}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-500">Online</span>
                              )}
                            </TableCell>

                            <TableCell className="p-3 align-middle">
                              {getStatusBadge(donation.paymentStatus)}
                            </TableCell>

                            <TableCell className="p-3 align-middle">
                              <span className="text-sm text-gray-500">
                                {donation.timestamp
                                  ? formatDonationDate(donation.timestamp, true)
                                  : 'N/A'}
                              </span>
                            </TableCell>
                            <TableCell className="p-3 align-middle">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(donation)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Ghost className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-lg font-medium mb-2">No Donations Found</p>
                  <p className="text-sm mb-4">
                    No donations have been made to your organization yet.
                  </p>
                </div>
              )}
              {(filteredDonations.length > 0 || canGoPrev) && (
                <div className="border-t border-gray-100 px-4">
                  <PaginationControls
                    pageNumber={pageNumber}
                    pageSize={pageSize}
                    totalOnPage={filteredDonations.length}
                    canGoNext={canGoNext}
                    canGoPrev={canGoPrev}
                    onNext={goNext}
                    onPrev={goPrev}
                    loading={fetching}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Donations Cards - Mobile */}
          <div className="md:hidden space-y-4 mt-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden rounded-3xl">
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : error ? (
              <Card className="overflow-hidden rounded-3xl border-red-200 bg-red-50">
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center text-center text-red-600">
                    <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                    <p className="text-lg">{error}</p>
                  </div>
                </CardContent>
              </Card>
            ) : filteredDonations.length > 0 ? (
              filteredDonations.map((donation) => {
                const kiosk =
                  donation.kioskId && kioskMap[donation.kioskId]
                    ? kioskMap[donation.kioskId]
                    : null;
                return (
                  <Card
                    key={donation.id}
                    className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {donation.donorName || 'Anonymous'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {getCampaignDisplayName(donation)}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            {donation.isGiftAid && (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200"
                              >
                                <Gift className="h-3 w-3 mr-1" />
                                Gift Aid
                              </Badge>
                            )}
                            {isRecurringDonation(donation) && (
                              <Badge
                                variant="outline"
                                className="bg-sky-50 text-sky-700 border-sky-200"
                              >
                                <CreditCard className="h-3 w-3 mr-1" />
                                Recurring
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div>{getStatusBadge(donation.paymentStatus)}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Amount</p>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(donation.amount || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="text-slate-900">
                            {donation.timestamp
                              ? formatDonationDate(donation.timestamp, false)
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Platform</p>
                          <p className="text-slate-900 capitalize">{donation.platform || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Source</p>
                          <p className="text-slate-900">{kiosk ? kiosk.name : 'Online'}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleViewDetails(donation)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card className="overflow-hidden rounded-3xl">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Ghost className="h-12 w-12 text-gray-400" />
                    <p className="text-xl font-bold text-gray-600">No Donations Found</p>
                    <p className="text-base text-gray-500 mt-2">
                      {searchTerm ||
                      statusFilter !== 'all' ||
                      campaignFilter !== 'all' ||
                      dateFilter
                        ? 'Try adjusting your search or filters'
                        : 'No donations have been made to your organization yet.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* Donation Details Dialog */}
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-indigo-600" />
                Donation Details
              </DialogTitle>
              <DialogDescription>Complete information about this donation</DialogDescription>
            </DialogHeader>

            {selectedDonation && (
              <div className="grid gap-4 py-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Donor Name</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedDonation.donorName || 'Anonymous'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Donation Amount</Label>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatCurrency(selectedDonation.amount || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Payment Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedDonation.paymentStatus)}</div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Campaign</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {getCampaignDisplayName(selectedDonation)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Donation Date</Label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedDonation.timestamp
                        ? formatDonationDate(selectedDonation.timestamp, true)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Platform</Label>
                    <p className="text-sm text-gray-900 mt-1 capitalize">
                      {selectedDonation.platform || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Gift Aid Eligible</Label>
                  <div className="mt-1">
                    {selectedDonation.isGiftAid ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 border-gray-200">No</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Recurring Donation</Label>
                  <div className="mt-1">
                    {isRecurringDonation(selectedDonation) ? (
                      <Badge className="bg-sky-100 text-sky-800 border-sky-200">
                        <CreditCard className="w-3 h-3 mr-1" />
                        Yes
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 border-gray-200">No</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Transaction ID</Label>
                  <p className="text-xs text-gray-700 font-mono mt-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block">
                    {selectedDonation.stripePaymentIntentId ||
                      selectedDonation.transactionId ||
                      selectedDonation.id ||
                      'N/A'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Subscription ID</Label>
                    <p className="text-xs text-gray-700 font-mono mt-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block break-all">
                      {selectedDonation.subscriptionId || 'N/A'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-700">
                        Recurring Interval
                      </Label>
                      <p className="text-sm text-gray-900 mt-1 capitalize">
                        {selectedDonation.recurringInterval || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Invoice ID</Label>
                      <p className="text-xs text-gray-700 font-mono mt-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block break-all">
                        {selectedDonation.invoiceId || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
