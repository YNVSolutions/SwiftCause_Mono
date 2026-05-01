'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Skeleton } from '../../shared/ui/skeleton';
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Settings,
  Heart,
  Globe,
  Activity as ActivityIcon,
  AlertCircle,
  CheckCircle,
  Plus,
  RefreshCw,
  CreditCard,
  Shield,
  ChevronRight,
  Monitor,
  BarChart3,
  Target,
  TriangleAlert,
  Building2,
  ArrowUpRight,
  Zap,
  Pencil,
  Gift,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../../shared/ui/dialog';
import { Screen, AdminSession, Permission, Campaign, Kiosk } from '../../shared/types';
import {
  formatCurrency as formatGbp,
  formatCurrencyFromMajor as formatGbpMajor,
} from '../../shared/lib/currencyFormatter';
import { auth, db } from '../../shared/lib/firebase';
import {
  collection,
  query,
  getDocs,
  where,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { useDashboardData, Activity } from '../../shared/lib/hooks/useDashboardData';
import { useOrganization } from '../../shared/lib/hooks/useOrganization';
import { useCampaignManagement } from '../../shared/lib/hooks/useCampaignManagement';
import {
  syncKiosksForCampaign,
  syncCampaignsForKiosk,
  normalizeAssignments,
} from '../../shared/lib/sync/campaignKioskSync';
import { DEFAULT_CAMPAIGN_CONFIG } from '../../shared/config';

import { AdminLayout } from './AdminLayout';
import { useStripeOnboarding, StripeOnboardingDialog } from '../../features/stripe-onboarding';
import { useToast } from '../../shared/ui/ToastProvider';
import { PerformanceDetailDialog } from '../../widgets/campaign-performance';
import {
  CampaignProgressDialog,
  transformCampaignsToProgress,
} from '../../widgets/campaign-progress';
import { DonationDistributionDialog } from '../../widgets/donation-distribution';
import { KioskForm, KioskFormData } from './components/KioskForm';
import { CampaignForm, CampaignFormData } from './components/CampaignForm';
import { KpiCard } from './components/KpiCard';
import { AdminRefreshButton } from './components/AdminRefreshButton';

// Dynamic imports for chart components to avoid SSR issues
const RevenueGrowthChart = dynamic(
  () =>
    import('./components/RevenueGrowthChart').then((mod) => ({ default: mod.RevenueGrowthChart })),
  { ssr: false },
);
const DonationDistributionDonut = dynamic(
  () =>
    import('./components/DonationDistributionDonut').then((mod) => ({
      default: mod.DonationDistributionDonut,
    })),
  { ssr: false },
);
const TopPerformingCampaigns = dynamic(
  () =>
    import('./components/TopPerformingCampaigns').then((mod) => ({
      default: mod.TopPerformingCampaigns,
    })),
  { ssr: false },
);
const DonorActivityHeatmap = dynamic(
  () =>
    import('./components/DonorActivityHeatmap').then((mod) => ({
      default: mod.DonorActivityHeatmap,
    })),
  { ssr: false },
);
import { AlertsSection } from './components/AlertsSection';

interface AdminDashboardProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

// Category-specific color palette for donation distribution
const CHART_COLORS = [
  '#2F6B4F', // Forest Green - Environment (Natural, trustworthy, aligns with sustainability)
  '#5B7C99', // Muted Blue - Education (Calm, intellectual, enterprise-safe)
  '#3A7F7A', // Muted Teal - Health (Clean, medical, non-alarming)
  '#D9B36A', // Muted Amber - Crisis Relief (Attention without panic)
  '#8FCFB3', // Soft Mint - Welfare/Social (Human, positive, supportive)
  '#B6B8BC', // Warm Gray - Uncategorized/Other (Neutral fallback)
  '#2F6B4F', // Forest Green (repeat for additional categories)
  '#5B7C99', // Muted Blue (repeat)
  '#3A7F7A', // Muted Teal (repeat)
  '#D9B36A', // Muted Amber (repeat)
];

interface GoalComparisonDataPoint {
  name: string;
  Collected: number;
  Goal: number;
}

interface CategoryDataPoint {
  name: string;
  value: number;
  color: string;
}

const parseDateLikeValue = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    const timestampLike = value as { toDate?: () => Date; seconds?: number };

    if (typeof timestampLike.toDate === 'function') {
      const fromToDate = timestampLike.toDate();
      return Number.isNaN(fromToDate.getTime()) ? null : fromToDate;
    }

    if (typeof timestampLike.seconds === 'number') {
      const fromSeconds = new Date(timestampLike.seconds * 1000);
      return Number.isNaN(fromSeconds.getTime()) ? null : fromSeconds;
    }
  }

  return null;
};

const toDateInputString = (value: unknown): string => {
  const parsed = parseDateLikeValue(value);
  return parsed ? parsed.toISOString().split('T')[0] : '';
};

