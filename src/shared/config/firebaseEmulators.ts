const FIREBASE_REGION = 'us-central1';
const FIREBASE_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';

const toPort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const FIREBASE_EMULATOR_CONFIG = {
  enabled: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true',
  host: FIREBASE_EMULATOR_HOST,
  authPort: toPort(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_PORT, 9099),
  firestorePort: toPort(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT, 8080),
  storagePort: toPort(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_PORT, 9199),
  functionsPort: toPort(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT, 5001),
} as const;

export { FIREBASE_REGION };

export const isUsingFirebaseEmulators = (): boolean => FIREBASE_EMULATOR_CONFIG.enabled;

export const getFunctionsBaseUrl = (projectId: string, region = FIREBASE_REGION): string => {
  if (!isUsingFirebaseEmulators()) {
    return `https://${region}-${projectId}.cloudfunctions.net`;
  }

  return `http://${FIREBASE_EMULATOR_CONFIG.host}:${FIREBASE_EMULATOR_CONFIG.functionsPort}/${projectId}/${region}`;
};
