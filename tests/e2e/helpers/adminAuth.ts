import type { Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../global-setup';

// The admin account is provisioned once in global-setup.ts (it must already
// exist — this app has exactly one admin, matched by email — not registered
// through the UI like a customer).
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 });
}
