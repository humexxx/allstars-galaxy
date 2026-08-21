import { chromium } from "@playwright/test";
import postgres from "postgres";

import { test, expect } from "./fixtures";

/**
 * The two kinds of share link, opened the way a recipient opens them: a fresh
 * browser with no session at all.
 *
 * This exists because the unit tests could not catch what broke here. They
 * mock the database and run in jsdom, where the server/client boundary does
 * not exist — so a scoped link that crashed the public page with "Attempted to
 * call moneyRange() from the server" passed every one of them.
 */
test.describe("Travel planner — share links", () => {
  test.beforeEach(async ({ cleanTrips }) => {
    await cleanTrips();
  });

  test.afterAll(async ({ cleanTrips }) => {
    await cleanTrips();
  });

  test("a whole-trip link hides the money; a traveller's link shows only theirs", async ({
    page,
  }) => {
    await page.goto("/portal/entertainment/travel-planner/new");
    await page.getByLabel("Title").fill("Share link spec");
    await page.getByRole("button", { name: /create|save/i }).first().click();
    await page.waitForURL(/travel-planner\/[0-9a-f-]{36}/, { timeout: 20_000 });
    const url = page.url();
    const tripId = url.match(/([0-9a-f-]{36})/)![1];

    // Seeded directly: this spec is about what a link exposes, not about the
    // forms that fill a trip in — those have their own spec.
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 1 });
    await sql`update trips set start_date='2027-01-15', end_date='2027-01-24'
              where id=${tripId}`;
    await sql`insert into trip_members (trip_id, name, sort_order)
              values (${tripId}, 'Jason Hume', 0), (${tripId}, 'Bruno Fabián', 1)`;
    await sql`insert into trip_items (trip_id, title, category, price, price_max,
      price_unit, scheduled_on, ends_on, round_trip)
      values (${tripId}, 'SJO ⇄ MCO', 'flight', '600.00', '800.00', 'total',
              '2027-01-15', '2027-01-24', true),
             (${tripId}, 'Star of the Seas', 'cruise', '1900.00', null,
              'per_person', '2027-01-17', '2027-01-24', false)`;
    const [bruno] = await sql`select id from trip_members
      where trip_id=${tripId} and name='Bruno Fabián'`;
    await sql`insert into trip_contributions (trip_id, member_id, amount, paid_on)
              values (${tripId}, ${bruno.id}, '300.00', '2026-08-16')`;
    await sql.end({ timeout: 1 });

    await page.goto(url);
    await page.waitForSelector("main header");

    const rows = page.locator("main .font-mono").filter({ hasText: "/trips/" });
    await page.getByRole("button", { name: /Create link/i }).click();
    await expect(rows).toHaveCount(1, { timeout: 15_000 });
    const anyoneLink = (await rows.first().innerText()).trim();

    await page.getByTitle(/Bruno Fabián/).click();
    await page.getByRole("button", { name: /Link for/i }).click();
    await expect(rows).toHaveCount(2, { timeout: 15_000 });
    const brunoLink = (await rows.allInnerTexts())
      .map((t) => t.trim())
      .find((t) => t !== anyoneLink)!;

    // Both links are labelled with what they expose, so two links to one trip
    // are told apart without opening them.
    await expect(page.locator("[data-slot=badge]").getByText("Whole trip")).toBeVisible();

    const browser = await chromium.launch();
    const anon = await browser.newContext();
    try {
      const guest = await anon.newPage();
      await guest.goto(anyoneLink);
      await guest.waitForLoadState("networkidle");
      const anyoneText = await guest.locator("body").innerText();

      // The cautious default: the plan, not the costs and not who is coming.
      expect(anyoneText).toContain("Share link spec");
      expect(anyoneText).not.toMatch(/\$/);
      expect(anyoneText).not.toMatch(/Bruno|Jason/);

      const guest2 = await anon.newPage();
      await guest2.goto(brunoLink);
      await guest2.waitForLoadState("networkidle");
      const brunoText = await guest2.locator("body").innerText();

      // His half of the flight, the cruise fare charged to him in full, and
      // what he has already handed over.
      expect(brunoText).toMatch(/bruno/i);
      expect(brunoText).toContain("$2,200 – $2,300");
      expect(brunoText).toContain("$300");
      expect(brunoText).toContain("$1,900");
      // The other traveller is the whole reason this link is scoped.
      expect(brunoText).not.toMatch(/jason/i);
    } finally {
      await browser.close();
    }
  });
});
