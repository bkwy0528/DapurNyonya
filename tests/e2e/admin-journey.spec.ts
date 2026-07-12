import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';
import { registerCustomer, selectFirstAvailableCalendarDate } from './helpers/registerCustomer';

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

test('admin can upload a product photo through the crop dialog', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/products');

  await page.getByRole('button', { name: 'Add New Product' }).click();
  await page.locator('#name').fill('Ondeh Ondeh');
  await page.locator('#description').fill('Pandan glutinous rice balls with gula melaka');
  await page.locator('#price').fill('12.00');
  await page.locator('#unit').fill('box (12 pieces)');
  await page.locator('#prepDays').fill('2');

  // Synthesize a camera-sized photo in the browser (no fixture file needed)
  // and feed it to the hidden file input, which opens the crop dialog.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e8590c';
    ctx.fillRect(0, 0, 1600, 1200);
    ctx.fillStyle = '#ffd8a8';
    ctx.fillRect(400, 300, 800, 600);
    return canvas.toDataURL('image/jpeg', 0.9);
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
  });

  await expect(page.getByRole('heading', { name: 'Adjust Photo' })).toBeVisible();
  // Enabled only once react-easy-crop has loaded the image and reported a crop area
  const usePhoto = page.getByRole('button', { name: 'Use Photo' });
  await expect(usePhoto).toBeEnabled();
  await usePhoto.click();
  await expect(page.getByRole('heading', { name: 'Adjust Photo' })).not.toBeVisible();

  // The cropped/compressed result lands in the form preview, with the
  // re-crop affordance available for stored (data:) images.
  const preview = page.getByRole('img', { name: 'Preview' });
  await expect(preview).toBeVisible();
  expect(await preview.getAttribute('src')).toMatch(/^data:image\/jpeg/);
  await expect(page.getByRole('button', { name: 'Adjust' })).toBeVisible();

  await page.getByRole('button', { name: 'Add Product' }).click();
  await expect(page.getByText('Product added successfully!')).toBeVisible();

  // The saved product renders the cropped photo (its img alt is the product name).
  await expect(page.getByRole('heading', { name: 'Ondeh Ondeh' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ondeh Ondeh' })).toBeVisible();
});

test('admin can approve a pending order and the customer sees the updated status', async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const { name: customerName } = await registerCustomer(customerPage, 'Order For Admin Approval');

  await customerPage.goto('/customer/order/1');
  await customerPage.getByRole('button', { name: 'Add to Cart' }).click();
  await customerPage.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await selectFirstAvailableCalendarDate(customerPage);
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
