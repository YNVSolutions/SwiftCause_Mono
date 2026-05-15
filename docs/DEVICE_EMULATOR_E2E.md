# Device Controller Emulator E2E

This runbook validates the local managed-device path inside `SwiftCause_Mono`.
The detailed validation matrix and last local verification notes live in
[`DEVICE_MANAGEMENT_TESTING.md`](./DEVICE_MANAGEMENT_TESTING.md).

The flow is:

```text
Firestore emulator seed
  -> SwiftCause Device Controller
  -> Firebase Functions emulator
  -> kiosk APK download
  -> PackageInstaller / launch
  -> status, heartbeat, events, command results
```

## Build

```bash
cd android
./gradlew :device-controller:assembleDebug :test-kiosk:assembleDebug
```

Controller APK:

```text
android/device-controller/build/outputs/apk/debug/device-controller-debug.apk
```

Test kiosk APK:

```text
android/test-kiosk/build/outputs/apk/debug/test-kiosk-debug.apk
```

Real SwiftCause app APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Start Firebase Emulators

In one terminal:

```bash
cd backend
firebase emulators:start
```

The controller uses this emulator-visible functions base URL:

```text
http://10.0.2.2:5001/swiftcause-app/us-central1
```

## Seed E2E Data And Serve APK

In another terminal:

```bash
npm run device:e2e:serve -- --build
```

This does four things:

- builds the test kiosk APK when `--build` is passed
- computes the APK SHA-256
- seeds Firestore emulator documents for kiosk login, campaigns, enrollment, and APK metadata
- serves the APK at `http://10.0.2.2:3005/swiftcause-test-kiosk.apk`

The seed intentionally does not write an `organizations` document. The local Functions emulator runs Firestore triggers, and creating an organization document can execute production-adjacent organization provisioning side effects.

It writes local state to:

```text
.e2e/device-e2e-state.json
```

The seeded kiosk login is:

```text
kioskId: kiosk-device-e2e
accessCode: 123456
```

The seeded campaign data includes `Global Emergency Fund` and `Local Food Relief`.

To ship the real Mono app instead of the small test kiosk APK, run:

```bash
DEVICE_E2E_KIOSK_APK=/absolute/path/to/SwiftCause_Mono/android/app/build/outputs/apk/debug/app-debug.apk \
DEVICE_E2E_KIOSK_PACKAGE=com.example.swiftcause \
DEVICE_E2E_BUILD_MODULE=:app:assembleDebug \
DEVICE_E2E_APK_FILE_NAME=swiftcause-mobile-debug.apk \
npm run device:e2e:serve -- --build
```

## Emulator

Boot a clean emulator, preferably `Medium_Tablet`.

Install the controller:

```bash
adb install -r android/device-controller/build/outputs/apk/debug/device-controller-debug.apk
```

If the emulator allows Device Owner setup, run this before opening the controller:

```bash
adb shell dpm set-device-owner com.swiftcause.devicecontroller/.DeviceAdminReceiver
```

Launch the E2E activity:

```bash
adb shell am start \
  -n com.swiftcause.devicecontroller/.E2eActivity \
  --es apiBaseUrl http://10.0.2.2:5001/swiftcause-app/us-central1 \
  --es enrollmentToken enroll-device-e2e
```

Watch logs:

```bash
adb logcat -s SwiftCauseE2E
```

## Expected Result

The E2E is successful when:

- `managedDevices` has a device for `org-device-e2e`
- the device stores `deviceSecretHash`, not plaintext `deviceSecret`
- `deviceEvents` includes registration, policy fetch, APK download metadata, status, heartbeat, and command result events
- the test kiosk package `com.swiftcause.kiosk` installs when Device Owner succeeds
- the test kiosk launches and displays `SwiftCause Test Kiosk`
- when using the real app package `com.example.swiftcause`, the app launches in lock task mode and can log in with `kiosk-device-e2e` / `123456`
- if Device Owner setup fails, the controller reports a clear `install_failed` status instead of silently passing

In development, it can still be possible to exit through ADB, emulator controls, removing Device Owner, or a stale/non-clean provisioning state. A normal Home press should not exit once Device Owner and lock task are active. Verify with:

```bash
adb shell dumpsys activity activities | grep -i locktask
```

To test command pickup, queue one safe command from the portal device dialog after the controller has registered, then relaunch the E2E activity. The controller polls pending commands once per E2E run and reports each result.
