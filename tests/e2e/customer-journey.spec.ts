import { test, expect } from '@playwright/test';
import { registerCustomer, selectFirstAvailableCalendarDate, deliveryDateDaysFromNow } from './helpers/registerCustomer';
import { seedPaidOrder } from './helpers/seedOrder';

// Cash checkout is gone — every order is paid on ToyyibPay's hosted page,
// which doesn't exist inside the emulator. So the journey splits in two:
// the UI is exercised up to the handoff to the payment page, and the
// post-payment experience (tracking, receipt) runs against an order seeded
// exactly the way submitOrder writes one (paid, numbered, Order Received).

test('customer can build a cart and reach the online payment step', async ({ page }) => {
  await registerCustomer(page, 'Pickup Customer');

  // Confirms browsing works (both seeded products render), then navigates by
  // ID rather than clicking "Order This" — Firestore's getDocs() gives no
  // ordering guarantee, so which product renders first in the DOM isn't
  // deterministic, but product "1" (Dumplings, RM 25) always is.
  await expect(page.getByRole('heading', { name: 'Traditional Dumplings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Festive Cookies' })).toBeVisible();
  await page.goto('/customer/order/1');

  // Type the quantity directly (the field is editable now — bulk customers no
  // longer press "+" twenty times) and add a note before adding to cart.
  await page.getByRole('textbox', { name: 'Quantity' }).fill('2');
  await page.locator('#notes').fill('No peanuts please');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page).toHaveURL(/\/customer\/cart$/);
  await expect(page.getByText('Traditional Dumplings')).toBeVisible();
  await expect(page.getByText('RM 50.00').first()).toBeVisible(); // 25.00 x 2 (item line + subtotal both show it)

  // The header badge counts distinct products, not units — 2 dumplings = "1".
  await expect(page.locator('.cart-badge')).toHaveText('1');

  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await expect(page).toHaveURL(/\/customer\/checkout$/);

  await selectFirstAvailableCalendarDate(page);
  await page.locator('#phone').fill('123456789');
  await page.getByText('DuitNow QR / E-Wallet', { exact: true }).click();
  await page.getByRole('button', { name: 'Proceed to Online Payment' }).click();

  // The handoff to ToyyibPay is the emulator boundary — reaching the payment
  // route with the order still pending in sessionStorage is the success state.
  await expect(page).toHaveURL(/\/customer\/payment$/);
});

test('a paid order appears in tracking with its receipt, and cannot be cancelled', async ({ page }) => {
  const { email } = await registerCustomer(page, 'Tracking Customer');
  const { finalizedNumber } = await seedPaidOrder(email, deliveryDateDaysFromNow(5));

  await page.goto('/customer/tracking');
  await expect(page.getByText(finalizedNumber)).toBeVisible();
  await expect(page.getByText('Order Received').first()).toBeVisible();
  await expect(page.getByText('Traditional Dumplings')).toBeVisible();

  // Self-cancel was removed along with cash — no cancel affordance anywhere.
  await expect(page.getByRole('button', { name: /Cancel/ })).not.toBeVisible();

  await page.getByRole('button', { name: 'View Receipt' }).click();
  await expect(page).toHaveURL(/\/customer\/receipt\//);
  // exact: the receipt shows the number twice (heading + "Issued by" footer)
  await expect(page.getByText(finalizedNumber, { exact: true })).toBeVisible();
  await expect(page.getByText('Paid Online')).toBeVisible();
});
