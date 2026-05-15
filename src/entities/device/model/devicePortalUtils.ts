import type { DeviceCommandType, ManagedDevice, ProvisioningPayload } from './types';

const HEARTBEAT_STALE_MS = 5 * 60 * 1000;

export const DEVICE_COMMAND_LABELS: Record<DeviceCommandType, string> = {
  sync_policy: 'Sync policy',
  restart_kiosk: 'Restart kiosk',
  refresh_content: 'Refresh content',
  clear_error: 'Clear error',
};

export const SAFE_DEVICE_COMMANDS = Object.keys(DEVICE_COMMAND_LABELS) as DeviceCommandType[];

const timestampToMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as { seconds?: number; ms?: number; toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().getTime();
    }
    if (typeof maybeTimestamp.seconds === 'number') {
      return maybeTimestamp.seconds * 1000;
    }
    if (typeof maybeTimestamp.ms === 'number') {
      return maybeTimestamp.ms;
    }
  }
  return null;
};

export const getDeviceStatusLabel = (device: ManagedDevice, nowMs = Date.now()): string => {
  if (device.lastError || device.status === 'error' || device.status === 'install_failed') {
    return 'Needs attention';
  }
  if (device.status === 'kiosk_active') {
    return 'Kiosk active';
  }
  if (device.status === 'installing') {
    return 'Installing';
  }
  if (device.status === 'enrolled') {
    return 'Enrolled';
  }

  const heartbeatMs = timestampToMillis(device.lastHeartbeatAt);
  if (heartbeatMs && nowMs - heartbeatMs <= HEARTBEAT_STALE_MS) {
    return 'Online';
  }
  if (heartbeatMs) {
    return 'Offline';
  }
  return 'No heartbeat';
};

export const getDeviceStatusTone = (
  label: string,
): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (label === 'Online' || label === 'Kiosk active') return 'success';
  if (label === 'Installing' || label === 'Enrolled') return 'warning';
  if (label === 'Needs attention' || label === 'Offline') return 'danger';
  return 'neutral';
};

export const validateDeviceCoordinates = (
  latitude: number | null,
  longitude: number | null,
): string | null => {
  const hasLatitude = latitude !== null;
  const hasLongitude = longitude !== null;
  if (hasLatitude !== hasLongitude) {
    return 'Latitude and longitude must be provided together.';
  }
  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    return 'Latitude must be between -90 and 90.';
  }
  if (longitude !== null && (longitude < -180 || longitude > 180)) {
    return 'Longitude must be between -180 and 180.';
  }
  return null;
};

export const formatProvisioningPayload = (payload: ProvisioningPayload): string => {
  return JSON.stringify(
    {
      enrollmentToken: payload.enrollmentToken,
      organizationId: payload.organizationId,
      kioskId: payload.kioskId || null,
      controllerPackage: payload.controllerPackage,
      apiBaseUrl: payload.apiBaseUrl || null,
    },
    null,
    2,
  );
};
