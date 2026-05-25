import { test, expect } from "./fixtures";

/**
 * Smoke tests for the authenticated portal.
 *
 * Goal: catch broken routes / 500s on every major page after auth lands. The
 * tests deliberately stay shallow — they only assert that the page is
 * navigated to and that some structural element is present. Module-specific
 * happy-paths live in their own spec files (sports-favorites, trip-lifecycle,
 * etc) so this file stays fast and stable.
 *
 * Uses the shared auth `storageState` set up by `auth.setup.ts`.
 */

test.describe("Portal smoke", () => {
  test("dashboard renders the Dashboard heading", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  const portalRoutes: Array<{ path: string; label: string }> = [
    { path: "/portal/portfolio", label: "Portfolio" },
    { path: "/portal/investment-methods", label: "Investment methods" },
    { path: "/portal/plans", label: "Finance plans" },
    { path: "/portal/plans/new", label: "New finance plan" },
    { path: "/portal/productivity/board", label: "Board" },
    { path: "/portal/productivity/road-paths", label: "Road paths" },
    { path: "/portal/entertainment/travel-planner", label: "Travel planner" },
    { path: "/portal/entertainment/travel-planner/new", label: "New trip" },
    { path: "/portal/entertainment/sports", label: "Sports" },
  ];

  for (const route of portalRoutes) {
    test(`${route.label} (${route.path}) responds 2xx and renders content`, async ({ page }) => {
      const response = await page.goto(route.path);
      // 2xx covers 200 + 304. Anything 4xx / 5xx fails the spec.
      expect(response?.status(), `${route.path} returned ${response?.status()}`).toBeLessThan(400);
      // The portal layout always renders a primary navigation; if it's missing
      // the page either errored or redirected us away from /portal.
      await expect(page.locator("nav, [role=\"navigation\"]").first()).toBeVisible();
    });
  }
});
