"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Campaign, Permission } from '../../../shared/types';
import { useScrollSpy } from '../../../shared/lib/hooks/useScrollSpy';
import { kioskApi } from '../../../entities/kiosk/api';

// UI Components
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription, VisuallyHidden } from '../../../shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import { Textarea } from '../../../shared/ui/textarea';
import { SimpleRichEditor } from '../../../shared/ui/simple-rich-editor';
import { Switch } from '../../../shared/ui/switch';
import { Checkbox } from '../../../shared/ui/checkbox';

import {
  Menu, X, Save, Upload, RefreshCw, AlertCircle
} from 'lucide-react';

// Types for the form data
export interface CampaignFormData {
  title: string;
  briefOverview: string;
  description: string;
  goal: number;
  category: string;
  status: Campaign['status'];
  coverImageUrl: string;
  videoUrl: string;
  galleryImages: string[];
  predefinedAmounts: number[];
  startDate: string;
  endDate: string;
  enableRecurring: boolean;
  recurringIntervals: string[];
  tags: string[];
  isGlobal: boolean;
  assignedKiosks: string[];
  giftAidEnabled: boolean;
}

export interface CampaignFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCampaign: Campaign | null;
  campaignData: CampaignFormData;
  setCampaignData: React.Dispatch<React.SetStateAction<CampaignFormData>>;
  onSubmit: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  formatCurrency: (amount: number) => string;
  onImageFileSelect?: (file: File | null) => void;
  onGalleryImagesSelect?: (files: File[]) => void;
  organizationId?: string;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  hasPermission?: (permission: Permission) => boolean;
  dateError?: boolean;
  onDateErrorClear?: () => void;
}

