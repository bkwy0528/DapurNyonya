import { readFileSync } from 'fs';
import { test, expect } from '@playwright/test';
import { registerCustomer } from './helpers/registerCustomer';
import { readUserByEmail } from './helpers/readUser';

// Getting a real FCM token requires a Web Push VAPID key (Firebase Console ->
// Project Settings -> Cloud Messaging -> Web configuration -> Generate key
// pair), which isn't a value this suite can fabricate. Until
// VITE_FIREBASE_VAPID_KEY is set in .env / .env.emulator, this test is
// skipped rather than left permanently red.
function hasVapidKey(): boolean {
  for (const file of ['.env', '.env.emulator']) {
    try {
      if (/^VITE_FIREBASE_VAPID_KEY=\S+/m.test(readFileSync(file, 'utf-8'))) return true;
    } catch {
      // file may not exist — fine, just means no key from this file
    }
  }
  return false;
}

test.describe('push notification opt-in', () => {
  test('enabling notifications in Profile saves a token to the user doc', async ({ page, context }) => {
    test.skip(!hasVapidKey(), 'VITE_FIREBASE_VAPID_KEY is not configured — see comment above.');

    // Chromium-only suite (playwright.config.ts). grantPermissions is meant to
    // let Notification.requestPermission() resolve 'granted' without a real
    // OS prompt, but some sandboxed/headless environments have no notification
    // service to grant against at all and report 'denied' regardless — verified
    // by hand here (manual navigator.serviceWorker.register + Notification
    // .permission checks) to be an environment limitation, not an app bug. Skip
    // rather than fail in that case; this still runs for real on a normal dev
    // machine or a CI runner with working notification support.
    await context.grantPermissions(['notifications'], { origin: 'http://localhost:5183' });
    const { email } = await registerCustomer(page, 'Notif Customer');
    await page.goto('/customer/profile');

    const grantedPermission = await page.evaluate(() => Notification.permission);
    test.skip(grantedPermission !== 'granted', `This environment reports Notification.permission as "${grantedPermission}" even after grantPermissions — cannot exercise the real grant flow here.`);

    const before = await readUserByEmail(email);
    expect(before?.fcmTokens ?? []).toHaveLength(0);

    await page.getByRole('switch').click();
    await expect(page.getByText(/Notifications enabled/i)).toBeVisible({ timeout: 15000 });

    const after = await readUserByEmail(email);
    expect(after?.fcmTokens?.length ?? 0).toBeGreaterThan(0);
  });

  test('a blocked browser permission shows a clear message instead of silently failing', async ({ page, context }) => {
    // The inverse case, and the one this sandboxed test environment actually
    // exercises for real every run (see skip reasoning above): permission is
    // denied, and the UI must tell the customer why nothing happened rather
    // than failing silently.
    await context.clearPermissions();
    const { email: _email } = await registerCustomer(page, 'Notif Blocked Customer');
    await page.goto('/customer/profile');

    await page.getByRole('switch').click();
    await expect(page.getByText(/blocked|not granted/i)).toBeVisible({ timeout: 15000 });
  });
});
