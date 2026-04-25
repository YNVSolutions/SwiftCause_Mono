/**
 * Campaign ↔ Kiosk Bidirectional Sync Utility
 *
 * Provides atomic, race-condition-safe operations for maintaining consistency
 * between campaign.assignedKiosks and kiosk.assignedCampaigns.
 */

import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface SyncOperation {
  type: 'add' | 'remove';
  campaignId: string;
  kioskId: string;
}

export interface SyncResult {
  success: boolean;
  operation: SyncOperation;
  error?: Error;
}

export interface SyncBatchResult {
  successful: SyncOperation[];
  failed: Array<{ operation: SyncOperation; error: Error }>;
}

function toSyncError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

function getErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { errorMessage: error.message, errorName: error.name };
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: string; message?: string };
    return {
      errorCode: candidate.code,
      errorMessage: candidate.message,
      errorRaw: String(error),
    };
  }

  return { errorRaw: String(error) };
}

function isFirestoreNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: string };
  return candidate.code === 'not-found';
}

/**
 * Structured logging for sync operations
 */
function logSync(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    module: 'campaignKioskSync',
    ...context,
  };

  const logMessage = `[CampaignKioskSync] ${message}`;

  switch (level) {
    case 'info':
      // eslint-disable-next-line no-console
      console.log(logMessage, logData);
      break;
    case 'warn':
      console.warn(logMessage, logData);
      break;
    case 'error':
      console.error(logMessage, logData);
      break;
  }
}

/**
 * Add a kiosk to a campaign's assignedKiosks array (atomic)
 */
async function addKioskToCampaign(campaignId: string, kioskId: string): Promise<SyncResult> {
  const operation: SyncOperation = { type: 'add', campaignId, kioskId };

  try {
    logSync('info', 'Adding kiosk to campaign', { campaignId, kioskId });

    const campaignRef = doc(db, 'campaigns', campaignId);
    await updateDoc(campaignRef, {
      assignedKiosks: arrayUnion(kioskId),
    });

    logSync('info', 'Successfully added kiosk to campaign', { campaignId, kioskId });
    return { success: true, operation };
  } catch (error) {
    logSync('error', 'Failed to add kiosk to campaign', {
      campaignId,
      kioskId,
      ...getErrorContext(error),
    });
    return { success: false, operation, error: toSyncError(error) };
  }
}

/**
 * Remove a kiosk from a campaign's assignedKiosks array (atomic)
 */
async function removeKioskFromCampaign(campaignId: string, kioskId: string): Promise<SyncResult> {
  const operation: SyncOperation = { type: 'remove', campaignId, kioskId };

  try {
    logSync('info', 'Removing kiosk from campaign', { campaignId, kioskId });

    const campaignRef = doc(db, 'campaigns', campaignId);
    await updateDoc(campaignRef, {
      assignedKiosks: arrayRemove(kioskId),
    });

    logSync('info', 'Successfully removed kiosk from campaign', { campaignId, kioskId });
    return { success: true, operation };
  } catch (error) {
    if (isFirestoreNotFound(error)) {
      logSync('warn', 'Campaign not found while removing kiosk; treated as already removed', {
        campaignId,
        kioskId,
        ...getErrorContext(error),
      });
      return { success: true, operation };
    }

    logSync('error', 'Failed to remove kiosk from campaign', {
      campaignId,
      kioskId,
      ...getErrorContext(error),
    });
    return { success: false, operation, error: toSyncError(error) };
  }
}

/**
 * Add a campaign to a kiosk's assignedCampaigns array (atomic)
 */
async function addCampaignToKiosk(kioskId: string, campaignId: string): Promise<SyncResult> {
  const operation: SyncOperation = { type: 'add', campaignId, kioskId };

  try {
    logSync('info', 'Adding campaign to kiosk', { kioskId, campaignId });

    const kioskRef = doc(db, 'kiosks', kioskId);
    await updateDoc(kioskRef, {
      assignedCampaigns: arrayUnion(campaignId),
    });

    logSync('info', 'Successfully added campaign to kiosk', { kioskId, campaignId });
    return { success: true, operation };
  } catch (error) {
    logSync('error', 'Failed to add campaign to kiosk', {
      kioskId,
      campaignId,
      ...getErrorContext(error),
    });
    return { success: false, operation, error: toSyncError(error) };
  }
}

/**
 * Remove a campaign from a kiosk's assignedCampaigns array (atomic)
 */
async function removeCampaignFromKiosk(kioskId: string, campaignId: string): Promise<SyncResult> {
  const operation: SyncOperation = { type: 'remove', campaignId, kioskId };

  try {
    logSync('info', 'Removing campaign from kiosk', { kioskId, campaignId });

    const kioskRef = doc(db, 'kiosks', kioskId);
    await updateDoc(kioskRef, {
      assignedCampaigns: arrayRemove(campaignId),
    });

    logSync('info', 'Successfully removed campaign from kiosk', { kioskId, campaignId });
    return { success: true, operation };
  } catch (error) {
    logSync('error', 'Failed to remove campaign from kiosk', {
      kioskId,
      campaignId,
      ...getErrorContext(error),
    });
    return { success: false, operation, error: toSyncError(error) };
  }
}

/**
 * Sync kiosk assignments when a campaign is updated
 * Forward sync: campaign.assignedKiosks → kiosk.assignedCampaigns
 */
