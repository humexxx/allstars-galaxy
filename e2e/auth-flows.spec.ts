import { test, expect } from "@playwright/test";

/**
 * Auth flow specs that intentionally run WITHOUT the persisted storage state
 * from `auth.setup.ts`. We override storageState to an empty session so each
 * test starts as an anonymous browser.
 *
 * Covers:
 *  - /login happy path → lands on /portal
 *  - logout from the portal → redirected back to /login
 *  - /forgot-password renders the reset form
 *  - /signup renders the signup form
 *
 * These tests reuse the same TEST_USER_EMAIL/PASSWORD as the auth.setup,
 * so they don't need separate fixtures or cleanup.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth — login / logout", () => {
  test("user can log in and lands on the dashboard", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "Missing TEST_USER_EMAIL / TEST_USER_PASSWORD in .env.test");
    }

    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();

    await page.waitForURL("**/portal**", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("logging out redirects back to /login", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(true, "Missing TEST_USER_EMAIL / TEST_USER_PASSWORD in .env.test");
    }

    // Re-login to get a fresh session for THIS browser context (the file-level
    // storageState override means we don't carry one between tests).
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL("**/portal**");

    // The nav-user trigger is a Button in the header that contains the
    // logged-in email as visible text on md+ viewports. Targeting by the
    // visible email is more stable than positional locators.
    await page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: email! })
      .click();

    await page.getByRole("menuitem", { name: /log out/i }).click();

    await page.waitForURL("**/login**", { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  });
});

test.describe("Auth — public pages", () => {
  test("/forgot-password renders the reset form", async ({ page }) => {
    const response = await page.goto("/forgot-password");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: /Reset Password/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("/signup renders the signup form", async ({ page }) => {
    const response = await page.goto("/signup");
    expect(response?.status()).toBeLessThan(400);
    // The signup form has an Email and Password input at minimum.
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("anonymous /portal access redirects to /login", async ({ page }) => {
    await page.goto("/portal");
    // Middleware redirects unauthenticated users to /login (with a `next=` query param).
    await page.waitForURL(/\/login(\?|$)/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  });
});
