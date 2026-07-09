import { defineConfig, devices } from '@playwright/test';

// Always run via `npm run test:e2e`, which wraps this in
// `firebase emulators:exec --only firestore,auth` — that starts both
// emulators, and `dev:emulator` (below) points the app at them, so every
// authenticated journey here creates and discards its own throwaway accounts
// and orders against a local, disposable Firestore/Auth instance. Nothing
// touches production data. Running `playwright test` directly, without the
// emulators up, will fail every authenticated test.
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // A single Vite dev server backs every test here; running workers serially
  // avoids cold-start contention on the first few page loads (Tailwind v4 +
  // the Firebase SDK take a moment to transform on a fresh dev server).
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev:emulator',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
