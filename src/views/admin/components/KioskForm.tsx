'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Kiosk, Permission } from '../../../shared/types';
import { Location, LocationFormData } from '../../../entities/location';

import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from '../../../shared/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { LocationForm } from './LocationForm';

import {
  Plus,
  Menu,
  X,
  Grid3X3,
  List,
  GalleryThumbnails,
  Image,
  Save,
  Edit,
  Loader2,
} from 'lucide-react';

export interface KioskFormData {
  name: string;
  location: string;
  location_id?: string;
  accessCode: string;
  status: Kiosk['status'];
  assignedCampaigns: string[];
  displayLayout: 'grid' | 'list' | 'carousel';
}

export interface Campaign {
  id: string;
  title: string;
  raised: number;
  goal: number;
  coverImageUrl?: string;
}

export interface KioskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingKiosk: Kiosk | null;
  kioskData: KioskFormData;
  setKioskData: React.Dispatch<React.SetStateAction<KioskFormData>>;
  campaigns: Campaign[];
  locations?: Location[];
  hasPermission?: (permission: Permission) => boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onAssignCampaign: (campaignId: string) => void;
  onUnassignCampaign: (campaignId: string) => void;
  onEditCampaign?: (campaignId: string) => void;
  onCreateLocation?: (locationData: LocationFormData, oldLocationId?: string) => Promise<string>;
  formatCurrency: (amount: number) => string;
  isLoading?: boolean;
}

