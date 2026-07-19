import type { Page } from '@playwright/test';

export interface TestCustomer {
  email: string;
  password: string;
  name: string;
}

// Registers a fresh throwaway customer against the Auth emulator and waits
// for the redirect to the customer home page. Safe to call as many times as
// needed — the emulator is disposable, so there is nothing to clean up.
export async function registerCustomer(page: Page, name = 'QA Customer'): Promise<TestCustomer> {
  const email = `qa.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'TestPass123';

  await page.goto('/register');
  await page.locator('#name').fill(name);
  await page.locator('#phone').fill('123456789');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('**/customer/home', { timeout: 15000 });

  return { email, password, name };
}

// Future-dated string in YYYY-MM-DD form, far enough out to clear any
// product's prepDays requirement in the seeded catalog (max 3 days).
export function deliveryDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Picks the first selectable day in the checkout calendar (react-day-picker),
// which by construction satisfies both the prep-days minimum and the
// admin-configured open order window. Day cells are the only buttons whose
// text is a bare number; disabled ones carry the `disabled` attribute.
// Advances up to two months in case the current view has no selectable day left.
export async function selectFirstAvailableCalendarDate(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const enabledDays = page.locator('.rdp button:not([disabled])', { hasText: /^\d+$/ });
    if (await enabledDays.count() > 0) {
      await enabledDays.first().click();
      return;
    }
    await page.locator('.rdp button[aria-label*="next" i]').click();
  }
  throw new Error('No selectable date found in the checkout calendar');
}
