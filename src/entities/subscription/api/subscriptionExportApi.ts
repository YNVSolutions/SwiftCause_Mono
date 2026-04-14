import { getAuth } from 'firebase/auth';
import { FUNCTION_URLS } from '@/shared/config/functions';

export type SubscriptionExportRange = 'current_month' | 'past_month' | 'custom';

export interface SubscriptionExportRequest {
  organizationId: string;
  range: SubscriptionExportRange;
  startDate?: string;
  endDate?: string;
}

const getCurrentUserToken = async () => {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error('Authentication token not found. Please log in.');
  }

  return token;
};

const parseFileName = (contentDisposition: string | null, fallbackName: string) => {
  if (!contentDisposition) return fallbackName;
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  if (!match || !match[1]) return fallbackName;
  return match[1];
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
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
};

export async function exportSubscriptions(request: SubscriptionExportRequest) {
  const token = await getCurrentUserToken();
  const url = FUNCTION_URLS.exportSubscriptions;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error(`Could not reach subscription export function at ${url}.`);
  }

  if (!response.ok) {
    let errorMessage = 'Failed to export subscriptions.';
    try {
      const errorData = await response.json();
      if (typeof errorData?.error === 'string' && errorData.error.trim()) {
        errorMessage = errorData.error;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }

  const contentDisposition = response.headers.get('content-disposition');
  const fallbackName = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
  const fileName = parseFileName(contentDisposition, fallbackName);
  const blob = await response.blob();
  triggerBlobDownload(blob, fileName);
}
