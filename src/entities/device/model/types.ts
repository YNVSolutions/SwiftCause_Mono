export type ManagedDeviceStatus =
  | 'enrolled'
  | 'online'
  | 'offline'
  | 'installing'
  | 'install_failed'
  | 'kiosk_active'
  | 'error';

export type DeviceCommandType = 'sync_policy' | 'restart_kiosk' | 'refresh_content' | 'clear_error';

export interface ManagedDevice {
  id: string;
  organizationId: string;
  kioskId?: string | null;
  status?: ManagedDeviceStatus | string | null;
  displayName?: string | null;
  placementLabel?: string | null;
  placementNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lastHeartbeatAt?: unknown;
  lastPolicyFetchAt?: unknown;
  lastStatusAt?: unknown;
  lastError?: string | null;
  installStatus?: string | null;
  launchStatus?: string | null;
  deviceOwner?: boolean | null;
  deviceInfo?: {
    model?: string | null;
    manufacturer?: string | null;
    controllerVersion?: string | null;
    androidId?: string | null;
    serialNumber?: string | null;
  };
}

export interface DeviceEnrollmentProfile {
  enrollmentToken: string;
  organizationId: string;
  kioskId?: string | null;
  status: 'active' | 'used' | 'revoked' | 'expired';
  provisioningPayload: ProvisioningPayload;
}

export interface ProvisioningPayload {
  enrollmentToken: string;
  organizationId: string;
  kioskId?: string | null;
  controllerPackage: string;
  apiBaseUrl?: string | null;
}

export interface DeviceCommand {
  id: string;
  organizationId: string;
  kioskId?: string | null;
  deviceId: string;
  commandType: DeviceCommandType | string;
  status: 'pending' | 'completed' | 'failed' | string;
  queuedAt?: unknown;
  completedAt?: unknown;
  failedAt?: unknown;
  error?: string | null;
}

export interface DeviceEvent {
  id: string;
  organizationId: string;
  kioskId?: string | null;
  deviceId: string;
  type: string;
  status?: string | null;
  payload?: Record<string, unknown>;
  createdAt?: unknown;
}
