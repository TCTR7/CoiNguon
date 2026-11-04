import { activatePrivateSession } from '../offline/store';
import { firebaseConfiguration } from './config';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  browserSessionPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
const configuration = firebaseConfiguration(import.meta.env);
export const useFirebaseEmulators = configuration.useEmulators;
const app = initializeApp(configuration.options, 'local-workspace');
export const auth = initializeAuth(app, {
  persistence: [browserSessionPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
if (configuration.useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Keep offline caches and notification ownership separate across account changes.
onAuthStateChanged(auth, (user) => {
  void activatePrivateSession(user?.uid ?? null).catch(() => undefined);
});
