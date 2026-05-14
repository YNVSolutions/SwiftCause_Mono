import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('id-token-1'),
    },
  },
}));

vi.mock('@/shared/config/functions', () => ({
  FUNCTION_URLS: {
    adminCreateDeviceProfile: 'https://functions.test/adminCreateDeviceProfile',
    adminListManagedDevices: 'https://functions.test/adminListManagedDevices',
    adminUpdateManagedDeviceMetadata: 'https://functions.test/adminUpdateManagedDeviceMetadata',
    adminQueueDeviceCommand: 'https://functions.test/adminQueueDeviceCommand',
    adminListDeviceCommands: 'https://functions.test/adminListDeviceCommands',
    adminListDeviceEvents: 'https://functions.test/adminListDeviceEvents',
  },
}));

import { managedDeviceApi } from './managedDeviceApi';

const fetchMock = vi.fn();

describe('managedDeviceApi', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends Firebase auth token when creating a device profile', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        enrollmentToken: 'enroll-1',
        organizationId: 'org-1',
        kioskId: 'kiosk-1',
        status: 'active',
        provisioningPayload: {
          enrollmentToken: 'enroll-1',
          organizationId: 'org-1',
          kioskId: 'kiosk-1',
          controllerPackage: 'com.swiftcause.devicecontroller',
        },
      }),
    });

    const profile = await managedDeviceApi.createDeviceProfile({ kioskId: 'kiosk-1' });

    expect(profile.enrollmentToken).toBe('enroll-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://functions.test/adminCreateDeviceProfile',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer id-token-1',
        }),
        body: JSON.stringify({ kioskId: 'kiosk-1' }),
      }),
    );
  });

  it('uses query string for device listing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ devices: [{ id: 'device-1', organizationId: 'org-1' }] }),
    });

    const devices = await managedDeviceApi.listManagedDevices('kiosk-1');

    expect(devices).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://functions.test/adminListManagedDevices?kioskId=kiosk-1',
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    );
  });

  it('surfaces backend error messages', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    });

    await expect(managedDeviceApi.queueDeviceCommand('device-1', 'restart_kiosk')).rejects.toThrow(
      'Forbidden',
    );
  });
});
