import { defineConfig } from 'vitest/config';

// Firestore security rules tests run against the Firebase emulator, not jsdom.
// Always invoke via `npm run test:rules`, which wraps this in
// `firebase emulators:exec` so FIRESTORE_EMULATOR_HOST is set and the emulator
// is torn down automatically — running `vitest --config vitest.rules.config.ts`
// directly will fail to connect.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
