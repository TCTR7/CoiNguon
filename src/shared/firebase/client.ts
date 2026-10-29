import { activatePrivateSession } from '../offline/store';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  browserSessionPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
// This module intentionally has no production configuration or fallback.
const app = initializeApp(
  { apiKey: 'demo-key', projectId: 'demo-coinguon', authDomain: 'demo-coinguon.firebaseapp.com' },
  'local-workspace',
);
export const auth = initializeAuth(app, {
  persistence: [browserSessionPersistence, browserLocalPersistence],
});
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);

// Keep offline caches and notification ownership separate across account changes.
onAuthStateChanged(auth, (user) => {
  void activatePrivateSession(user?.uid ?? null).catch(() => undefined);
});
