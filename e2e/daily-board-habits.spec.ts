import { test, expect } from "./fixtures";

/**
 * The daily board and the habits that feed it, end to end:
 * a habit due today is on today's board without anyone adding it, finishing
 * it checks the day in on its road path, and a task left open yesterday is
 * offered to today in the column it had.
 *
 * The reader's zone decides what "today" is, so the browser and the `tz`
 * cookie are pinned to one: without the cookie the first server render reads
 * UTC, which is already tomorrow on a Costa Rica evening.
 */

const ZONE = "America/Costa_Rica";
test.use({ timezoneId: ZONE });

test.describe("Daily board and habits", () => {
  test.beforeEach(async ({ page, baseURL, cleanBoard, cleanRoadPaths }) => {
    await cleanRoadPaths();
    await cleanBoard();
    await page.context().addCookies([{ name: "tz", value: ZONE, url: baseURL! }]);
  });

  test.afterAll(async ({ cleanBoard, cleanRoadPaths }) => {
    await cleanRoadPaths();
    await cleanBoard();
  });

  test("a habit due today is on the board, and finishing it checks the day in", async ({
    page,
  }) => {
    const title = `E2E Habit ${Date.now()}`;

    await page.goto("/portal/productivity/road-paths");
    await page.getByRole("button", { name: "Create road path" }).first().click();
    const create = page.getByRole("dialog", { name: "Create road path" });
    await create.getByLabel("Title").fill(title);
    // Every day, so it is due whatever day the test runs on.
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      await create.getByRole("button", { name: day, exact: true }).click();
    }
    await expect(create.getByText(/^Every day\./)).toBeVisible();
    await create.getByRole("button", { name: "Create road path" }).click();
    await expect(create).not.toBeVisible();

    await page.goto("/portal/productivity/board");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Habit" })).toBeVisible();

    // Finish it through its edit form: a new column is a move.
    await page.getByRole("button", { name: `Options for ${title}` }).click();
    await page.getByRole("menuitem", { name: "Edit task" }).click();
    const edit = page.getByRole("dialog", { name: "Edit task" });
    await edit.getByLabel("Column").click();
    await page.getByRole("option", { name: "Done" }).click();
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).not.toBeVisible();

    await page.getByRole("link", { name: "Habit" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText("due day in a row", { exact: false })).toBeVisible();
    await expect(page.getByText("1 of 1 due days done")).toBeVisible();
    await expect(page.getByText(/done today/)).toBeVisible();
  });

  test("an unfinished task from yesterday is offered to today and keeps its column", async ({
    page,
  }) => {
    const title = `E2E Carry ${Date.now()}`;

    await page.goto("/portal/productivity/board");
    await expect(page.getByText(/^Today · /)).toBeVisible();
    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page.getByText(/^Yesterday · /)).toBeVisible();

    await page.getByRole("button", { name: "Add task to Working" }).click();
    const create = page.getByRole("dialog", { name: "Create new task" });
    await create.getByLabel("Title").fill(title);
    await create.getByRole("button", { name: "Create task" }).click();
    await expect(create).not.toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.getByRole("link", { name: "Back to today" }).click();
    const prompt = page.getByRole("dialog", { name: "You didn’t finish some things" });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText(title)).toBeVisible();
    await prompt.getByRole("button", { name: "Move 1 to today" }).click();
    await expect(prompt).not.toBeVisible();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: `Options for ${title}` }).click();
    await page.getByRole("menuitem", { name: "Edit task" }).click();
    await expect(page.getByRole("dialog", { name: "Edit task" }).getByLabel("Column")).toHaveText(
      "Working"
    );
  });

  test("a task left behind stays on its day and is not asked about again", async ({ page }) => {
    const title = `E2E Leave ${Date.now()}`;

    await page.goto("/portal/productivity/board");
    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page.getByText(/^Yesterday · /)).toBeVisible();
    await page.getByRole("button", { name: "Add task" }).first().click();
    const create = page.getByRole("dialog", { name: "Create new task" });
    await create.getByLabel("Title").fill(title);
    await create.getByRole("button", { name: "Create task" }).click();
    await expect(create).not.toBeVisible();

    await page.getByRole("link", { name: "Back to today" }).click();
    const prompt = page.getByRole("dialog", { name: "You didn’t finish some things" });
    await prompt.getByRole("button", { name: "Leave them" }).click();
    await expect(prompt).not.toBeVisible();
    await expect(page.getByRole("heading", { name: title })).not.toBeVisible();

    await page.reload();
    await expect(page.getByText(/^Today · /)).toBeVisible();
    await expect(prompt).not.toBeVisible();

    await page.getByRole("link", { name: "Previous day" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  });
});
