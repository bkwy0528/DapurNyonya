import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';
import { registerCustomer, deliveryDateDaysFromNow } from './helpers/registerCustomer';

test('admin dashboard and product management reflect the seeded catalog', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText('Admin Dashboard')).toBeVisible();
  await expect(page.getByText('Orders Today')).toBeVisible();
  await expect(page.getByText('Total Revenue')).toBeVisible();

  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'Traditional Dumplings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Festive Cookies' })).toBeVisible();
});

test('admin can add a new product without uploading a photo', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/products');

  await page.getByRole('button', { name: 'Add New Product' }).click();
  await page.locator('#name').fill('Kuih Lapis');
  await page.locator('#description').fill('Steamed layered rice cake');
  await page.locator('#price').fill('15.50');
  await page.locator('#unit').fill('box (10 pieces)');
  await page.locator('#prepDays').fill('2');
  await page.getByRole('button', { name: 'Add Product' }).click();

  await expect(page.getByText('Product added successfully!')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kuih Lapis' })).toBeVisible();
});

test('admin can approve a pending order and the customer sees the updated status', async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const { name: customerName } = await registerCustomer(customerPage, 'Order For Admin Approval');

  await customerPage.goto('/customer/order/1');
  await customerPage.getByRole('button', { name: 'Add to Cart' }).click();
  await customerPage.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await customerPage.locator('#deliveryDate').fill(deliveryDateDaysFromNow(5));
  await customerPage.locator('#phone').fill('123456789');
  await customerPage.getByText('Cash', { exact: true }).click();
  await customerPage.getByRole('button', { name: 'Review My Order' }).click();
  await customerPage.getByRole('button', { name: 'Confirm & Submit Order' }).click();
  await customerPage.waitForURL('**/customer/tracking', { timeout: 8000 });
  await expect(customerPage.getByText('Pending Approval')).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginAsAdmin(adminPage);
  await adminPage.goto('/admin/orders');

  // The order card's whole header is the expand/collapse toggle.
  await adminPage.getByText(customerName).click();
  await adminPage.getByRole('button', { name: 'Approve Order' }).click();
  await expect(adminPage.getByText('Order status updated!')).toBeVisible();

  await customerPage.reload();
  await expect(customerPage.getByText('Order Received').first()).toBeVisible();

  await customerContext.close();
  await adminContext.close();
});
