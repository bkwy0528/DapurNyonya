import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCaC-6Jrjgm3cpgi7outr5t-IKPuZ4ipa0",
  authDomain: "dapurnyonya-9b752.firebaseapp.com",
  projectId: "dapurnyonya-9b752",
  storageBucket: "dapurnyonya-9b752.firebasestorage.app",
  messagingSenderId: "236811840368",
  appId: "1:236811840368:web:f1acde48db24122ac93db5",
};

const app = initializeApp(firebaseConfig);
export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);

// Opt-in only (npm run dev:emulator / the e2e test suite) — everyday `npm run
// dev` still talks to real production Firebase, unchanged.
if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8089);
  // getFunctions() is cached per (app, region), so connecting it here once
  // also covers every other call site that does getFunctions(firebaseApp, 'asia-southeast1').
  connectFunctionsEmulator(getFunctions(app, 'asia-southeast1'), '127.0.0.1', 5001);
}
