'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, RotateCcw, Save, ShieldCheck, TabletSmartphone } from 'lucide-react';

import {
  DEVICE_COMMAND_LABELS,
  formatProvisioningPayload,
  getDeviceStatusLabel,
  getDeviceStatusTone,
  managedDeviceApi,
  SAFE_DEVICE_COMMANDS,
  validateDeviceCoordinates,
} from '@/entities/device';
import type { DeviceCommandType, DeviceEvent, ManagedDevice } from '@/entities/device';
import type { Kiosk } from '@/shared/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

const toneClass = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
};

interface DeviceManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kiosks: Kiosk[];
  initialKioskId?: string | null;
  onDevicesChanged?: () => void;
}

export function DeviceManagementDialog({
  open,
  onOpenChange,
  kiosks,
  initialKioskId,
  onDevicesChanged,
}: DeviceManagementDialogProps) {
  const [devices, setDevices] = useState<ManagedDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [provisioningPayload, setProvisioningPayload] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    placementLabel: '',
    placementNotes: '',
    latitude: '',
    longitude: '',
    kioskId: initialKioskId || '',
  });

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) || null;

  const linkedKioskName = useMemo(() => {
    if (!selectedDevice?.kioskId) return 'Unassigned';
    return kiosks.find((kiosk) => kiosk.id === selectedDevice.kioskId)?.name || 'Unknown kiosk';
  }, [kiosks, selectedDevice?.kioskId]);

  const loadDevices = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const nextDevices = await managedDeviceApi.listManagedDevices(initialKioskId || null);
      setDevices(nextDevices);
      const preferredDevice =
        nextDevices.find((device) => device.id === selectedDeviceId) || nextDevices[0] || null;
      setSelectedDeviceId(preferredDevice?.id || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKioskId]);

  useEffect(() => {
    if (!selectedDevice) {
      setEvents([]);
      setForm({
        displayName: '',
        placementLabel: '',
        placementNotes: '',
        latitude: '',
        longitude: '',
        kioskId: initialKioskId || '',
      });
      return;
    }

    setForm({
      displayName: selectedDevice.displayName || '',
      placementLabel: selectedDevice.placementLabel || '',
      placementNotes: selectedDevice.placementNotes || '',
      latitude:
        selectedDevice.latitude === null || selectedDevice.latitude === undefined
          ? ''
          : String(selectedDevice.latitude),
      longitude:
        selectedDevice.longitude === null || selectedDevice.longitude === undefined
          ? ''
          : String(selectedDevice.longitude),
      kioskId: selectedDevice.kioskId || '',
    });

    managedDeviceApi
      .listDeviceEvents(selectedDevice.id)
      .then((nextEvents) => setEvents(nextEvents))
      .catch(() => setEvents([]));
  }, [initialKioskId, selectedDevice]);

  const handleCreateProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const profile = await managedDeviceApi.createDeviceProfile({
        kioskId: initialKioskId || form.kioskId || null,
        label: form.placementLabel || null,
      });
      setProvisioningPayload(formatProvisioningPayload(profile.provisioningPayload));
      setMessage('Provisioning profile created.');
      onDevicesChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create provisioning profile.');
    } finally {
      setSaving(false);
    }
  };

  const parseCoordinate = (value: string) => (value.trim() ? Number(value) : null);

  const handleSaveMetadata = async () => {
    if (!selectedDevice) return;
    const latitude = parseCoordinate(form.latitude);
    const longitude = parseCoordinate(form.longitude);
    const coordinateError = validateDeviceCoordinates(latitude, longitude);
    if (coordinateError) {
      setMessage(coordinateError);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await managedDeviceApi.updateManagedDeviceMetadata({
        deviceId: selectedDevice.id,
        displayName: form.displayName || null,
        placementLabel: form.placementLabel || null,
        placementNotes: form.placementNotes || null,
        latitude,
        longitude,
        kioskId: form.kioskId || null,
      });
      setMessage('Device details saved.');
      await loadDevices();
      onDevicesChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save device details.');
    } finally {
      setSaving(false);
    }
  };

  const handleQueueCommand = async (commandType: DeviceCommandType) => {
    if (!selectedDevice) return;
    setSaving(true);
    setMessage(null);
    try {
      await managedDeviceApi.queueDeviceCommand(selectedDevice.id, commandType);
      setMessage(`${DEVICE_COMMAND_LABELS[commandType]} queued.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to queue command.');
    } finally {
      setSaving(false);
    }
  };

  const copyProvisioningPayload = async () => {
    if (!provisioningPayload) return;
    await navigator.clipboard.writeText(provisioningPayload);
    setMessage('Provisioning payload copied.');
  };

  const statusLabel = selectedDevice ? getDeviceStatusLabel(selectedDevice) : 'No device selected';
  const statusTone = getDeviceStatusTone(statusLabel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[880px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TabletSmartphone className="h-5 w-5 text-emerald-700" />
            Device management
          </DialogTitle>
          <DialogDescription>
            Provision devices, record placement, and queue safe remote actions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <Button
              onClick={handleCreateProfile}
              disabled={saving}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <ShieldCheck className="h-4 w-4 mr-2" />
              Create provisioning profile
            </Button>
            <Button variant="outline" onClick={loadDevices} disabled={loading} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh devices
            </Button>

            <div className="rounded-md border divide-y bg-white">
              {devices.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {loading ? 'Loading devices...' : 'No devices enrolled yet.'}
                </div>
              ) : (
                devices.map((device) => {
                  const label = getDeviceStatusLabel(device);
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={`w-full px-3 py-3 text-left hover:bg-gray-50 ${
                        selectedDeviceId === device.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {device.displayName || device.deviceInfo?.model || device.id}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500 truncate">
                          {device.placementLabel || 'No placement'}
                        </span>
                        <Badge className={toneClass[getDeviceStatusTone(label)]}>{label}</Badge>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-5">
            {message && (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {message}
              </div>
            )}

            {provisioningPayload && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-emerald-900">Provisioning payload</div>
                  <Button variant="outline" size="sm" onClick={copyProvisioningPayload}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
                <pre className="mt-3 max-h-40 overflow-auto rounded bg-white p-3 text-xs text-gray-800">
                  {provisioningPayload}
                </pre>
              </div>
            )}

            {selectedDevice ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedDevice.displayName || selectedDevice.id}
                    </div>
                    <div className="text-sm text-gray-500">Linked kiosk: {linkedKioskName}</div>
                  </div>
                  <Badge className={toneClass[statusTone]}>{statusLabel}</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={form.displayName}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, displayName: event.target.value }))
                    }
                    placeholder="Device display name"
                  />
                  <Input
                    value={form.placementLabel}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, placementLabel: event.target.value }))
                    }
                    placeholder="Placement label"
                  />
                  <Input
                    value={form.latitude}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, latitude: event.target.value }))
                    }
                    placeholder="Latitude"
                    inputMode="decimal"
                  />
                  <Input
                    value={form.longitude}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, longitude: event.target.value }))
                    }
                    placeholder="Longitude"
                    inputMode="decimal"
                  />
                  <div className="md:col-span-2">
                    <Select
                      value={form.kioskId || 'unassigned'}
                      onValueChange={(value) =>
                        setForm((prev) => ({
                          ...prev,
                          kioskId: value === 'unassigned' ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assign kiosk" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {kiosks.map((kiosk) => (
                          <SelectItem key={kiosk.id} value={kiosk.id}>
                            {kiosk.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    className="md:col-span-2"
                    value={form.placementNotes}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, placementNotes: event.target.value }))
                    }
                    placeholder="Placement notes"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveMetadata} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    Save details
                  </Button>
                  {SAFE_DEVICE_COMMANDS.map((command) => (
                    <Button
                      key={command}
                      variant="outline"
                      onClick={() => handleQueueCommand(command)}
                      disabled={saving}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {DEVICE_COMMAND_LABELS[command]}
                    </Button>
                  ))}
                </div>

                <div className="rounded-md border">
                  <div className="border-b px-3 py-2 text-sm font-medium text-gray-900">
                    Recent events
                  </div>
                  <div className="divide-y">
                    {events.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-500">No events yet.</div>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900">{event.type}</div>
                          <div className="text-gray-500">{event.status || 'Recorded'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-gray-500">
                Create a provisioning profile, then enroll a tablet to manage placement and safe
                remote actions.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
