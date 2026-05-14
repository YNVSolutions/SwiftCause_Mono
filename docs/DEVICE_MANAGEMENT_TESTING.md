# Device Management Testing

This document captures the automated and manual validation for the Mono-native device
management E2E path.

## Scope

The tested flow is:

```text
Firestore emulator seed
  -> SwiftCause Device Controller
  -> Firebase Functions emulator
  -> APK policy and download metadata
  -> Android PackageInstaller
  -> SwiftCause kiosk app launch
  -> status, heartbeat, events, and command result reporting
```

The primary app package for the real kiosk run is `com.example.swiftcause`. The controller
package is `com.swiftcause.devicecontroller`.

## Automated Checks

Run from the repository root unless noted:

```bash
cd backend/functions
npm test -- managedDevice
```

Expected coverage:

- device secret auth for policy, status, heartbeat, APK download, command polling, and command
  results
- registration returning plaintext `deviceSecret` only once and storing only `deviceSecretHash`
- server-pinned controller package identity
- partial status updates preserving existing status fields
- assigned APK enforcement, including same-org unassigned APK rejection
- policy package fields resolving from the assigned APK package, including the real app package
- command result idempotency so completed commands cannot be overwritten by replayed results
- admin profile, list, metadata update, command queue, command list, and event list access control
- E2E trace events for registration, policy fetch, APK metadata request, heartbeat, and command
  results

```bash
cd android
./gradlew :app:assembleDebug :device-controller:assembleDebug :test-kiosk:assembleDebug
```

Expected coverage:

- real SwiftCause app debug APK builds with Firebase emulator configuration
- device controller debug APK builds
- local test kiosk debug APK builds

```bash
cd android
./gradlew :device-controller:testDebugUnitTest
```

Expected coverage:

- controller endpoint URL construction
- status and command mapping helpers

```bash
npm test -- --run src/entities/device
npm test -- --run
npx tsc --noEmit
npm run build
```

Expected coverage:

- device entity frontend API tests
- full Vitest suite
- TypeScript type checking
- production Next.js build

```bash
git diff --check
```

Expected coverage:

- no trailing whitespace or patch formatting issues

## Local Firebase Seed

Start Firebase emulators:

```bash
cd backend
firebase emulators:start
```

Serve the real SwiftCause app as the kiosk APK:

```bash
DEVICE_E2E_KIOSK_APK=/absolute/path/to/SwiftCause_Mono/android/app/build/outputs/apk/debug/app-debug.apk \
DEVICE_E2E_KIOSK_PACKAGE=com.example.swiftcause \
DEVICE_E2E_BUILD_MODULE=:app:assembleDebug \
DEVICE_E2E_APK_FILE_NAME=swiftcause-mobile-debug.apk \
npm run device:e2e:serve -- --build
```

The seed writes `.e2e/device-e2e-state.json` and creates emulator-only kiosk/campaign/device
records. It intentionally does not create an `organizations` document because the emulator runs
Firestore triggers and organization creation can execute provisioning side effects.

Seeded kiosk login:

```text
kioskId: kiosk-device-e2e
accessCode: 123456
```

Seeded campaigns:

- `Global Emergency Fund`
- `Local Food Relief`

## Manual Emulator Acceptance

Use a clean `Medium_Tablet` emulator when possible.

Build and install the controller:

```bash
cd android
./gradlew :device-controller:assembleDebug
adb install -r device-controller/build/outputs/apk/debug/device-controller-debug.apk
```

Set Device Owner before launching the controller:

```bash
adb shell dpm set-device-owner com.swiftcause.devicecontroller/.DeviceAdminReceiver
```

Launch the E2E controller flow:

```bash
adb shell am start \
  -n com.swiftcause.devicecontroller/.E2eActivity \
  --es apiBaseUrl http://10.0.2.2:5001/swiftcause-app/us-central1 \
  --es enrollmentToken enroll-device-e2e
```

Verify:

- `managedDevices` contains the registered device for `org-device-e2e`
- the device stores `deviceSecretHash`, not plaintext `deviceSecret`
- `deviceEvents` includes registration, policy fetch, APK metadata request, status, heartbeat,
  and command result records
- `com.example.swiftcause` installs and launches when Device Owner succeeds
- the kiosk app logs in with `kiosk-device-e2e` / `123456`
- the seeded campaigns render in the app
- a normal Home press does not exit the kiosk app once lock task is active

Lock task verification:

```bash
adb shell dumpsys activity activities | grep -i locktask
```

Expected output includes:

```text
mLockTaskModeState=LOCKED
```

Development caveat: ADB, emulator controls, Device Owner removal, or stale emulator state can still
exit or disrupt kiosk mode. Normal user navigation should not exit when Device Owner and lock task
are active.

## Last Local Verification

The current PR was locally verified with:

```bash
cd backend/functions && npm test -- managedDevice
cd backend/functions && npm test
cd android && ./gradlew :app:assembleDebug :device-controller:assembleDebug :test-kiosk:assembleDebug
cd android && ./gradlew :device-controller:testDebugUnitTest
npm test -- --run src/entities/device
npm test -- --run
npx tsc --noEmit
npm run build
git diff --check
```

Manual emulator verification confirmed:

- controller registration succeeded
- the real SwiftCause app package `com.example.swiftcause` installed and launched
- local Firebase login succeeded with `kiosk-device-e2e` / `123456`
- seeded campaigns rendered
- Android reported lock task mode as `LOCKED` after pressing Home
