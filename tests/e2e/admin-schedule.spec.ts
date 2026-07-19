import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';
import { registerCustomer, deliveryDateDaysFromNow } from './helpers/registerCustomer';
import { seedPaidOrder } from './helpers/seedOrder';

// The Schedule page now owns General Order Availability (open date windows,
// moved here from the Pre-Orders page) and lists orders grouped per day for
// whatever range is selected on the calendar. These specs drive both halves
// through the real UI. The wide-open window seeded by global-setup (starting
// 2020-01-01) must survive every test here — other specs' checkouts depend
// on it — so the availability test only ever adds and removes its own window.

// Mirrors the page's formatRangeDate (en-MY, e.g. "5 Aug 2026").
const formatRangeDate = (d: Date) =>
  d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

// Mirrors the page's per-day dropdown heading (en-US long form).
const formatDayHeading = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

test('admin can add and remove an availability window through the Schedule page', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/schedule');

  await expect(page.getByText('General Order Availability')).toBeVisible();
  // The seeded wide-open window is listed (its exact end date is relative to
  // when global-setup ran, so match on the fixed start).
  await expect(page.getByRole('button', { name: /1 Jan 2020/ })).toBeVisible();

  // Pick the 5th–10th of next month in the range calendar. Next month keeps
  // the choice deterministic (no "today" styling, and leading outside-days
  // can never be a 5 — they come from the tail end of the previous month).
  const base = new Date();
  const from = new Date(base.getFullYear(), base.getMonth() + 1, 5);
  const to = new Date(base.getFullYear(), base.getMonth() + 1, 10);
  await page.locator('.rdp button[aria-label*="next" i]').click();
  await page.locator('.rdp button:not([disabled])', { hasText: /^5$/ }).first().click();
  await page.locator('.rdp button:not([disabled])', { hasText: /^10$/ }).first().click();
  await page.getByRole('button', { name: 'Add available dates' }).click();

  const windowLabel = `${formatRangeDate(from)} – ${formatRangeDate(to)}`;
  const newRow = page.locator('div.rounded-lg.border', { hasText: windowLabel });
  await expect(newRow).toBeVisible();

  // A reload proves the window was persisted to settings, not just local state.
  await page.reload();
  await expect(page.locator('div.rounded-lg.border', { hasText: windowLabel })).toBeVisible();

  // Remove only the window this test added; the seeded one must remain.
  await page.locator('div.rounded-lg.border', { hasText: windowLabel }).getByRole('button').last().click();
  await expect(page.getByText(windowLabel)).not.toBeVisible();
  await expect(page.getByRole('button', { name: /1 Jan 2020/ })).toBeVisible();
});

test('clicking a saved window lists the orders inside it, grouped per day', async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const { email } = await registerCustomer(customerPage, 'Schedule Range Customer');
  const deliveryDate = deliveryDateDaysFromNow(6);
  const { finalizedNumber } = await seedPaidOrder(email, deliveryDate);
  await customerContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto('/admin/schedule');

  // No range selected yet — the orders panel says so.
  await expect(adminPage.getByText('No date range selected yet.')).toBeVisible();

  // Clicking the saved wide-open window selects it as the active range, so
  // the seeded order's delivery day appears as its own dropdown below.
  await adminPage.getByRole('button', { name: /1 Jan 2020/ }).click();
  const dayToggle = adminPage.getByRole('button', { name: new RegExp(formatDayHeading(deliveryDate)) });
  await expect(dayToggle).toBeVisible();
  await expect(dayToggle.getByText('Upcoming')).toBeVisible(); // 6 days out

  await dayToggle.click();
  await expect(adminPage.getByText(finalizedNumber)).toBeVisible();
  await expect(adminPage.getByText('Schedule Range Customer')).toBeVisible();
  await expect(adminPage.getByText('Total: RM 50.00')).toBeVisible();

  await adminContext.close();
});
