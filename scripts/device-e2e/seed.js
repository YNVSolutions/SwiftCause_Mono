#!/usr/bin/env node

const { createHash } = require('crypto');
const { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const admin = require('../../backend/functions/node_modules/firebase-admin');

const root = path.resolve(__dirname, '..', '..');
const projectId = process.env.FIREBASE_PROJECT_ID || 'swiftcause-app';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const apkServerPort = Number(process.env.DEVICE_E2E_APK_PORT || 3005);
const apkServerHost = process.env.DEVICE_E2E_APK_HOST || '127.0.0.1';
const emulatorApkHost = process.env.DEVICE_E2E_EMULATOR_APK_HOST || '10.0.2.2';
const functionsBaseUrl =
  process.env.DEVICE_E2E_FUNCTIONS_BASE_URL || `http://10.0.2.2:5001/${projectId}/us-central1`;
const stateDir = path.join(root, '.e2e');
const statePath = path.join(stateDir, 'device-e2e-state.json');
const apkPath =
  process.env.DEVICE_E2E_KIOSK_APK ||
  path.join(
    root,
    'android',
    'test-kiosk',
    'build',
    'outputs',
    'apk',
    'debug',
    'test-kiosk-debug.apk',
  );
const apkPackageName = process.env.DEVICE_E2E_KIOSK_PACKAGE || 'com.swiftcause.kiosk';
const apkServerFileName = process.env.DEVICE_E2E_APK_FILE_NAME || 'swiftcause-test-kiosk.apk';
const apkVersionCode = Number(process.env.DEVICE_E2E_APK_VERSION_CODE || 1);
const apkVersionName = process.env.DEVICE_E2E_APK_VERSION_NAME || '1.0.0';

const shouldBuild = process.argv.includes('--build');
const shouldServe = process.argv.includes('--serve');

const ids = {
  organizationId: 'org-device-e2e',
  kioskId: 'kiosk-device-e2e',
  campaignId: 'campaign-device-e2e',
  globalCampaignId: 'campaign-device-e2e-global',
  enrollmentToken: 'enroll-device-e2e',
  apkId: 'apk-test-kiosk',
};

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const writeDocument = async (collection, id, data) => {
  await admin.firestore().collection(collection).doc(id).set(data, { merge: true });
};

const sha256 = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });

const buildTestKiosk = () => {
  const moduleName = process.env.DEVICE_E2E_BUILD_MODULE || ':test-kiosk:assembleDebug';
  const result = spawnSync('./gradlew', [moduleName], {
    cwd: path.join(root, 'android'),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Failed to build ${moduleName}`);
  }
};

const startApkServer = () => {
  const server = http.createServer((req, res) => {
    if (req.url !== `/${apkServerFileName}`) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${apkServerFileName}"`,
    });
    createReadStream(apkPath).pipe(res);
  });
  server.listen(apkServerPort, apkServerHost, () => {
    console.log(`APK server: http://${apkServerHost}:${apkServerPort}/${apkServerFileName}`);
    console.log(
      `Emulator APK URL: http://${emulatorApkHost}:${apkServerPort}/${apkServerFileName}`,
    );
  });
};

