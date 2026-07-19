import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';
import { registerCustomer, deliveryDateDaysFromNow } from './helpers/registerCustomer';
import { seedPaidOrder } from './helpers/seedOrder';

// The header bell derives its list client-side from orders/pre-orders the
// user already reads (no notifications collection), with unread state kept
// in localStorage — so a freshly seeded order must surface as one unread
// item, and opening the panel must clear the badge.

test('customer bell shows an unread order notification that links to tracking', async ({ page }) => {
  const { email } = await registerCustomer(page, 'Bell Customer');
  const { finalizedNumber } = await seedPaidOrder(email, deliveryDateDaysFromNow(5));

  // Remount the app so the bell refetches with the seeded order present.
  await page.goto('/customer/home');

  const bell = page.getByRole('button', { name: 'Notifications (1 unread)' });
  await expect(bell).toBeVisible();
  await bell.click();

  await expect(page.getByText('Order confirmed')).toBeVisible();
  await expect(page.getByText(new RegExp(finalizedNumber))).toBeVisible();

  // Clicking the item navigates to tracking and closes the panel.
  await page.getByText('Order confirmed').click();
  await expect(page).toHaveURL(/\/customer\/tracking$/);

  // Opening the panel marked everything seen — the badge is gone now.
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
});

test('admin bell reports a new order and links to Order Management', async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const { email } = await registerCustomer(customerPage, 'Bell Admin Customer');
  const { finalizedNumber } = await seedPaidOrder(email, deliveryDateDaysFromNow(5));
  await customerContext.close();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAsAdmin(adminPage);

  // Fresh admin context — every derived item counts as unread.
  const bell = adminPage.getByRole('button', { name: /Notifications \(\d+\+? unread\)/ });
  await expect(bell).toBeVisible();
  await bell.click();

  // The just-seeded order is the newest item, so it's within the capped list.
  // Scope to the unique order number — the dashboard's own recent-orders list
  // behind the panel also renders the customer's name.
  await expect(adminPage.getByText('New order 💰').first()).toBeVisible();
  const item = adminPage.getByText(new RegExp(`${finalizedNumber} — Bell Admin Customer`));
  await expect(item).toBeVisible();

  await item.click();
  await expect(adminPage).toHaveURL(/\/admin\/orders$/);

  await adminContext.close();
});
