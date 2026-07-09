import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit + component tests (jsdom). Firestore rules tests run under a separate
// node-environment config — see vitest.rules.config.ts — since they talk to
// the Firebase emulator rather than a browser DOM.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/component/**/*.test.{ts,tsx}'],
  },
});
