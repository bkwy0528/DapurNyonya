import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/adminAuth';
import { registerCustomer, deliveryDateDaysFromNow } from './helpers/registerCustomer';
import { seedBatchProduct, seedProductionBatch, findBatchOrderId, seedBatchOrderPaid, seedPaymentConfirmation, readBatchOrder } from './helpers/seedBatch';
import { callSubmitBatchOrderPayment } from './helpers/callFunctions';

// Batch/MOQ products skip the normal cart/checkout flow entirely — customers
// pre-order against an admin-opened production date and pay nothing until
// enough pre-orders accumulate. Production date is "today" (not a future
// date) purely so the admin Pre-Orders page's default calendar selection (today)
// shows it without needing to click through the calendar in the test.
const PRODUCTION_DATE = deliveryDateDaysFromNow(0);
const PRODUCT_ID = 'chang-test';
const BATCH_ID = `${PRODUCT_ID}_${PRODUCTION_DATE}`;

test.describe('batch/MOQ production ordering', () => {
  test('MOQ crossing confirms the batch and opens payment for everyone already waiting', async ({ browser }) => {
    await seedBatchProduct({ id: PRODUCT_ID, name: 'Test Chang', price: 2, unit: 'piece' });
    await seedProductionBatch({ id: BATCH_ID, productId: PRODUCT_ID, productName: 'Test Chang', productionDate: PRODUCTION_DATE, minQuantity: 5, maxQuantity: 8 });

    const customerAContext = await browser.newContext();
    const customerAPage = await customerAContext.newPage();
    const { email: emailA } = await registerCustomer(customerAPage, 'Batch Customer A');

    await customerAPage.goto(`/customer/batch-order/${PRODUCT_ID}`);
    await expect(customerAPage.getByText('Waiting for Minimum Quantity').first()).toBeVisible();
    await customerAPage.getByRole('textbox', { name: 'Quantity' }).fill('3');
    await customerAPage.locator('#batch-phone').fill('123456789');
    await customerAPage.getByRole('button', { name: 'Place Pre-Order' }).click();

    // createBatchPreOrder is a real round trip to the Functions emulator, and
    // its result gates the navigation (unlike checkout, which navigates first
    // and fires its callable on the next page) — the first invocation in a
    // fresh emulator run can be considerably slower than the 5s default.
    await expect(customerAPage).toHaveURL(/\/customer\/tracking$/, { timeout: 20000 });
    await expect(customerAPage.getByText('Waiting for Minimum Quantity').first()).toBeVisible();
    await expect(customerAPage.getByText(/3 \/ 5 piece/)).toBeVisible();

    // A second customer's 2 units tips the batch over its 5-unit minimum.
    const customerBContext = await browser.newContext();
    const customerBPage = await customerBContext.newPage();
    await registerCustomer(customerBPage, 'Batch Customer B');

    await customerBPage.goto(`/customer/batch-order/${PRODUCT_ID}`);
    await customerBPage.getByRole('textbox', { name: 'Quantity' }).fill('2');
    await customerBPage.locator('#batch-phone').fill('987654321');
    await customerBPage.getByRole('button', { name: 'Place Pre-Order' }).click();

    await expect(customerBPage).toHaveURL(/\/customer\/tracking$/, { timeout: 20000 });
    await expect(customerBPage.getByText('Payment Open').first()).toBeVisible();
    await expect(customerBPage.getByRole('button', { name: 'Pay Now' })).toBeVisible();

    // Customer A never re-visited the page, but was still sitting on 'waiting'
    // — a reload should show the fan-out from createBatchPreOrder confirming
    // their pre-order too, not just the one that tipped the batch over.
    await customerAPage.reload();
    await expect(customerAPage.getByText('Payment Open').first()).toBeVisible();
    await expect(customerAPage.getByRole('button', { name: 'Pay Now' })).toBeVisible();

    // A third customer trying to join for more than the remaining capacity
    // (8 max - 5 committed = 3 left) is rejected client-side before any write.
    const customerCContext = await browser.newContext();
    const customerCPage = await customerCContext.newPage();
    await registerCustomer(customerCPage, 'Batch Customer C');

    await customerCPage.goto(`/customer/batch-order/${PRODUCT_ID}`);
    await customerCPage.getByRole('textbox', { name: 'Quantity' }).fill('10');
    await customerCPage.locator('#batch-phone').fill('555555555');
    await customerCPage.getByRole('button', { name: 'Place Pre-Order' }).click();
    await expect(customerCPage.getByText(/Only 3 left for this date/)).toBeVisible();
    await expect(customerCPage).toHaveURL(new RegExp(`/customer/batch-order/${PRODUCT_ID}$`));

    // The admin Pre-Orders page reflects the same confirmed state and totals.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.goto('/admin/production-calendar');
    await expect(adminPage.getByText('Test Chang')).toBeVisible();
    await expect(adminPage.getByText('Confirmed — payment open')).toBeVisible();
    await expect(adminPage.getByText('5 / 5')).toBeVisible();
    await adminPage.getByRole('button', { name: /2 orders/ }).click();
    await expect(adminPage.getByText('Batch Customer A — 3 piece')).toBeVisible();
    await expect(adminPage.getByText('Batch Customer B — 2 piece')).toBeVisible();

    // Clicking through to pay hands off to ToyyibPay's hosted page, same
    // emulator boundary as the regular checkout flow — reaching the payment
    // route with the pre-order still awaiting is the success state here.
    await customerBPage.getByRole('button', { name: 'Pay Now' }).click();
    await customerBPage.getByText('DuitNow QR / E-Wallet', { exact: true }).click();
    await customerBPage.getByRole('button', { name: 'Continue to Payment' }).click();
    await expect(customerBPage).toHaveURL(/\/customer\/payment$/);

    // Payment itself can't be driven through the emulator (ToyyibPay is a
    // real external gateway) — graduate customer A's pre-order the same way
    // seedOrder.ts seeds a normal paid order, and confirm it behaves exactly
    // like any other order from here on (no batch-specific special-casing
    // anywhere downstream).
    const batchOrderIdA = await findBatchOrderId(emailA, BATCH_ID);
    const { finalizedNumber } = await seedBatchOrderPaid(batchOrderIdA);

    await customerAPage.reload();
    await expect(customerAPage.getByText(finalizedNumber)).toBeVisible();
    await expect(customerAPage.getByText('Order Received').first()).toBeVisible();
    // The paid pre-order no longer shows in the "Your Pre-Orders" section.
    await expect(customerAPage.getByText('Your Pre-Orders')).not.toBeVisible();

    await adminPage.goto('/admin/orders');
    await expect(adminPage.getByText('Batch Customer A')).toBeVisible();
    await adminPage.getByText('Batch Customer A').click();
    await expect(adminPage.getByRole('button', { name: 'Start Preparation' })).toBeVisible();

    await customerAContext.close();
    await customerBContext.close();
    await customerCContext.close();
    await adminContext.close();
  });

  test('a production date that never reaches its minimum shows no payment prompt', async ({ page }) => {
    const productId = 'chang-test-2';
    const batchId = `${productId}_${PRODUCTION_DATE}`;
    await seedBatchProduct({ id: productId, name: 'Small Batch Chang', price: 3, unit: 'piece' });
    await seedProductionBatch({ id: batchId, productId, productName: 'Small Batch Chang', productionDate: PRODUCTION_DATE, minQuantity: 20, maxQuantity: 40 });

    await registerCustomer(page, 'Under Minimum Customer');
    await page.goto(`/customer/batch-order/${productId}`);
    await page.getByRole('textbox', { name: 'Quantity' }).fill('4');
    await page.locator('#batch-phone').fill('111222333');
    await page.getByRole('button', { name: 'Place Pre-Order' }).click();

    await expect(page).toHaveURL(/\/customer\/tracking$/, { timeout: 20000 });
    await expect(page.getByText('Waiting for Minimum Quantity').first()).toBeVisible();
    await expect(page.getByText(/4 \/ 20 piece/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pay Now' })).not.toBeVisible();
  });

  test('joining an already-confirmed batch goes straight to payment, and the real payment function graduates it', async ({ browser }) => {
    const productId = 'chang-confirm';
    const batchId = `${productId}_${PRODUCTION_DATE}`;
    await seedBatchProduct({ id: productId, name: 'Confirm Chang', price: 4, unit: 'piece' });
    await seedProductionBatch({ id: batchId, productId, productName: 'Confirm Chang', productionDate: PRODUCTION_DATE, minQuantity: 2, maxQuantity: 10 });

    // Customer A's 2 units alone hit the 2-unit minimum — batch confirms.
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const { email: emailA, password: passwordA } = await registerCustomer(pageA, 'Confirm Customer A');
    await pageA.goto(`/customer/batch-order/${productId}`);
    await pageA.getByRole('textbox', { name: 'Quantity' }).fill('2');
    await pageA.locator('#batch-phone').fill('123123123');
    await pageA.getByRole('button', { name: 'Place Pre-Order' }).click();
    await expect(pageA).toHaveURL(/\/customer\/tracking$/, { timeout: 20000 });
    await expect(pageA.getByText('Payment Open').first()).toBeVisible();

    // Customer B joins AFTER confirmation: the pre-order page already shows
    // the batch as confirmed, and their pre-order must go straight to
    // awaiting_payment (sharing the existing deadline), never 'waiting'.
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    const { email: emailB, password: passwordB } = await registerCustomer(pageB, 'Confirm Customer B');
    await pageB.goto(`/customer/batch-order/${productId}`);
    await expect(pageB.getByText('Confirmed — payment open').first()).toBeVisible();
    await pageB.getByRole('textbox', { name: 'Quantity' }).fill('3');
    await pageB.locator('#batch-phone').fill('456456456');
    await pageB.getByRole('button', { name: 'Place Pre-Order' }).click();
    await expect(pageB).toHaveURL(/\/customer\/tracking$/, { timeout: 20000 });
    await expect(pageB.getByText('Payment Open').first()).toBeVisible();
    await expect(pageB.getByRole('button', { name: 'Pay Now' })).toBeVisible();

    const batchOrderIdB = await findBatchOrderId(emailB, batchId);
    expect((await readBatchOrder(batchOrderIdB)).status).toBe('awaiting_payment');

    // Drive the REAL submitBatchOrderPayment function (not the seed shortcut):
    // without a recorded payment confirmation it must refuse. 'unavailable'
    // (not 'failed-precondition') because a missing confirmation is treated as
    // a transient callback lag the return page retries — a genuinely never-paid
    // bill just never produces one.
    const unpaid = await callSubmitBatchOrderPayment(emailB, passwordB, {
      batchOrderId: batchOrderIdB, billCode: 'bill-that-never-paid', paymentMethod: 'fpx',
    });
    expect(unpaid.ok).toBe(false);
    expect(unpaid.code).toBe('functions/unavailable');

    // ...someone else's sign-in must be rejected even with a valid bill...
    const billCode = `test-bill-${batchOrderIdB}`;
    await seedPaymentConfirmation(billCode, 4 * 3 * 100); // price 4 x qty 3, in cents
    const wrongOwner = await callSubmitBatchOrderPayment(emailA, passwordA, {
      batchOrderId: batchOrderIdB, billCode, paymentMethod: 'fpx',
    });
    expect(wrongOwner.ok).toBe(false);
    expect(wrongOwner.code).toBe('functions/permission-denied');

    // ...and with the confirmation in place, the rightful owner's call
    // graduates the pre-order into a real numbered order.
    const paid = await callSubmitBatchOrderPayment(emailB, passwordB, {
      batchOrderId: batchOrderIdB, billCode, paymentMethod: 'fpx',
    });
    expect(paid.ok).toBe(true);
    expect(paid.data.orderId).toBeTruthy();
    expect(paid.data.total).toBe(12);
    const graduated = await readBatchOrder(batchOrderIdB);
    expect(graduated.status).toBe('paid');
    expect(graduated.orderId).toBe(paid.data.orderId);

    // A repeat call (e.g. a reload) returns the same order, not a duplicate.
    const repeat = await callSubmitBatchOrderPayment(emailB, passwordB, {
      batchOrderId: batchOrderIdB, billCode, paymentMethod: 'fpx',
    });
    expect(repeat.ok).toBe(true);
    expect(repeat.data.orderId).toBe(paid.data.orderId);

    await pageB.reload();
    await expect(pageB.getByText('Order Received').first()).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('admin can open a production date through the UI, then cancel a pre-order to release its quantity', async ({ browser }) => {
    const productId = 'chang-admin';
    await seedBatchProduct({ id: productId, name: 'Admin Chang', price: 5, unit: 'piece' });

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    await adminPage.goto('/admin/production-calendar');

    // The Pre-Orders page defaults to today — open Admin Chang's date with a
    // minimum of 10 and no maximum, through the real form.
    const adminCard = adminPage.locator('div.rounded-lg.border', { hasText: 'Admin Chang' });
    await adminCard.getByPlaceholder('e.g. 20').fill('10');
    await adminCard.getByRole('button', { name: 'Open this date' }).click();
    await expect(adminCard.getByText('Waiting for Minimum Quantity')).toBeVisible();
    await expect(adminCard.getByText('0 / 10')).toBeVisible();
    await expect(adminCard.getByText('Unlimited')).toBeVisible();

    // A customer pre-orders 4 against the freshly opened date.
    const custContext = await browser.newContext();
    const custPage = await custContext.newPage();
    await registerCustomer(custPage, 'Cancelled Customer');
    await custPage.goto(`/customer/batch-order/${productId}`);
    await custPage.getByRole('textbox', { name: 'Quantity' }).fill('4');
    await custPage.locator('#batch-phone').fill('789789789');
    await custPage.getByRole('button', { name: 'Place Pre-Order' }).click();
    await expect(custPage).toHaveURL(/\/customer\/tracking$/, { timeout: 20000 });

    // Admin cancels that pre-order from the expanded order list; the reserved
    // quantity is released and the row flips to cancelled.
    await adminPage.reload();
    const refreshedCard = adminPage.locator('div.rounded-lg.border', { hasText: 'Admin Chang' });
    await expect(refreshedCard.getByText('4 / 10')).toBeVisible();
    await refreshedCard.getByRole('button', { name: /1 order/ }).click();
    await expect(refreshedCard.getByText('Cancelled Customer — 4 piece')).toBeVisible();
    adminPage.once('dialog', (dialog) => dialog.accept());
    await refreshedCard.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(refreshedCard.getByText('0 / 10')).toBeVisible();
    await expect(refreshedCard.getByText('cancelled', { exact: true })).toBeVisible();

    // The customer sees the cancellation on their side too.
    await custPage.reload();
    await expect(custPage.getByText('Cancelled — Minimum Not Reached').first()).toBeVisible();

    await adminContext.close();
    await custContext.close();
  });
});
