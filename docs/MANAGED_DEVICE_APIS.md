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

## Firestore Model

The first API slice uses these collections:

- `deviceEnrollments`: active/revoked enrollment records for pairing a tablet with an
  organization and optional kiosk.
- `managedDevices`: physical Android device records, linked to `organizationId` and
  optional `kioskId`.
- `kioskApks`: uploaded or assigned kiosk APK metadata.
- `deviceEvents`: append-only event records for status changes and heartbeats.

Existing `kiosks` documents remain focused on fundraising configuration. A managed device
links to a kiosk with `kioskId` when the tablet should run that kiosk.

## API Contract

### `kioskDeviceRegister`

Registers or updates a managed device from an active enrollment token.

Required input:

- `enrollmentToken`
- `androidId` or `serialNumber`

Important behavior:

- validates the enrollment record
- creates a deterministic `managedDevices` ID
- links the device to enrollment `organizationId` and optional `kioskId`
- stores controller and device metadata

### `kioskDevicePolicy`

Returns the current policy for a registered device.

Important behavior:

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

- updates install, launch, Device Owner, and error state
- appends a `STATUS_UPDATED` event

### `kioskDeviceHeartbeat`

Records periodic liveness from the Android controller.

Important behavior:

- marks the device online
- updates heartbeat, battery, and network metadata
- appends a `HEARTBEAT` event
- returns the next heartbeat interval

### `kioskApkDownload`

Returns APK download metadata for a registered device.

Important behavior:

- validates the device
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
- recording status updates and events
- recording heartbeat updates and events
- rejecting invalid status values
- preventing cross-organization APK access

React admin UI, Android controller wiring, QR provisioning, and Firebase Storage upload/signing
are intentionally left for follow-up PRs.

## Next Integration Steps

1. Add admin UI for enrollment creation, device listing, kiosk linking, APK assignment, and
   device event history.
2. Add storage-backed APK upload and signed download resolution.
3. Wire the Android controller to register, fetch policy, install the kiosk APK, launch it,
   and report heartbeat/status.
4. Validate the full emulator path before physical QR/factory-reset provisioning.
