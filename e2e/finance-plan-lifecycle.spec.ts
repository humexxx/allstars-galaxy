import { test, expect } from "./fixtures";

/**
 * Smoke happy-path for finance plan creation.
 *
 * The plan form lives at /portal/plans/new. Only "Name" is strictly required
 * (start month + months ahead have sane defaults). After submit we expect a
 * redirect to /portal/plans/{uuid}.
 */

test.describe("Finance plans — create lifecycle", () => {
  test.beforeEach(async ({ cleanFinancePlans }) => {
    await cleanFinancePlans();
  });

  test.afterAll(async ({ cleanFinancePlans }) => {
    await cleanFinancePlans();
  });

  test("user can create a plan with only a name", async ({ page }) => {
    await page.goto("/portal/plans/new");

    const uniqueName = `E2E Plan ${Date.now()}`;
    await page.getByLabel("Name").fill(uniqueName);

    await page.getByRole("button", { name: /Create plan/i }).click();

    // Successful create routes to /portal/plans/<uuid>.
    await page.waitForURL(/\/portal\/plans\/[0-9a-f-]{36}/, { timeout: 10_000 });
    await expect(page.getByText(uniqueName).first()).toBeVisible();
  });

  test("plan appears on the plans index after creation", async ({ page }) => {
    const uniqueName = `Index Plan ${Date.now()}`;
    await page.goto("/portal/plans/new");
    await page.getByLabel("Name").fill(uniqueName);
    await page.getByRole("button", { name: /Create plan/i }).click();
    await page.waitForURL(/\/portal\/plans\/[0-9a-f-]{36}/);

    await page.goto("/portal/plans");
    await expect(page.getByText(uniqueName).first()).toBeVisible();
  });
});
