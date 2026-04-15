import { Campaign } from '@/shared/types';

/**
 * Get top 3 predefined amounts for a campaign
 * Falls back to default amounts if not enough are configured
 */
export const getTop3Amounts = (campaign: Campaign): number[] => {
  const predefinedAmounts = campaign.configuration?.predefinedAmounts || [];
  const sortedAmounts = [...predefinedAmounts].sort((a, b) => a - b);
  const top3 = sortedAmounts.slice(0, 3);
  
  // Pad with defaults if needed
  const defaultAmounts = [10, 25, 50];
  while (top3.length < 3) {
    const nextDefault = defaultAmounts[top3.length];
    if (!top3.includes(nextDefault)) {
      top3.push(nextDefault);
    } else {
      top3.push((top3[top3.length - 1] || 10) * 2);
    }
  }
  
  return top3;
};

/**
 * Calculate progress percentage for a campaign
 * Allows percentage to exceed 100% for over-funded campaigns
 */
export const getProgressPercentage = (raised: number, goal: number): number => {
  if (goal <= 0) return 0;
  return ((raised / 100) / goal) * 100;
};

/**
 * Paginate campaigns array
 */
export const paginateCampaigns = (
  campaigns: Campaign[],
  page: number,
  perPage: number = 6
): { campaigns: Campaign[]; totalPages: number } => {
  const totalPages = Math.ceil(campaigns.length / perPage);
  const startIdx = (page - 1) * perPage;
  const endIdx = startIdx + perPage;
  
  return {
    campaigns: campaigns.slice(startIdx, endIdx),
    totalPages,
  };
};
