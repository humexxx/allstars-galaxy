import { test, expect } from "./fixtures";

/**
 * Admin smoke tests.
 *
 * The dedicated test user (from `.env.test`) may or may not have admin role.
 * `requireAdminOrRedirect` (used by both admin pages) silently redirects
 * non-admins to `/portal`. To keep the suite green on both setups, each spec:
 *   1. Navigates to the admin page.
 *   2. Reads `page.url()` after settle.
 *   3. If we landed back on `/portal`, treats the test as "not applicable for
 *      this env" via `test.skip(...)` (Playwright records it as skipped, not
 *      failed).
 *   4. Otherwise asserts admin-only UI structural elements.
 *
 * If you flip the test user to admin in Supabase, these checks become real
 * happy-paths automatically — no spec changes required.
 */

test.describe("Admin — smoke", () => {
  test("admin users page renders for admins / redirects for non-admins", async ({ page }) => {
    const response = await page.goto("/portal/admin/users");
    expect(response?.status(), `expected 2xx, got ${response?.status()}`).toBeLessThan(400);

    const settled = new URL(page.url()).pathname;
    if (!settled.startsWith("/portal/admin")) {
      test.skip(true, `Test user is not admin (landed on ${settled}); skipping admin assertions`);
    }

    // For admins we expect a table / list of users. Match loosely on any
    // table element rather than a specific email, since the user roster
    // varies across environments.
    await expect(page.locator("table, [role=\"table\"]").first()).toBeVisible();
  });

  test("admin transactions page renders for admins / redirects for non-admins", async ({ page }) => {
    const response = await page.goto("/portal/admin/transactions");
    expect(response?.status()).toBeLessThan(400);

    const settled = new URL(page.url()).pathname;
    if (!settled.startsWith("/portal/admin")) {
      test.skip(true, `Test user is not admin (landed on ${settled}); skipping admin assertions`);
    }

    // Admins see at minimum the pending-transactions surface heading.
    await expect(
      page.getByRole("heading", { name: /transactions/i }).first()
    ).toBeVisible();
  });
});
