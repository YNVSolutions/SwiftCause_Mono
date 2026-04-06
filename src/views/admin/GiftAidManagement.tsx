import { useState, useEffect, useCallback, useRef } from 'react';
import { Screen, AdminSession, Permission } from '../../shared/types';
import { GiftAidDeclaration } from '../../entities/giftAid/model/types';
import {
  downloadGiftAidExportFile,
  exportGiftAidDeclarations,
  fetchGiftAidExportBatches,
  giftAidApi,
  type GiftAidExportBatch,
  type GiftAidExportFile,
} from '../../entities/giftAid/api';
import { AdminLayout } from './AdminLayout';
import { db } from '../../shared/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '../../shared/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../shared/ui/table';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Skeleton } from '../../shared/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/dialog';
import {
  Gift,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
} from 'lucide-react';
import {
  AdminSearchFilterHeader,
  AdminSearchFilterConfig,
} from './components/AdminSearchFilterHeader';
import { SortableTableHeader } from './components/SortableTableHeader';
import { useTableSort } from '../../shared/lib/hooks/useTableSort';
import { formatCurrency } from '../../shared/lib/currencyFormatter';
import { useGiftAid } from '../../shared/lib/hooks/useGiftAid';
import { PaginationControls } from '../../shared/ui/PaginationControls';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../../shared/ui/pagination';
import { useToast } from '../../shared/ui/ToastProvider';

const EXPORT_HISTORY_PAGE_SIZE = 8;

interface GiftAidManagementProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