export function CampaignForm({
  open,
  onOpenChange,
  editingCampaign,
  campaignData,
  setCampaignData,
  onSubmit,
  onSaveDraft,
  onCancel,
  formatCurrency,
  onImageFileSelect,
  onGalleryImagesSelect,
  organizationId,
  isSubmitting = false,
  isSavingDraft = false,
  hasPermission,
  dateError = false,
  onDateErrorClear
}: CampaignFormProps) {
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [kiosks, setKiosks] = useState<any[]>([]);
  const [loadingKiosks, setLoadingKiosks] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const basicInfoRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLElement>(null);
  const kioskDistributionRef = useRef<HTMLElement>(null);
  
  const sectionRefsObject = useRef({
    'basic-info': basicInfoRef,
    details: detailsRef,
    media: mediaRef,
    'kiosk-distribution': kioskDistributionRef,
  });
  
  const sectionRefs = sectionRefsObject.current;
  
  
  const navigationItems = [
    { id: 'basic-info', label: 'BASIC INFO' },
    { id: 'details', label: 'DETAILS' },
    { id: 'media', label: 'MEDIA' },
    ...(hasPermission?.('assign_campaigns') ? [{ id: 'kiosk-distribution', label: 'KIOSK DISTRIBUTION' }] : [])
  ];

  // Use ScrollSpy hook
  const { activeSection, scrollToSection, setActiveSection } = useScrollSpy({
    containerRef: scrollContainerRef,
    sectionRefs,
    enabled: open
  });

  // Reset to first section when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        setActiveSection('basic-info');
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [open, setActiveSection]);

  // Reset transient image state when dialog opens or campaign changes
  useEffect(() => {
    if (!open) return;

    // Clear unsaved selections
    setSelectedImageFile(null);
    setSelectedGalleryFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    // Always reset previews first
    setImagePreview(null);
    setGalleryPreviews([]);

    if (editingCampaign) {
      // Only load the saved cover image
      if (campaignData.coverImageUrl) {
        setImagePreview(campaignData.coverImageUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingCampaign?.id]);

  useEffect(() => {
    if (open && organizationId) {
      const fetchKiosks = async () => {
        try {
          setLoadingKiosks(true);
          const kiosksList = await kioskApi.getKiosks(organizationId);
          setKiosks(kiosksList);
        } catch (error) {
          console.error('Failed to fetch kiosks:', error);
          setKiosks([]);
        } finally {
          setLoadingKiosks(false);
        }
      };
      fetchKiosks();
    }
  }, [open, organizationId]);

  // Handle keyboard navigation
  const handleNavKeyDown = (event: React.KeyboardEvent, sectionId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToSection(sectionId);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setActiveSection('basic-info');
    setIsMobileSidebarOpen(false);
    setSelectedImageFile(null);
    setImagePreview(null);
    setSelectedGalleryFiles([]);
    setGalleryPreviews([]);
    if (onGalleryImagesSelect) {
      onGalleryImagesSelect([]);
    }
  };

  // Handle image file selection
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        setImageUploadError('Cover image must be less than 5MB. Please choose a smaller file.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Clear error after 5 seconds
        setTimeout(() => {
          setImageUploadError(null);
        }, 5000);
        return;
      }

      // Clear any previous errors
      setImageUploadError(null);
      setSelectedImageFile(file);
      
      // Notify parent component
      if (onImageFileSelect) {
        onImageFileSelect(file);
      }
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setCampaignData(p => ({ ...p, coverImageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    setImageUploadError(null);
    setCampaignData(p => ({ ...p, coverImageUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Notify parent component
    if (onImageFileSelect) {
      onImageFileSelect(null);
    }
  };

  // Handle gallery image selection
  const handleGalleryImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const currentTotal = galleryPreviews.length + (campaignData.galleryImages?.length || 0);
    
    if (currentTotal + newFiles.length > 4) {
      alert('You can only upload a maximum of 4 gallery images.');
      return;
    }

    const updatedFiles = [...selectedGalleryFiles, ...newFiles];
    setSelectedGalleryFiles(updatedFiles);
    
    // Notify parent component
    if (onGalleryImagesSelect) {
      onGalleryImagesSelect(updatedFiles);
    }
    
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Trigger gallery input click
  const handleGalleryUploadClick = () => {
    galleryInputRef.current?.click();
  };

  // Remove gallery image
  const handleRemoveGalleryImage = (index: number) => {
    const existingCount = campaignData.galleryImages.length;
    
    if (index < existingCount) {
      // Removing an existing image
      setCampaignData(p => ({
        ...p,
        galleryImages: p.galleryImages.filter((_, i) => i !== index)
      }));
    } else {
      // Removing a newly selected image
      const newIndex = index - existingCount;
      const updatedFiles = selectedGalleryFiles.filter((_, i) => i !== newIndex);
      setSelectedGalleryFiles(updatedFiles);
      setGalleryPreviews(prev => prev.filter((_, i) => i !== newIndex));
      
      // Notify parent component
      if (onGalleryImagesSelect) {
        onGalleryImagesSelect(updatedFiles);
      }
    }
  };

  // Handle kiosk selection
  const handleKioskToggle = (kioskId: string) => {
    setCampaignData(p => {
      const currentAssigned = p.assignedKiosks || [];
      const isAssigned = currentAssigned.includes(kioskId);
      
      return {
        ...p,
        assignedKiosks: isAssigned
          ? currentAssigned.filter(id => id !== kioskId)
          : [...currentAssigned, kioskId]
      };
    });
  };

  const handleDeselectAllKiosks = () => {
    setCampaignData(p => ({
      ...p,
      assignedKiosks: []
    }));
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-6xl p-0 border-0 shadow-2xl bg-white rounded-2xl overflow-hidden font-lexend h-[90vh] w-[95vw] sm:w-full flex flex-col [&>button]:hidden sm:[&>button]:flex">
        <VisuallyHidden>
          <DialogTitle>{editingCampaign ? 'Edit Campaign Configuration' : 'Campaign Setup Configuration'}</DialogTitle>
          <DialogDescription>
            {editingCampaign ? 'Modify the settings and configuration for this campaign' : 'Configure a new campaign with basic information, details, and media'}
          </DialogDescription>
        </VisuallyHidden>
        
        {/* Mobile Header - Fixed */}
        <div className="sm:hidden flex flex-col border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex-shrink-0">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{editingCampaign ? 'Edit Campaign' : 'Campaign Setup'}</h3>
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
            } sm:block w-full sm:w-72 bg-gradient-to-b from-gray-50 to-gray-100 sm:bg-gray-50 border-r border-gray-200 p-6 sm:p-8 absolute sm:relative z-10 sm:z-auto h-full sm:h-auto flex-shrink-0 shadow-xl sm:shadow-none`} 
            aria-label="Campaign setup navigation"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign</h3>
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
            <header className="hidden sm:flex items-center justify-between p-6 lg:p-8 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="text-base text-gray-500 uppercase tracking-wide font-medium">
                  {editingCampaign ? 'EDIT • CAMPAIGN' : 'SETUP • NEW CAMPAIGN'}
                </div>
              </div>
            </header>

            {/* Scrollable Content Container - The only scroll area */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto min-h-0"
              style={{ scrollSnapType: 'y proximity' }}
            >
              {/* Basic Information Section */}
              <section 
                id="basic-info"
                ref={sectionRefs['basic-info']}
                className="p-4 sm:p-6 lg:p-8 border-b border-gray-100"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="max-w-4xl">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                    General Information
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Campaign Title */}
                    <div>
                      <Label htmlFor="campaignTitle" className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        CAMPAIGN TITLE
                      </Label>
                      <Input
                        id="campaignTitle"
                        value={campaignData.title}
                        onChange={(e) => setCampaignData(p => ({ ...p, title: e.target.value }))}
                        placeholder="e.g. Clean Water Initiative"
                        className="h-12 text-base border-gray-300 rounded-lg focus:border-green-500 focus:ring-green-500"
                      />
                    </div>

                    {/* Brief Overview */}
                    <div>
                      <Label htmlFor="briefOverview" className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        BRIEF OVERVIEW
                      </Label>
                      <Textarea
                        id="briefOverview"
                        value={campaignData.briefOverview}
                        onChange={(e) => setCampaignData(p => ({ ...p, briefOverview: e.target.value }))}
                        placeholder="Short summary for kiosk list cards..."
                        className="text-base border-gray-300 rounded-lg focus:border-green-500 focus:ring-green-500 resize-none"
                        rows={2}
                        style={{ height: '60px' }}
                      />
                    </div>

                    {/* Detailed Campaign Story */}
                    <div>
                      <Label htmlFor="detailedStory" className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                        DETAILED CAMPAIGN STORY
                      </Label>
                      <SimpleRichEditor
                        value={campaignData.description}
                        onChange={(value) => setCampaignData(p => ({ ...p, description: value }))}
                        placeholder="Tell your campaign story..."
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Details Section */}
              <section 
                id="details"
                ref={sectionRefs['details']}
                className="p-4 sm:p-6 lg:p-8 border-b border-gray-100"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="max-w-4xl">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                    Details
                  </h2>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="category" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                          CATEGORY
                        </Label>
                        <Input
                          id="category"
                          value={campaignData.category}
                          onChange={(e) => setCampaignData(p => ({ ...p, category: e.target.value }))}
                          placeholder="e.g. Health, Education, Environment"
                          className="h-14 text-base border-gray-300 rounded-xl focus:border-green-500 focus:ring-green-500 bg-white shadow-sm"
                        />
                      </div>

                      <div>
                        <Label htmlFor="status" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                          STATUS
                        </Label>
                        <Select
                          value={campaignData.status}
                          onValueChange={(value) => setCampaignData(p => ({ ...p, status: value as Campaign['status'] }))}
                        >
                          <SelectTrigger className="h-14 text-base border-gray-300 rounded-xl focus:border-green-500 focus:ring-green-500 bg-white shadow-sm font-normal">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="exceeded">Exceeded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Goal Amount and Standard Tiers Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="goal" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                          FUNDRAISING TARGET (£)
                        </Label>
                        <Input
                          id="goal"
                          type="number"
                          step="1"
                          min="0"
                          value={campaignData.goal || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const numValue = parseFloat(value);
                            if (value === '' || (!isNaN(numValue) && numValue >= 0 && Number.isInteger(numValue))) {
                              setCampaignData(p => ({ ...p, goal: numValue || 0 }));
                            }
                          }}
                          onKeyPress={(e) => {
                            if (!/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          placeholder="e.g. 50000"
                          className="h-14 text-base border-gray-300 rounded-xl focus:border-green-500 focus:ring-green-500 bg-white shadow-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                          STANDARD TIERS
                        </Label>
                        <div className="grid grid-cols-3 gap-3">
                          {[0, 1, 2].map((index) => (
                            <div key={index} className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-base">£</span>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={campaignData.predefinedAmounts[index] || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const numValue = parseFloat(value);
                                  if (value === '' || (!isNaN(numValue) && numValue >= 0 && Number.isInteger(numValue))) {
                                    const newAmounts = [...campaignData.predefinedAmounts];
                                    newAmounts[index] = numValue || 0;
                                    setCampaignData(p => ({ ...p, predefinedAmounts: newAmounts }));
                                  }
                                }}
                                onKeyPress={(e) => {
                                  if (!/[0-9]/.test(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                placeholder="0"
                                className="h-14 text-base border-gray-300 rounded-xl focus:border-green-500 focus:ring-green-500 bg-white shadow-sm pl-8"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="startDate" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                          START DATE
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={campaignData.startDate}
                          onChange={(e) => {
                            setCampaignData(p => ({ ...p, startDate: e.target.value }));
                            if (dateError && onDateErrorClear) onDateErrorClear();
                          }}
                          className={`h-14 text-base rounded-xl bg-white shadow-sm ${
                            dateError 
                              ? 'border-2 border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:border-green-500 focus:ring-green-500'
                          }`}
                        />
                        {dateError && (
                          <p className="text-sm text-red-600 mt-2 flex items-center gap-1.5 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            End date must be after start date
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="endDate" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                          END DATE
                        </Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={campaignData.endDate}
                          onChange={(e) => {
                            setCampaignData(p => ({ ...p, endDate: e.target.value }));
                            if (dateError && onDateErrorClear) onDateErrorClear();
                          }}
                          className={`h-14 text-base rounded-xl bg-white shadow-sm ${
                            dateError 
                              ? 'border-2 border-red-500 focus:border-red-500 focus:ring-red-500' 
                              : 'border-gray-300 focus:border-green-500 focus:ring-green-500'
                          }`}
                        />
                        {dateError && (
                          <p className="text-sm text-red-600 mt-2 flex items-center gap-1.5 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            End date must be after start date
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Recurring Payments Toggle */}
                    <div className="col-span-full">
                      <div className="flex items-center justify-between mb-4">
                        <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                          RECURRING PAYMENTS
                        </Label>
                        <button
                          type="button"
                          onClick={() => setCampaignData(p => ({
                            ...p,
                            enableRecurring: !p.enableRecurring,
                            recurringIntervals: !p.enableRecurring ? ['monthly'] : []
                          }))}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                            campaignData.enableRecurring ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              campaignData.enableRecurring ? 'translate-x-8' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {campaignData.enableRecurring && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                          {[
                            { value: 'monthly', label: 'Monthly' },
                            { value: 'quarterly', label: 'Quarterly' },
                            { value: 'yearly', label: 'Yearly' }
                          ].map((interval) => (
                            <button
                              key={interval.value}
                              type="button"
                              onClick={() => {
                                const isSelected = campaignData.recurringIntervals.includes(interval.value);
                                if (isSelected) {
                                  setCampaignData(p => ({
                                    ...p,
                                    recurringIntervals: p.recurringIntervals.filter(i => i !== interval.value)
                                  }));
                                } else {
                                  setCampaignData(p => ({
                                    ...p,
                                    recurringIntervals: [...p.recurringIntervals, interval.value]
                                  }));
                                }
                              }}
                              className={`relative flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                                campaignData.recurringIntervals.includes(interval.value)
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              <span className={`text-base font-semibold ${
                                campaignData.recurringIntervals.includes(interval.value)
                                  ? 'text-green-700'
                                  : 'text-gray-700'
                              }`}>
                                {interval.label}
                              </span>
                              <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                                campaignData.recurringIntervals.includes(interval.value)
                                  ? 'border-green-500 bg-green-500'
                                  : 'border-gray-300 bg-white'
                              }`}>
                                {campaignData.recurringIntervals.includes(interval.value) && (
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="col-span-full">
                      <Label htmlFor="tags" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 block">
                        TAGS (COMMA-SEPARATED)
                      </Label>
                      <Input
                        id="tags"
                        value={Array.isArray(campaignData.tags) ? campaignData.tags.join(', ') : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const tags = value.split(',').map(tag => tag.trim());
                          setCampaignData(p => ({ ...p, tags }));
                        }}
                        placeholder="e.g. water, health, community"
                        className="h-14 text-base border-gray-300 rounded-xl focus:border-green-500 focus:ring-green-500 bg-white shadow-sm w-full"
                      />
                      {campaignData.tags && Array.isArray(campaignData.tags) && campaignData.tags.filter(tag => tag.length > 0).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {campaignData.tags.filter(tag => tag.length > 0).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="bg-green-50 text-green-700 border border-green-200 text-sm px-3 py-1.5 rounded-lg font-medium">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Gift Aid Toggle */}
                    <div className="col-span-full">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex-1">
                          <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1 block">
                            GIFT AID
                          </Label>
                          <p className="text-sm text-gray-600">
                            Enable Gift Aid declarations for UK taxpayers to increase donations by 25%
                          </p>
                        </div>
                        <Switch
                          checked={campaignData.giftAidEnabled}
                          onCheckedChange={(checked) => setCampaignData(p => ({ ...p, giftAidEnabled: checked }))}
                          className="ml-4"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Media Section */}
              <section 
                id="media"
                ref={sectionRefs['media']}
                className="p-4 sm:p-6 lg:p-8"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="max-w-4xl">
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                    Media
                  </h2>
                  
                  {/* Cover Image Section */}
                  <div className="mb-6 sm:mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">Cover Image</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        className="hidden"
                      />

                      {/* Image Preview */}
                      {(campaignData.coverImageUrl || imagePreview) ? (
                        <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="aspect-video bg-white rounded-lg overflow-hidden flex items-center justify-center relative">
                            <img 
                              src={imagePreview || campaignData.coverImageUrl} 
                              alt="Campaign cover preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = '<div class="flex flex-col items-center justify-center text-gray-400"><svg class="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><p class="text-sm">Invalid image URL</p></div>';
                                }
                              }}
                            />
                            <Button
                              type="button"
                              onClick={handleRemoveImage}
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 h-8 w-8 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          {selectedImageFile && (
                            <p className="text-xs text-gray-500 mt-2">
                              Selected: {selectedImageFile.name} ({(selectedImageFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleUploadClick}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center hover:border-green-500 hover:bg-green-50 transition-colors cursor-pointer"
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                          </div>
                          <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No image uploaded</h4>
                          <p className="text-gray-500 text-sm mb-2">Click to upload from device or enter URL above</p>
                          <p className="text-xs text-gray-400">JPG, PNG or WebP (max. 5MB)</p>
                        </button>
                      )}
                      
                      {/* Error message */}
                      {imageUploadError && (
                        <p className="text-sm text-red-600 mt-2">{imageUploadError}</p>
                      )}
                    </div>
                  </div>

                  {/* Video URL Section */}
                  <div className="mb-6 sm:mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">Video URL</h3>
                    </div>
                    
                    <div>
                      <Label htmlFor="videoUrl" className="text-sm font-medium text-gray-700 mb-2 block">
                        OPTIONAL YOUTUBE URL
                      </Label>
                      <Input
                        id="videoUrl"
                        value={campaignData.videoUrl}
                        onChange={(e) => setCampaignData(p => ({ ...p, videoUrl: e.target.value }))}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="h-12 text-base border-gray-300 rounded-lg focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  {/* Gallery Images Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <h3 className="text-base sm:text-lg font-medium text-gray-900">Gallery Images</h3>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">
                      Upload up to 4 additional images for your campaign gallery.
                    </p>

                    {/* Hidden gallery file input */}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryImageSelect}
                      className="hidden"
                    />

                    {/* Gallery Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* Existing gallery images from campaignData */}
                      {campaignData.galleryImages && campaignData.galleryImages.length > 0 && campaignData.galleryImages.map((url, index) => (
                        <div key={`existing-${index}`} className="relative aspect-square border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                          <img 
                            src={url} 
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error('Failed to load gallery image:', url);
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                          {index === 0 && (
                            <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                              PRIMARY
                            </div>
                          )}
                          <Button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(index)}
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-7 w-7 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}

                      {/* New gallery image previews */}
                      {galleryPreviews.map((preview, index) => (
                        <div key={`preview-${index}`} className="relative aspect-square border-2 border-green-300 rounded-lg overflow-hidden bg-white">
                          <img 
                            src={preview} 
                            alt={`New gallery ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            onClick={() => handleRemoveGalleryImage((campaignData.galleryImages?.length || 0) + index)}
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2 h-7 w-7 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}

                      {/* Add Image Button */}
                      {((campaignData.galleryImages?.length || 0) + galleryPreviews.length) < 4 && (
                        <button
                          type="button"
                          onClick={handleGalleryUploadClick}
                          className="aspect-square border-2 border-dashed border-blue-300 rounded-lg flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer bg-blue-50/30"
                        >
                          <div className="text-blue-500 text-4xl mb-2">+</div>
                          <div className="text-blue-600 text-sm font-semibold">ADD IMAGE</div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Kiosk Distribution Section */}
              {hasPermission?.('assign_campaigns') && (
                <section 
                  id="kiosk-distribution"
                  ref={sectionRefs['kiosk-distribution']}
                  className="p-4 sm:p-6 lg:p-8 border-b border-gray-100"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="max-w-4xl">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
                      Kiosk Distribution
                    </h2>
                  
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribution Settings</h3>
                      
                      <div className="space-y-4">
                        <div className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                          campaignData.isGlobal 
                            ? 'bg-green-50 border border-green-200' 
                            : 'bg-gray-50'
                        }`}>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 mb-1">Global Distribution</p>
                            <p className="text-sm text-gray-600">
                              {campaignData.isGlobal 
                                ? 'This campaign will be automatically distributed to all active kiosks in your organization.'
                                : 'Enable global distribution to make this campaign available on all kiosks, or manage specific kiosk assignments from the Kiosk Management section.'
                              }
                            </p>
                          </div>
                          <Switch
                            checked={campaignData.isGlobal}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // When enabling global, assign all kiosks
                                const allKioskIds = kiosks.map(k => k.id);
                                setCampaignData(p => ({ 
                                  ...p, 
                                  isGlobal: true,
                                  assignedKiosks: allKioskIds
                                }));
                              } else {
                                // When disabling global, clear all assignments
                                setCampaignData(p => ({ 
                                  ...p, 
                                  isGlobal: false,
                                  assignedKiosks: []
                                }));
                              }
                            }}
                            className="ml-4"
                          />
                        </div>

                        {/* Active Kiosks List */}
                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-gray-900">Kiosk Assignment</h4>
                              {!campaignData.isGlobal && kiosks.length > 0 && (
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeselectAllKiosks}
                                    className="h-7 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                  >
                                    Clear
                                  </Button>
                                </div>
                              )}
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                              {loadingKiosks ? '...' : 
                                campaignData.isGlobal 
                                  ? `${kiosks.length} Total`
                                  : `${(campaignData.assignedKiosks || []).length} Selected`
                              }
                            </Badge>
                          </div>
                          
                          {loadingKiosks ? (
                            <div className="space-y-2">
                              {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
                              ))}
                            </div>
                          ) : kiosks.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm font-medium">No kiosks found</p>
                              <p className="text-xs mt-1">Add kiosks from Kiosk Management</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {kiosks.map((kiosk) => {
                                // If campaign is global, all kiosks are assigned
                                const isAssigned = campaignData.isGlobal || (campaignData.assignedKiosks || []).includes(kiosk.id);
                                const isDisabled = campaignData.isGlobal;
                                
                                return (
                                  <div 
                                    key={kiosk.id} 
                                    className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                                      isDisabled 
                                        ? 'bg-gray-50 opacity-60 cursor-not-allowed' 
                                        : isAssigned
                                          ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                                          : 'bg-gray-50 hover:bg-gray-100'
                                    }`}
                                    onClick={() => !isDisabled && handleKioskToggle(kiosk.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Checkbox
                                        checked={isDisabled || isAssigned}
                                        disabled={isDisabled}
                                        onCheckedChange={(checked) => {
                                          // Prevent this from firing when container is clicked
                                          if (!isDisabled) {
                                            handleKioskToggle(kiosk.id);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="cursor-pointer"
                                      />
                                      <div className={`w-2 h-2 rounded-full ${
                                        kiosk.status === 'online' ? 'bg-green-500' : 
                                        kiosk.status === 'offline' ? 'bg-gray-400' : 
                                        'bg-yellow-500'
                                      }`}></div>
                                      <div>
                                        <p className="font-medium text-gray-900 text-sm">{kiosk.name}</p>
                                        <p className="text-xs text-gray-500">{kiosk.location || 'No location'}</p>
                                      </div>
                                    </div>
                                    <Badge 
                                      variant="secondary" 
                                      className={`text-xs capitalize ${
                                        kiosk.status === 'online' 
                                          ? 'bg-green-100 text-green-700 border-green-200' : 
                                        kiosk.status === 'offline'
                                          ? 'bg-gray-100 text-gray-700 border-gray-200'
                                          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                      }`}
                                    >
                                      {kiosk.status || 'Unknown'}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              )}
            </div>

            {/* Footer - Fixed */}
            <footer className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 lg:p-8 border-t border-gray-200 bg-gray-50 gap-4 sm:gap-0 flex-shrink-0">
              <Button
                variant="ghost"
                onClick={onSaveDraft}
                disabled={!campaignData.title || isSavingDraft || isSubmitting}
                className="text-gray-600 hover:text-gray-800 w-full sm:w-auto h-12 sm:h-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSavingDraft ? 'SAVING...' : 'SAVE DRAFT'}
              </Button>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting || isSavingDraft}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 w-full sm:w-auto h-12 sm:h-auto"
                >
                  CANCEL
                </Button>
                <Button
                  onClick={onSubmit}
                  disabled={!campaignData.title || !campaignData.description || campaignData.goal <= 0 || isSubmitting || isSavingDraft}
                  className="bg-black hover:bg-gray-800 text-white px-6 w-full sm:w-auto h-12 sm:h-auto"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {editingCampaign ? 'UPDATING...' : 'SAVING...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingCampaign ? 'UPDATE CAMPAIGN' : 'SAVE CAMPAIGN'}
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