export function KioskForm({
  open,
  onOpenChange,
  editingKiosk,
  kioskData,
  setKioskData,
  campaigns,
  locations = [],
  hasPermission,
  onSubmit,
  onCancel,
  onAssignCampaign,
  onUnassignCampaign,
  onEditCampaign,
  onCreateLocation,
  formatCurrency,
  isLoading = false,
}: KioskFormProps) {
  const [activeSection, setActiveSection] = useState('basic-info');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [isCreatingLocation, setIsCreatingLocation] = useState(false);
  const [locationFormData, setLocationFormData] = useState<LocationFormData>({
    name: '',
    addressLine1: '',
    city: '',
    postcode: '',
    country: 'UK',
    isCommunityBuilding: false,
  });
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [editingSourceLocationId, setEditingSourceLocationId] = useState<string | undefined>(
    undefined,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const basicInfoRef = useRef<HTMLElement>(null);
  const locationRef = useRef<HTMLElement>(null);
  const campaignsRef = useRef<HTMLElement>(null);
  const displayRef = useRef<HTMLElement>(null);
  const sectionRefs = useMemo(
    () => ({
      'basic-info': basicInfoRef,
      location: locationRef,
      campaigns: campaignsRef,
      display: displayRef,
    }),
    [],
  );

  const navigationItems = [
    { id: 'basic-info', label: 'BASIC INFO' },
    { id: 'location', label: 'LOCATION' },
    ...(hasPermission?.('assign_campaigns') !== false
      ? [{ id: 'campaigns', label: 'CAMPAIGNS' }]
      : []),
    { id: 'display', label: 'DISPLAY' },
  ];

  const assignedCampaignIds = useMemo(
    () => Array.from(new Set((kioskData.assignedCampaigns || []).filter(Boolean))),
    [kioskData.assignedCampaigns],
  );

  const assignedCampaigns = useMemo(
    () =>
      assignedCampaignIds
        .map((campaignId) => campaigns.find((campaign) => campaign.id === campaignId))
        .filter((campaign): campaign is Campaign => Boolean(campaign)),
    [assignedCampaignIds, campaigns],
  );

  const unassignedCampaigns = useMemo(
    () => campaigns.filter((campaign) => !assignedCampaignIds.includes(campaign.id)),
    [campaigns, assignedCampaignIds],
  );

  useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const visibleSections = new Map<string, number>();

          entries.forEach((entry) => {
            if (entry.intersectionRatio > 0) {
              visibleSections.set(entry.target.id, entry.intersectionRatio);
            }
          });

          if (visibleSections.size === 0) return;

          let maxRatio = 0;
          let activeId = '';

          visibleSections.forEach((ratio, id) => {
            if (ratio > maxRatio) {
              maxRatio = ratio;
              activeId = id;
            }
          });

          setActiveSection((currentActive) => {
            const switchThreshold = 0.25;
            const stayThreshold = 0.15;

            const currentRatio = visibleSections.get(currentActive) || 0;
            const shouldStay = currentRatio >= stayThreshold;
            const shouldSwitch = maxRatio >= switchThreshold && activeId !== currentActive;

            const isDisplaySection = activeId === 'display';
            const displaySwitchThreshold = 0.15;
            const shouldSwitchToDisplay =
              isDisplaySection && maxRatio >= displaySwitchThreshold && activeId !== currentActive;

            if ((shouldSwitch || shouldSwitchToDisplay) && !shouldStay && activeId) {
              return activeId;
            } else {
              return currentActive;
            }
          });
        },
        {
          root: container,
          rootMargin: '-10% 0px -40% 0px',
          threshold: [
            0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
          ],
        },
      );

      Object.values(sectionRefs).forEach((ref) => {
        if (ref.current) {
          observer.observe(ref.current);
        }
      });

      return () => {
        observer.disconnect();
      };
    }, 200);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [open, sectionRefs]);

  const scrollToSection = (sectionId: string) => {
    const sectionRef = sectionRefs[sectionId as keyof typeof sectionRefs];
    if (sectionRef?.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setActiveSection(sectionId);
    }
  };

  const handleNavKeyDown = (event: React.KeyboardEvent, sectionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToSection(sectionId);
    }
  };

  const handleLocationSelect = (locationId: string) => {
    const selectedLocation = locations.find((loc) => loc.id === locationId);
    setLocationError(null);
    setEditingSourceLocationId(undefined);
    setKioskData((p) => ({
      ...p,
      location_id: locationId,
      location: selectedLocation?.name || p.location,
    }));
  };

  const handleCreateNewLocation = () => {
    setIsCreatingLocation(true);
    setLocationError(null);
    setEditingSourceLocationId(undefined);
    setLocationFormData({
      name: '',
      addressLine1: '',
      city: '',
      postcode: '',
      country: 'UK',
      isCommunityBuilding: false,
    });
  };

  const handleEditLocationStart = (locationId: string) => {
    setLocationError(null);
    setEditingSourceLocationId(locationId);
  };

  const handleLocationFormChange = (data: LocationFormData) => {
    setLocationFormData(data);
  };

  const handleSubmitLocation = async () => {
    if (!onCreateLocation) return;

    try {
      setLocationError(null);
      setIsLocationLoading(true);
      const newLocationId = await onCreateLocation(locationFormData, editingSourceLocationId);
      setKioskData((p) => ({
        ...p,
        location_id: newLocationId,
        location: locationFormData.name.trim(),
      }));
      setIsCreatingLocation(false);
      setEditingSourceLocationId(undefined);
    } catch (error) {
      console.error('Error creating location:', error);
      setLocationError(
        error instanceof Error ? error.message : 'Failed to save location. Please try again.',
      );
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleCancelLocationForm = () => {
    setIsCreatingLocation(false);
    setLocationError(null);
    setEditingSourceLocationId(undefined);
    setLocationFormData({
      name: '',
      addressLine1: '',
      city: '',
      postcode: '',
      country: 'UK',
      isCommunityBuilding: false,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setActiveSection('basic-info');
    setIsMobileSidebarOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl p-0 border-0 shadow-2xl bg-white rounded-2xl overflow-hidden font-lexend h-[90vh] w-[95vw] sm:w-full flex flex-col [&>button]:hidden sm:[&>button]:flex">
        <VisuallyHidden>
          <DialogTitle>
            {editingKiosk ? 'Edit Kiosk Configuration' : 'Kiosk Setup Configuration'}
          </DialogTitle>
          <DialogDescription>
            {editingKiosk
              ? 'Modify the settings and configuration for this kiosk'
              : 'Configure a new kiosk with basic information, campaign assignments, and display settings'}
          </DialogDescription>
        </VisuallyHidden>

        {/* Mobile Header - Fixed */}
        <div className="sm:hidden flex flex-col border-b border-gray-200 bg-linear-to-r from-gray-50 to-gray-100 shrink-0">
          {/* Header with aligned controls and title */}
          <div className="flex items-center justify-between px-4 pt-3 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              className="p-3 hover:bg-white/60 rounded-xl border border-gray-200/50 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </Button>

            {/* Centered Title Section */}
            <div className="text-center flex-1 mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {editingKiosk ? 'Edit Kiosk' : 'Kiosk Setup'}
              </h3>
              <p className="text-sm text-gray-600">Configuration</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="p-3 hover:bg-white/60 rounded-xl border border-gray-200/50 shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <X className="w-5 h-5 text-gray-700" />
            </Button>
          </div>
        </div>

        {/* Main Content Area - Flex container */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">
          {/* Sidebar Navigation */}
          <nav
            className={`${
              isMobileSidebarOpen ? 'block' : 'hidden'
            } sm:block w-full sm:w-72 bg-linear-to-b from-gray-50 to-gray-100 sm:bg-gray-50 border-r border-gray-200 p-6 sm:p-8 absolute sm:relative z-10 sm:z-auto h-full sm:h-auto shrink-0 shadow-xl sm:shadow-none`}
            aria-label="Kiosk setup navigation"
          >
            {/* Mobile Navigation Header */}
            <div className="sm:hidden mb-6 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Navigation</h3>
                <p className="text-sm text-gray-600 mt-1">Choose a section</p>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden sm:block mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Kiosk</h3>
              <p className="text-sm text-gray-500">Configuration</p>
            </div>

            <div className="relative">
              {/* Navigation Items */}
              <ul className="space-y-3 relative" role="list">
                {navigationItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        scrollToSection(item.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      onKeyDown={(e) => handleNavKeyDown(e, item.id)}
                      className={`w-full flex items-center gap-3 px-4 sm:px-5 py-4 rounded-xl cursor-pointer transition-all duration-200 text-left shadow-sm ${
                        activeSection === item.id
                          ? 'bg-green-600 text-white shadow-lg shadow-green-600/25 border border-green-500'
                          : 'text-gray-700 hover:bg-white hover:shadow-md border border-gray-200/50 bg-gray-50/50'
                      }`}
                      aria-current={activeSection === item.id ? 'step' : undefined}
                      tabIndex={0}
                    >
                      <div className="text-sm font-medium">{item.label}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Main Content Column - Flex container */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Header - Fixed */}
            <header className="hidden sm:flex items-center justify-between p-6 lg:p-8 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-4">
                <div className="text-base text-gray-500 uppercase tracking-wide font-medium">
                  {editingKiosk ? 'EDIT • KIOSK' : 'SETUP • NEW KIOSK'}
                </div>
              </div>
            </header>

            {/* Scrollable Content Container - The only scroll area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
              {/* Basic Information Section */}
              <section
                id="basic-info"
                ref={sectionRefs['basic-info']}
                className="p-4 sm:p-6 lg:p-8 border-b border-gray-100"
              >
                <div className="max-w-4xl">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                    Basic Information
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="lg:col-span-2">
                        <Label
                          htmlFor="kioskName"
                          className="text-sm font-medium text-gray-700 mb-2 block"
                        >
                          KIOSK NAME
                        </Label>
                        <Input
                          id="kioskName"
                          value={kioskData.name}
                          onChange={(e) => setKioskData((p) => ({ ...p, name: e.target.value }))}
                          placeholder="e.g. Reception Donation Terminal"
                          className="h-12 text-base border-gray-300 rounded-lg focus:border-green-500 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor="accessCode"
                          className="text-sm font-medium text-gray-700 mb-2 block"
                        >
                          ACCESS CODE / PAIRING KEY
                        </Label>
                        <Input
                          id="accessCode"
                          value={kioskData.accessCode}
                          onChange={(e) =>
                            setKioskData((p) => ({ ...p, accessCode: e.target.value }))
                          }
                          placeholder="e.g. DON-001-UK"
                          className="h-12 text-base border-gray-300 rounded-lg focus:border-green-500 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <Label
                          htmlFor="status"
                          className="text-sm font-medium text-gray-700 mb-2 block"
                        >
                          STATUS
                        </Label>
                        <Select
                          value={kioskData.status}
                          onValueChange={(value: Kiosk['status']) =>
                            setKioskData((p) => ({ ...p, status: value }))
                          }
                        >
                          <SelectTrigger className="h-12 text-base border-gray-300 rounded-lg focus:border-green-500 focus:ring-green-500">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="online">Active</SelectItem>
                            <SelectItem value="offline">Inactive</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Location Section */}
              <section
                id="location"
                ref={sectionRefs['location']}
                className="p-4 sm:p-6 lg:p-8 border-b border-gray-100"
              >
                <div className="max-w-4xl">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                    Location
                  </h2>

                  <LocationForm
                    locations={locations}
                    selectedLocationId={kioskData.location_id}
                    onLocationSelect={handleLocationSelect}
                    onCreateNew={handleCreateNewLocation}
                    onEditLocationStart={handleEditLocationStart}
                    isCreatingNew={isCreatingLocation}
                    formData={locationFormData}
                    onFormDataChange={handleLocationFormChange}
                    onSubmit={handleSubmitLocation}
                    onCancel={handleCancelLocationForm}
                    isLoading={isLocationLoading || isLoading}
                    isEditing={!!editingKiosk}
                  />
                  {locationError && <p className="mt-3 text-sm text-red-600">{locationError}</p>}
                </div>
              </section>

              {/* Campaigns Section */}
              {hasPermission?.('assign_campaigns') !== false && (
                <section
                  id="campaigns"
                  ref={sectionRefs['campaigns']}
                  className="p-4 sm:p-6 lg:p-8 border-b border-gray-100"
                >
                  <div className="max-w-4xl">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                      Campaigns
                    </h2>

                    {/* Assigned Campaigns Section */}
                    <div className="mb-6 sm:mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <h3 className="text-base sm:text-lg font-medium text-gray-900">
                          Assigned Campaigns
                        </h3>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                          {assignedCampaigns.length}
                        </Badge>
                      </div>

                      <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                        {assignedCampaigns.length === 0 ? (
                          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 sm:p-8 text-center">
                            <button
                              onClick={() => {
                                const availableCampaignsElement =
                                  document.getElementById('available-campaigns');
                                if (availableCampaignsElement) {
                                  availableCampaignsElement.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start',
                                  });
                                }
                              }}
                              className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 hover:bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors cursor-pointer group"
                              aria-label="Scroll to available campaigns"
                            >
                              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-green-600 transition-colors" />
                            </button>
                            <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                              No campaigns assigned
                            </h4>
                            <p className="text-gray-500 text-sm">
                              Select campaigns from the available list below to get started
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {assignedCampaigns.map((campaign) => {
                              const fundingPercentage = Math.round(
                                (campaign.raised / 100 / campaign.goal) * 100,
                              );

                              return (
                                <div
                                  key={campaign.id}
                                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-white border border-gray-200 rounded-lg"
                                >
                                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                      {campaign.coverImageUrl ? (
                                        <img
                                          src={campaign.coverImageUrl}
                                          alt={campaign.title}
                                          className="w-full h-full object-cover rounded-lg"
                                        />
                                      ) : (
                                        <span className="text-xs font-medium text-gray-500">
                                          {campaign.title.substring(0, 3).toUpperCase()}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-gray-900 truncate text-sm sm:text-base">
                                        {campaign.title}
                                      </h4>
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-500 mt-1">
                                        <span>{formatCurrency(campaign.raised)} raised</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span>{fundingPercentage}% funded</span>
                                      </div>
                                    </div>
                                  </div>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUnassignCampaign(campaign.id)}
                                    className="text-red-600 border-red-200 hover:bg-red-50 w-full sm:w-auto"
                                  >
                                    Remove
                                  </Button>
                                  {onEditCampaign && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onEditCampaign(campaign.id)}
                                      className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                                    >
                                      <Edit className="w-4 h-4 mr-1" />
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Available Campaigns Section */}
                    <div id="available-campaigns">
                      <div className="flex items-center gap-2 mb-4">
                        <Plus className="w-5 h-5 text-gray-400" />
                        <h3 className="text-base sm:text-lg font-medium text-gray-900">
                          Available Campaigns
                        </h3>
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                          {unassignedCampaigns.length}
                        </Badge>
                      </div>

                      <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                        <div className="space-y-3">
                          {unassignedCampaigns.map((campaign) => {
                            const fundingPercentage = Math.round(
                              (campaign.raised / 100 / campaign.goal) * 100,
                            );

                            return (
                              <div
                                key={campaign.id}
                                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shrink-0 border">
                                    {campaign.coverImageUrl ? (
                                      <img
                                        src={campaign.coverImageUrl}
                                        alt={campaign.title}
                                        className="w-full h-full object-cover rounded-lg"
                                      />
                                    ) : (
                                      <span className="text-xs font-medium text-gray-500">
                                        {campaign.title.substring(0, 3).toUpperCase()}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate text-sm sm:text-base">
                                      {campaign.title}
                                    </h4>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-gray-500 mt-1">
                                      <span>{formatCurrency(campaign.raised)} raised</span>
                                      <span className="hidden sm:inline">•</span>
                                      <span>{fundingPercentage}% funded</span>
                                    </div>
                                  </div>
                                </div>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onAssignCampaign(campaign.id)}
                                  className="text-green-600 border-green-200 hover:bg-green-50 w-full sm:w-auto"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  ASSIGN
                                </Button>
                                {onEditCampaign && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onEditCampaign(campaign.id)}
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                                  >
                                    <Edit className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                            );
                          })}

                          {unassignedCampaigns.length === 0 && (
                            <div className="text-center py-6 sm:py-8 text-gray-500">
                              <p className="text-sm sm:text-base">
                                All available campaigns have been assigned to this kiosk.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Display Section */}
              <section id="display" ref={sectionRefs['display']} className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-4xl">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                    Campaign View
                  </h2>

                  {/* Display Layout Selection */}
                  <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
                      DISPLAY LAYOUT
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                      {/* Grid Option */}
                      <button
                        onClick={() => setKioskData((prev) => ({ ...prev, displayLayout: 'grid' }))}
                        className={`flex flex-col items-center justify-center w-full h-32 sm:h-36 rounded-2xl transition-all ${
                          kioskData.displayLayout === 'grid'
                            ? 'border-2 border-green-500 bg-green-50'
                            : 'border-2 border-gray-200 bg-transparent hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        aria-pressed={kioskData.displayLayout === 'grid'}
                      >
                        <Grid3X3
                          className={`w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4 ${
                            kioskData.displayLayout === 'grid' ? 'text-green-600' : 'text-gray-400'
                          }`}
                        />
                        <span
                          className={`text-sm sm:text-base font-medium ${
                            kioskData.displayLayout === 'grid' ? 'text-green-600' : 'text-gray-500'
                          }`}
                        >
                          GRID
                        </span>
                      </button>

                      {/* List Option */}
                      <button
                        onClick={() => setKioskData((prev) => ({ ...prev, displayLayout: 'list' }))}
                        className={`flex flex-col items-center justify-center w-full h-32 sm:h-36 rounded-2xl transition-all ${
                          kioskData.displayLayout === 'list'
                            ? 'border-2 border-green-500 bg-green-50'
                            : 'border-2 border-gray-200 bg-transparent hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        aria-pressed={kioskData.displayLayout === 'list'}
                      >
                        <List
                          className={`w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4 ${
                            kioskData.displayLayout === 'list' ? 'text-green-600' : 'text-gray-400'
                          }`}
                        />
                        <span
                          className={`text-sm sm:text-base font-medium ${
                            kioskData.displayLayout === 'list' ? 'text-green-600' : 'text-gray-500'
                          }`}
                        >
                          LIST
                        </span>
                      </button>

                      {/* Carousel Option */}
                      <button
                        onClick={() =>
                          setKioskData((prev) => ({ ...prev, displayLayout: 'carousel' }))
                        }
                        className={`flex flex-col items-center justify-center w-full h-32 sm:h-36 rounded-2xl transition-all ${
                          kioskData.displayLayout === 'carousel'
                            ? 'border-2 border-green-500 bg-green-50'
                            : 'border-2 border-gray-200 bg-transparent hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        aria-pressed={kioskData.displayLayout === 'carousel'}
                      >
                        <GalleryThumbnails
                          className={`w-8 h-8 sm:w-10 sm:h-10 mb-3 sm:mb-4 ${
                            kioskData.displayLayout === 'carousel'
                              ? 'text-green-600'
                              : 'text-gray-400'
                          }`}
                        />
                        <span
                          className={`text-sm sm:text-base font-medium ${
                            kioskData.displayLayout === 'carousel'
                              ? 'text-green-600'
                              : 'text-gray-500'
                          }`}
                        >
                          CAROUSEL
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Layout Preview */}
                  <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
                      LAYOUT PREVIEW
                    </h3>

                    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 min-h-[300px] sm:min-h-[400px]">
                      {/* Mock Device Frame */}
                      <div className="bg-gray-100 rounded-lg p-3 sm:p-4 max-w-2xl mx-auto">
                        {/* Device Header */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4 text-xs text-gray-500">
                          <span>9:41 AM</span>
                          <div className="flex gap-1">
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="bg-white rounded-lg p-3 sm:p-4 min-h-[200px] sm:min-h-[300px]">
                          {kioskData.displayLayout === 'grid' && (
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                              {[1, 2, 3, 4].map((item) => (
                                <div
                                  key={item}
                                  className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center"
                                >
                                  <Image className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                                </div>
                              ))}
                            </div>
                          )}

                          {kioskData.displayLayout === 'list' && (
                            <div className="space-y-3 sm:space-y-4">
                              {[1, 2, 3, 4].map((item) => (
                                <div
                                  key={item}
                                  className="flex items-center gap-3 sm:gap-4 p-2 sm:p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg flex items-center justify-center shrink-0">
                                    <Image className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="h-2 sm:h-3 bg-gray-200 rounded mb-1 sm:mb-2"></div>
                                    <div className="h-1.5 sm:h-2 bg-gray-200 rounded w-2/3"></div>
                                  </div>
                                  <div className="w-12 h-6 sm:w-16 sm:h-8 bg-green-200 rounded"></div>
                                </div>
                              ))}
                            </div>
                          )}

                          {kioskData.displayLayout === 'carousel' && (
                            <div className="relative">
                              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-3 sm:mb-4">
                                <Image className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400" />
                              </div>
                              <div className="flex justify-center gap-2 mb-3 sm:mb-4">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                              </div>
                              <div className="text-center">
                                <div className="h-3 sm:h-4 bg-gray-200 rounded mb-2 mx-auto w-3/4"></div>
                                <div className="h-2 sm:h-3 bg-gray-200 rounded mx-auto w-1/2"></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Navigation */}
                        <div className="flex justify-center mt-3 sm:mt-4 gap-2">
                          <div className="w-10 h-1.5 sm:w-12 sm:h-2 bg-gray-800 rounded-full"></div>
                          <div className="w-6 h-1.5 sm:w-8 sm:h-2 bg-green-400 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer - Fixed */}
            <footer className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 lg:p-8 border-t border-gray-200 bg-gray-50 gap-4 sm:gap-0 shrink-0">
              <Button
                variant="ghost"
                onClick={onCancel}
                className="text-gray-600 hover:text-gray-800 w-full sm:w-auto h-12 sm:h-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                SAVE DRAFT
              </Button>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 w-full sm:w-auto h-12 sm:h-auto"
                >
                  CANCEL
                </Button>
                <Button
                  onClick={onSubmit}
                  disabled={!kioskData.name || !kioskData.location_id || isLoading}
                  className="bg-black hover:bg-gray-800 text-white px-6 w-full sm:w-auto h-12 sm:h-auto disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingKiosk ? 'UPDATING...' : 'SAVING...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingKiosk ? 'UPDATE KIOSK' : 'SAVE KIOSK'}
                    </>
                  )}
                </Button>
              </div>
            </footer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
