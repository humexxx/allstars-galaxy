import { test, expect } from "./fixtures";

/**
 * Board happy-path: navigate → create task in the auto-initialised default
 * "Todo" column → verify it renders.
 *
 * The board page itself initialises three default columns (Todo / Working /
 * Done) on first visit if the user has none, so the cleanBoard fixture is
 * enough — we don't have to seed anything else.
 */

test.describe("Board — task lifecycle", () => {
  test.beforeEach(async ({ cleanBoard }) => {
    await cleanBoard();
  });

  test.afterAll(async ({ cleanBoard }) => {
    await cleanBoard();
  });

  test("first visit auto-creates the three default columns", async ({ page }) => {
    await page.goto("/portal/productivity/board");

    // Default column names from `initializeDefaultColumns`.
    await expect(page.getByText("Todo", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Working", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();
  });

  test("user can create a task and see it on the board", async ({ page }) => {
    await page.goto("/portal/productivity/board");
    // Wait for default columns to render so the dialog has a column to pick.
    await expect(page.getByText("Todo", { exact: true }).first()).toBeVisible();

    // Top-level "Add Task" button is the default trigger when no `children`
    // override is passed (see CreateTaskDialog).
    await page.getByRole("button", { name: /Add Task/i }).first().click();

    const dialog = page.getByRole("dialog", { name: /Create New Task/i });
    await expect(dialog).toBeVisible();

    const uniqueTitle = `E2E Task ${Date.now()}`;
    await dialog.getByLabel("Title").fill(uniqueTitle);

    await dialog.getByRole("button", { name: /Create Task/i }).click();

    // Dialog dismisses on success; task title shows up on the board.
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(uniqueTitle).first()).toBeVisible();
  });

  test("user can create a custom column via the Add Column dialog", async ({ page }) => {
    await page.goto("/portal/productivity/board");
    await expect(page.getByText("Todo", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: /Add Column/i }).click();

    const dialog = page.getByRole("dialog", { name: /Create New Column/i });
    const uniqueName = `E2E Column ${Date.now()}`;
    await dialog.getByLabel("Title").fill(uniqueName);
    await dialog.getByRole("button", { name: /Create Column/i }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(uniqueName).first()).toBeVisible();
  });
});
