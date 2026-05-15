import { auth } from '@/shared/lib/firebase';
import { FUNCTION_URLS } from '@/shared/config/functions';

import type {
  DeviceCommand,
  DeviceCommandType,
  DeviceEnrollmentProfile,
  DeviceEvent,
  ManagedDevice,
} from '../model/types';

type HttpMethod = 'GET' | 'POST';

interface AdminFunctionOptions {
  method?: HttpMethod;
  query?: Record<string, string | null | undefined>;
  body?: Record<string, unknown>;
}

const buildUrl = (baseUrl: string, query?: AdminFunctionOptions['query']) => {
  const url = new URL(baseUrl);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const getIdToken = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('You must be signed in to manage devices.');
  }
  return token;
};

export const callAdminDeviceFunction = async <TResponse>(
  url: string,
  options: AdminFunctionOptions = {},
): Promise<TResponse> => {
  const token = await getIdToken();
  const method = options.method || 'POST';
  const response = await fetch(buildUrl(url, options.query), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(options.body || {}) : undefined,
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || `Device request failed with status ${response.status}.`);
  }

  return data as TResponse;
};

export interface CreateDeviceProfileInput {
  kioskId?: string | null;
  label?: string | null;
  apiBaseUrl?: string | null;
}

export interface UpdateManagedDeviceMetadataInput {
  deviceId: string;
  displayName?: string | null;
  placementLabel?: string | null;
  placementNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  kioskId?: string | null;
}

export const managedDeviceApi = {
  async createDeviceProfile(input: CreateDeviceProfileInput): Promise<DeviceEnrollmentProfile> {
    const response = await callAdminDeviceFunction<{
      enrollmentToken: string;
      organizationId: string;
      kioskId?: string | null;
      status: DeviceEnrollmentProfile['status'];
      provisioningPayload: DeviceEnrollmentProfile['provisioningPayload'];
    }>(FUNCTION_URLS.adminCreateDeviceProfile, {
      body: input as Record<string, unknown>,
    });

    return response;
  },

  async listManagedDevices(kioskId?: string | null): Promise<ManagedDevice[]> {
    const response = await callAdminDeviceFunction<{ devices: ManagedDevice[] }>(
      FUNCTION_URLS.adminListManagedDevices,
      {
        method: 'GET',
        query: { kioskId },
      },
    );
    return response.devices;
  },

  async updateManagedDeviceMetadata(input: UpdateManagedDeviceMetadataInput): Promise<void> {
    await callAdminDeviceFunction(FUNCTION_URLS.adminUpdateManagedDeviceMetadata, {
      body: input as unknown as Record<string, unknown>,
    });
  },

  async queueDeviceCommand(deviceId: string, commandType: DeviceCommandType): Promise<string> {
    const response = await callAdminDeviceFunction<{ commandId: string }>(
      FUNCTION_URLS.adminQueueDeviceCommand,
      {
        body: { deviceId, commandType },
      },
    );
    return response.commandId;
  },

  async listDeviceCommands(deviceId: string): Promise<DeviceCommand[]> {
    const response = await callAdminDeviceFunction<{ commands: DeviceCommand[] }>(
      FUNCTION_URLS.adminListDeviceCommands,
      {
        method: 'GET',
        query: { deviceId },
      },
    );
    return response.commands;
  },

  async listDeviceEvents(deviceId: string): Promise<DeviceEvent[]> {
    const response = await callAdminDeviceFunction<{ events: DeviceEvent[] }>(
      FUNCTION_URLS.adminListDeviceEvents,
      {
        method: 'GET',
        query: { deviceId },
      },
    );
    return response.events;
  },
};
