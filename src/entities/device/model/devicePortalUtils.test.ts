import { describe, expect, it } from 'vitest';

import {
  formatProvisioningPayload,
  getDeviceStatusLabel,
  getDeviceStatusTone,
  validateDeviceCoordinates,
} from './devicePortalUtils';

describe('device portal utilities', () => {
  it('maps active heartbeat and kiosk state to simple labels', () => {
    expect(
      getDeviceStatusLabel(
        {
          id: 'device-1',
          organizationId: 'org-1',
          status: 'online',
          lastHeartbeatAt: { ms: 10_000 },
        },
        11_000,
      ),
    ).toBe('Online');
    expect(
      getDeviceStatusLabel({
        id: 'device-1',
        organizationId: 'org-1',
        status: 'kiosk_active',
      }),
    ).toBe('Kiosk active');
  });

  it('marks stale heartbeat and errors clearly', () => {
    expect(
      getDeviceStatusLabel(
        {
          id: 'device-1',
          organizationId: 'org-1',
          status: 'online',
          lastHeartbeatAt: { ms: 1_000 },
        },
        10 * 60 * 1000,
      ),
    ).toBe('Offline');
    expect(
      getDeviceStatusLabel({
        id: 'device-1',
        organizationId: 'org-1',
        status: 'install_failed',
      }),
    ).toBe('Needs attention');
  });

  it('maps labels to badge tones', () => {
    expect(getDeviceStatusTone('Online')).toBe('success');
    expect(getDeviceStatusTone('Enrolled')).toBe('warning');
    expect(getDeviceStatusTone('Needs attention')).toBe('danger');
    expect(getDeviceStatusTone('No heartbeat')).toBe('neutral');
  });

  it('validates coordinates as a pair', () => {
    expect(validateDeviceCoordinates(51.5, -0.12)).toBeNull();
    expect(validateDeviceCoordinates(91, 0)).toBe('Latitude must be between -90 and 90.');
    expect(validateDeviceCoordinates(0, 181)).toBe('Longitude must be between -180 and 180.');
    expect(validateDeviceCoordinates(51.5, null)).toBe(
      'Latitude and longitude must be provided together.',
    );
  });

  it('formats provisioning payload without APK details', () => {
    const formatted = formatProvisioningPayload({
      enrollmentToken: 'enroll-1',
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      controllerPackage: 'com.swiftcause.devicecontroller',
      apiBaseUrl: 'https://functions.example.test',
    });

    expect(JSON.parse(formatted)).toEqual({
      enrollmentToken: 'enroll-1',
      organizationId: 'org-1',
      kioskId: 'kiosk-1',
      controllerPackage: 'com.swiftcause.devicecontroller',
      apiBaseUrl: 'https://functions.example.test',
    });
    expect(formatted).not.toContain('apk');
  });
});