const main = async () => {
  if (shouldBuild) {
    buildTestKiosk();
  }
  if (!existsSync(apkPath)) {
    throw new Error(
      `Kiosk APK not found: ${apkPath}. Run with --build or set DEVICE_E2E_KIOSK_APK to an existing APK.`,
    );
  }

  mkdirSync(stateDir, { recursive: true });
  const apkHash = await sha256(apkPath);
  const apkDownloadUrl = `http://${emulatorApkHost}:${apkServerPort}/${apkServerFileName}`;
  const now = new Date();

  await writeDocument('kiosks', ids.kioskId, {
    organizationId: ids.organizationId,
    name: 'Device E2E Kiosk',
    location: 'Local emulator',
    status: 'online',
    accessCode: '123456',
    assignedCampaigns: [ids.campaignId],
    assignedKioskApkId: ids.apkId,
    settings: {
      displayMode: 'grid',
      showAllCampaigns: false,
      maxCampaignsDisplay: 6,
      autoRotateCampaigns: false,
    },
    createdAt: now,
    updatedAt: now,
  });
  await writeDocument('campaigns', ids.campaignId, {
    organizationId: ids.organizationId,
    title: 'Local Food Relief',
    description: 'Help provide emergency meals through the local emulator campaign.',
    longDescription:
      'This campaign is seeded into the Firebase emulator so the Android kiosk can log in and render real campaign data without touching production.',
    goal: 5000,
    raised: 125000,
    status: 'active',
    isGlobal: false,
    assignedKiosks: [ids.kioskId],
    category: 'Community',
    currency: 'GBP',
    organizationInfo: {
      name: 'SwiftCause Local Test Org',
      currency: 'GBP',
    },
    configuration: {
      predefinedAmounts: [5, 10, 25, 50],
      allowCustomAmount: true,
      minCustomAmount: 1,
      maxCustomAmount: 1000,
      enableRecurring: true,
      recurringIntervals: ['monthly'],
      showProgressBar: true,
      showDonorCount: true,
      primaryCTAText: 'Donate',
      enableGiftAid: true,
    },
    createdAt: now,
    updatedAt: now,
  });
  await writeDocument('campaigns', ids.globalCampaignId, {
    organizationId: ids.organizationId,
    title: 'Global Emergency Fund',
    description: 'A global campaign that should appear for every kiosk in the test organization.',
    longDescription:
      'This confirms global campaign lookup from the Android app against the local Firestore emulator.',
    goal: 10000,
    raised: 275000,
    status: 'active',
    isGlobal: true,
    assignedKiosks: [],
    category: 'Emergency',
    currency: 'GBP',
    organizationInfo: {
      name: 'SwiftCause Local Test Org',
      currency: 'GBP',
    },
    configuration: {
      predefinedAmounts: [10, 25, 50, 100],
      allowCustomAmount: true,
      minCustomAmount: 1,
      maxCustomAmount: 2000,
      enableRecurring: false,
      showProgressBar: true,
      showDonorCount: true,
      primaryCTAText: 'Donate now',
    },
    createdAt: now,
    updatedAt: now,
  });
  await writeDocument('deviceEnrollments', ids.enrollmentToken, {
    organizationId: ids.organizationId,
    kioskId: ids.kioskId,
    label: 'Medium Tablet emulator',
    status: 'active',
    createdBy: 'device-e2e-seed',
    createdAt: now,
    updatedAt: now,
  });
  await writeDocument('kioskApks', ids.apkId, {
    organizationId: ids.organizationId,
    packageName: apkPackageName,
    versionCode: apkVersionCode,
    versionName: apkVersionName,
    downloadUrl: apkDownloadUrl,
    checksumSha256: apkHash,
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  const state = {
    ...ids,
    projectId,
    functionsBaseUrl,
    firestoreHost,
    apkPath,
    apkDownloadUrl,
    apkSha256: apkHash,
    controllerPackage: 'com.swiftcause.devicecontroller',
    controllerActivity: 'com.swiftcause.devicecontroller/.E2eActivity',
    deviceAdminComponent: 'com.swiftcause.devicecontroller/.DeviceAdminReceiver',
    kioskPackage: apkPackageName,
    kioskLogin: {
      kioskId: ids.kioskId,
      accessCode: '123456',
    },
    seededCampaigns: [ids.globalCampaignId, ids.campaignId],
    generatedAt: now.toISOString(),
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  console.log(`Seeded device E2E data for project ${projectId}`);
  console.log(`State file: ${statePath}`);
  console.log(`Enrollment token: ${ids.enrollmentToken}`);
  console.log(`Kiosk login: ${ids.kioskId} / 123456`);
  console.log(`Functions base URL: ${functionsBaseUrl}`);
  console.log(`APK SHA-256: ${apkHash}`);

  if (shouldServe) {
    startApkServer();
  } else if (existsSync(statePath)) {
    const writtenState = JSON.parse(readFileSync(statePath, 'utf8'));
    console.log(`Run with --serve to keep APK server online: ${writtenState.apkDownloadUrl}`);
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
