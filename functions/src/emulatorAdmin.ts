import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

// Test-only bootstrap, imported by tests/integration/* — never by index.ts, so
// it is dead code in the deployed bundle. It exists because the integration
// tests must hand batchLifecycle.ts a Firestore from the SAME firebase-admin
// package instance it imports (functions/node_modules): a db created from a
// second copy of firebase-admin can't serialize the other copy's FieldValue
// sentinels ("Couldn't serialize object of type NumericIncrementTransform").
export function getEmulatorDb(projectId: string): Firestore {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is not set — run via `npm run test:integration`.');
  }
  if (getApps().length === 0) {
    initializeApp({ projectId });
  }
  return getFirestore();
}
