// Campaign-related types
export interface CampaignConfiguration {
  predefinedAmounts: number[];
  allowCustomAmount: boolean;
  minCustomAmount: number;
  maxCustomAmount: number;
  suggestedAmounts: number[];
  enableRecurring: boolean;
  recurringIntervals: ("monthly" | "quarterly" | "yearly")[];
  defaultRecurringInterval: "monthly" | "quarterly" | "yearly";
  recurringDiscount?: number;
  displayStyle: "grid" | "list" | "carousel";
  showProgressBar: boolean;
  showDonorCount: boolean;
  showRecentDonations: boolean;
  maxRecentDonations: number;
  primaryCTAText: string;
  secondaryCTAText?: string;
  urgencyMessage?: string;
  accentColor?: string;
  backgroundImage?: string;
  theme: "default" | "minimal" | "vibrant" | "elegant";
  requiredFields: ("email" | "name" | "phone" | "address")[];
  optionalFields: ("email" | "name" | "phone" | "address" | "message")[];
  enableAnonymousDonations: boolean;
  enableSocialSharing: boolean;
  shareMessage?: string;
  enableDonorWall: boolean;
  enableComments: boolean;
  giftAidEnabled: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  goal: number;
  raised: number;
  coverImageUrl: string;
  category: string;
  tags?: string[];
  status?: "active" | "paused" | "completed" | "exceeded";
  createdAt?: string;
  startDate?: string | Date | { seconds: number; nanoseconds?: number; toDate?: () => Date };
  endDate?: string | Date | { seconds: number; nanoseconds?: number; toDate?: () => Date };
  autoCompletedGoal?: number;
  autoCompletedAt?: string;
  autoPausedEndDate?: string;
  autoPausedEndDateAt?: string;
  organizationId?: string;
  donationCount?: number;
  configuration: CampaignConfiguration;
  assignedKiosks?: string[];
  isGlobal?: boolean;
  longDescription?: string;
  videoUrl?: string;
  galleryImages?: string[];
  organizationInfo?: {
    name: string;
    description: string;
    website?: string;
    logo?: string;
  };
  impactMetrics?: {
    peopleHelped?: number;
    itemsProvided?: number;
    customMetric?: {
      label: string;
      value: number;
      unit: string;
    };
  };
}
