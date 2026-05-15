# SwiftCause Managed Device APIs

## Purpose

SwiftCause needs to manage Android tablets separately from the donor-facing kiosk experience.
The existing kiosk model represents fundraising configuration: campaigns, location, access
code, display settings, and donation behavior. A managed device represents the physical
Android tablet and its controller state: enrollment, policy sync, APK installation, kiosk
launch status, and heartbeat.

This separation lets SwiftCause replace or reassign tablets without corrupting kiosk
fundraising data. It also gives the Android controller a narrow backend contract before
React admin UI and Android integration are added.

## Architecture

The intended flow is:

```text
SwiftCause React Admin UI
        |
Firebase Functions + Firestore
        |
SwiftCause Device Controller Android app
        |
SwiftCause Kiosk Android app
```

The device controller is the Android management app. It is expected to use package
`com.swiftcause.devicecontroller`. The donor-facing kiosk app is expected to use package
`com.swiftcause.kiosk`.

The Headwind Android agent can provide the controller foundation, but SwiftCause owns the
admin UI, backend APIs, Firestore model, and donor kiosk app.

The backend pins the controller package server-side. Client-provided package names are not
used to derive managed device identity.

## Device Authentication

Registration is authenticated by an active enrollment token. After registration, the backend
returns a one-time plaintext `deviceSecret` and stores only `deviceSecretHash` on the
`managedDevices` record.

The Android controller must store the plaintext secret locally and send it on later requests
using either:

- `Authorization: Bearer <deviceSecret>`
- `x-device-secret: <deviceSecret>`

The device secret is required for policy, status, heartbeat, and APK download endpoints. App
Check, attestation, secret rotation, and admin-driven revocation can be layered on top of this
contract later.

## Firestore Model

The first API slice uses these collections:

- `deviceEnrollments`: active/revoked enrollment records for pairing a tablet with an
  organization and optional kiosk.
- `managedDevices`: physical Android device records, linked to `organizationId` and
  optional `kioskId`.
- `kioskApks`: uploaded or assigned kiosk APK metadata.
- `deviceCommands`: queued safe remote commands for a registered device.
- `deviceEvents`: append-only event records for registration, policy fetches, APK download
  requests, status changes, heartbeats, and command results.

Existing `kiosks` documents remain focused on fundraising configuration. A managed device
links to a kiosk with `kioskId` when the tablet should run that kiosk.

## API Contract

### Admin portal APIs

The organization portal uses admin-only functions protected by Firebase ID token auth. These
functions enforce the caller's `organizationId` from the `users` collection and require kiosk
management access through role or permissions.

Organization admins can:

- create a device provisioning profile
- list devices in their organization
- update placement metadata and kiosk linkage
- queue safe remote commands
- view device command and event history

Organization admins cannot set APK IDs, package names, device secrets, organization ownership,
or policy internals.

Supported safe remote commands:

- `sync_policy`
- `restart_kiosk`
- `refresh_content`
- `clear_error`

### `adminCreateDeviceProfile`

Creates an active organization-scoped enrollment profile and returns a copyable provisioning
payload. The profile can optionally be preassigned to a kiosk in the same organization.

### `adminListManagedDevices`

Lists managed devices for the caller's organization, optionally filtered by kiosk.

### `adminUpdateManagedDeviceMetadata`

Updates organization-facing metadata such as display name, placement label, placement notes,
latitude, longitude, and kiosk assignment. Protected device and policy fields are rejected.

### `adminQueueDeviceCommand`

Queues an allowlisted remote command for a device in the caller's organization. Android command
pickup and execution are handled in a later controller integration.

### `adminListDeviceCommands`

Lists command history for a device in the caller's organization.

### `adminListDeviceEvents`

Lists recent device events for a device in the caller's organization.

### `kioskDeviceRegister`

Registers or updates a managed device from an active enrollment token.

Required input:

- `enrollmentToken`
- `androidId` or `serialNumber`

Important behavior:

- validates the enrollment record
- creates a deterministic `managedDevices` ID
- returns a one-time `deviceSecret`
- stores only `deviceSecretHash`
- links the device to enrollment `organizationId` and optional `kioskId`
- stores controller and device metadata

### `kioskDevicePolicy`

Returns the current policy for a registered device.

Important behavior:

- requires a valid device secret
- resolves controller and kiosk package names
- returns launch package and heartbeat interval
- returns assigned kiosk APK metadata when available
- records the last policy fetch timestamp

### `kioskDeviceStatus`

Records controller status from the Android device.

Supported statuses:

- `enrolled`
- `online`
- `offline`
- `installing`
- `install_failed`
- `kiosk_active`
- `error`

Important behavior:

- requires a valid device secret
- updates install, launch, Device Owner, and error state
- preserves omitted optional fields on partial updates
- appends a `STATUS_UPDATED` event

### `kioskDeviceHeartbeat`

Records periodic liveness from the Android controller.

Important behavior:

- requires a valid device secret
- marks the device online
- updates heartbeat, battery, and network metadata
- appends a `HEARTBEAT` event
- returns the next heartbeat interval

### `kioskDeviceCommands`

Lists pending safe commands for a registered device. The endpoint requires a valid device
secret and returns only commands assigned to that device.

### `kioskDeviceCommandResult`

Records the result of a queued device command. The endpoint requires a valid device secret,
updates only that device's command record, and appends a `COMMAND_RESULT` event.

### `kioskApkDownload`

Returns APK download metadata for a registered device.

Important behavior:

- requires a valid device secret
- validates the device
- validates the requested APK is the resolved assigned APK for the device policy
- validates APK organization ownership
- returns package, version, checksum, and download URL metadata

This first slice does not implement signed Firebase Storage download URLs. That can be added
after the API contract is proven.

## TDD Scope

The first backend slice is intentionally API-first and backend-only. It includes Jest tests
for:

- registering from an active enrollment
- repeated registration updating the same device
- rejecting unknown or revoked enrollments
- fetching policy with assigned APK metadata
- rejecting unauthenticated policy/status requests
- recording status updates and events
- preserving existing state during partial status updates
- recording heartbeat updates and events
- rejecting invalid status values
- preventing cross-organization APK access
- preventing same-organization but unassigned APK access
- creating organization-scoped admin provisioning profiles
- rejecting cross-organization admin device/profile access
- updating placement metadata without allowing protected policy fields
- queueing only allowlisted remote commands

QR provisioning and Firebase Storage upload/signing are intentionally left for follow-up PRs.

## Next Integration Steps

1. Add storage-backed APK download signing for SwiftCause-controlled rollout.
2. Validate physical QR/factory-reset provisioning after the emulator path is stable.
