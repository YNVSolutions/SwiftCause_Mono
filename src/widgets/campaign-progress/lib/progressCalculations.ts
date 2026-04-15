import { Campaign } from '../../../shared/types';

export interface CampaignProgress {
  id: string;
  name: string;
  raised: number;
  goal: number;
  percentage: number;
  status: 'critical' | 'warning' | 'good' | 'exceeded';
  statusColor: string;
  progressColor: string;
}

/**
 * Calculate progress status based on percentage
 */
export function getProgressStatus(percentage: number): {
  status: CampaignProgress['status'];
  statusColor: string;
  progressColor: string;
} {
  if (percentage >= 100) {
    return {
      status: 'exceeded',
      statusColor: 'text-emerald-600',
      progressColor: 'bg-emerald-600',
    };
  } else if (percentage >= 67) {
    return {
      status: 'good',
      statusColor: 'text-emerald-600',
      progressColor: 'bg-emerald-600',
    };
  } else if (percentage >= 34) {
    return {
      status: 'warning',
      statusColor: 'text-amber-600',
      progressColor: 'bg-amber-600',
    };
  } else {
    return {
      status: 'critical',
      statusColor: 'text-red-600',
      progressColor: 'bg-red-600',
    };
  }
}

/**
 * Transform campaigns into progress data
 */
export function transformCampaignsToProgress(campaigns: Campaign[]): CampaignProgress[] {
  return campaigns.map(campaign => {
    const raised = campaign.raised || 0;
    const goal = campaign.goal || 1;
    // Allow percentage to exceed 100% for over-funded campaigns
    const percentage = Math.round(((raised / 100) / goal) * 100);
    const { status, statusColor, progressColor } = getProgressStatus(percentage);

    return {
      id: campaign.id,
      name: campaign.title || 'Untitled Campaign',
      raised,
      goal,
      percentage,
      status,
      statusColor,
      progressColor,
    };
  });
}

/**
 * Sort campaigns by different criteria
 */
export function sortCampaignProgress(
  campaigns: CampaignProgress[],
  sortBy: 'progress' | 'raised' | 'goal' | 'name'
): CampaignProgress[] {
  const sorted = [...campaigns];
  
  switch (sortBy) {
    case 'progress':
      return sorted.sort((a, b) => b.percentage - a.percentage);
    case 'raised':
      return sorted.sort((a, b) => b.raised - a.raised);
    case 'goal':
      return sorted.sort((a, b) => b.goal - a.goal);
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}
