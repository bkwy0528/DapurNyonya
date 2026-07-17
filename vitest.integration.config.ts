import { defineConfig } from 'vitest/config';

// Integration tests for Cloud Functions logic (functions/src/batchLifecycle.ts)
// against the Firestore emulator via the Admin SDK. Always invoke via
// `npm run test:integration`, which wraps this in `firebase emulators:exec` so
// FIRESTORE_EMULATOR_HOST is set and the emulator is torn down automatically —
// running `vitest --config vitest.integration.config.ts` directly will fail
// to connect.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
