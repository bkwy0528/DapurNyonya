import { test, expect } from '@playwright/test';

// Unauthenticated, read-only journeys only — see playwright.config.ts for why.
// These exercise routing, the auth-role guard, and the two auth forms
// rendering correctly, without creating any account or writing any data.

// The logged-out header nav also renders its own "Login"/"Register" links, so
// the welcome page's own call-to-action buttons are the *last* matches in DOM
// order — scope to those rather than the nav's copies.

test('welcome page presents the brand and both entry points', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dapur Nyonya' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Login' }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Register' }).last()).toBeVisible();
});

test('welcome page links navigate to the login and register forms', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).last().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).last().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#confirmPassword')).toBeVisible();
});

test('register form surfaces live password requirement feedback', async ({ page }) => {
  await page.goto('/register');
  await page.locator('#password').fill('short');
  await expect(page.getByText('At least 8 characters')).toBeVisible();
  await expect(page.getByText('Contains letters and numbers')).toBeVisible();
});

test('a logged-out visitor is redirected away from a protected customer route', async ({ page }) => {
  await page.goto('/customer/home');
  await expect(page).toHaveURL(/\/login$/);
});

test('a logged-out visitor is redirected away from a protected admin route', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
