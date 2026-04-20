import { Campaign } from '@/shared/types';

// State for the campaign details feature
export interface CampaignDetailsState {
  campaign: Campaign | null;
  loading: boolean;
  error: string | null;
  selectedAmount: number | null;
  customAmount: string;
  currentImageIndex: number;
  isRecurring: boolean;
  recurringInterval: 'monthly' | 'quarterly' | 'yearly';
}

// Props for the main campaign details page
export interface CampaignDetailsPageProps {
  state: CampaignDetailsState;
  currency: string;
  accentColorHex?: string;
  organizationId?: string | null;
  donorEmail?: string;
  donorName?: string;
  onBack: () => void;
  onSelectAmount: (amount: number) => void;
  onCustomAmountChange: (value: string) => void;
  onRecurringToggle: (value: boolean) => void;
  onRecurringIntervalChange: (value: 'monthly' | 'quarterly' | 'yearly') => void;
  onDonate: () => void;
  onImageChange: (index: number) => void;
  onDonorEmailChange?: (email: string) => void;
  onDonorNameChange?: (name: string) => void;
}

// Props for header
export interface CampaignDetailsHeaderProps {
  onBack: () => void;
}

// Props for image carousel
export interface ImageCarouselProps {
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  fallbackImage?: string;
  accentColorHex?: string;
}

// Props for amount selector
export interface AmountSelectorProps {
  amounts: number[];
  selectedAmount: number | null;
  customAmount: string;
  currency: string;
  enableRecurring: boolean;
  recurringIntervals?: ('monthly' | 'quarterly' | 'yearly')[];
  recurringInterval: 'monthly' | 'quarterly' | 'yearly';
  isRecurring: boolean;
  donorEmail?: string;
  donorName?: string;
  accentColorHex?: string;
  onSelectAmount: (amount: number) => void;
  onCustomAmountChange: (value: string) => void;
  onRecurringToggle: (value: boolean) => void;
  onRecurringIntervalChange: (value: 'monthly' | 'quarterly' | 'yearly') => void;
  onDonorEmailChange?: (email: string) => void;
  onDonorNameChange?: (name: string) => void;
}

// Props for donate button
export interface DonateButtonProps {
  disabled: boolean;
  onClick: () => void;
  label?: string;
  accentColorHex?: string;
}

// Props for video player
export interface VideoPlayerProps {
  videoUrl: string | undefined;
}

// Props for loading state
export interface LoadingStateProps {
  message?: string;
  accentColorHex?: string;
  organizationId?: string | null;
}

// Props for error state
export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}