export async function syncKiosksForCampaign(
  campaignId: string,
  newKioskIds: string[],
  oldKioskIds: string[] = [],
): Promise<SyncBatchResult> {
  logSync('info', 'Starting campaign → kiosk sync', {
    campaignId,
    newKioskIds,
    oldKioskIds,
    addCount: newKioskIds.filter((id) => !oldKioskIds.includes(id)).length,
    removeCount: oldKioskIds.filter((id) => !newKioskIds.includes(id)).length,
  });

  const addedKiosks = newKioskIds.filter((id) => !oldKioskIds.includes(id));
  const removedKiosks = oldKioskIds.filter((id) => !newKioskIds.includes(id));

  const results: SyncResult[] = [];

  for (const kioskId of addedKiosks) {
    const result = await addCampaignToKiosk(kioskId, campaignId);
    results.push(result);
  }

  for (const kioskId of removedKiosks) {
    const result = await removeCampaignFromKiosk(kioskId, campaignId);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).map((r) => r.operation);
  const failed = results
    .filter((r) => !r.success)
    .map((r) => ({ operation: r.operation, error: r.error! }));

  logSync('info', 'Completed campaign → kiosk sync', {
    campaignId,
    successCount: successful.length,
    failCount: failed.length,
  });

  return { successful, failed };
}

/**
 * Sync campaign assignments when a kiosk is updated
 * Reverse sync: kiosk.assignedCampaigns → campaign.assignedKiosks
 */
export async function syncCampaignsForKiosk(
  kioskId: string,
  newCampaignIds: string[],
  oldCampaignIds: string[] = [],
): Promise<SyncBatchResult> {
  logSync('info', 'Starting kiosk → campaign sync', {
    kioskId,
    newCampaignIds,
    oldCampaignIds,
    addCount: newCampaignIds.filter((id) => !oldCampaignIds.includes(id)).length,
    removeCount: oldCampaignIds.filter((id) => !newCampaignIds.includes(id)).length,
  });

  const addedCampaigns = newCampaignIds.filter((id) => !oldCampaignIds.includes(id));
  const removedCampaigns = oldCampaignIds.filter((id) => !newCampaignIds.includes(id));

  const results: SyncResult[] = [];

  for (const campaignId of addedCampaigns) {
    const result = await addKioskToCampaign(campaignId, kioskId);
    results.push(result);
  }

  for (const campaignId of removedCampaigns) {
    const result = await removeKioskFromCampaign(campaignId, kioskId);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).map((r) => r.operation);
  const failed = results
    .filter((r) => !r.success)
    .map((r) => ({ operation: r.operation, error: r.error! }));

  logSync('info', 'Completed kiosk → campaign sync', {
    kioskId,
    successCount: successful.length,
    failCount: failed.length,
  });

  return { successful, failed };
}

/**
 * Remove a kiosk from all campaigns (used when deleting a kiosk)
 */
export async function removeKioskFromAllCampaigns(
  kioskId: string,
  assignedCampaignIds: string[],
): Promise<SyncBatchResult> {
  logSync('info', 'Removing kiosk from all campaigns', {
    kioskId,
    campaignCount: assignedCampaignIds.length,
  });

  return syncCampaignsForKiosk(kioskId, [], assignedCampaignIds);
}

/**
 * Remove a campaign from all kiosks (used when deleting a campaign)
 */
export async function removeCampaignFromAllKiosks(
  campaignId: string,
  assignedKioskIds: string[],
): Promise<SyncBatchResult> {
  logSync('info', 'Removing campaign from all kiosks', {
    campaignId,
    kioskCount: assignedKioskIds.length,
  });

  return syncKiosksForCampaign(campaignId, [], assignedKioskIds);
}

/**
 * Normalize assignedKiosks/assignedCampaigns to string[]
 * Handles legacy comma-separated strings and ensures consistent data shape
 */
export function normalizeAssignments(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Verify sync consistency (for debugging/testing)
 * Checks if campaign.assignedKiosks matches kiosk.assignedCampaigns
 */
export async function verifySyncConsistency(campaignId: string): Promise<{
  consistent: boolean;
  campaignKiosks: string[];
  kioskCampaigns: Record<string, string[]>;
  mismatches: string[];
}> {
  const campaignRef = doc(db, 'campaigns', campaignId);
  const campaignSnap = await getDoc(campaignRef);

  if (!campaignSnap.exists()) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const campaignData = campaignSnap.data();
  const campaignKiosks = normalizeAssignments(campaignData.assignedKiosks);
  const kioskCampaigns: Record<string, string[]> = {};
  const mismatches: string[] = [];

  for (const kioskId of campaignKiosks) {
    const kioskRef = doc(db, 'kiosks', kioskId);
    const kioskSnap = await getDoc(kioskRef);

    if (kioskSnap.exists()) {
      const kioskData = kioskSnap.data();
      const campaigns = normalizeAssignments(kioskData.assignedCampaigns);
      kioskCampaigns[kioskId] = campaigns;

      if (!campaigns.includes(campaignId)) {
        mismatches.push(kioskId);
      }
    } else {
      mismatches.push(kioskId);
    }
  }

  return {
    consistent: mismatches.length === 0,
    campaignKiosks,
    kioskCampaigns,
    mismatches,
  };
}
