import { test, expect } from "./fixtures";

/**
 * Happy-path lifecycle for a trip: navigate → create → verify detail page.
 * The cleanTrips fixture wipes any rows left over from previous runs both
 * before and after so partial failures don't bleed into the next spec.
 */

test.describe("Travel planner — trip lifecycle", () => {
  test.beforeEach(async ({ cleanTrips }) => {
    await cleanTrips();
  });

  test.afterAll(async ({ cleanTrips }) => {
    await cleanTrips();
  });

  test("user can create a trip and land on its detail page", async ({ page }) => {
    await page.goto("/portal/entertainment/travel-planner/new");

    // Title is the only required field besides dates (default = today).
    const uniqueTitle = `E2E Trip ${Date.now()}`;
    await page.getByLabel("Title").fill(uniqueTitle);
    await page.getByLabel("Destination").fill("Lisbon, Portugal");

    await page.getByRole("button", { name: /Create trip/i }).click();

    // Redirected to /portal/entertainment/travel-planner/<uuid> on success.
    await page.waitForURL(/\/portal\/entertainment\/travel-planner\/[0-9a-f-]{36}/, {
      timeout: 10_000,
    });
    await expect(page.getByText(uniqueTitle, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Lisbon, Portugal").first()).toBeVisible();
  });

  test("trip appears in the overview list after creation", async ({ page }) => {
    const uniqueTitle = `Overview Trip ${Date.now()}`;
    await page.goto("/portal/entertainment/travel-planner/new");
    await page.getByLabel("Title").fill(uniqueTitle);
    await page.getByRole("button", { name: /Create trip/i }).click();
    await page.waitForURL(/\/portal\/entertainment\/travel-planner\/[0-9a-f-]{36}/);

    await page.goto("/portal/entertainment/travel-planner");
    await expect(page.getByText(uniqueTitle).first()).toBeVisible();
  });

  test("user can delete a trip from its detail page", async ({ page }) => {
    const uniqueTitle = `Delete Trip ${Date.now()}`;
    // Seed via UI.
    await page.goto("/portal/entertainment/travel-planner/new");
    await page.getByLabel("Title").fill(uniqueTitle);
    await page.getByRole("button", { name: /Create trip/i }).click();
    await page.waitForURL(/\/portal\/entertainment\/travel-planner\/[0-9a-f-]{36}/);

    // Click the icon-only "Delete trip" button (labelled by aria-label).
    await page.getByRole("button", { name: /^Delete trip$/i }).click();

    // Confirm in the AlertDialog.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Delete$/ }).click();

    // After delete we should be off the detail page.
    await page.waitForURL(/\/portal\/entertainment\/travel-planner(\/|$)/);
    // And the trip should no longer be on the overview.
    await page.goto("/portal/entertainment/travel-planner");
    await expect(page.getByText(uniqueTitle)).toHaveCount(0);
  });
});
