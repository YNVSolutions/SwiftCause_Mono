import { Campaign, KioskSession } from '@/shared/types';

// Layout modes for campaign display
export type CampaignLayoutMode = 'grid' | 'list' | 'carousel';

// State for the campaign list feature
export interface CampaignListState {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  layoutMode: CampaignLayoutMode;
}

// Props for the main campaign list page
export interface CampaignListPageProps {
  state: CampaignListState;
  kioskSession: KioskSession | null;
  organizationBranding?: {
    displayName?: string;
    logoUrl?: string | null;
    accentColorHex?: string;
    idleImageUrl?: string | null;
  };
  onSelectCampaign: (campaign: Campaign, amount?: number) => void;
  onViewDetails: (campaign: Campaign) => void;
  onLogout: () => void;
}

// Props for individual campaign card
export interface CampaignCardProps {
  campaign: Campaign;
  currency: string;
  accentColorHex?: string;
  onSelectAmount: (amount: number) => void;
  onDonate: () => void;
  onCardClick: () => void;
}

// Props for grid layout
export interface CampaignGridProps {
  campaigns: Campaign[];
  currency: string;
  accentColorHex?: string;
  onSelectCampaign: (campaign: Campaign, amount?: number) => void;
  onViewDetails: (campaign: Campaign) => void;
}

// Props for list layout
export interface CampaignListLayoutProps {
  campaigns: Campaign[];
  currency: string;
  accentColorHex?: string;
  onSelectCampaign: (campaign: Campaign, amount?: number) => void;
  onViewDetails: (campaign: Campaign) => void;
}

// Props for carousel layout
export interface CampaignCarouselProps {
  campaigns: Campaign[];
  currency: string;
  accentColorHex?: string;
  onSelectCampaign: (campaign: Campaign, amount?: number) => void;
  onViewDetails: (campaign: Campaign) => void;
}

// Props for pagination
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// Props for header
export interface CampaignListHeaderProps {
  onBack: () => void;
}

// Props for loading state
export interface LoadingStateProps {
  message?: string;
  submessage?: string;
}

// Props for error state
export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

// Props for empty state
export interface EmptyStateProps {
  kioskName?: string;
}
