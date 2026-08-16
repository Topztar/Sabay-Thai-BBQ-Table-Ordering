import { initializeApp } from 'firebase/app';
import { getFunctions } from "firebase/functions";
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore, disableNetwork, enableNetwork } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || 'ai-studio-sabaythaibbqtabl-84418196-9d0c-459c-bced-ddc424dfba07';

let firestoreInstance: Firestore;

// Helper to check indexedDB availability to prevent Firestore cache boot failures in sandboxed iframes
const checkIndexedDB = (): boolean => {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && !!window.indexedDB;
  } catch (e) {
    return false;
  }
};

try {
  if (checkIndexedDB()) {
    // Configure persistent local cache with multi-tab manager for sub-millisecond cache speed and optimal quota conservation
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, FIRESTORE_DATABASE_ID);
  } else {
    firestoreInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
  }
} catch (error) {
  console.warn('[Firebase] Firestore initialization cache fallback or double-init check:', error);
  try {
    firestoreInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
  } catch (err) {
    console.error('[Firebase] Critical fallback initialization failed:', err);
    firestoreInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
  }
}

export const db = firestoreInstance;
export const auth = getAuth();

// Default state: Firebase sync is now re-enabled for performance and cost reduction
let syncEnabled = true;

export const isFirebaseSyncEnabled = () => syncEnabled;

export const stopFirebaseSync = async () => {
  syncEnabled = false;
  try {
    await disableNetwork(db);
    console.log('[Firebase Sync] Firebase network synchronization is STOPPED.');
  } catch (err) {
    console.warn('[Firebase Sync] Error disabling network:', err);
  }
};

export const startFirebaseSync = async () => {
  syncEnabled = true;
  try {
    await enableNetwork(db);
    console.log('[Firebase Sync] Firebase network synchronization is ENABLED.');
  } catch (err) {
    console.warn('[Firebase Sync] Error enabling network:', err);
  }
};

// Firebase network sync is enabled by default

export const functions = getFunctions(app);

