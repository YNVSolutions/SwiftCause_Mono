import { Campaign } from '@/shared/types';

export type CampaignStatus = NonNullable<Campaign['status']>;

export interface CampaignStatusResolution {
  status: CampaignStatus;
  updates?: Partial<
    Pick<
      Campaign,
      | 'status'
      | 'autoCompletedGoal'
      | 'autoCompletedAt'
      | 'autoPausedEndDate'
      | 'autoPausedEndDateAt'
    >
  >;
}

export type CampaignLifecycleEvent =
  | { type: 'SYSTEM_RECONCILE'; now?: Date }
  | { type: 'MANUAL_STATUS_SET'; status: CampaignStatus; now?: Date }
  | { type: 'GOAL_UPDATED'; goal: number; now?: Date }
  | { type: 'END_DATE_UPDATED'; endDate: Campaign['endDate']; now?: Date };

type FirestoreTimestampLike = {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
};

function parseCampaignDate(
  value: Campaign['startDate'] | Campaign['endDate'] | undefined,
): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const maybeTimestamp = value as FirestoreTimestampLike;
  if (typeof maybeTimestamp?.toDate === 'function') {
    const parsed = maybeTimestamp.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof maybeTimestamp?.seconds === 'number') {
    const parsed = new Date(maybeTimestamp.seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function toEndDateKey(endDate: Campaign['endDate']): string | null {
  const parsed = parseCampaignDate(endDate);
  return parsed ? parsed.toISOString() : null;
}

function reconcileCampaignStatus(
  campaign: Pick<
    Campaign,
    | 'status'
    | 'goal'
    | 'raised'
    | 'startDate'
    | 'endDate'
    | 'autoCompletedGoal'
    | 'autoPausedEndDate'
  >,
  now: Date,
): CampaignStatusResolution {
  const status = campaign.status;

  if (status === 'completed' || status === 'exceeded') {
    return { status };
  }

  const startDate = parseCampaignDate(campaign.startDate);
  if (startDate) {
    if (startOfDay(startDate) > now) {
      return { status: 'paused' };
    }
    return { status: status === 'active' ? 'active' : 'paused' };
  }

  if (status === 'paused') {
    return { status: 'paused' };
  }

  return { status: 'active' };
}

/**
 * Explicit transition engine:
 * Given current campaign state + event => next status and metadata updates.
 */
export function applyCampaignStatusEvent(
  campaign: Pick<
    Campaign,
    | 'status'
    | 'goal'
    | 'raised'
    | 'startDate'
    | 'endDate'
    | 'autoCompletedGoal'
    | 'autoPausedEndDate'
  >,
  event: CampaignLifecycleEvent,
): CampaignStatusResolution {
  switch (event.type) {
    case 'MANUAL_STATUS_SET': {
      return { status: event.status, updates: { status: event.status } };
    }
    case 'GOAL_UPDATED': {
      const now = event.now || new Date();
      return reconcileCampaignStatus({ ...campaign, goal: event.goal }, now);
    }
    case 'END_DATE_UPDATED': {
      const now = event.now || new Date();
      return reconcileCampaignStatus({ ...campaign, endDate: event.endDate }, now);
    }
    case 'SYSTEM_RECONCILE':
    default: {
      const now = event.now || new Date();
      return reconcileCampaignStatus(campaign, now);
    }
  }
}

export function deriveEndDateKey(endDate: Campaign['endDate']): string | null {
  return toEndDateKey(endDate);
}
