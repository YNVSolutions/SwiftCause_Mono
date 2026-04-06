import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FUNCTION_URLS } from '@/shared/config/functions';
import { db } from '@/shared/lib/firebase';

export interface GiftAidExportFile {
  fileName: string;
  storagePath: string;
  downloadUrl?: string | null;
  sha256: string;
  sizeBytes: number;
}

export interface GiftAidExportResult {
  success: true;
  empty: boolean;
  rowCount: number;
  message?: string;
  batchId?: string;
  exportedAt?: string;
  hmrcFile?: GiftAidExportFile;
  internalFile?: GiftAidExportFile;
}

export interface GiftAidExportBatch {
  id: string;
  batchId?: string;
  organizationId: string;
  status: string;
  createdAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureMessage?: string;
  createdByUserId?: string;
  createdByEmail?: string | null;
  createdByName?: string | null;
  rowCount: number;
  hmrcFile?: GiftAidExportFile | null;
  internalFile?: GiftAidExportFile | null;
}

export type GiftAidExportFileKind = 'hmrc' | 'internal';

const getGiftAidExportFunctionUrl = () => {
  return (
    process.env.NEXT_PUBLIC_EXPORT_GIFTAID_FUNCTION_URL?.trim() ||
    FUNCTION_URLS.exportGiftAidDeclarations
  );
};

const getGiftAidBatchDownloadFunctionUrl = () => {
  const explicitOverride = process.env.NEXT_PUBLIC_DOWNLOAD_GIFTAID_BATCH_FILE_FUNCTION_URL?.trim();
  if (explicitOverride) {
    return explicitOverride;
  }

  const exportOverride = process.env.NEXT_PUBLIC_EXPORT_GIFTAID_FUNCTION_URL?.trim();
  if (exportOverride) {
    return exportOverride.replace(
      /\/exportGiftAidDeclarations$/,
      '/downloadGiftAidExportBatchFile',
    );
  }

  return FUNCTION_URLS.downloadGiftAidExportBatchFile;
};

const getCurrentUserToken = async () => {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error('Authentication token not found. Please log in.');
  }

  return token;
};

export async function exportGiftAidDeclarations(
  organizationId: string,
): Promise<GiftAidExportResult> {
  const token = await getCurrentUserToken();
  const url = getGiftAidExportFunctionUrl();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ organizationId }),
    });
  } catch {
    throw new Error(
      `Could not reach Gift Aid export function at ${url}. ` +
        `If you are testing locally, restart Next.js after updating .env.local. ` +
        `For function-only local testing, set NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false and set NEXT_PUBLIC_EXPORT_GIFTAID_FUNCTION_URL to your local function emulator URL.`,
    );
  }

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.error || 'Failed to export Gift Aid declarations.');
  }

  return responseData as GiftAidExportResult;
}

export async function fetchGiftAidExportBatches(
  organizationId: string,
): Promise<GiftAidExportBatch[]> {
  const batchesQuery = query(
    collection(db, 'giftAidExportBatches'),
    where('organizationId', '==', organizationId),
  );
  const snapshot = await getDocs(batchesQuery);

  return snapshot.docs
    .map(
      (docSnapshot) =>
        ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }) as GiftAidExportBatch,
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || left.completedAt || left.failedAt || '');
      const rightTime = Date.parse(right.createdAt || right.completedAt || right.failedAt || '');
      return (
        (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
      );
    });
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

export async function downloadGiftAidExportFile(
  batchId: string,
  fileKind: GiftAidExportFileKind,
  file: GiftAidExportFile,
) {
  const token = await getCurrentUserToken();
  const url = getGiftAidBatchDownloadFunctionUrl();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        batchId,
        fileKind,
      }),
    });
  } catch {
    throw new Error(
      `Could not reach Gift Aid batch download function at ${url}. ` +
        `If you are testing locally, point NEXT_PUBLIC_DOWNLOAD_GIFTAID_BATCH_FILE_FUNCTION_URL to your local function emulator URL.`,
    );
  }

  if (!response.ok) {
    let errorMessage = `Failed to download ${file.fileName}.`;
    try {
      const errorData = await response.json();
      if (typeof errorData?.error === 'string' && errorData.error.trim()) {
        errorMessage = errorData.error;
      }
    } catch {
      // Non-JSON failure response; keep the generic message.
    }

    throw new Error(errorMessage);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, file.fileName);
}