export function AdminDashboard({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: AdminDashboardProps) {
  const { stats, recentActivities, alerts, loading, error, refreshDashboard } = useDashboardData(
    userSession.user.organizationId,
  );

  // Use the campaign management hook for image upload functionality
  const {
    handleImageSelect,
    handleGalleryImagesSelect,
    selectedImage,
    selectedGalleryImages,
    clearImageSelection,
    clearGallerySelection,
    uploadFile,
    createWithImage,
  } = useCampaignManagement(userSession.user.organizationId);

  // Helper function to remove undefined properties from an object
  const removeUndefined = (obj: unknown): unknown => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(removeUndefined).filter((item) => item !== undefined);
    }

    const newObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = (obj as Record<string, unknown>)[key];
        if (value !== undefined) {
          const processedValue = removeUndefined(value);
          if (processedValue !== undefined) {
            newObj[key] = processedValue;
          }
        }
      }
    }
    return newObj;
  };

  // Map CampaignForm fields to database schema
  const mapFormDataToDatabase = useCallback((formData: CampaignFormData) => {
    return {
      title: formData.title,
      description: formData.briefOverview || '', // Brief overview goes to description
      longDescription: formData.description || '', // Detailed story goes to longDescription
      goal: Number(formData.goal),
      status: formData.status || 'active',
      category: formData.category || 'General',
      tags: Array.isArray(formData.tags) ? formData.tags : [],
      coverImageUrl: formData.coverImageUrl || '',
      videoUrl: formData.videoUrl || '',
      galleryImages: Array.isArray(formData.galleryImages) ? formData.galleryImages : [],
      isGlobal: formData.isGlobal || false,
      assignedKiosks: Array.isArray(formData.assignedKiosks) ? formData.assignedKiosks : [],
    };
  }, []);

  const [dashboardData, setDashboardData] = useState({
    topCampaigns: [] as Campaign[],
    allCampaignsForPerformance: [] as Campaign[],
    goalComparisonData: [] as GoalComparisonDataPoint[],
    categoryData: [] as CategoryDataPoint[],
    showFeatures: false,
    isLegendExpanded: false,
  });

  const [onboardingFlow, setOnboardingFlow] = useState({
    showOnboarding: false,
    onboardingDismissed: sessionStorage.getItem('onboardingDismissed') === 'true',
    showCampaignForm: false,
    showKioskForm: false,
    showLinkingForm: false,
    showStripeStep: false,
    isTourActive: false,
    campaignCountChecked: false,
  });

  const [campaignCreation, setCampaignCreation] = useState({
    formData: {
      title: '',
      briefOverview: '',
      description: '',
      goal: 0,
      category: '',
      status: 'active',
      coverImageUrl: '',
      videoUrl: '',
      galleryImages: [],
      predefinedAmounts: [10, 25, 50],
      startDate: '',
      endDate: '',
      enableRecurring: DEFAULT_CAMPAIGN_CONFIG.enableRecurring,
      recurringIntervals: [...DEFAULT_CAMPAIGN_CONFIG.recurringIntervals],
      tags: [],
      isGlobal: false,
      assignedKiosks: [],
      giftAidEnabled: false,
    } as CampaignFormData,
    newCampaign: {
      title: '',
      description: '',
      goal: 0,
      status: 'active',
      startDate: '',
      endDate: '',
      tags: [] as string[],
      coverImageUrl: '',
      category: '',
      isGlobal: false,
    },
    allCampaigns: [] as Campaign[],
    assignedCampaignIds: [] as string[],
    editingCampaignInTour: null as Campaign | null,
    selectedCampaignInTour: null as Campaign | null,
    selectedImageFile: null as File | null,
    isCreating: false,
    createdId: '',
    linkingId: null as string | null,
  });

  // Date validation error state for getting started flow
  const [campaignDateError, setCampaignDateError] = useState(false);

  const [kioskCreation, setKioskCreation] = useState({
    formData: {
      name: '',
      location: '',
      accessCode: '',
      status: 'online',
      assignedCampaigns: [],
      displayLayout: 'grid',
    } as KioskFormData,
    newKiosk: { name: '', location: '', accessCode: '' },
    allKiosks: [] as Kiosk[],
    assignedKioskIds: [] as string[],
    isGlobalCampaign: false,
    isCreating: false,
    createdId: '',
  });

  const [stripeOnboarding, setStripeOnboarding] = useState({
    statusMessage: null as { type: 'success' | 'error' | 'warning'; message: string } | null,
    isOnboarding: false,
  });

  const [dialogVisibility, setDialogVisibility] = useState({
    showStripeStatusDialog: false,
    showActivityDialog: false,
    showPerformanceDialog: false,
    showDonationDistributionDialog: false,
    showCampaignProgressDialog: false,
    showCampaignFormDialog: false,
    showCreateKioskModal: false,
    showOnboardingPopup: false,
    selectedActivity: null as Activity | null,
  });

  const {
    organization,
    loading: orgLoading,
    error: orgError,
  } = useOrganization(userSession.user.organizationId ?? null);
  const resolvedOrganizationName =
    organization?.settings?.displayName ||
    organization?.name ||
    userSession.user.organizationName ||
    null;

  const { needsOnboarding } = useStripeOnboarding(organization);
  const { showToast } = useToast();

  // Reusable function to fetch campaigns by organization ID
  const fetchCampaignsByOrganization = useCallback(
    async (organizationId: string): Promise<Campaign[]> => {
      const campaignsRef = collection(db, 'campaigns');
      const q = query(campaignsRef, where('organizationId', '==', organizationId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Campaign);
    },
    [],
  );

  // Handle return from Stripe onboarding

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const stripeStatus = params.get('stripe_status');

    if (stripeStatus === 'success') {
      setStripeOnboarding((prev) => ({
        ...prev,
        statusMessage: {
          type: 'success',
          message:
            'Stripe onboarding complete! Your account is being reviewed and will be payout-ready shortly.',
        },
      }));
      showToast('Stripe onboarding completed successfully!', 'success', 3000);
      // Organization data will auto-refresh via Firestore listener
    } else if (stripeStatus === 'refresh') {
      setStripeOnboarding((prev) => ({
        ...prev,
        statusMessage: {
          type: 'warning',
          message: 'Stripe onboarding session expired or was cancelled. Please try again.',
        },
      }));
      showToast('Stripe onboarding was cancelled. Please try again.', 'warning', 3000);
    }

    if (stripeStatus) {
      const newHash = hash.split('?')[0];
      window.history.replaceState(null, '', newHash);
    }
  }, [showToast]);

  const fetchChartData = useCallback(async () => {
    if (!userSession.user.organizationId) return;
    try {
      const allCampaigns = await fetchCampaignsByOrganization(userSession.user.organizationId);

      // Store all campaigns for performance widget
      setDashboardData((prev) => ({ ...prev, allCampaignsForPerformance: allCampaigns }));

      // Check if there are no campaigns and show onboarding (only if not previously dismissed)
      if (
        allCampaigns.length === 0 &&
        !onboardingFlow.showOnboarding &&
        !onboardingFlow.onboardingDismissed
      ) {
        setOnboardingFlow((prev) => ({ ...prev, showOnboarding: true }));
      }
      setOnboardingFlow((prev) => ({ ...prev, campaignCountChecked: true }));

      // Sort by percentage of goal completion
      const sortedByPercentage = allCampaigns
        .filter((campaign) => campaign.goal && campaign.goal > 0)
        .sort((a, b) => {
          const percentA = (a.raised || 0) / (a.goal || 1);
          const percentB = (b.raised || 0) / (b.goal || 1);
          return percentB - percentA;
        })
        .slice(0, 4);

      setDashboardData((prev) => ({ ...prev, topCampaigns: sortedByPercentage }));

      // Get top 5 campaigns by raised amount for chart
      const topCampaignsForChart = allCampaigns
        .sort((a, b) => (b.raised || 0) - (a.raised || 0))
        .slice(0, 5);

      const comparisonData = topCampaignsForChart.map((campaign) => ({
        name: campaign.title,
        Collected: campaign.raised || 0,
        Goal: campaign.goal || 0,
      }));
      setDashboardData((prev) => ({ ...prev, goalComparisonData: comparisonData }));

      // Build categoryData from per-campaign average donation values so the
      // pie chart shows the relative average donation per campaign.
      const averages: { id: string; name: string; avg: number }[] = [];
      allCampaigns.forEach((campaign) => {
        const raised = campaign.raised || 0;
        const count = campaign.donationCount || 0;
        const avgValue = count > 0 ? raised / count : 0;
        averages.push({
          id: campaign.id,
          name: campaign.title || `Campaign ${campaign.id}`,
          avg: avgValue,
        });
      });

      // Only include campaigns with non-zero averages
      const nonZeroAverages = averages.filter((a) => a.avg > 0);
      const totalAvg = nonZeroAverages.reduce((sum, a) => sum + a.avg, 0);

      if (totalAvg > 0) {
        // Use the raw average donation amount as the slice value so the pie
        // chart proportions reflect actual average dollar amounts.
        let formattedCategoryData = nonZeroAverages.map((entry, index) => ({
          name: entry.name,
          value: entry.avg,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }));

        // Sort descending by value so the chart displays largest -> smallest
        formattedCategoryData = formattedCategoryData.sort((a, b) => b.value - a.value);

        setDashboardData((prev) => ({ ...prev, categoryData: formattedCategoryData }));
      } else {
        setDashboardData((prev) => ({ ...prev, categoryData: [] }));
      }
    } catch (error) {
      console.error('Error fetching chart data: ', error);
    }
  }, [
    userSession.user.organizationId,
    onboardingFlow.showOnboarding,
    onboardingFlow.onboardingDismissed,
    fetchCampaignsByOrganization,
  ]);

  const setCampaignFormData = useCallback(
    (data: CampaignFormData | ((prev: CampaignFormData) => CampaignFormData)) => {
      if (typeof data === 'function') {
        setCampaignCreation((prev) => ({ ...prev, formData: data(prev.formData) }));
      } else {
        setCampaignCreation((prev) => ({ ...prev, formData: data }));
      }
    },
    [],
  );

  const setKioskFormData = useCallback(
    (data: KioskFormData | ((prev: KioskFormData) => KioskFormData)) => {
      if (typeof data === 'function') {
        setKioskCreation((prev) => ({ ...prev, formData: data(prev.formData) }));
      } else {
        setKioskCreation((prev) => ({ ...prev, formData: data }));
      }
    },
    [],
  );

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const handleRefresh = () => {
    refreshDashboard();
    fetchChartData();
  };

  // Kiosk Form Handlers
  const handleKioskFormSubmit = async () => {
    if (!kioskCreation.formData.name || !kioskCreation.formData.location || !userSession) return;

    if (!kioskCreation.formData.accessCode || kioskCreation.formData.accessCode.length < 4) {
      showToast('Access code must be at least 4 characters', 'error', 4000);
      return;
    }

    setKioskCreation((prev) => ({ ...prev, isCreating: true }));
    try {
      const newKioskData = {
        name: kioskCreation.formData.name,
        location: kioskCreation.formData.location,
        accessCode: kioskCreation.formData.accessCode,
        status: kioskCreation.formData.status,
        lastActive: new Date().toISOString(),
        totalDonations: 0,
        totalRaised: 0,
        assignedCampaigns: kioskCreation.formData.assignedCampaigns,
        defaultCampaign: kioskCreation.formData.assignedCampaigns[0] || '',
        deviceInfo: {},
        operatingHours: {},
        settings: {
          displayMode: kioskCreation.formData.displayLayout,
          showAllCampaigns: true,
          maxCampaignsDisplay: 6,
          autoRotateCampaigns: false,
        },
        organizationId: userSession.user.organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const docRef = await addDoc(collection(db, 'kiosks'), newKioskData);

      // Sync campaign side so each assigned campaign knows about this new kiosk
      if (kioskCreation.formData.assignedCampaigns.length > 0) {
        try {
          await syncCampaignsForKiosk(docRef.id, kioskCreation.formData.assignedCampaigns, []);
        } catch (syncError) {
          console.error(
            'Kiosk-campaign sync failed after kiosk create (kiosk was saved):',
            syncError,
          );
        }
      }

      // Add the new kiosk to the list
      setKioskCreation((prev) => ({
        ...prev,
        allKiosks: [...prev.allKiosks, { id: docRef.id, ...newKioskData } as Kiosk],
        formData: {
          name: '',
          location: '',
          accessCode: '',
          status: 'online',
          assignedCampaigns: [],
          displayLayout: 'grid',
        },
      }));

      // Close modal
      setDialogVisibility((prev) => ({ ...prev, showCreateKioskModal: false }));
    } catch (error) {
      console.error('Error adding kiosk: ', error);
      showToast('Failed to create kiosk. Please try again.', 'error', 4000);
    } finally {
      setKioskCreation((prev) => ({ ...prev, isCreating: false }));
    }
  };

  const handleKioskFormAssignCampaign = (campaignId: string) => {
    setKioskCreation((prev) => ({
      ...prev,
      formData: {
        ...prev.formData,
        assignedCampaigns: [...prev.formData.assignedCampaigns, campaignId],
      },
    }));
  };

  const handleKioskFormUnassignCampaign = (campaignId: string) => {
    setKioskCreation((prev) => ({
      ...prev,
      formData: {
        ...prev.formData,
        assignedCampaigns: prev.formData.assignedCampaigns.filter((id) => id !== campaignId),
      },
    }));
  };

  // Campaign Form Handler for Get a Tour flow
  const handleCampaignFormSubmit = async () => {
    if (
      !campaignCreation.formData.title ||
      !campaignCreation.formData.description ||
      !userSession
    ) {
      showToast('Please fill in all required fields', 'error', 4000);
      return;
    }

    if (!campaignCreation.formData.goal || campaignCreation.formData.goal <= 0) {
      showToast('Fundraising goal must be greater than 0', 'error', 4000);
      return;
    }

    // Date validation
    if (campaignCreation.formData.startDate && campaignCreation.formData.endDate) {
      const startDate = new Date(campaignCreation.formData.startDate);
      const endDate = new Date(campaignCreation.formData.endDate);

      if (endDate <= startDate) {
        setCampaignDateError(true);
        return;
      }
    }

    // Clear date error if validation passes
    setCampaignDateError(false);

    setCampaignCreation((prev) => ({ ...prev, isCreating: true }));
    try {
      const startDate = campaignCreation.formData.startDate
        ? new Date(campaignCreation.formData.startDate)
        : new Date();
      const endDate = campaignCreation.formData.endDate
        ? new Date(campaignCreation.formData.endDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      if (campaignCreation.editingCampaignInTour) {
        // Update existing campaign
        const campaignRef = doc(db, 'campaigns', campaignCreation.editingCampaignInTour.id);

        // Map form data to database schema
        const mappedData = mapFormDataToDatabase(campaignCreation.formData);

        let coverImageUrl = mappedData.coverImageUrl || '';

        // Upload cover image BEFORE update if selected
        if (selectedImage) {
          const uploadedUrl = await uploadFile(
            selectedImage,
            `campaigns/${campaignCreation.editingCampaignInTour.id}/${Date.now()}_${selectedImage.name}`,
          );
          if (uploadedUrl) {
            coverImageUrl = uploadedUrl;
          }
        }

        // Upload gallery images BEFORE update if selected
        const existingGalleryUrls = Array.isArray(campaignCreation.formData.galleryImages)
          ? campaignCreation.formData.galleryImages
          : [];
        const galleryImageUrls = [...existingGalleryUrls];

        if (selectedGalleryImages.length > 0) {
          for (const file of selectedGalleryImages) {
            const uploadedUrl = await uploadFile(
              file,
              `campaigns/${campaignCreation.editingCampaignInTour.id}/gallery/${Date.now()}_${file.name}`,
            );
            if (uploadedUrl) {
              galleryImageUrls.push(uploadedUrl);
            }
          }
        }

        // Prepare campaign data with uploaded URLs
        const campaignDataToUpdate = {
          ...mappedData,
          coverImageUrl: coverImageUrl,
          galleryImages: galleryImageUrls,
          startDate: startDate,
          endDate: endDate,
          updatedAt: new Date(),
        };

        await updateDoc(campaignRef, campaignDataToUpdate);

        // Clear image selections after successful upload
        clearImageSelection();
        clearGallerySelection();

        // Refresh campaigns list
        const campaigns = await fetchCampaignsByOrganization(userSession.user.organizationId!);
        setCampaignCreation((prev) => ({ ...prev, allCampaigns: campaigns }));
      } else {
        // Create new campaign - Using same logic as CampaignManagement
        const formData = campaignCreation.formData;

        let coverImageUrl = formData.coverImageUrl;

        // Upload cover image file if one was selected
        if (selectedImage) {
          const uploadedUrl = await uploadFile(
            selectedImage,
            `campaigns/new/${Date.now()}_${selectedImage.name}`,
          );
          if (uploadedUrl) {
            coverImageUrl = uploadedUrl;
          }
        }

        // Upload gallery images if any were selected
        const galleryImageUrls = [...(formData.galleryImages || [])];
        if (selectedGalleryImages.length > 0) {
          for (const file of selectedGalleryImages) {
            const uploadedUrl = await uploadFile(
              file,
              `campaigns/new/gallery/${Date.now()}_${file.name}`,
            );
            if (uploadedUrl) {
              galleryImageUrls.push(uploadedUrl);
            }
          }
        }

        const dataToSave: Record<string, unknown> = {
          title: formData.title,
          description: formData.briefOverview || '',
          longDescription: formData.description || '',
          status: formData.status,
          goal: Number(formData.goal),
          tags: Array.isArray(formData.tags)
            ? formData.tags.filter((t) => t.trim().length > 0)
            : [],
          coverImageUrl: coverImageUrl || '',
          videoUrl: formData.videoUrl || '',
          galleryImages: galleryImageUrls,
          category: formData.category || '',
          organizationId: userSession.user.organizationId || '',
          assignedKiosks: normalizeAssignments(formData.assignedKiosks),
          isGlobal: formData.isGlobal,
          configuration: {
            ...DEFAULT_CAMPAIGN_CONFIG,
            predefinedAmounts: formData.predefinedAmounts.filter((a: number) => a > 0),
            enableRecurring: formData.enableRecurring,
            recurringIntervals: formData.recurringIntervals,
            giftAidEnabled: formData.giftAidEnabled,
          },
        };

        if (formData.startDate) {
          dataToSave.startDate = Timestamp.fromDate(new Date(formData.startDate));
        }
        if (formData.endDate) {
          dataToSave.endDate = Timestamp.fromDate(new Date(formData.endDate));
        }

        const finalDataToSave = removeUndefined(dataToSave) as Omit<Campaign, 'id'>;
        const newCampaign = await createWithImage(finalDataToSave);

        await syncKiosksForCampaign(
          newCampaign.id,
          normalizeAssignments(formData.assignedKiosks),
          [],
        );

        // Clear image selections after successful upload
        clearImageSelection();
        clearGallerySelection();

        setCampaignCreation((prev) => ({ ...prev, createdId: newCampaign.id }));

        // Refresh campaigns list
        const refreshedCampaigns = await fetchCampaignsByOrganization(
          userSession.user.organizationId!,
        );
        setCampaignCreation((prev) => ({ ...prev, allCampaigns: refreshedCampaigns }));

        // Set the newly created campaign as selected
        const newlyCreatedCampaign = refreshedCampaigns.find((c) => c.id === newCampaign.id);
        if (newlyCreatedCampaign) {
          setCampaignCreation((prev) => ({
            ...prev,
            selectedCampaignInTour: newlyCreatedCampaign,
          }));
        }

        // Move to next step only when creating new
        setOnboardingFlow((prev) => ({ ...prev, showCampaignForm: false, showKioskForm: true }));
      }

      // Reset form and close dialog
      setCampaignCreation((prev) => ({
        ...prev,
        formData: {
          title: '',
          briefOverview: '',
          description: '',
          goal: 0,
          category: '',
          status: 'active',
          coverImageUrl: '',
          videoUrl: '',
          galleryImages: [],
          predefinedAmounts: [10, 25, 50],
          startDate: '',
          endDate: '',
          enableRecurring: DEFAULT_CAMPAIGN_CONFIG.enableRecurring,
          recurringIntervals: [...DEFAULT_CAMPAIGN_CONFIG.recurringIntervals],
          tags: [],
          isGlobal: false,
          assignedKiosks: [],
          giftAidEnabled: false,
        },
        editingCampaignInTour: null,
      }));

      // Clear hook state after successful save
      clearImageSelection();
      clearGallerySelection();

      setDialogVisibility((prev) => ({ ...prev, showCampaignFormDialog: false }));
    } catch (error) {
      console.error('Error saving campaign: ', error);
      showToast('Failed to save campaign. Please try again.', 'error', 4000);
    } finally {
      setCampaignCreation((prev) => ({ ...prev, isCreating: false }));
    }
  };

  // Fetch all campaigns when linking form or campaign form is shown
  useEffect(() => {
    const fetchAllCampaigns = async () => {
      if (
        (!onboardingFlow.showLinkingForm && !onboardingFlow.showCampaignForm) ||
        !userSession.user.organizationId
      )
        return;

      try {
        const campaigns = await fetchCampaignsByOrganization(userSession.user.organizationId!);
        setCampaignCreation((prev) => ({ ...prev, allCampaigns: campaigns }));
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      }
    };

    fetchAllCampaigns();
  }, [
    onboardingFlow.showLinkingForm,
    onboardingFlow.showCampaignForm,
    userSession.user.organizationId,
    fetchCampaignsByOrganization,
  ]);

  // Sync kiosk assignments from campaign when moving to Step 2
  useEffect(() => {
    if (onboardingFlow.showKioskForm && campaignCreation.selectedCampaignInTour) {
      const campaign = campaignCreation.selectedCampaignInTour;

      // Set the kiosk assignments from the campaign
      setKioskCreation((prev) => ({
        ...prev,
        isGlobalCampaign: campaign.isGlobal || false,
        assignedKioskIds: campaign.assignedKiosks || [],
      }));
    }
  }, [onboardingFlow.showKioskForm, campaignCreation.selectedCampaignInTour]);

  // Fetch all kiosks when kiosk form is shown
  useEffect(() => {
    const fetchAllKiosks = async () => {
      if (!onboardingFlow.showKioskForm || !userSession.user.organizationId) return;

      try {
        const kiosksRef = collection(db, 'kiosks');
        const q = query(kiosksRef, where('organizationId', '==', userSession.user.organizationId));
        const snapshot = await getDocs(q);
        const kiosks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Kiosk);
        setKioskCreation((prev) => ({ ...prev, allKiosks: kiosks }));
      } catch (error) {
        console.error('Error fetching kiosks: ', error);
      }
    };

    fetchAllKiosks();
  }, [onboardingFlow.showKioskForm, userSession.user.organizationId]);

  const formatCurrency = (amount: number) => formatGbp(amount);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'donation':
        return <Heart className="w-4 h-4 text-green-600" />;
      case 'campaign':
        return <TrendingUp className="w-4 h-4 text-blue-600" />;
      case 'kiosk':
        return <Settings className="w-4 h-4 text-orange-600" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleStartTour = () => {
    // Reset all form states
    setCampaignCreation((prev) => ({
      ...prev,
      newCampaign: {
        title: '',
        description: '',
        goal: 0,
        status: 'active',
        startDate: '',
        endDate: '',
        tags: [],
        coverImageUrl: '',
        category: '',
        isGlobal: false,
      },
      createdId: '',
    }));
    setKioskCreation((prev) => ({
      ...prev,
      newKiosk: { name: '', location: '', accessCode: '' },
      createdId: '',
    }));

    // Start the tour by showing onboarding
    setOnboardingFlow((prev) => ({
      ...prev,
      isTourActive: true,
      showOnboarding: true,
      onboardingDismissed: false,
      showCampaignForm: false,
      showKioskForm: false,
      showLinkingForm: false,
      showStripeStep: false,
    }));

    // Clear sessionStorage when manually starting tour
    sessionStorage.removeItem('onboardingDismissed');

    // Add a history entry so browser back exits the tour instead of leaving the dashboard
    if (typeof window !== 'undefined') {
      window.history.pushState({ tour: true }, '', window.location.href);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (!onboardingFlow.showOnboarding) return;

      setOnboardingFlow((prev) => ({
        ...prev,
        showOnboarding: false,
        isTourActive: false,
        showCampaignForm: false,
        showKioskForm: false,
        showLinkingForm: false,
        showStripeStep: false,
      }));

      if (typeof window !== 'undefined') {
        window.history.pushState({ tour: false }, '', window.location.href);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }

    return;
  }, [onboardingFlow.showOnboarding]);

  const handleDirectStripeOnboarding = async () => {
    if (!organization?.id) {
      showToast('Organization ID not available for Stripe onboarding.', 'error');
      return;
    }

    if (!auth.currentUser) {
      showToast('No authenticated user found. Please log in again.', 'error');
      return;
    }

    try {
      setStripeOnboarding((prev) => ({ ...prev, isOnboarding: true }));
      const idToken = await auth.currentUser.getIdToken();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/createOnboardingLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ orgId: organization.id }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || response.statusText || 'Failed to create onboarding link.',
        );
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No onboarding URL received from server.');
      }
    } catch (error: unknown) {
      console.error('Error creating Stripe onboarding link:', error);
      const errorName =
        typeof error === 'object' && error !== null && 'name' in error
          ? String((error as { name: unknown }).name)
          : '';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorName === 'AbortError') {
        showToast('Request timed out. Please check your connection and try again.', 'error', 4000);
      } else {
        showToast(`Failed to start Stripe onboarding: ${errorMessage}`, 'error', 4000);
      }
      setStripeOnboarding((prev) => ({ ...prev, isOnboarding: false }));
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-red-50 text-red-700">
        <AlertCircle className="w-6 h-6 mr-2" />
        <p>Error loading dashboard data: {error}</p>
      </div>
    );
  }

  // Check if user has all required permissions for the getting started tour
  const hasGetStartedPermissions =
    hasPermission('edit_campaign') &&
    hasPermission('view_campaigns') &&
    hasPermission('view_kiosks') &&
    hasPermission('edit_kiosk');

  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      onStartTour={hasGetStartedPermissions ? handleStartTour : undefined}
      onOpenStripeSetup={() =>
        setDialogVisibility((prev) => ({ ...prev, showStripeStatusDialog: true }))
      }
      headerTitle={
        <div className="flex flex-col">
          {resolvedOrganizationName && (
            <div className="flex items-center gap-1.5 mb-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 tracking-wide">
                {resolvedOrganizationName}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold text-gray-900">
              <span className="header-title-text">Dashboard</span>
            </h1>
            <Badge className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {userSession.user.role.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
      }
      headerSubtitle="Real-time view of fundraising activity"
      headerTopRightActions={
        <div className="hidden sm:flex items-center gap-2 flex-nowrap ml-auto">
          {organization && organization.stripe && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDialogVisibility((prev) => ({ ...prev, showStripeStatusDialog: true }))
                }
                className={`relative rounded-lg transition-all duration-300
                  ${
                    !organization.stripe.chargesEnabled || !organization.stripe.payoutsEnabled
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-md hover:shadow-red-900/10 hover:scale-105 animate-pulse'
                      : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:shadow-md hover:shadow-green-900/10 hover:scale-105'
                  }`}
                aria-label="Stripe Status"
              >
                <CreditCard className="h-4 w-4" />
              </Button>
            </div>
          )}
          <AdminRefreshButton
            onRefresh={handleRefresh}
            refreshing={loading}
            label="Refresh"
            ariaLabel="Refresh Dashboard"
            hideLabelOnMobile
            variant="outline"
            size="sm"
          />
        </div>
      }
      hideSidebarTrigger={false}
      hideHeader={onboardingFlow.showOnboarding}
    >
      {/* Onboarding Flow with Sliding Animation */}
      {onboardingFlow.showOnboarding && !loading && onboardingFlow.campaignCountChecked ? (
        <div className="h-full bg-white overflow-hidden">
          <div
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{
              transform: onboardingFlow.showStripeStep
                ? 'translateX(-300%)'
                : onboardingFlow.showKioskForm
                  ? 'translateX(-200%)'
                  : onboardingFlow.showCampaignForm
                    ? 'translateX(-100%)'
                    : 'translateX(0)',
            }}
          >
            {/* Step 1: Welcome Screen */}
            <div className="min-w-full h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
              <div className="w-full max-w-5xl">
                <div className="p-8 sm:p-12">
                  <div className="max-w-4xl mx-auto">
                    {/* Header Badge */}
                    <div className="flex justify-center mb-6">
                      <Badge className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white">
                        ACTION REQUIRED
                      </Badge>
                    </div>

                    {/* Main Title */}
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-4">
                      Ready to start <span className="text-indigo-600">raising funds</span>?
                    </h2>

                    {/* Description */}
                    <p className="text-center text-gray-600 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
                      Welcome to SwiftCause. Your organization's dashboard is almost ready. Let's
                      walk through setting up your first donation kiosk and campaign in just 2
                      minutes.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                      <Button
                        onClick={() =>
                          setOnboardingFlow((prev) => ({ ...prev, showCampaignForm: true }))
                        }
                        size="lg"
                        className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                      >
                        Start Hands-on Guide
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </Button>
                      <Button
                        onClick={() => {
                          setOnboardingFlow((prev) => ({
                            ...prev,
                            showOnboarding: false,
                            onboardingDismissed: true,
                          }));
                          // Persist to sessionStorage so it stays dismissed during the session
                          sessionStorage.setItem('onboardingDismissed', 'true');
                        }}
                        variant="ghost"
                        size="lg"
                        className="text-gray-600 hover:text-gray-900 px-8 py-6 text-base font-medium w-full sm:w-auto"
                      >
                        SKIP AND EXPLORE
                      </Button>
                    </div>

                    {/* Feature Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {/* Deploy Kiosks */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                          <Monitor className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">Deploy Kiosks</h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Register physical donation points for contactless giving.
                        </p>
                        <ul className="space-y-1 text-xs text-gray-500">
                          <li>• Mobile-first design</li>
                          <li>• QR code access</li>
                          <li>• Real-time tracking</li>
                        </ul>
                      </div>

                      {/* Track Campaigns */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                          <Target className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">
                          Track Campaigns
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Link kiosks to specific goals and monitor real-time progress.
                        </p>
                        <ul className="space-y-1 text-xs text-gray-500">
                          <li>• Custom goals</li>
                          <li>• Progress tracking</li>
                          <li>• Performance metrics</li>
                        </ul>
                      </div>

                      {/* Automated Payouts */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                          <CreditCard className="w-6 h-6 text-purple-600" />
                        </div>
                        <h3 className="font-semibold text-lg text-gray-900 mb-2">
                          Automated Payouts
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          Receive funds directly to your organization's bank account.
                        </p>
                        <ul className="space-y-1 text-xs text-gray-500">
                          <li>• Secure processing</li>
                          <li>• Direct deposits</li>
                          <li>• Transparent fees</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Campaign Form */}
            <div className="min-w-full h-full flex flex-col bg-white">
              {/* Progress Stepper - Outside form, at top */}
              <div className="w-full bg-white border-b border-gray-200 py-2 px-4 sm:px-6 lg:px-8 pt-6 mb-4">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between">
                    {/* Step 1: Campaign */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mb-2">
                        <Target className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-green-600">Create Campaign</span>
                    </div>

                    {/* Connector Line */}
                    <div className="flex-1 h-0.5 bg-gray-300 mx-2 -mt-6"></div>

                    {/* Step 2: Kiosk */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                        <Monitor className="w-5 h-5 text-gray-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-400">Assign Kiosk</span>
                    </div>

                    {/* Connector Line */}
                    <div className="flex-1 h-0.5 bg-gray-300 mx-2 -mt-6"></div>

                    {/* Step 3: Stripe */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-400">Setup Payments</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-2xl mx-auto">
                  <Card className="bg-white border border-gray-200 rounded-xl shadow-sm">
                    <CardContent className="p-8">
                      {/* Header with Title */}
                      <div className="mb-6">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                          Create New Campaign
                        </h2>
                        <p className="text-base text-gray-500">
                          Configure a new fundraising campaign for your organization.
                        </p>
                      </div>

                      {/* What is a Campaign Info */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Target className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-blue-900 mb-1">
                              What is a Campaign?
                            </h4>
                            <p className="text-xs text-blue-700 leading-relaxed">
                              A campaign is a fundraising initiative with a specific goal. Donors
                              can contribute to campaigns through your kiosks.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Existing Campaigns List */}
                      {campaignCreation.allCampaigns.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Existing Campaigns ({campaignCreation.allCampaigns.length})
                          </h3>
                          <p className="text-sm text-gray-500 mb-3">
                            Click on a campaign to select it, or create a new one below.
                          </p>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {campaignCreation.allCampaigns.map((campaign) => (
                              <div
                                key={campaign.id}
                                onClick={() =>
                                  setCampaignCreation((prev) => ({
                                    ...prev,
                                    selectedCampaignInTour:
                                      prev.selectedCampaignInTour?.id === campaign.id
                                        ? null
                                        : campaign,
                                  }))
                                }
                                className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                  campaignCreation.selectedCampaignInTour?.id === campaign.id
                                    ? 'bg-green-50 border-green-500'
                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* Selection indicator */}
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                      campaignCreation.selectedCampaignInTour?.id === campaign.id
                                        ? 'border-green-500 bg-green-500'
                                        : 'border-gray-300'
                                    }`}
                                  >
                                    {campaignCreation.selectedCampaignInTour?.id ===
                                      campaign.id && <CheckCircle className="w-4 h-4 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 truncate">
                                      {campaign.title}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-sm text-gray-500">
                                        Goal: {formatGbpMajor(campaign.goal || 0)}
                                      </span>
                                      <span className="text-sm text-gray-500">
                                        Raised: {formatCurrency(campaign.raised || 0)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    className={`${
                                      campaign.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : campaign.status === 'paused'
                                          ? 'bg-yellow-100 text-yellow-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {campaign.status}
                                  </Badge>
                                  <button
                                    className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCampaignCreation((prev) => ({
                                        ...prev,
                                        editingCampaignInTour: campaign,
                                      }));
                                      const startDateStr = toDateInputString(campaign.startDate);
                                      const endDateStr = toDateInputString(campaign.endDate);
                                      setCampaignCreation((prev) => ({
                                        ...prev,
                                        formData: {
                                          title: campaign.title || '',
                                          briefOverview: '', // Campaign type doesn't have briefOverview, so use empty string
                                          description: campaign.description || '',
                                          goal: campaign.goal || 0,
                                          category: campaign.category || '',
                                          status: campaign.status || 'active',
                                          coverImageUrl: campaign.coverImageUrl || '',
                                          videoUrl: campaign.videoUrl || '',
                                          galleryImages: campaign.galleryImages || [],
                                          predefinedAmounts: campaign.configuration
                                            ?.predefinedAmounts || [10, 25, 50],
                                          startDate: startDateStr,
                                          endDate: endDateStr,
                                          enableRecurring:
                                            campaign.configuration?.enableRecurring ??
                                            DEFAULT_CAMPAIGN_CONFIG.enableRecurring,
                                          recurringIntervals: campaign.configuration
                                            ?.recurringIntervals || [
                                            ...DEFAULT_CAMPAIGN_CONFIG.recurringIntervals,
                                          ],
                                          tags: campaign.tags || [],
                                          isGlobal: campaign.isGlobal || false,
                                          assignedKiosks: campaign.assignedKiosks || [],
                                          giftAidEnabled:
                                            campaign.configuration?.giftAidEnabled || false,
                                        },
                                      }));
                                      setDialogVisibility((prev) => ({
                                        ...prev,
                                        showCampaignFormDialog: true,
                                      }));
                                    }}
                                  >
                                    <Pencil className="w-5 h-5 text-gray-500" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Create Campaign Button */}
                      <div className="py-4">
                        <button
                          onClick={() =>
                            setDialogVisibility((prev) => ({
                              ...prev,
                              showCampaignFormDialog: true,
                            }))
                          }
                          className="w-full py-5 border-2 border-dashed border-gray-300 rounded-xl text-gray-700 font-semibold text-lg hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus className="w-6 h-6" />
                          Create New Campaign
                        </button>
                      </div>

                      {/* Form Actions */}
                      <div className="flex justify-end gap-3 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setOnboardingFlow((prev) => ({ ...prev, showCampaignForm: false }));
                          }}
                          className="px-6"
                        >
                          <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                          Back
                        </Button>
                        <Button
                          onClick={() => {
                            // If a campaign is selected, use it for the next step
                            if (campaignCreation.selectedCampaignInTour) {
                              setCampaignCreation((prev) => ({
                                ...prev,
                                createdId: prev.selectedCampaignInTour!.id,
                              }));
                            }
                            setOnboardingFlow((prev) => ({
                              ...prev,
                              showCampaignForm: false,
                              showKioskForm: true,
                            }));
                          }}
                          className="bg-gray-900 hover:bg-gray-800 px-6"
                        >
                          Continue
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Campaign Form Dialog */}
              <CampaignForm
                open={dialogVisibility.showCampaignFormDialog}
                onOpenChange={(open) => {
                  setDialogVisibility((prev) => ({ ...prev, showCampaignFormDialog: open }));
                  if (!open) {
                    // Clear hook state when dialog closes
                    clearImageSelection();
                    clearGallerySelection();
                    setCampaignCreation((prev) => ({ ...prev, editingCampaignInTour: null }));
                    setCampaignDateError(false);
                  }
                }}
                editingCampaign={campaignCreation.editingCampaignInTour}
                campaignData={campaignCreation.formData}
                setCampaignData={setCampaignFormData}
                onSubmit={handleCampaignFormSubmit}
                onSaveDraft={() => {
                  // Handle save draft functionality if needed
                }}
                onCancel={() => {
                  // Clear hook state when canceling
                  clearImageSelection();
                  clearGallerySelection();
                  setDialogVisibility((prev) => ({ ...prev, showCampaignFormDialog: false }));
                  setCampaignCreation((prev) => ({ ...prev, editingCampaignInTour: null }));
                  setCampaignDateError(false);
                }}
                formatCurrency={formatCurrency}
                onImageFileSelect={(file) => {
                  if (file) {
                    // Create a DataTransfer to properly create a FileList
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    const fakeEvent = {
                      target: {
                        files: dataTransfer.files,
                      },
                    } as React.ChangeEvent<HTMLInputElement>;
                    handleImageSelect(fakeEvent);
                  }
                  setCampaignCreation((prev) => ({ ...prev, selectedImageFile: file }));
                }}
                onGalleryImagesSelect={(files) => {
                  if (files && files.length > 0) {
                    // Create a DataTransfer to properly create a FileList
                    const dataTransfer = new DataTransfer();
                    files.forEach((file) => dataTransfer.items.add(file));
                    const fakeEvent = {
                      target: {
                        files: dataTransfer.files,
                      },
                    } as React.ChangeEvent<HTMLInputElement>;
                    handleGalleryImagesSelect(fakeEvent);
                  }
                }}
                organizationId={userSession.user.organizationId}
                isSubmitting={campaignCreation.isCreating}
                hasPermission={hasPermission}
                dateError={campaignDateError}
                onDateErrorClear={() => setCampaignDateError(false)}
              />
            </div>

            {/* Step 3: Kiosk Form */}
            <div className="min-w-full h-full flex flex-col bg-white">
              {/* Progress Stepper - Outside form, at top */}
              <div className="w-full bg-white border-b border-gray-200 py-2 px-4 sm:px-6 lg:px-8 pt-6 mb-4">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between">
                    {/* Step 1: Campaign - Completed */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mb-2">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-green-600">Create Campaign</span>
                    </div>

                    {/* Connector Line - Completed */}
                    <div className="flex-1 h-0.5 bg-green-500 mx-2 -mt-6"></div>

                    {/* Step 2: Kiosk - Active */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mb-2">
                        <Monitor className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-green-600">Assign Kiosk</span>
                    </div>

                    {/* Connector Line - Inactive */}
                    <div className="flex-1 h-0.5 bg-gray-300 mx-2 -mt-6"></div>

                    {/* Step 3: Stripe - Inactive */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mb-2">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                      </div>
                      <span className="text-xs font-medium text-gray-400">Setup Payments</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-2xl mx-auto">
                  <Card className="bg-white border border-gray-200 rounded-xl shadow-sm">
                    <CardContent className="p-8">
                      {/* Header with Title and Skip Button */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <h2 className="text-3xl font-bold text-gray-900 mb-2">Assign Kiosk</h2>
                          <p className="text-base text-gray-500">
                            Assign your campaign to kiosks in your organization.
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            setOnboardingFlow((prev) => ({
                              ...prev,
                              showKioskForm: false,
                              showStripeStep: true,
                            }));
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium ml-4"
                        >
                          Skip
                        </Button>
                      </div>

                      {/* Make Campaign Global Button - Only show if there are kiosks */}
                      {kioskCreation.allKiosks.length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (kioskCreation.isGlobalCampaign) {
                              // If already global, turn off and unassign all
                              setKioskCreation((prev) => ({
                                ...prev,
                                isGlobalCampaign: false,
                                assignedKioskIds: [],
                              }));

                              // Update campaign document
                              if (campaignCreation.selectedCampaignInTour) {
                                try {
                                  const campaignRef = doc(
                                    db,
                                    'campaigns',
                                    campaignCreation.selectedCampaignInTour.id,
                                  );
                                  await updateDoc(campaignRef, {
                                    isGlobal: false,
                                    assignedKiosks: [],
                                    updatedAt: new Date(),
                                  });
                                  // Sync kiosk side — remove this campaign from all previously assigned kiosks
                                  const oldKioskIds = kioskCreation.allKiosks.map((k) => k.id);
                                  try {
                                    await syncKiosksForCampaign(
                                      campaignCreation.selectedCampaignInTour.id,
                                      [],
                                      oldKioskIds,
                                    );
                                  } catch (syncError) {
                                    console.error(
                                      'Kiosk sync failed after global unassign (campaign was updated):',
                                      syncError,
                                    );
                                  }
                                } catch (error) {
                                  console.error('Error updating campaign:', error);
                                }
                              }
                            } else {
                              // Make global - assign all kiosks
                              const allKioskIds = kioskCreation.allKiosks.map((k) => k.id);
                              setKioskCreation((prev) => ({
                                ...prev,
                                isGlobalCampaign: true,
                                assignedKioskIds: allKioskIds,
                              }));

                              // Update campaign document
                              if (campaignCreation.selectedCampaignInTour) {
                                try {
                                  const campaignRef = doc(
                                    db,
                                    'campaigns',
                                    campaignCreation.selectedCampaignInTour.id,
                                  );
                                  await updateDoc(campaignRef, {
                                    isGlobal: true,
                                    assignedKiosks: allKioskIds,
                                    updatedAt: new Date(),
                                  });
                                  // Sync kiosk side — add this campaign to all kiosks
                                  const oldKioskIds = kioskCreation.assignedKioskIds;
                                  try {
                                    await syncKiosksForCampaign(
                                      campaignCreation.selectedCampaignInTour.id,
                                      allKioskIds,
                                      oldKioskIds,
                                    );
                                  } catch (syncError) {
                                    console.error(
                                      'Kiosk sync failed after global assign (campaign was updated):',
                                      syncError,
                                    );
                                  }
                                } catch (error) {
                                  console.error('Error updating campaign:', error);
                                }
                              }
                            }
                          }}
                          disabled={!campaignCreation.selectedCampaignInTour}
                          className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 mb-6 flex items-center justify-center gap-3 ${
                            !campaignCreation.selectedCampaignInTour
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : kioskCreation.isGlobalCampaign
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300'
                          }`}
                        >
                          <Globe className="w-6 h-6" />
                          {kioskCreation.isGlobalCampaign
                            ? 'Your Campaign is now Global'
                            : 'Make this Campaign Global'}
                        </button>
                      )}

                      {/* Kiosk List */}
                      <div className="space-y-3 mb-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          Organization Kiosks
                        </h3>
                        {kioskCreation.allKiosks.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm">No kiosks found in your organization</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {kioskCreation.allKiosks.map((kiosk) => {
                              // If campaign is global, all kiosks are assigned
                              const isAssigned =
                                kioskCreation.isGlobalCampaign ||
                                kioskCreation.assignedKioskIds.includes(kiosk.id);
                              return (
                                <div
                                  key={kiosk.id}
                                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                                      <Monitor className="w-5 h-5 text-gray-600" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{kiosk.name}</p>
                                      <p className="text-xs text-gray-500">{kiosk.location}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (isAssigned) {
                                        // Unassign this kiosk
                                        const newAssignedIds =
                                          kioskCreation.assignedKioskIds.filter(
                                            (id) => id !== kiosk.id,
                                          );
                                        setKioskCreation((prev) => ({
                                          ...prev,
                                          assignedKioskIds: newAssignedIds,
                                        }));
                                        // If not all kiosks are assigned anymore, turn off global
                                        if (
                                          newAssignedIds.length < kioskCreation.allKiosks.length
                                        ) {
                                          setKioskCreation((prev) => ({
                                            ...prev,
                                            isGlobalCampaign: false,
                                          }));
                                        }

                                        // Update campaign document
                                        if (campaignCreation.selectedCampaignInTour) {
                                          try {
                                            const campaignRef = doc(
                                              db,
                                              'campaigns',
                                              campaignCreation.selectedCampaignInTour.id,
                                            );
                                            await updateDoc(campaignRef, {
                                              assignedKiosks: newAssignedIds,
                                              isGlobal:
                                                newAssignedIds.length ===
                                                kioskCreation.allKiosks.length,
                                              updatedAt: new Date(),
                                            });
                                            // Sync kiosk side — remove this campaign from the unassigned kiosk
                                            try {
                                              await syncKiosksForCampaign(
                                                campaignCreation.selectedCampaignInTour.id,
                                                newAssignedIds,
                                                kioskCreation.assignedKioskIds,
                                              );
                                            } catch (syncError) {
                                              console.error(
                                                'Kiosk sync failed after unassign (campaign was updated):',
                                                syncError,
                                              );
                                            }
                                          } catch (error) {
                                            console.error('Error updating campaign:', error);
                                          }
                                        }
                                      } else {
                                        // Assign this kiosk
                                        const newAssignedIds = [
                                          ...kioskCreation.assignedKioskIds,
                                          kiosk.id,
                                        ];
                                        setKioskCreation((prev) => ({
                                          ...prev,
                                          assignedKioskIds: newAssignedIds,
                                        }));
                                        // If all kiosks are now assigned, turn on global
                                        if (
                                          newAssignedIds.length === kioskCreation.allKiosks.length
                                        ) {
                                          setKioskCreation((prev) => ({
                                            ...prev,
                                            isGlobalCampaign: true,
                                          }));
                                        }

                                        // Update campaign document
                                        if (campaignCreation.selectedCampaignInTour) {
                                          try {
                                            const campaignRef = doc(
                                              db,
                                              'campaigns',
                                              campaignCreation.selectedCampaignInTour.id,
                                            );
                                            await updateDoc(campaignRef, {
                                              assignedKiosks: newAssignedIds,
                                              isGlobal:
                                                newAssignedIds.length ===
                                                kioskCreation.allKiosks.length,
                                              updatedAt: new Date(),
                                            });
                                            // Sync kiosk side — add this campaign to the newly assigned kiosk
                                            try {
                                              await syncKiosksForCampaign(
                                                campaignCreation.selectedCampaignInTour.id,
                                                newAssignedIds,
                                                kioskCreation.assignedKioskIds,
                                              );
                                            } catch (syncError) {
                                              console.error(
                                                'Kiosk sync failed after assign (campaign was updated):',
                                                syncError,
                                              );
                                            }
                                          } catch (error) {
                                            console.error('Error updating campaign:', error);
                                          }
                                        }
                                      }
                                    }}
                                    disabled={!campaignCreation.selectedCampaignInTour}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                                      !campaignCreation.selectedCampaignInTour
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : isAssigned
                                          ? 'bg-green-500 hover:bg-green-600 text-white'
                                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                                    }`}
                                  >
                                    {isAssigned ? 'Assigned' : 'Assign'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Create New Kiosk Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setDialogVisibility((prev) => ({ ...prev, showCreateKioskModal: true }))
                        }
                        className="w-full py-4 px-6 rounded-lg font-medium text-gray-600 border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Create a new Kiosk
                      </button>

                      {/* Form Actions */}
                      <div className="flex justify-end gap-3 mt-8">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setOnboardingFlow((prev) => ({
                              ...prev,
                              showKioskForm: false,
                              showCampaignForm: true,
                            }));
                          }}
                          className="px-6"
                        >
                          <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                          Back
                        </Button>
                        <Button
                          onClick={async () => {
                            // Assign selected campaign to assigned kiosks
                            if (
                              campaignCreation.selectedCampaignInTour &&
                              kioskCreation.assignedKioskIds.length > 0
                            ) {
                              try {
                                // Update each assigned kiosk with the campaign
                                const updatePromises = kioskCreation.assignedKioskIds.map(
                                  async (kioskId) => {
                                    const kioskRef = doc(db, 'kiosks', kioskId);
                                    const kiosk = kioskCreation.allKiosks.find(
                                      (k) => k.id === kioskId,
                                    );

                                    if (kiosk) {
                                      const currentAssignedCampaigns =
                                        kiosk.assignedCampaigns || [];
                                      // Add campaign if not already assigned
                                      if (
                                        !currentAssignedCampaigns.includes(
                                          campaignCreation.selectedCampaignInTour!.id,
                                        )
                                      ) {
                                        const updatedCampaigns = [
                                          ...currentAssignedCampaigns,
                                          campaignCreation.selectedCampaignInTour!.id,
                                        ];
                                        await updateDoc(kioskRef, {
                                          assignedCampaigns: updatedCampaigns,
                                          defaultCampaign: updatedCampaigns[0],
                                          updatedAt: new Date(),
                                        });
                                      }
                                    }
                                  },
                                );

                                await Promise.all(updatePromises);
                              } catch (error) {
                                console.error('Error assigning campaign to kiosks:', error);
                                showToast(
                                  'Failed to assign campaign to kiosks. Please try again.',
                                  'error',
                                  4000,
                                );
                                return;
                              }
                            }

                            setOnboardingFlow((prev) => ({
                              ...prev,
                              showKioskForm: false,
                              showStripeStep: true,
                            }));
                          }}
                          className="bg-gray-900 hover:bg-gray-800 px-6"
                        >
                          Continue
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Step 4: Stripe Account Status */}
            <div className="min-w-full h-full flex flex-col bg-white">
              {/* Progress Stepper - Outside form, at top */}
              <div className="w-full bg-white border-b border-gray-200 py-2 px-4 sm:px-6 lg:px-8 pt-6 mb-4">
                <div className="max-w-2xl mx-auto">
                  <div className="flex items-center justify-between">
                    {/* Step 1: Campaign - Completed */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mb-2">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-green-600">Create Campaign</span>
                    </div>

                    {/* Connector Line - Completed */}
                    <div className="flex-1 h-0.5 bg-green-500 mx-2 -mt-6"></div>

                    {/* Step 2: Kiosk - Completed */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mb-2">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-green-600">Assign Kiosk</span>
                    </div>

                    {/* Connector Line - Completed */}
                    <div className="flex-1 h-0.5 bg-green-500 mx-2 -mt-6"></div>

                    {/* Step 3: Stripe - Active */}
                    <div className="flex flex-col items-center flex-1">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mb-2">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-green-600">Setup Payments</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
                <div className="w-full max-w-2xl mx-auto">
                  <Card className="bg-white border border-gray-200 rounded-xl shadow-sm">
                    <CardContent className="p-8">
                      {/* Header with Title and Skip Button */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <h2 className="text-3xl font-bold text-gray-900 mb-2">Setup Payments</h2>
                          <p className="text-base text-gray-500">
                            Connect your Stripe account to accept donations.
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            setKioskCreation((prev) => ({
                              ...prev,
                              newKiosk: { name: '', location: '', accessCode: '' },
                            }));
                            setCampaignCreation((prev) => ({
                              ...prev,
                              newCampaign: {
                                title: '',
                                description: '',
                                goal: 0,
                                status: 'active',
                                startDate: '',
                                endDate: '',
                                tags: [],
                                coverImageUrl: '',
                                category: '',
                                isGlobal: false,
                              },
                            }));
                            setOnboardingFlow((prev) => ({
                              ...prev,
                              showStripeStep: false,
                              showCampaignForm: false,
                              showKioskForm: false,
                              showLinkingForm: false,
                              showOnboarding: false,
                              onboardingDismissed: true,
                            }));
                            // Persist to sessionStorage so it stays dismissed during the session
                            sessionStorage.setItem('onboardingDismissed', 'true');
                            // Refresh dashboard data
                            refreshDashboard();
                            // Navigate to dashboard to see the new data
                            onNavigate('admin-dashboard');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium ml-4"
                        >
                          Skip
                        </Button>
                      </div>

                      {/* Stripe Status Content */}
                      <div className="space-y-6">
                        {orgLoading ? (
                          <div className="text-center py-8">
                            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-3" />
                            <p className="text-sm text-gray-600">Loading organization data...</p>
                          </div>
                        ) : orgError ? (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm text-red-700">Error: {orgError}</p>
                          </div>
                        ) : organization &&
                          organization.stripe &&
                          !organization.stripe.chargesEnabled ? (
                          <>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                              <div className="flex items-start gap-3">
                                <TriangleAlert className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                  <h3 className="font-semibold text-yellow-900 mb-2">
                                    Action Required
                                  </h3>
                                  <p className="text-sm text-yellow-800 leading-relaxed">
                                    Your organization needs to complete Stripe onboarding to accept
                                    donations and receive payouts.
                                  </p>
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={handleDirectStripeOnboarding}
                              disabled={stripeOnboarding.isOnboarding}
                              className="w-full bg-yellow-600 hover:bg-yellow-700 h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {stripeOnboarding.isOnboarding ? (
                                <>
                                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                                  Redirecting...
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-5 h-5 mr-2" />
                                  Complete Stripe Onboarding
                                </>
                              )}
                            </Button>
                          </>
                        ) : organization &&
                          organization.stripe &&
                          organization.stripe.chargesEnabled &&
                          !organization.stripe.payoutsEnabled ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <div className="flex items-start gap-3">
                              <RefreshCw className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <h3 className="font-semibold text-blue-900 mb-2">Under Review</h3>
                                <p className="text-sm text-gray-800 leading-relaxed">
                                  Your Stripe account is being reviewed. Payouts will be enabled
                                  shortly.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                            <div className="flex items-start gap-3">
                              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <h3 className="font-semibold text-green-900 mb-2">All Set!</h3>
                                <p className="text-sm text-green-800 leading-relaxed">
                                  Your Stripe account is fully configured and ready to accept
                                  donations and process payouts.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Form Actions */}
                      <div className="flex justify-end gap-3 mt-8">
                        <Button
                          onClick={() => {
                            setKioskCreation((prev) => ({
                              ...prev,
                              newKiosk: { name: '', location: '', accessCode: '' },
                            }));
                            setCampaignCreation((prev) => ({
                              ...prev,
                              newCampaign: {
                                title: '',
                                description: '',
                                goal: 0,
                                status: 'active',
                                startDate: '',
                                endDate: '',
                                tags: [],
                                coverImageUrl: '',
                                category: '',
                                isGlobal: false,
                              },
                            }));
                            setOnboardingFlow((prev) => ({
                              ...prev,
                              showStripeStep: false,
                              showCampaignForm: false,
                              showKioskForm: false,
                              showOnboarding: false,
                              onboardingDismissed: true,
                            }));
                            // Persist to sessionStorage so it stays dismissed during the session
                            sessionStorage.setItem('onboardingDismissed', 'true');
                            // Refresh dashboard data
                            refreshDashboard();
                            // Navigate to dashboard to see the new data
                            onNavigate('admin-dashboard');
                          }}
                          className="bg-gray-900 hover:bg-gray-800 px-8"
                        >
                          Close & View Dashboard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* Kiosk Form Dialog - Inside Onboarding */}
          <KioskForm
            open={dialogVisibility.showCreateKioskModal}
            onOpenChange={(open) =>
              setDialogVisibility((prev) => ({ ...prev, showCreateKioskModal: open }))
            }
            editingKiosk={null}
            kioskData={kioskCreation.formData}
            setKioskData={setKioskFormData}
            campaigns={campaignCreation.allCampaigns.map((c) => ({
              id: c.id,
              title: c.title,
              raised: c.raised || 0,
              goal: c.goal,
              coverImageUrl: c.coverImageUrl,
            }))}
            onSubmit={handleKioskFormSubmit}
            onCancel={() =>
              setDialogVisibility((prev) => ({ ...prev, showCreateKioskModal: false }))
            }
            onAssignCampaign={handleKioskFormAssignCampaign}
            onUnassignCampaign={handleKioskFormUnassignCampaign}
            formatCurrency={formatCurrency}
          />
        </div>
      ) : onboardingFlow.campaignCountChecked && !onboardingFlow.showOnboarding ? (
        <>
          <div className="min-h-screen bg-[#F3F1EA] font-['Helvetica',sans-serif] transition-all duration-500 ease-in-out">
            <div className="px-6 lg:px-8 pt-12 pb-8 max-w-7xl mx-auto space-y-12 transition-all duration-500 ease-in-out">
              {stripeOnboarding.statusMessage && (
                <Card
                  className={`mb-6 ${stripeOnboarding.statusMessage.type === 'success' ? 'border-green-400 bg-green-50 text-green-800' : stripeOnboarding.statusMessage.type === 'warning' ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-red-400 bg-red-50 text-red-800'}`}
                >
                  <CardContent className="flex items-center space-x-2 sm:space-x-3 p-3 sm:p-4">
                    {stripeOnboarding.statusMessage.type === 'success' && (
                      <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    )}
                    {stripeOnboarding.statusMessage.type === 'warning' && (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    )}
                    {stripeOnboarding.statusMessage.type === 'error' && (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    )}
                    <p className="font-medium text-xs sm:text-sm break-words">
                      {stripeOnboarding.statusMessage.message}
                    </p>
                  </CardContent>
                </Card>
              )}
              {orgLoading ? (
                <p>Loading organization data...</p>
              ) : orgError ? (
                <p className="text-red-500">Error: {orgError}</p>
              ) : null}

              {/* Stripe Onboarding Alert Card */}
              <div
                className={`transition-all duration-500 ease-in-out ${needsOnboarding && organization ? 'mb-8' : 'mb-0 h-0 overflow-hidden'}`}
              >
                {needsOnboarding && organization && (
                  <Card className="border-l-4 border-l-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-lg hover:shadow-xl transition-all duration-500 ease-in-out">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-yellow-100 flex items-center justify-center animate-pulse">
                              <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                              <AlertCircle className="w-5 h-5 text-yellow-600" />
                              Complete Stripe Onboarding
                            </h3>
                            <p className="text-sm sm:text-base text-gray-700 mb-3">
                              Your organization needs to connect with Stripe to accept donations and
                              process payments.
                              <span className="hidden sm:inline">
                                {' '}
                                This quick setup takes only 5-10 minutes.
                              </span>
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <Shield className="w-4 h-4 text-green-600" />
                                <span>Secure</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-4 h-4 text-purple-600" />
                                <span>Fast Setup</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                <span>Accept Donations</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto flex-shrink-0">
                          <Button
                            onClick={() =>
                              setDialogVisibility((prev) => ({
                                ...prev,
                                showStripeStatusDialog: true,
                              }))
                            }
                            className="w-full sm:w-auto bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all h-11 sm:h-12 px-6"
                          >
                            <CreditCard className="w-5 h-5 mr-2" />
                            Start Onboarding
                            <ArrowUpRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Dashboard Content - Smoothly moves down when banner appears */}
              <div
                className={`transition-transform duration-500 ease-in-out ${needsOnboarding && organization ? 'transform translate-y-0' : 'transform translate-y-0'}`}
              >
                {/* ENTERPRISE DASHBOARD LAYOUT - Row 1: KPI Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 max-w-[1200px] mx-auto mb-12 transition-all duration-500 ease-in-out">
                  <KpiCard
                    title="Total Raised"
                    value={formatCurrency(stats.totalRaised)}
                    icon={DollarSign}
                    loading={loading}
                    isPrimary={true}
                  />
                  <KpiCard
                    title="Active Campaigns"
                    value={stats.activeCampaigns}
                    icon={Target}
                    loading={loading}
                  />
                  <KpiCard
                    title="Total Donations"
                    value={stats.totalDonations}
                    icon={Heart}
                    loading={loading}
                  />
                  <KpiCard
                    title="Active Kiosks"
                    value={stats.activeKiosks}
                    icon={Monitor}
                    loading={loading}
                  />
                  <KpiCard
                    title="Gift Aid Claimed"
                    value={formatCurrency(stats.totalGiftAid)}
                    icon={Gift}
                    loading={loading}
                  />
                </div>

                {/* Recurring KPI Row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 max-w-[1200px] mx-auto mb-8 transition-all duration-500 ease-in-out">
                  <KpiCard
                    title="Active Subs"
                    value={stats.recurring.activeSubscriptions}
                    icon={Users}
                    loading={loading}
                  />
                  <KpiCard
                    title="New Subs"
                    value={stats.recurring.newSubscriptions}
                    icon={ArrowUpRight}
                    loading={loading}
                  />
                  <KpiCard
                    title="Churn"
                    value={`${stats.recurring.churnRatePercent.toFixed(2)}%`}
                    icon={TrendingDown}
                    loading={loading}
                  />
                  <KpiCard
                    title="MRR"
                    value={formatGbpMajor(stats.recurring.mrrMinor / 100)}
                    icon={TrendingUp}
                    loading={loading}
                  />
                  <KpiCard
                    title="ARR"
                    value={formatGbpMajor(stats.recurring.arrMinor / 100)}
                    icon={BarChart3}
                    loading={loading}
                  />
                </div>

                {/* Recurring Trend */}
                <Card className="bg-white rounded-xl border border-gray-100 shadow-sm mb-12 transition-all duration-500 ease-in-out">
                  <CardHeader className="p-6 border-b border-gray-100">
                    <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mr-3">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      Recurring Trend
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500 mt-1 ml-11">
                      MRR and subscription lifecycle trend ({stats.recurring.windowLabel})
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    {loading ? (
                      <div className="space-y-3 transition-opacity duration-300">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-11/12 max-w-full" />
                        <Skeleton className="h-10 w-5/6 max-w-full" />
                      </div>
                    ) : stats.recurring.error ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        {stats.recurring.error}
                      </div>
                    ) : stats.recurring.trends.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                        No recurring trend data available yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stats.recurring.trends.map((point) => (
                          <div
                            key={point.period}
                            className="grid grid-cols-2 md:grid-cols-5 gap-3 items-center rounded-lg border border-gray-100 px-3 py-2"
                          >
                            <p className="text-sm font-medium text-gray-800">{point.period}</p>
                            <p className="text-sm text-gray-700">
                              MRR: {formatGbpMajor(point.mrrMinor / 100)}
                            </p>
                            <p className="text-sm text-gray-700">
                              Cash: {formatGbpMajor(point.cashCollectedMinor / 100)}
                            </p>
                            <p className="text-sm text-gray-700">New: {point.newSubscriptions}</p>
                            <p className="text-sm text-gray-700">
                              Canceled: {point.canceledSubscriptions}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Row 2: Revenue Growth Chart - Full Width */}
                <div className="mb-12 transition-all duration-500 ease-in-out">
                  <RevenueGrowthChart
                    data={stats.monthlyRevenue}
                    loading={loading}
                    formatCurrency={formatCurrency}
                  />
                </div>

                {/* Row 3: Alerts & Heatmap, Donation Distribution - Prioritized Heatmap Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-[auto_1fr] gap-6 mb-12 transition-all duration-500 ease-in-out">
                  {/* Left Column Top: Alerts & Notifications */}
                  <div className="lg:row-start-1">
                    <AlertsSection
                      alerts={alerts}
                      loading={loading}
                      onDismissAlert={() => {
                        // Handle alert dismissal - could add to local storage or API call
                      }}
                    />
                  </div>

                  {/* Left Column Bottom: Donor Activity Heatmap */}
                  <div className="lg:row-start-2">
                    <DonorActivityHeatmap data={stats.heatmapData} loading={loading} />
                  </div>

                  {/* Right Column: Donation Distribution - Spans full height */}
                  <div className="lg:row-span-2">
                    <DonationDistributionDonut
                      data={stats.categoryData}
                      loading={loading}
                      onViewDetails={() =>
                        setDialogVisibility((prev) => ({
                          ...prev,
                          showDonationDistributionDialog: true,
                        }))
                      }
                      className="h-full"
                    />
                  </div>
                </div>

                {/* Row 4: Split Section - Top Performing Campaigns & Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12 transition-all duration-500 ease-in-out">
                  <TopPerformingCampaigns
                    data={stats.topCampaigns}
                    loading={loading}
                    onViewDetails={() =>
                      setDialogVisibility((prev) => ({ ...prev, showCampaignProgressDialog: true }))
                    }
                    formatCurrency={formatCurrency}
                  />
                  {/* Recent Activity - Moved to right column */}
                  <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    <CardHeader className="p-6 border-b-2 border-gray-200">
                      <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center mr-3">
                          <ActivityIcon className="w-4 h-4" />
                        </div>
                        Recent Activity
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500 mt-1 ml-11">
                        Latest actions and updates
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 pt-0">
                      <div
                        className="max-h-[420px] overflow-y-auto force-hide-scrollbar space-y-4 pb-8"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        {loading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="flex items-start space-x-3 py-3 border-b border-gray-50 last:border-0 transition-opacity duration-300"
                            >
                              <Skeleton className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
                              <div className="flex-1 space-y-2 min-w-0">
                                <Skeleton
                                  className={`h-4 ${i === 0 ? 'w-[78%]' : i === 1 ? 'w-[65%]' : 'w-[82%]'}`}
                                />
                                <Skeleton
                                  className={`h-3 ${i === 0 ? 'w-1/2' : i === 1 ? 'w-2/5' : 'w-3/5'}`}
                                />
                              </div>
                            </div>
                          ))
                        ) : recentActivities.length > 0 ? (
                          recentActivities.map((activity: Activity) => (
                            <div
                              key={activity.id}
                              className="flex items-start space-x-3 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-25 cursor-pointer transition-colors rounded-lg px-2 -mx-2"
                              onClick={() => {
                                setDialogVisibility((prev) => ({
                                  ...prev,
                                  selectedActivity: activity,
                                  showActivityDialog: true,
                                }));
                              }}
                            >
                              <div className="flex-shrink-0 mt-1 opacity-70">
                                {getActivityIcon(activity.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 break-words leading-relaxed">
                                  {activity.message}
                                </p>
                                <div className="flex items-center flex-wrap gap-2 mt-2">
                                  <p className="text-xs text-gray-500 font-medium">
                                    {activity.timeAgo}
                                  </p>
                                  {activity.kioskId && (
                                    <>
                                      <span className="text-xs text-gray-300">·</span>
                                      <Badge
                                        variant="secondary"
                                        className="text-xs bg-gray-50 text-gray-600 border-0"
                                      >
                                        {activity.kioskId}
                                      </Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <ActivityIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-base font-medium mb-2 text-gray-700">
                              No Recent Activity
                            </p>
                            <p className="text-sm mb-4 px-4 text-gray-500 leading-relaxed">
                              Start by managing campaigns or configuring kiosks to see activity
                              here.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center gap-2">
                              {hasPermission('create_campaign') && (
                                <Button
                                  onClick={() => onNavigate('admin-campaigns')}
                                  size="sm"
                                  className="text-xs"
                                >
                                  <Settings className="w-3 h-3 mr-2" />
                                  <span className="hidden sm:inline">Manage Campaigns</span>
                                  <span className="sm:hidden">Campaigns</span>
                                </Button>
                              )}
                              {hasPermission('create_kiosk') && (
                                <Button
                                  onClick={() => onNavigate('admin-kiosks')}
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                >
                                  <Monitor className="w-3 h-3 mr-2" />
                                  <span className="hidden sm:inline">Configure Kiosks</span>
                                  <span className="sm:hidden">Kiosks</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Donation Details Dialog */}
      <Dialog
        open={dialogVisibility.showActivityDialog}
        onOpenChange={(open) =>
          setDialogVisibility((prev) => ({ ...prev, showActivityDialog: open }))
        }
      >
        <DialogContent className="sm:max-w-[500px] mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Heart className="h-5 w-5 text-green-600" />
              <span>Donation Details</span>
            </DialogTitle>
            <DialogDescription className="text-sm">
              Complete information about this donation
            </DialogDescription>
          </DialogHeader>

          {dialogVisibility.selectedActivity && dialogVisibility.selectedActivity.donationData && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Amount:</span>
                <span className="col-span-2 text-sm font-semibold text-green-600">
                  {formatCurrency(
                    Number(dialogVisibility.selectedActivity.donationData.amount) || 0,
                  )}
                </span>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Campaign:</span>
                <span className="col-span-2 text-sm text-gray-900">
                  {dialogVisibility.selectedActivity.campaignName || 'N/A'}
                </span>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Date & Time:</span>
                <span className="col-span-2 text-sm text-gray-900">
                  {dialogVisibility.selectedActivity.displayTime}
                </span>
              </div>

              {dialogVisibility.selectedActivity.donationData.donorName && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Donor Name:</span>
                  <span className="col-span-2 text-sm text-gray-900">
                    {dialogVisibility.selectedActivity.donationData.donorName}
                  </span>
                </div>
              )}

              {dialogVisibility.selectedActivity.donationData.donorEmail && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Email:</span>
                  <span className="col-span-2 text-sm text-gray-900 break-all">
                    {dialogVisibility.selectedActivity.donationData.donorEmail}
                  </span>
                </div>
              )}

              {dialogVisibility.selectedActivity.donationData.donorPhone && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Phone:</span>
                  <span className="col-span-2 text-sm text-gray-900">
                    {dialogVisibility.selectedActivity.donationData.donorPhone}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Type:</span>
                <span className="col-span-2 text-sm">
                  {dialogVisibility.selectedActivity.donationData.isRecurring ? (
                    <Badge variant="default" className="bg-blue-600">
                      Recurring ({dialogVisibility.selectedActivity.donationData.recurringInterval})
                    </Badge>
                  ) : (
                    <Badge variant="secondary">One-time</Badge>
                  )}
                </span>
              </div>

              {dialogVisibility.selectedActivity.donationData.isAnonymous && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Anonymous:</span>
                  <span className="col-span-2 text-sm">
                    <Badge variant="outline">Anonymous Donation</Badge>
                  </span>
                </div>
              )}

              {dialogVisibility.selectedActivity.donationData.isGiftAid && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Gift Aid:</span>
                  <span className="col-span-2 text-sm">
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      Gift Aid Eligible
                    </Badge>
                  </span>
                </div>
              )}

              {dialogVisibility.selectedActivity.kioskId && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Platform:</span>
                  <span className="col-span-2 text-sm text-gray-900">
                    {dialogVisibility.selectedActivity.kioskId}
                  </span>
                </div>
              )}

              {dialogVisibility.selectedActivity.donationData.transactionId && (
                <div className="grid grid-cols-3 items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Transaction ID:</span>
                  <span className="col-span-2 text-xs text-gray-600 font-mono break-all">
                    {dialogVisibility.selectedActivity.donationData.transactionId}
                  </span>
                </div>
              )}

              {dialogVisibility.selectedActivity.donationData.donorMessage && (
                <div className="grid grid-cols-3 items-start gap-4">
                  <span className="text-sm font-medium text-gray-700">Message:</span>
                  <span className="col-span-2 text-sm text-gray-900 italic">
                    "{dialogVisibility.selectedActivity.donationData.donorMessage}"
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" className="w-full sm:w-auto">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Centralized Stripe Onboarding Dialog - New Redesigned Version */}
      <StripeOnboardingDialog
        open={dialogVisibility.showStripeStatusDialog}
        onOpenChange={(open) =>
          setDialogVisibility((prev) => ({ ...prev, showStripeStatusDialog: open }))
        }
        organization={organization}
        loading={orgLoading}
      />

      {/* Additional Onboarding Dialog for other triggers */}
      <StripeOnboardingDialog
        open={dialogVisibility.showOnboardingPopup}
        onOpenChange={(open) =>
          setDialogVisibility((prev) => ({ ...prev, showOnboardingPopup: open }))
        }
        organization={organization}
        loading={orgLoading}
      />

      {/* Performance Detail Dialog */}
      <PerformanceDetailDialog
        isOpen={dialogVisibility.showPerformanceDialog}
        onClose={() => setDialogVisibility((prev) => ({ ...prev, showPerformanceDialog: false }))}
        campaigns={dashboardData.allCampaignsForPerformance}
        stats={stats}
      />

      {/* Donation Distribution Dialog */}
      <DonationDistributionDialog
        isOpen={dialogVisibility.showDonationDistributionDialog}
        onClose={() =>
          setDialogVisibility((prev) => ({ ...prev, showDonationDistributionDialog: false }))
        }
        data={stats.donationDistribution}
        totalRaised={stats.totalRaised}
        formatCurrency={formatCurrency}
      />

      {/* Campaign Progress Dialog */}
      <CampaignProgressDialog
        isOpen={dialogVisibility.showCampaignProgressDialog}
        onClose={() =>
          setDialogVisibility((prev) => ({ ...prev, showCampaignProgressDialog: false }))
        }
        campaigns={transformCampaignsToProgress(
          dashboardData.goalComparisonData.map(
            (d, index): Campaign => ({
              id: `${d.name}-${index}`,
              title: d.name,
              description: '',
              raised: d.Collected,
              goal: d.Goal,
              coverImageUrl: '',
              category: 'General',
              configuration: {
                ...DEFAULT_CAMPAIGN_CONFIG,
                predefinedAmounts: [...DEFAULT_CAMPAIGN_CONFIG.predefinedAmounts],
                suggestedAmounts: [...DEFAULT_CAMPAIGN_CONFIG.suggestedAmounts],
                recurringIntervals: [...DEFAULT_CAMPAIGN_CONFIG.recurringIntervals],
                requiredFields: [...DEFAULT_CAMPAIGN_CONFIG.requiredFields],
                optionalFields: [...DEFAULT_CAMPAIGN_CONFIG.optionalFields],
              },
            }),
          ),
        )}
        onCampaignClick={() => {
          setDialogVisibility((prev) => ({ ...prev, showCampaignProgressDialog: false }));
          onNavigate('admin-campaigns');
        }}
        formatCurrency={formatCurrency}
      />

      {loading && !onboardingFlow.showOnboarding && (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-3" />
            <p className="text-sm text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
