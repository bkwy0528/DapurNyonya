import { test, expect } from '@playwright/test';
import { registerCustomer, deliveryDateDaysFromNow } from './helpers/registerCustomer';

// Full happy-path customer journey against the seeded catalog (see
// global-setup.ts): browse -> add to cart -> checkout (pickup + cash) ->
// confirm -> tracking -> cancel. One continuous flow rather than one test per
// step, since each step's state depends on the last and re-registering a
// fresh customer per assertion would mostly be re-testing the same wiring.

test('customer can place a pickup/cash order and see it in tracking', async ({ page }) => {
  await registerCustomer(page, 'Pickup Customer');

  // Confirms browsing works (both seeded products render), then navigates by
  // ID rather than clicking "Order This" — Firestore's getDocs() gives no
  // ordering guarantee, so which product renders first in the DOM isn't
  // deterministic, but product "1" (Dumplings, RM 25) always is.
  await expect(page.getByRole('heading', { name: 'Traditional Dumplings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Festive Cookies' })).toBeVisible();
  await page.goto('/customer/order/1');

  // Bump quantity to 2 and add a note before adding to cart. The +/- buttons
  // are icon-only with no accessible name (a known gap — QA strategy §17.2),
  // so this locates by the lucide "plus" icon's own class rather than a role.
  await page.locator('button:has(svg.lucide-plus)').click();
  await page.locator('#notes').fill('No peanuts please');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page).toHaveURL(/\/customer\/cart$/);
  await expect(page.getByText('Traditional Dumplings')).toBeVisible();
  await expect(page.getByText('RM 50.00').first()).toBeVisible(); // 25.00 x 2 (item line + subtotal both show it)

  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/\/customer\/checkout$/);

  await page.locator('#deliveryDate').fill(deliveryDateDaysFromNow(5));
  await page.locator('#phone').fill('123456789');
  await page.getByText('Cash', { exact: true }).click();
  await page.getByRole('button', { name: 'Review My Order' }).click();

  await expect(page).toHaveURL(/\/customer\/order-confirmation$/);
  await expect(page.getByText('Confirm Your Order')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm & Submit Order' }).click();
  await expect(page.getByText('Order Submitted!')).toBeVisible();

  await page.waitForURL('**/customer/tracking', { timeout: 8000 });
  await expect(page.getByText('Pending Approval')).toBeVisible();
  await expect(page.getByText('Traditional Dumplings')).toBeVisible();
});

test('customer can cancel a pending order from tracking', async ({ page }) => {
  await registerCustomer(page, 'Cancel Customer');
  await page.goto('/customer/order/1');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

  await page.locator('#deliveryDate').fill(deliveryDateDaysFromNow(5));
  await page.locator('#phone').fill('123456789');
  await page.getByText('Cash', { exact: true }).click();
  await page.getByRole('button', { name: 'Review My Order' }).click();
  await page.getByRole('button', { name: 'Confirm & Submit Order' }).click();
  await page.waitForURL('**/customer/tracking', { timeout: 8000 });

  await page.getByRole('button', { name: 'Cancel This Order' }).click();
  await page.getByRole('button', { name: 'Yes, Cancel It' }).click();
  await expect(page.getByText('Order Cancelled')).toBeVisible();
});
