import { test, expect } from '@playwright/test';
import { registerCustomer, selectFirstAvailableCalendarDate } from './helpers/registerCustomer';

test.describe('registration — invalid input', () => {
  test('rejects mismatched passwords without ever contacting Firebase', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#name').fill('Mismatch Customer');
    await page.locator('#phone').fill('123456789');
    await page.locator('#email').fill(`qa.${Date.now()}@example.com`);
    await page.locator('#password').fill('TestPass123');
    await page.locator('#confirmPassword').fill('DifferentPass123');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test('rejects a password that is not both letters and numbers', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#name').fill('Weak Password Customer');
    await page.locator('#phone').fill('123456789');
    await page.locator('#email').fill(`qa.${Date.now()}@example.com`);
    await page.locator('#password').fill('onlyletters');
    await page.locator('#confirmPassword').fill('onlyletters');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('Password must be alphanumeric (letters and numbers)')).toBeVisible();
  });

  test('rejects registering the same email twice', async ({ page }) => {
    const { email } = await registerCustomer(page, 'First Registration');

    // Log out via the profile page (the header's logout button is desktop-only).
    await page.goto('/customer/profile');
    // The header nav also has its own (desktop-only) Logout button; the
    // profile page's own button is the last match in DOM order.
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await page.waitForURL('**/login', { timeout: 10000 });

    await page.goto('/register');
    await page.locator('#name').fill('Duplicate Registration');
    await page.locator('#phone').fill('987654321');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('TestPass123');
    await page.locator('#confirmPassword').fill('TestPass123');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('An account with this email already exists')).toBeVisible();
  });
});

test.describe('login — invalid input', () => {
  test('shows one generic error for a wrong password, without confirming the email exists', async ({ page }) => {
    const { email } = await registerCustomer(page, 'Login Test Customer');
    await page.goto('/customer/profile');
    // The header nav also has its own (desktop-only) Logout button; the
    // profile page's own button is the last match in DOM order.
    await page.getByRole('button', { name: 'Logout' }).last().click();
    await page.waitForURL('**/login', { timeout: 10000 });

    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows the same generic error for an email that was never registered', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('never-registered@example.com');
    await page.locator('#password').fill('WhateverPass123');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});

test.describe('checkout — validation', () => {
  test('reports every missing required field at once, not one at a time', async ({ page }) => {
    await registerCustomer(page, 'Empty Checkout Customer');
    await page.goto('/customer/order/1');
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    // Clear the phone field, which is otherwise pre-filled from registration.
    await page.locator('#phone').fill('');
    await page.getByRole('button', { name: 'Review My Order' }).click();

    await expect(page.getByText('Please select a pickup/delivery date')).toBeVisible();
    await expect(page.getByText('Please provide a contact phone number')).toBeVisible();
    await expect(page.getByText('Please select a payment method')).toBeVisible();
    // Submission must be blocked — still on the checkout page.
    await expect(page).toHaveURL(/\/customer\/checkout$/);
  });

  test('small orders are restricted to the configured collection days', async ({ page }) => {
    await registerCustomer(page, 'Small Order Customer');
    await page.goto('/customer/order/1'); // Traditional Dumplings — prepDays: 3
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    // 1 unit < default bulk minimum (20) — the rule explainer must show, and
    // the first selectable calendar day must be a default collection day
    // (Saturday), which also proves earlier-than-prep-time days are disabled.
    await expect(page.getByText(/Small order/)).toBeVisible();
    await selectFirstAvailableCalendarDate(page);
    await expect(page.getByText(/Selected: Saturday/)).toBeVisible();
  });

  test('orders meeting the bulk minimum can pick any available date', async ({ page }) => {
    await registerCustomer(page, 'Bulk Order Customer');
    await page.goto('/customer/order/1');
    // Bump quantity from 1 to 20 — the default bulk minimum.
    const plus = page.locator('button:has(svg.lucide-plus)');
    for (let i = 0; i < 19; i++) await plus.click();
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await page.getByRole('button', { name: 'Proceed to Checkout' }).click();

    // No small-order restriction: the explainer is gone and the first
    // selectable day is the prep-time minimum (3 days out), whatever weekday
    // that happens to be.
    await expect(page.getByText(/Small order/)).not.toBeVisible();
    await selectFirstAvailableCalendarDate(page);
    await expect(page.getByText(/Selected: /)).toBeVisible();
  });

  test('an empty cart cannot reach checkout', async ({ page }) => {
    await registerCustomer(page, 'Empty Cart Customer');
    await page.goto('/customer/checkout');
    await expect(page).toHaveURL(/\/customer\/cart$/);
  });
});
