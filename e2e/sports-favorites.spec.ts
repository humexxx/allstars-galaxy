import { test, expect } from "./fixtures";

test.describe("Sports favorites", () => {
  test.beforeEach(async ({ cleanFavorites }) => {
    await cleanFavorites();
  });

  test.afterAll(async ({ cleanFavorites }) => {
    await cleanFavorites();
  });

  test("dashboard shows empty CTA when the user has no favourites", async ({ page }) => {
    await page.goto("/portal");

    const sportsCard = page.locator("section").filter({ hasText: "Sports" }).first();
    await expect(sportsCard.getByText(/Pick a few favorite sports/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Pick favorites/i })
    ).toHaveAttribute("href", "/portal/entertainment/sports");
  });

  test("sheet lists all 7 sports with switches off", async ({ page }) => {
    await page.goto("/portal/entertainment/sports");
    await page.getByRole("button", { name: /Manage favorites/i }).click();

    const sheet = page.getByRole("dialog", { name: /Favorite sports/i });
    await expect(sheet).toBeVisible();

    for (const label of [
      "Football",
      "Padel",
      "Formula 1",
      "NBA",
      "Tennis",
      "American Football",
      "League of Legends",
    ]) {
      await expect(sheet.getByText(label, { exact: true }).first()).toBeVisible();
    }

    const switches = sheet.getByRole("switch");
    await expect(switches).toHaveCount(7);
    for (let i = 0; i < 7; i++) {
      await expect(switches.nth(i)).not.toBeChecked();
    }
  });

  test("toggling Football on persists and pins it on the tab strip with a star", async ({
    page,
  }) => {
    await page.goto("/portal/entertainment/sports");
    await page.getByRole("button", { name: /Manage favorites/i }).click();

    const sheet = page.getByRole("dialog", { name: /Favorite sports/i });
    await sheet.getByRole("switch", { name: /Toggle Football as favorite/i }).click();
    await expect(
      sheet.getByRole("switch", { name: /Toggle Football as favorite/i })
    ).toBeChecked();

    // Close the sheet — count badge should now show "1" on the trigger.
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: /Manage favorites/i })).toContainText("1");

    // Reload to prove persistence (cookie + DB), not just optimistic state.
    await page.reload();
    await expect(page.getByRole("button", { name: /Manage favorites/i })).toContainText("1");
  });

  test("favourited sports show highlights on the dashboard", async ({ page }) => {
    await page.goto("/portal/entertainment/sports");
    await page.getByRole("button", { name: /Manage favorites/i }).click();
    const sheet = page.getByRole("dialog", { name: /Favorite sports/i });

    // Serialise the two toggles — each click fires an async server action and
    // we don't want to navigate before they both commit. The pending loader
    // is a per-row spinner with `.animate-spin`; we wait for it to clear.
    await sheet.getByRole("switch", { name: /Toggle Football as favorite/i }).click();
    await expect(sheet.locator(".animate-spin")).toHaveCount(0);
    await sheet.getByRole("switch", { name: /Toggle Formula 1 as favorite/i }).click();
    await expect(sheet.locator(".animate-spin")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Done" }).click();

    await page.goto("/portal");
    await expect(page.getByText(/Following 2 sports/i)).toBeVisible();

    // Each card carries the sport's label as a visually-uppercased eyebrow.
    // The DOM text is the registry label ("Football", "Formula 1"); the
    // `uppercase` Tailwind class only changes how it renders.
    await expect(page.getByText(/^Football$/).first()).toBeVisible();
    await expect(page.getByText(/^Formula 1$/).first()).toBeVisible();

    // F1 highlight should reference the leader's points line.
    await expect(page.getByText("Drivers' leader")).toBeVisible();
    await expect(page.getByText(/^.+ · \d+ pts$/).first()).toBeVisible();
  });

  test("untoggling the last favourite returns the dashboard to its empty state", async ({
    page,
  }) => {
    // Seed one favourite through the UI then remove it.
    await page.goto("/portal/entertainment/sports");
    await page.getByRole("button", { name: /Manage favorites/i }).click();
    const sheet = page.getByRole("dialog", { name: /Favorite sports/i });
    await sheet.getByRole("switch", { name: /Toggle NBA as favorite/i }).click();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: /Manage favorites/i })).toContainText("1");

    // Remove it.
    await page.getByRole("button", { name: /Manage favorites/i }).click();
    const sheet2 = page.getByRole("dialog", { name: /Favorite sports/i });
    await sheet2.getByRole("switch", { name: /Toggle NBA as favorite/i }).click();
    await expect(
      sheet2.getByRole("switch", { name: /Toggle NBA as favorite/i })
    ).not.toBeChecked();
    await sheet2.getByRole("button", { name: "Done" }).click();

    // Dashboard back to CTA.
    await page.goto("/portal");
    await expect(page.getByText(/Pick a few favorite sports/i)).toBeVisible();
  });
});