export function GiftAidManagement({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: GiftAidManagementProps) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDonation, setSelectedDonation] = useState<GiftAidDeclaration | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUpdatingPaid, setIsUpdatingPaid] = useState(false);
  const [exportBatches, setExportBatches] = useState<GiftAidExportBatch[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(true);
  const [exportHistoryPage, setExportHistoryPage] = useState(1);
  const [activeDownloadKey, setActiveDownloadKey] = useState<string | null>(null);
  const [charitySubmittedReference, setCharitySubmittedReference] = useState('');
  const [unresolvedReconciliationCount, setUnresolvedReconciliationCount] = useState(0);
  const exportHistoryRef = useRef<HTMLDivElement | null>(null);

  const {
    declarations: pagedDeclarations,
    loading,
    fetching,
    error: hookError,
    pageNumber,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    pageSize,
    refresh,
  } = useGiftAid(userSession.user.organizationId, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  // Local error state for mutation errors (export, mark paid)
  const [mutationError, setMutationError] = useState<string | null>(null);
  const error = hookError ?? mutationError;

  // Keep a local copy so mutations (export, mark paid) can update UI optimistically
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<GiftAidDeclaration>>>(
    {},
  );

  const giftAidDonations: GiftAidDeclaration[] = pagedDeclarations.map((d) => ({
    ...d,
    ...(localOverrides[d.id] ?? {}),
  }));
  const canExportGiftAid = hasPermission('export_giftaid');
  const canDownloadGiftAidBatchHistory = hasPermission('download_giftaid_exports');

  const loadExportBatches = useCallback(
    async (organizationId: string) => {
      setExportHistoryLoading(true);
      try {
        const batches = await fetchGiftAidExportBatches(organizationId);
        setExportBatches(batches);
      } catch (batchError) {
        console.error('Failed to load Gift Aid export batches:', batchError);
        showToast('Failed to load Gift Aid export history.', 'warning');
      } finally {
        setExportHistoryLoading(false);
      }
    },
    [showToast],
  );

  const syncExportHistory = useCallback(() => {
    const organizationId = userSession.user.organizationId;
    if (!organizationId || !canDownloadGiftAidBatchHistory) {
      setExportBatches([]);
      setExportHistoryPage(1);
      setExportHistoryLoading(false);
      return;
    }

    void loadExportBatches(organizationId);
  }, [canDownloadGiftAidBatchHistory, loadExportBatches, userSession.user.organizationId]);

  const getUnresolvedReconciliationCount = useCallback(async (organizationId: string) => {
    const issuesRef = collection(db, 'giftAidReconciliationIssues');
    const issuesQuery = query(
      issuesRef,
      where('organizationId', '==', organizationId),
      where('resolved', '==', false),
    );
    const snapshot = await getDocs(issuesQuery);
    return snapshot.size;
  }, []);

  // Fetch unresolved reconciliation count on mount
  useEffect(() => {
    const organizationId = userSession.user.organizationId;
    if (!organizationId) return;
    getUnresolvedReconciliationCount(organizationId)
      .then(setUnresolvedReconciliationCount)
      .catch(console.error);
  }, [getUnresolvedReconciliationCount, userSession.user.organizationId]);

  useEffect(() => {
    syncExportHistory();
  }, [syncExportHistory]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(exportBatches.length / EXPORT_HISTORY_PAGE_SIZE));
    setExportHistoryPage((currentPage) => Math.min(currentPage, totalPages));
  }, [exportBatches]);

  // Configuration for AdminSearchFilterHeader
  const searchFilterConfig: AdminSearchFilterConfig = {
    filters: [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Captured', value: 'captured' },
          { label: 'Exported', value: 'exported' },
        ],
      },
    ],
  };

  const filterValues = {
    statusFilter,
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'statusFilter') {
      setStatusFilter(value);
    }
  };

  // Client-side search on current page — status filter is server-side via useGiftAid
  const filteredDonationsData = giftAidDonations
    .filter((donation) => {
      const donorName = `${donation.donorFirstName} ${donation.donorSurname}`.trim();
      return (
        !searchTerm ||
        donorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (donation.campaignTitle || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .map((donation) => ({
      ...donation,
      donationDateTs: donation.donationDate ? new Date(donation.donationDate).getTime() || 0 : 0,
    }));

  // Use sorting hook
  const {
    sortedData: filteredDonations,
    sortKey,
    sortDirection,
    handleSort,
  } = useTableSort({
    data: filteredDonationsData,
    defaultSortKey: 'donationDateTs',
    defaultSortDirection: 'desc',
  });

  const paginatedExportBatches = exportBatches.slice(
    (exportHistoryPage - 1) * EXPORT_HISTORY_PAGE_SIZE,
    exportHistoryPage * EXPORT_HISTORY_PAGE_SIZE,
  );
  const canGoExportHistoryNext =
    exportHistoryPage * EXPORT_HISTORY_PAGE_SIZE < exportBatches.length;
  const canGoExportHistoryPrev = exportHistoryPage > 1;

  const goToNextExportHistoryPage = () => {
    if (!canGoExportHistoryNext) return;
    setExportHistoryPage((currentPage) => currentPage + 1);
  };

  const goToPrevExportHistoryPage = () => {
    if (!canGoExportHistoryPrev) return;
    setExportHistoryPage((currentPage) => Math.max(1, currentPage - 1));
  };

  const getStatusBadge = (status: string, paidConfirmed?: boolean) => {
    if (paidConfirmed) {
      return (
        <Badge variant="outline" className="bg-[#064e3b]/10 text-[#064e3b] border-[#064e3b]/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid Confirmed
        </Badge>
      );
    }
    switch (status) {
      case 'captured':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Captured
          </Badge>
        );
      case 'exported':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Download className="w-3 h-3 mr-1" />
            Exported
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Total gift aid amount for donations shown in the table (filtered donations)
  const totalGiftAidPending = filteredDonations.reduce((sum, d) => sum + (d.giftAidAmount || 0), 0);

  // Total gift aid amount for all donations (regardless of status)
  const totalGiftAidClaimed = giftAidDonations.reduce((sum, d) => sum + (d.giftAidAmount || 0), 0);

  const handleViewDetails = (donation: GiftAidDeclaration) => {
    setSelectedDonation(donation);
    setCharitySubmittedReference(donation.charitySubmittedReference || '');
    setShowDetailsDialog(true);
  };

  const handleExportData = async () => {
    if (!userSession.user.organizationId || !canExportGiftAid) return;

    setIsExporting(true);
    setMutationError(null);

    try {
      const exportResult = await exportGiftAidDeclarations(userSession.user.organizationId);

      if (exportResult.empty) {
        showToast(
          exportResult.message || 'No captured Gift Aid declarations were available to export.',
          'info',
        );
        return;
      }

      if (!exportResult.batchId) {
        throw new Error('Export completed but no batch id was returned.');
      }

      if (exportResult.hmrcFile) {
        await downloadGiftAidExportFile(exportResult.batchId, 'hmrc', exportResult.hmrcFile);
      }

      if (exportResult.internalFile) {
        try {
          await downloadGiftAidExportFile(
            exportResult.batchId,
            'internal',
            exportResult.internalFile,
          );
        } catch (downloadError) {
          console.error('Failed to download internal Gift Aid export:', downloadError);
          showToast('Export succeeded, but the internal CSV download failed.', 'warning');
        }
      }

      setLocalOverrides({});
      refresh();
      setExportHistoryPage(1);
      await loadExportBatches(userSession.user.organizationId);
      showToast(
        `Exported ${exportResult.rowCount} Gift Aid declarations in batch ${exportResult.batchId}.`,
        'success',
      );
    } catch (exportError) {
      console.error('Failed to export Gift Aid declarations:', exportError);
      const message =
        exportError instanceof Error
          ? exportError.message
          : 'Failed to export Gift Aid declarations.';
      setMutationError(message);
      showToast(message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleMarkPaidConfirmed = async () => {
    if (!selectedDonation) return;

    setIsUpdatingPaid(true);
    setMutationError(null);
    try {
      await giftAidApi.markDeclarationPaidConfirmed(
        selectedDonation.id,
        charitySubmittedReference.trim() || undefined,
      );
      const paidConfirmedAt = new Date().toISOString();
      const override = {
        paidConfirmed: true,
        paidConfirmedAt,
        charitySubmittedReference: charitySubmittedReference.trim() || null,
      };
      setLocalOverrides((prev) => ({
        ...prev,
        [selectedDonation.id]: { ...prev[selectedDonation.id], ...override },
      }));
      setSelectedDonation((prev) => (prev ? { ...prev, ...override } : prev));
    } catch (markError) {
      console.error('Failed to mark declaration as paid confirmed:', markError);
      setMutationError('Failed to mark declaration as paid confirmed.');
    } finally {
      setIsUpdatingPaid(false);
    }
  };

  const handleRefresh = () => {
    setMutationError(null);
    setLocalOverrides({});
    refresh();
    if (userSession.user.organizationId && canDownloadGiftAidBatchHistory) {
      setExportHistoryPage(1);
      void loadExportBatches(userSession.user.organizationId);
    }
  };

  const handleDownloadBatchFile = async (
    batchId: string,
    fileKind: 'hmrc' | 'internal',
    file: GiftAidExportFile | null | undefined,
  ) => {
    if (!canDownloadGiftAidBatchHistory) {
      showToast('You do not have permission to download Gift Aid export batches.', 'warning');
      return;
    }

    if (!file) {
      showToast('This export file is unavailable for download.', 'warning');
      return;
    }

    const downloadKey = `${batchId}:${fileKind}`;
    setActiveDownloadKey(downloadKey);
    try {
      await downloadGiftAidExportFile(batchId, fileKind, file);
    } catch (downloadError) {
      console.error(`Failed to download ${fileKind} Gift Aid export:`, downloadError);
      showToast(
        'The stored export file could not be downloaded. It may have been removed from storage.',
        'error',
      );
    } finally {
      setActiveDownloadKey(null);
    }
  };

  const formatBatchTimestamp = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewExportHistory = () => {
    if (!canDownloadGiftAidBatchHistory) return;
    exportHistoryRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    exportHistoryRef.current?.focus({ preventScroll: true });
  };

  // Check permissions
  if (!hasPermission('view_donations')) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-gift-aid"
      >
        <div className="p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">Access Denied</p>
              </div>
              <p className="text-red-700 mt-2">
                You don't have permission to view Gift Aid donations. Please contact your
                administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      activeScreen="admin-gift-aid"
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
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Gift Aid</h1>
        </div>
      }
      headerSubtitle="Manage and track Gift Aid eligible donations for tax reclaim"
      headerSearchPlaceholder="Search by donor name or campaign..."
      headerSearchValue={searchTerm}
      onHeaderSearchChange={setSearchTerm}
      headerTopRightActions={
        canExportGiftAid || canDownloadGiftAidBatchHistory ? (
          <div className="flex items-center gap-2">
            {canDownloadGiftAidBatchHistory ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl border-[#064e3b]/20 bg-white/70 text-[#064e3b] hover:bg-emerald-50 hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-900/10 hover:scale-105 transition-all duration-300 px-5"
                onClick={handleViewExportHistory}
              >
                <Clock className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">View History</span>
              </Button>
            ) : null}
            {canExportGiftAid ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl border-[#064e3b] bg-transparent text-[#064e3b] hover:bg-emerald-50 hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-900/10 hover:scale-105 transition-all duration-300 px-5"
                onClick={handleExportData}
                disabled={isExporting || !userSession.user.organizationId}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {isExporting ? 'Exporting...' : 'Export & Track'}
                </span>
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="px-6 lg:px-8 pt-12 pb-8 space-y-6 sm:space-y-8">
        {/* Error Alert */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Gift Aid (Shown)</p>
                  <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                    {loading ? '...' : formatCurrency(totalGiftAidPending)}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Gift Aid</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#064e3b]">
                    {loading ? '...' : formatCurrency(totalGiftAidClaimed)}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-[#064e3b]/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-[#064e3b]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Donations</p>
                  <p className="text-xl sm:text-2xl font-bold text-indigo-600">
                    {loading ? '...' : giftAidDonations.length}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Reconciliation Issues</p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">
                    {loading ? '...' : unresolvedReconciliationCount}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
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
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh"
              className="border-[#064e3b]/20 text-[#064e3b] hover:bg-[#064e3b]/10 hover:text-[#064e3b] hover:border-[#064e3b]/30"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} sm:mr-2`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          }
        />

        {canDownloadGiftAidBatchHistory ? (
          <div
            ref={exportHistoryRef}
            tabIndex={-1}
            className="scroll-mt-24 rounded-2xl focus:outline-none"
          >
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Export History</h2>
                    <p className="text-sm text-gray-500">
                      Re-download previous HMRC and internal Gift Aid export batches.
                    </p>
                  </div>
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="batch"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3"
                        >
                          Batch
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="created"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3"
                        >
                          Created
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="rows"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3"
                        >
                          Rows
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="actor"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3"
                        >
                          Exported By
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="status"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3"
                        >
                          Status
                        </SortableTableHeader>
                        <SortableTableHeader
                          sortable={false}
                          sortKey="downloads"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          className="p-3"
                        >
                          Downloads
                        </SortableTableHeader>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exportHistoryLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <TableRow key={`export-history-skeleton-${index}`}>
                            <TableCell className="p-3">
                              <Skeleton className="h-5 w-32" />
                            </TableCell>
                            <TableCell className="p-3">
                              <Skeleton className="h-5 w-36" />
                            </TableCell>
                            <TableCell className="p-3">
                              <Skeleton className="h-5 w-12" />
                            </TableCell>
                            <TableCell className="p-3">
                              <Skeleton className="h-5 w-32" />
                            </TableCell>
                            <TableCell className="p-3">
                              <Skeleton className="h-5 w-20" />
                            </TableCell>
                            <TableCell className="p-3">
                              <Skeleton className="h-9 w-40" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : exportBatches.length > 0 ? (
                        paginatedExportBatches.map((batch) => (
                          <TableRow key={batch.id}>
                            <TableCell className="p-3">
                              <div className="font-medium text-slate-900">
                                {batch.batchId || batch.id}
                              </div>
                            </TableCell>
                            <TableCell className="p-3 text-sm text-gray-700">
                              {formatBatchTimestamp(batch.completedAt || batch.createdAt)}
                            </TableCell>
                            <TableCell className="p-3 text-sm text-gray-700">
                              {batch.rowCount ?? 0}
                            </TableCell>
                            <TableCell className="p-3 text-sm text-gray-700">
                              {batch.createdByName || batch.createdByEmail || 'Unknown'}
                            </TableCell>
                            <TableCell className="p-3">
                              {batch.status === 'completed' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-[#064e3b]/10 text-[#064e3b] border-[#064e3b]/20"
                                >
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Completed
                                </Badge>
                              ) : batch.status === 'failed' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200"
                                >
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Failed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-yellow-50 text-yellow-700 border-yellow-200"
                                >
                                  <Clock className="mr-1 h-3 w-3" />
                                  {batch.status || 'Pending'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="p-3">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    !canDownloadGiftAidBatchHistory ||
                                    !batch.hmrcFile ||
                                    activeDownloadKey === `${batch.id}:hmrc`
                                  }
                                  onClick={() =>
                                    void handleDownloadBatchFile(batch.id, 'hmrc', batch.hmrcFile)
                                  }
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  {activeDownloadKey === `${batch.id}:hmrc`
                                    ? 'Downloading...'
                                    : 'HMRC CSV'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    !canDownloadGiftAidBatchHistory ||
                                    !batch.internalFile ||
                                    activeDownloadKey === `${batch.id}:internal`
                                  }
                                  onClick={() =>
                                    void handleDownloadBatchFile(
                                      batch.id,
                                      'internal',
                                      batch.internalFile,
                                    )
                                  }
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  {activeDownloadKey === `${batch.id}:internal`
                                    ? 'Downloading...'
                                    : 'Internal CSV'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="p-6 text-center text-sm text-gray-500">
                            No Gift Aid export batches yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {exportHistoryLoading ? (
                    Array.from({ length: 2 }).map((_, index) => (
                      <Card
                        key={`export-history-mobile-skeleton-${index}`}
                        className="border border-gray-100 shadow-sm"
                      >
                        <CardContent className="space-y-3 p-4">
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-9 w-full" />
                        </CardContent>
                      </Card>
                    ))
                  ) : exportBatches.length > 0 ? (
                    paginatedExportBatches.map((batch) => (
                      <Card key={batch.id} className="border border-gray-100 shadow-sm">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-slate-900">
                                {batch.batchId || batch.id}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatBatchTimestamp(batch.completedAt || batch.createdAt)}
                              </div>
                            </div>
                            <div>
                              {batch.status === 'completed' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-[#064e3b]/10 text-[#064e3b] border-[#064e3b]/20"
                                >
                                  Completed
                                </Badge>
                              ) : batch.status === 'failed' ? (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200"
                                >
                                  Failed
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-yellow-50 text-yellow-700 border-yellow-200"
                                >
                                  {batch.status || 'Pending'}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-gray-500">Rows</p>
                              <p className="font-medium text-slate-900">{batch.rowCount ?? 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Exported By</p>
                              <p className="font-medium text-slate-900">
                                {batch.createdByName || batch.createdByEmail || 'Unknown'}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                !canDownloadGiftAidBatchHistory ||
                                !batch.hmrcFile ||
                                activeDownloadKey === `${batch.id}:hmrc`
                              }
                              onClick={() =>
                                void handleDownloadBatchFile(batch.id, 'hmrc', batch.hmrcFile)
                              }
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {activeDownloadKey === `${batch.id}:hmrc`
                                ? 'Downloading...'
                                : 'HMRC CSV'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                !canDownloadGiftAidBatchHistory ||
                                !batch.internalFile ||
                                activeDownloadKey === `${batch.id}:internal`
                              }
                              onClick={() =>
                                void handleDownloadBatchFile(
                                  batch.id,
                                  'internal',
                                  batch.internalFile,
                                )
                              }
                            >
                              <Download className="mr-2 h-4 w-4" />
                              {activeDownloadKey === `${batch.id}:internal`
                                ? 'Downloading...'
                                : 'Internal CSV'}
                            </Button>
                          </div>

                          {batch.status === 'failed' && batch.failureMessage ? (
                            <p className="text-sm text-red-600">{batch.failureMessage}</p>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                      No Gift Aid export batches yet.
                    </div>
                  )}
                </div>

                {!exportHistoryLoading && exportBatches.length > EXPORT_HISTORY_PAGE_SIZE ? (
                  <div className="border-t border-gray-100 px-4 py-4 sm:px-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              goToPrevExportHistoryPage();
                            }}
                            className={
                              !canGoExportHistoryPrev ? 'pointer-events-none opacity-50' : ''
                            }
                          />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            isActive
                            size="default"
                            onClick={(event) => event.preventDefault()}
                          >
                            Page {exportHistoryPage}
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              goToNextExportHistoryPage();
                            }}
                            className={
                              !canGoExportHistoryNext ? 'pointer-events-none opacity-50' : ''
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Donations Table - Desktop */}
        <Card className="overflow-hidden hidden md:block">
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <SortableTableHeader
                    sortKey="donorName"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    className="p-3 w-[22%]"
                  >
                    Donor
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="campaignTitle"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    className="p-3 w-[22%]"
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
                    Donation
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="giftAidAmount"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    className="p-3 w-[14%]"
                  >
                    Gift Aid
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="donationDateTs"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    className="p-3 w-[14%]"
                  >
                    Date
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortable={false}
                    sortKey="actions"
                    currentSortKey={sortKey}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    className="p-3 w-[14%]"
                  >
                    Actions
                  </SortableTableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="h-16">
                      <TableCell className="py-4">
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell className="py-4">
                        <Skeleton className="h-8 w-8 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredDonations.length > 0 ? (
                  filteredDonations.map((donation) => (
                    <TableRow key={donation.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="p-3">
                        <p
                          className="text-base text-gray-900 truncate max-w-[220px]"
                          title={`${donation.donorFirstName} ${donation.donorSurname}`.trim()}
                        >
                          {`${donation.donorFirstName} ${donation.donorSurname}`.trim()}
                        </p>
                      </TableCell>
                      <TableCell className="p-3">
                        <p
                          className="text-base text-gray-800 truncate max-w-[220px]"
                          title={donation.campaignTitle}
                        >
                          {donation.campaignTitle}
                        </p>
                      </TableCell>
                      <TableCell className="p-3">
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(donation.donationAmount || 0)}
                        </p>
                      </TableCell>
                      <TableCell className="p-3">
                        <p className="text-base font-bold text-[#064e3b]">
                          {formatCurrency(donation.giftAidAmount || 0)}
                        </p>
                      </TableCell>
                      <TableCell className="p-3">
                        <p className="text-base text-gray-700">
                          {donation.donationDate
                            ? (() => {
                                const date = new Date(donation.donationDate);
                                return isNaN(date.getTime())
                                  ? 'Invalid Date'
                                  : date.toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    });
                              })()
                            : 'N/A'}
                        </p>
                      </TableCell>
                      <TableCell className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(donation);
                          }}
                          className="mx-auto"
                          title="View donation details"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 p-6">
                      <div className="flex flex-col items-center gap-2">
                        <Gift className="h-12 w-12 text-gray-400" />
                        <p className="text-xl font-bold text-gray-600">
                          No Gift Aid donations found
                        </p>
                        <p className="text-base text-gray-500 mt-2">
                          {searchTerm || statusFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Gift Aid eligible donations will appear here when donors opt-in for Gift Aid'}
                        </p>
                        {!searchTerm && statusFilter === 'all' && (
                          <p className="text-sm text-gray-400 mt-2">
                            Gift Aid declarations are created automatically when donors opt-in
                            during the donation process.
                          </p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination — desktop */}
        {(filteredDonations.length > 0 || canGoPrev) && (
          <div className="hidden md:block border border-gray-100 rounded-lg px-4 bg-white">
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

        {/* Donations Cards - Mobile */}
        <div className="md:hidden space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredDonations.length > 0 ? (
            filteredDonations.map((donation) => (
              <Card
                key={donation.id}
                className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {`${donation.donorFirstName} ${donation.donorSurname}`.trim() || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">{donation.campaignTitle || 'N/A'}</div>
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className="bg-[#064e3b]/10 text-[#064e3b] border-[#064e3b]/20"
                        >
                          <Gift className="w-3 h-3 mr-1" />
                          Gift Aid
                        </Badge>
                      </div>
                    </div>
                    <div>
                      {getStatusBadge(
                        donation.operationalStatus || 'captured',
                        donation.paidConfirmed,
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Donation</p>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(donation.donationAmount || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Gift Aid</p>
                      <p className="font-semibold text-[#064e3b]">
                        {formatCurrency(donation.giftAidAmount || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="text-slate-900">
                        {donation.donationDate && donation.donationDate !== 'Unknown Date'
                          ? new Date(donation.donationDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Tax Year</p>
                      <p className="text-slate-900">{donation.taxYear || 'N/A'}</p>
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
            ))
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Gift className="h-12 w-12 text-gray-400" />
                  <p className="text-xl font-bold text-gray-600">No Gift Aid donations found</p>
                  <p className="text-base text-gray-500 mt-2">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Gift Aid eligible donations will appear here when donors opt-in for Gift Aid'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-[#064e3b]" />
                Gift Aid Donation Details
              </DialogTitle>
              <DialogDescription>
                Complete information about this Gift Aid eligible donation
              </DialogDescription>
            </DialogHeader>

            {selectedDonation && (
              <div className="grid gap-4 py-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Donor Name</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {`${selectedDonation.donorFirstName} ${selectedDonation.donorSurname}`.trim()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Donation Amount</Label>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatCurrency(selectedDonation.donationAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(
                        selectedDonation.operationalStatus || 'captured',
                        selectedDonation.paidConfirmed,
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Gift Aid Amount</Label>
                    <p className="text-sm font-semibold text-[#064e3b] mt-1">
                      {formatCurrency(selectedDonation.giftAidAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Tax Year</Label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedDonation.taxYear || 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Campaign</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedDonation.campaignTitle || 'N/A'}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Donation Date</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedDonation.donationDate
                      ? (() => {
                          const date = new Date(selectedDonation.donationDate);
                          return isNaN(date.getTime())
                            ? 'Invalid Date'
                            : date.toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              });
                        })()
                      : 'N/A'}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Address</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {`${selectedDonation.donorHouseNumber || ''}, ${selectedDonation.donorAddressLine1 || ''}, ${selectedDonation.donorAddressLine2 || ''}, ${selectedDonation.donorTown || ''}, ${selectedDonation.donorPostcode || ''}`.replace(
                      /^,\s*|,\s*$/g,
                      '',
                    )}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Transaction ID</Label>
                  <p className="text-xs text-gray-700 font-mono mt-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block break-all">
                    {selectedDonation.donationId || 'N/A'}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Declaration Date</Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedDonation.declarationDate || 'N/A'}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    UK Taxpayer Confirmation
                  </Label>
                  <p className="text-sm text-gray-900 mt-1">
                    {selectedDonation.ukTaxpayerConfirmation ? 'Confirmed' : 'Not confirmed'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Operational Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(
                        selectedDonation.operationalStatus || 'captured',
                        selectedDonation.paidConfirmed,
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Exported At</Label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedDonation.exportedAt || 'Not exported'}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Charity Submitted Reference (Optional)
                  </Label>
                  <Input
                    value={charitySubmittedReference}
                    onChange={(e) => setCharitySubmittedReference(e.target.value)}
                    placeholder="e.g. HMRC-REF-2026-001"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                onClick={handleMarkPaidConfirmed}
                disabled={!selectedDonation || isUpdatingPaid || selectedDonation?.paidConfirmed}
              >
                {selectedDonation?.paidConfirmed
                  ? 'Paid Confirmed'
                  : isUpdatingPaid
                    ? 'Saving...'
                    : 'Mark Paid Confirmed'}
              </Button>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
