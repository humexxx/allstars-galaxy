import { test as base } from "@playwright/test";
import postgres from "postgres";

/**
 * Resets the test user's `user_sports_preferences` rows so each spec starts
 * from a known empty state. Runs through Postgres directly (DATABASE_URL from
 * `.env`) instead of going through the app — the test should drive UI/DB
 * mutations from the browser, not seed them.
 *
 * Looks up the user id by email via `auth.users` so we don't have to bake the
 * UUID into the test env.
 */
async function cleanFavoritesFor(email: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set (read from .env) for cleanFavorites");
  }
  const sql = postgres(url, { max: 1, idle_timeout: 1 });
  try {
    await sql`
      DELETE FROM user_sports_preferences
      WHERE user_id = (SELECT id FROM auth.users WHERE email = ${email})
    `;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

type Fixtures = {
  cleanFavorites: () => Promise<void>;
};

export const test = base.extend<Fixtures>({
  cleanFavorites: async ({}, use) => {
    const email = process.env.TEST_USER_EMAIL;
    if (!email) throw new Error("Missing TEST_USER_EMAIL");
    // `use` here is Playwright's fixture-setup callback (not React's `use`
    // hook); the rules-of-hooks lint rule misfires because the names collide.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => cleanFavoritesFor(email));
  },
});

export { expect } from "@playwright/test";
