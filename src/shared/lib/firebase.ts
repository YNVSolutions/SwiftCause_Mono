import { initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectStorageEmulator, getStorage, ref, deleteObject } from 'firebase/storage'; // Import ref and deleteObject
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'; // Import getFunctions
import {
  FIREBASE_EMULATOR_CONFIG,
  FIREBASE_REGION,
  isUsingFirebaseEmulators,
} from '../config/firebaseEmulators';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, FIREBASE_REGION); // Initialize functions

const emulatorFlag = '__SWIFTCAUSE_FIREBASE_EMULATORS_CONNECTED__';

const connectFirebaseEmulators = () => {
  if (!isUsingFirebaseEmulators()) {
    return;
  }

  const globalState = globalThis as typeof globalThis & {
    [emulatorFlag]?: boolean;
  };

  if (globalState[emulatorFlag]) {
    return;
  }

  connectAuthEmulator(
    auth,
    `http://${FIREBASE_EMULATOR_CONFIG.host}:${FIREBASE_EMULATOR_CONFIG.authPort}`,
    { disableWarnings: true },
  );
  connectFirestoreEmulator(
    db,
    FIREBASE_EMULATOR_CONFIG.host,
    FIREBASE_EMULATOR_CONFIG.firestorePort,
  );
  connectFunctionsEmulator(
    functions,
    FIREBASE_EMULATOR_CONFIG.host,
    FIREBASE_EMULATOR_CONFIG.functionsPort,
  );
  connectStorageEmulator(
    storage,
    FIREBASE_EMULATOR_CONFIG.host,
    FIREBASE_EMULATOR_CONFIG.storagePort,
  );

  globalState[emulatorFlag] = true;
};

if (typeof window !== 'undefined') {
  connectFirebaseEmulators();
}

// Function to delete a file from Firebase Storage
const deleteFile = async (fileUrl: string) => {
  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
    console.warn(`File deleted successfully: ${fileUrl}`);
  } catch (error) {
    console.error(`Error deleting file ${fileUrl}:`, error);
    throw error; // Re-throw the error for handling in the calling component
  }
};

export { db, auth, storage, functions, doc, getDoc, updateDoc, addDoc, collection, deleteFile };
