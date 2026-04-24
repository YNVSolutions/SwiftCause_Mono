'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { db } from '../../shared/lib/firebase';
import { useKiosks } from '../../shared/lib/hooks/useKiosks';
import { useLocations } from '../../shared/lib/hooks/useLocations';
import { useCampaigns } from '../../entities/campaign';
import { exportKiosks } from '../../entities/kiosk/api';
import { createLocation, updateLocationImmutable } from '../../entities/location/api/locationApi';
import { LocationFormData } from '../../entities/location';
import { useKioskPerformance } from '../../shared/lib/hooks/useKioskPerformance';
import { useOrganization } from '../../shared/lib/hooks/useOrganization';
import { useStripeOnboarding, StripeOnboardingDialog } from '../../features/stripe-onboarding';
import { collection, updateDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { Screen, Kiosk, AdminSession, Permission } from '../../shared/types';
import { formatCurrency } from '../../shared/lib/currencyFormatter';
import {
  syncCampaignsForKiosk,
  removeKioskFromAllCampaigns,
} from '../../shared/lib/sync/campaignKioskSync';
import { PaginationControls } from '../../shared/ui/PaginationControls';

import { Button } from '../../shared/ui/button';
import { Badge } from '../../shared/ui/badge';
import { Card, CardContent } from '../../shared/ui/card';
import { Dialog, DialogContent, DialogTitle, VisuallyHidden } from '../../shared/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../shared/ui/table';

import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  Eye,
  EyeOff,
  Copy,
  Check,
  MoreVertical,
  DollarSign,
  Users,
  Settings,
  Activity,
  AlertTriangle,
  Download,
  Loader2,
  Building2,
  Ghost,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { KioskForm, KioskFormData } from './components/KioskForm';
import { useToast } from '../../shared/ui/ToastProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu';
import {
  AdminSearchFilterHeader,
  AdminSearchFilterConfig,
} from './components/AdminSearchFilterHeader';
import { SortableTableHeader } from './components/SortableTableHeader';
import { useTableSort } from '../../shared/lib/hooks/useTableSort';

export function KioskManagement({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'maintenance'>(
    'all',
  );

  const {
    kiosks,
    loading: kiosksLoading,
    fetching,
    pageNumber,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    pageSize,
    refresh: refreshKiosks,
  } = useKiosks(userSession.user.organizationId, { status: statusFilter });

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    refetch: refetchLocations,
  } = useLocations(userSession.user.organizationId);

  const {
    campaigns,
    loading: campaignsLoading,
    refresh: refreshCampaigns,
  } = useCampaigns(userSession.user.organizationId);

  const performanceData = useKioskPerformance(kiosks);

  const { organization, loading: orgLoading } = useOrganization(
    userSession.user.organizationId ?? null,
  );
  const { needsOnboarding } = useStripeOnboarding(organization);
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);

  const isLoading = kiosksLoading || campaignsLoading;

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((location) => {
      map.set(location.id, location.name);
    });
    return map;
  }, [locations]);

  const filteredKiosksData = kiosks.filter(
    (kiosk) =>
      kiosk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kiosk.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kiosk.id.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const {
    sortedData: filteredKiosks,
    sortKey,
    sortDirection,
    handleSort,
  } = useTableSort({
    data: filteredKiosksData,
  });

  const totalStats = {
    online: filteredKiosks.filter((k) => k.status === 'online').length,
    offline: filteredKiosks.filter((k) => k.status === 'offline').length,
    maintenance: filteredKiosks.filter((k) => k.status === 'maintenance').length,
    totalRaised: Object.values(performanceData).reduce((sum, d) => sum + (d?.totalRaised || 0), 0),
    totalDonations: Object.values(performanceData).reduce(
      (sum, d) => sum + (d?.donorCount || 0),
      0,
    ),
  };

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [isCreatingKiosk, setIsCreatingKiosk] = useState(false);
  const [newKiosk, setNewKiosk] = useState<KioskFormData>({
    name: '',
    location: '',
    location_id: undefined,
    accessCode: '',
    status: 'offline' as Kiosk['status'],
    assignedCampaigns: [] as string[],
    displayLayout: 'grid' as 'grid' | 'list' | 'carousel',
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [kioskToDelete, setKioskToDelete] = useState<Kiosk | null>(null);
  const [isDeletingKiosk, setIsDeletingKiosk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [showAccessCodes, setShowAccessCodes] = useState<{ [key: string]: boolean }>({});
  const [copiedIds, setCopiedIds] = useState<{ [key: string]: boolean }>({});
  const lastLocationsErrorRef = useRef<string | null>(null);

  const normalizeAssignedCampaigns = (campaignIds?: string[]) =>
    Array.from(new Set((campaignIds || []).filter(Boolean)));

  const searchFilterConfig: AdminSearchFilterConfig = {
    filters: [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
          { label: 'Online', value: 'online' },
          { label: 'Offline', value: 'offline' },
          { label: 'Maintenance', value: 'maintenance' },
        ],
      },
    ],
  };

  const filterValues = { statusFilter };

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === 'statusFilter') {
      setStatusFilter(value as typeof statusFilter);
    }
  }, []);

  useEffect(() => {
    refreshCampaigns();
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!locationsError) {
      lastLocationsErrorRef.current = null;
      return;
    }

    const message =
      locationsError instanceof Error ? locationsError.message : 'Failed to load locations.';
    if (lastLocationsErrorRef.current === message) return;

    lastLocationsErrorRef.current = message;
    showToast(`Location data unavailable: ${message}`, 'error');
  }, [locationsError, showToast]);

  const handleAssignCampaign = (campaignId: string) => {
    if (needsOnboarding) {
      setShowOnboardingDialog(true);
      return;
    }

    setNewKiosk((prev) => ({
      ...prev,
      assignedCampaigns: normalizeAssignedCampaigns([...prev.assignedCampaigns, campaignId]),
    }));
  };

  const handleUnassignCampaign = (campaignId: string) => {
    setNewKiosk((prev) => ({
      ...prev,
      assignedCampaigns: prev.assignedCampaigns.filter((id) => id !== campaignId),
    }));
  };

  const handleCreateLocation = async (
    locationData: LocationFormData,
    oldLocationId?: string,
  ): Promise<string> => {
    if (!userSession.user.organizationId) {
      throw new Error('Organization ID is required to create a location');
    }
    try {
      const newLocationId = oldLocationId
        ? await updateLocationImmutable(
            userSession.user.organizationId,
            oldLocationId,
            locationData,
            userSession.user.id,
          )
        : await createLocation(userSession.user.organizationId, locationData, userSession.user.id);
      await refetchLocations();
      return newLocationId;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  };

  const handleCreateKiosk = async () => {
    if (!newKiosk.name || !newKiosk.location_id || !userSession) return;

    setIsCreatingKiosk(true);
    try {
      const normalizedAssignedCampaigns = normalizeAssignedCampaigns(newKiosk.assignedCampaigns);

      if (editingKiosk) {
        const selectedLocationName =
          locationNameById.get(newKiosk.location_id) || newKiosk.location || editingKiosk.location;
        const updatedKioskData = {
          name: newKiosk.name,
          location: selectedLocationName,
          location_id: newKiosk.location_id,
          accessCode: newKiosk.accessCode,
          status: newKiosk.status,
          assignedCampaigns: normalizedAssignedCampaigns,
          settings: {
            ...editingKiosk.settings,
            displayMode: newKiosk.displayLayout,
          },
          organizationId: userSession.user.organizationId,
        };
        const kioskRef = doc(db, 'kiosks', editingKiosk.id);
        await updateDoc(kioskRef, updatedKioskData);

        const oldAssignedCampaigns = editingKiosk.assignedCampaigns || [];
        await syncCampaignsForKiosk(
          editingKiosk.id,
          normalizedAssignedCampaigns,
          oldAssignedCampaigns,
        );
      } else {
        const selectedLocationName =
          locationNameById.get(newKiosk.location_id) || newKiosk.location;
        const newKioskData: Omit<Kiosk, 'id'> = {
          name: newKiosk.name,
          location: selectedLocationName,
          location_id: newKiosk.location_id,
          accessCode: newKiosk.accessCode,
          status: newKiosk.status,
          lastActive: new Date().toISOString(),
          totalDonations: 0,
          totalRaised: 0,
          assignedCampaigns: normalizedAssignedCampaigns,
          defaultCampaign: '',
          deviceInfo: {},
          operatingHours: {},
          settings: {
            displayMode: newKiosk.displayLayout,
            showAllCampaigns: true,
            maxCampaignsDisplay: 6,
            autoRotateCampaigns: false,
          },
          organizationId: userSession.user.organizationId,
        };
        const docRef = await addDoc(collection(db, 'kiosks'), newKioskData);

        await syncCampaignsForKiosk(docRef.id, normalizedAssignedCampaigns, []);
      }
      refreshKiosks();
      refreshCampaigns();
      setNewKiosk({
        name: '',
        location: '',
        location_id: undefined,
        accessCode: '',
        status: 'offline',
        assignedCampaigns: [],
        displayLayout: 'grid',
      });
      setIsCreateDialogOpen(false);
      setEditingKiosk(null);
    } catch (error) {
      console.error('Error saving kiosk: ', error);
      const message = error instanceof Error ? error.message : 'Failed to save kiosk.';
      showToast(message, 'error');
    } finally {
      setIsCreatingKiosk(false);
    }
  };

  const handleCancel = () => {
    setIsCreateDialogOpen(false);
    setEditingKiosk(null);
    setNewKiosk({
      name: '',
      location: '',
      location_id: undefined,
      accessCode: '',
      status: 'offline',
      assignedCampaigns: [],
      displayLayout: 'grid',
    });
  };

  const handleEditKiosk = (kiosk: Kiosk) => {
    const normalizedLegacyLocationName = kiosk.location?.trim().toLowerCase();
    const matchedLocations = normalizedLegacyLocationName
      ? locations.filter(
          (location) => location.name.trim().toLowerCase() === normalizedLegacyLocationName,
        )
      : [];

    const hasReferencedLocation =
      !!kiosk.location_id && locations.some((location) => location.id === kiosk.location_id);
    let inferredLocationId = hasReferencedLocation ? kiosk.location_id : undefined;

    if (kiosk.location_id && !hasReferencedLocation) {
      showToast(
        'This kiosk references an unavailable location. Please select a valid location before saving.',
        'warning',
      );
    }

    if (!inferredLocationId && matchedLocations.length === 1) {
      inferredLocationId = matchedLocations[0].id;
    }

    if (!inferredLocationId) {
      if (matchedLocations.length > 1) {
        showToast(
          'Multiple locations match this kiosk. Please select the correct location before saving.',
          'warning',
        );
      } else {
        showToast(
          'This kiosk has no location mapping. Please select a location before saving.',
          'warning',
        );
      }
    }

    setEditingKiosk(kiosk);
    setNewKiosk({
      name: kiosk.name,
      location: kiosk.location,
      location_id: inferredLocationId,
      accessCode: kiosk.accessCode || '',
      status: kiosk.status,
      assignedCampaigns: normalizeAssignedCampaigns(kiosk.assignedCampaigns),
      displayLayout: (kiosk.settings?.displayMode as 'grid' | 'list' | 'carousel') || 'grid',
    });
    setIsCreateDialogOpen(true);
  };

  const handleDeleteKiosk = (kiosk: Kiosk) => {
    setKioskToDelete(kiosk);
    setIsDeleteDialogOpen(true);
  };

  const handleEditCampaign = (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (campaign) {
      onNavigate(`admin-campaigns`);
    }
  };

  const confirmDeleteKiosk = async () => {
    if (!kioskToDelete) return;

    setIsDeletingKiosk(true);
    try {
      const assignedCampaigns = kioskToDelete.assignedCampaigns || [];
      await removeKioskFromAllCampaigns(kioskToDelete.id, assignedCampaigns);

      await deleteDoc(doc(db, 'kiosks', kioskToDelete.id));
      refreshKiosks();
      refreshCampaigns();
      setIsDeleteDialogOpen(false);
      setKioskToDelete(null);
    } catch (error) {
      console.error('Error deleting kiosk: ', error);
    } finally {
      setIsDeletingKiosk(false);
    }
  };

  const copyKioskId = async (kioskId: string) => {
    try {
      await navigator.clipboard.writeText(kioskId);
      setCopiedIds((prev) => ({ ...prev, [kioskId]: true }));

      setTimeout(() => {
        setCopiedIds((prev) => ({ ...prev, [kioskId]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy kiosk ID:', error);
    }
  };

  const toggleAccessCode = (kioskId: string) => {
    setShowAccessCodes((prev) => ({
      ...prev,
      [kioskId]: !prev[kioskId],
    }));
  };

  const handleExportKiosks = async () => {
    if (!hasPermission('export_kiosks')) return;
    if (!userSession.user.organizationId) {
      showToast('Organization ID is required to export kiosks.', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      await exportKiosks({
        organizationId: userSession.user.organizationId,
        filters: {
          searchTerm,
          status: statusFilter,
        },
      });
      showToast('Kiosk export started. Your download should begin shortly.', 'success');
    } catch (exportError) {
      console.error('Kiosk export failed:', exportError);
      const message =
        exportError instanceof Error ? exportError.message : 'Failed to export kiosks.';
      showToast(message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-[#064e3b]/10 text-[#064e3b] border-[#064e3b]/20">Online</Badge>;
      case 'offline':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Offline</Badge>;
      case 'maintenance':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Maintenance</Badge>
        );
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-kiosks"
      >
        <div className="min-h-screen bg-gray-50">
          <div className="text-center py-12">
            <div className="animate-pulse">
              <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-3"></div>
              <div className="h-4 bg-gray-300 rounded w-32 mx-auto mb-2"></div>
              <div className="h-3 bg-gray-300 rounded w-48 mx-auto"></div>
            </div>
          </div>
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
      activeScreen="admin-kiosks"
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
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Kiosks</h1>
        </div>
      }
      headerSubtitle="Configure and monitor donation kiosks"
      headerSearchPlaceholder="Search kiosks..."
      headerSearchValue={searchTerm}
      onHeaderSearchChange={setSearchTerm}
      headerTopRightActions={
        hasPermission('export_kiosks') ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl border-[#064e3b] bg-transparent text-[#064e3b] hover:bg-emerald-50 hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-900/10 hover:scale-105 transition-all duration-300 px-5"
            onClick={handleExportKiosks}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
          </Button>
        ) : null
      }
      headerInlineActions={
        hasPermission('create_kiosk') ? (
          <Button
            onClick={() => {
              setIsCreateDialogOpen(true);
            }}
            className="h-10 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Kiosk
          </Button>
        ) : null
      }
    >
      <div className="min-h-screen bg-gray-50">
        <main className="px-6 lg:px-8 pt-12 pb-8">
          {/* Stat Cards Section */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Kiosks</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                      {filteredKiosks.length}
                    </p>
                    <div className="flex items-center space-x-2 sm:space-x-4 text-xs text-gray-500 mt-1">
                      <span className="text-[#064e3b]">{totalStats.online} online</span>
                      <span className="text-red-600">{totalStats.offline} offline</span>
                    </div>
                  </div>
                  <Settings className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Raised</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                      {formatCurrency(totalStats.totalRaised)}
                    </p>
                  </div>
                  <DollarSign className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-[#064e3b]" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total Donations</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                      {totalStats.totalDonations.toLocaleString()}
                    </p>
                  </div>
                  <Users className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Maintenance</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">
                      {totalStats.maintenance}
                    </p>
                  </div>
                  <Activity className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Unified Header Component */}
          <AdminSearchFilterHeader
            config={searchFilterConfig}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
          />

          {/* Modern Table Container */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {filteredKiosks.length > 0 ? (
                <>
                  <div className="md:hidden px-6 py-6 space-y-4">
                    {filteredKiosks.map((kiosk) => {
                      const assignedIds = Array.from(new Set(kiosk.assignedCampaigns || [])).filter(
                        Boolean,
                      );
                      const assignedCount = campaigns.filter((c) =>
                        assignedIds.includes(c.id),
                      ).length;

                      return (
                        <div
                          key={kiosk.id}
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {kiosk.name}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin className="h-3 w-3" />
                                {kiosk.location}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gray-500 hover:bg-gray-100"
                                  aria-label="Kiosk actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {hasPermission('edit_kiosk') ? (
                                  <DropdownMenuItem
                                    onSelect={() => handleEditKiosk(kiosk)}
                                    className="flex items-center gap-2"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled
                                    className="flex items-center gap-2 text-gray-400 cursor-not-allowed"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit (No permission)
                                  </DropdownMenuItem>
                                )}
                                {hasPermission('delete_kiosk') ? (
                                  <DropdownMenuItem
                                    onSelect={() => handleDeleteKiosk(kiosk)}
                                    className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled
                                    className="flex items-center gap-2 text-gray-400 cursor-not-allowed"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete (No permission)
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Kiosk ID
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-mono text-sm text-gray-900 break-all">
                                  {kiosk.id}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyKioskId(kiosk.id)}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-800"
                                  title="Copy ID"
                                >
                                  {copiedIds[kiosk.id] ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                                Access Code
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-mono text-sm text-gray-900">
                                  {showAccessCodes[kiosk.id]
                                    ? kiosk.accessCode || 'Not set'
                                    : '******'}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleAccessCode(kiosk.id)}
                                  className="h-8 w-8 text-blue-600 hover:text-blue-800"
                                  title={
                                    showAccessCodes[kiosk.id]
                                      ? 'Hide Access Code'
                                      : 'Show Access Code'
                                  }
                                >
                                  {showAccessCodes[kiosk.id] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">{getStatusBadge(kiosk.status)}</div>

                          <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
                            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                              Performance
                            </div>
                            <div className="mt-1 font-semibold text-gray-900">
                              {formatCurrency(performanceData[kiosk.id]?.totalRaised || 0)}
                            </div>
                          </div>

                          <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
                            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                              Campaign Assignment
                            </div>
                            <div className="mt-2">{assignedCount} assigned</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block overflow-hidden">
                    <Table className="w-full table-fixed">
                      <TableHeader>
                        <TableRow className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                          <SortableTableHeader
                            sortKey="name"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="w-[30%] px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide"
                          >
                            Kiosk Details
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortKey="status"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="w-[12%] px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide"
                          >
                            Status
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortKey="totalRaised"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="w-[15%] px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide text-right"
                          >
                            Performance
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortKey="assignedCampaigns"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="w-[18%] px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide"
                          >
                            Campaign Assignment
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortable={false}
                            sortKey="actions"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="w-[25%] px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide"
                          >
                            Actions
                          </SortableTableHeader>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-white divide-y divide-gray-200">
                        {filteredKiosks.map((kiosk) => (
                          <TableRow key={kiosk.id} className="hover:bg-gray-50">
                            <TableCell className="px-4 lg:px-6 py-4 whitespace-nowrap">
                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-900">
                                      {kiosk.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-gray-400" />
                                    <span className="text-sm text-gray-500">{kiosk.location}</span>
                                  </div>
                                </div>
                                <div className="bg-gray-50 rounded p-3 text-xs space-y-2">
                                  <div>
                                    <div className="text-gray-500 uppercase font-medium mb-1">
                                      Kiosk ID
                                    </div>
                                    <div className="font-mono text-gray-900 flex items-center justify-between">
                                      <span className="truncate">{kiosk.id}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyKioskId(kiosk.id)}
                                        className="h-auto p-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        title="Copy ID"
                                      >
                                        {copiedIds[kiosk.id] ? (
                                          <>
                                            <Check className="w-3 h-3" />
                                            Copied
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            Copy ID
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-500 uppercase font-medium mb-1">
                                      Access Code
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-blue-600 font-medium font-mono">
                                        {showAccessCodes[kiosk.id]
                                          ? kiosk.accessCode || 'Not set'
                                          : '******'}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleAccessCode(kiosk.id)}
                                        className="h-auto p-1 text-xs text-blue-600 hover:text-gray-800 flex items-center gap-1"
                                        title={
                                          showAccessCodes[kiosk.id]
                                            ? 'Hide Access Code'
                                            : 'Show Access Code'
                                        }
                                      >
                                        {showAccessCodes[kiosk.id] ? (
                                          <>
                                            <EyeOff className="w-3 h-3" />
                                            Hide
                                          </>
                                        ) : (
                                          <>
                                            <Eye className="w-3 h-3" />
                                            Show
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 lg:px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(kiosk.status)}
                            </TableCell>
                            <TableCell className="px-4 lg:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatCurrency(performanceData[kiosk.id]?.totalRaised || 0)}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 lg:px-6 py-4 whitespace-nowrap">
                              {(() => {
                                const assignedIds = Array.from(
                                  new Set(kiosk.assignedCampaigns || []),
                                ).filter(Boolean);
                                const assignedCount = campaigns.filter((c) =>
                                  assignedIds.includes(c.id),
                                ).length;
                                return (
                                  <div className="text-sm text-gray-500">
                                    {assignedCount} assigned
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="px-4 lg:px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {hasPermission('edit_kiosk') ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditKiosk(kiosk)}
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                    title="Edit Kiosk"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="h-8 w-8 p-0 text-gray-300 cursor-not-allowed"
                                    title="No permission to edit kiosks"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {hasPermission('delete_kiosk') ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteKiosk(kiosk)}
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                                    title="Delete Kiosk"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="h-8 w-8 p-0 text-gray-300 cursor-not-allowed"
                                    title="No permission to delete kiosks"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500 p-6">
                  <Ghost className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-lg font-medium mb-2">No Kiosks Found</p>
                  <p className="text-sm mb-4">No kiosks found matching your search criteria.</p>
                </div>
              )}
              {/* Pagination — shown whenever there's data or more pages */}
              {(filteredKiosks.length > 0 || canGoPrev) && (
                <div className="border-t border-gray-100 px-4">
                  <PaginationControls
                    pageNumber={pageNumber}
                    pageSize={pageSize}
                    totalOnPage={filteredKiosks.length}
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
        </main>
      </div>

      {/* Kiosk Setup/Edit Dialog */}
      <KioskForm
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setEditingKiosk(null);
            setNewKiosk({
              name: '',
              location: '',
              location_id: undefined,
              accessCode: '',
              status: 'offline',
              assignedCampaigns: [],
              displayLayout: 'grid',
            });
          }
        }}
        editingKiosk={editingKiosk}
        kioskData={newKiosk}
        setKioskData={setNewKiosk}
        campaigns={campaigns}
        locations={locations}
        hasPermission={hasPermission}
        onSubmit={handleCreateKiosk}
        onCancel={handleCancel}
        onAssignCampaign={handleAssignCampaign}
        onUnassignCampaign={handleUnassignCampaign}
        onEditCampaign={handleEditCampaign}
        onCreateLocation={handleCreateLocation}
        formatCurrency={formatCurrency}
        isLoading={isCreatingKiosk || locationsLoading}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <VisuallyHidden>
            <DialogTitle>Delete Kiosk Confirmation</DialogTitle>
          </VisuallyHidden>
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Kiosk</h2>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this kiosk? This action cannot be undone.
            </p>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeletingKiosk}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteKiosk}
                disabled={isDeletingKiosk}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {isDeletingKiosk ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stripe Onboarding Dialog */}
      <StripeOnboardingDialog
        open={showOnboardingDialog}
        onOpenChange={setShowOnboardingDialog}
        organization={organization}
        loading={orgLoading}
      />
    </AdminLayout>
  );
}
