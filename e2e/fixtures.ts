import { test as base } from "@playwright/test";
import postgres from "postgres";

/**
 * Per-module DB reset helpers.
 *
 * Each spec opts into the helpers it needs via fixture parameters so we don't
 * pay the SQL cost on tests that don't mutate that module.
 *
 * All helpers go through Postgres directly (DATABASE_URL from `.env`) instead
 * of routing through the app — the spec should drive UI/DB mutations from the
 * browser, not seed them. User id is looked up by email via `auth.users` so
 * we don't have to bake the UUID into the env.
 *
 * NOTE: only the test user's rows are deleted. Cascades take care of child
 * tables (e.g. deleting a finance plan removes its incomes / expenses /
 * debts / snapshots / confirmations / overrides).
 */

function getSqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set (read from .env) for e2e cleanup fixtures");
  }
  return postgres(url, { max: 1, idle_timeout: 1 });
}

async function withSql<T>(fn: (sql: ReturnType<typeof getSqlClient>) => Promise<T>): Promise<T> {
  const sql = getSqlClient();
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function cleanFavoritesFor(email: string): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      DELETE FROM user_sports_preferences
      WHERE user_id = (SELECT id FROM auth.users WHERE email = ${email})
    `;
  });
}

async function cleanTripsFor(email: string): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      DELETE FROM trips
      WHERE user_id = (SELECT id FROM auth.users WHERE email = ${email})
    `;
  });
}

async function cleanFinancePlansFor(email: string): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      DELETE FROM finance_plans
      WHERE user_id = (SELECT id FROM auth.users WHERE email = ${email})
    `;
  });
}

async function cleanBoardFor(email: string): Promise<void> {
  // Delete tasks first (their road_path FK is set null, not cascaded), then
  // columns (cascades any remaining tasks).
  await withSql(async (sql) => {
    const userIdSubquery = sql`(SELECT id FROM auth.users WHERE email = ${email})`;
    await sql`DELETE FROM board_tasks WHERE user_id = ${userIdSubquery}`;
    await sql`DELETE FROM board_columns WHERE user_id = ${userIdSubquery}`;
  });
}

async function cleanRoadPathsFor(email: string): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      DELETE FROM road_paths
      WHERE user_id = (SELECT id FROM auth.users WHERE email = ${email})
    `;
  });
}

/**
 * Wipes every user-owned row across all modules. Use for specs that touch
 * multiple surfaces or want a guaranteed clean slate. Slower than the
 * per-module helpers, so prefer those when you know exactly what you mutated.
 */
async function resetUserDataFor(email: string): Promise<void> {
  await withSql(async (sql) => {
    const userIdSubquery = sql`(SELECT id FROM auth.users WHERE email = ${email})`;
    // Order matters where cascades don't cover everything (board_tasks ->
    // road_paths is set null, not cascade).
    await sql`DELETE FROM board_tasks WHERE user_id = ${userIdSubquery}`;
    await sql`DELETE FROM board_columns WHERE user_id = ${userIdSubquery}`;
    await sql`DELETE FROM road_paths WHERE user_id = ${userIdSubquery}`;
    await sql`DELETE FROM finance_plans WHERE user_id = ${userIdSubquery}`;
    await sql`DELETE FROM trips WHERE user_id = ${userIdSubquery}`;
    await sql`DELETE FROM user_sports_preferences WHERE user_id = ${userIdSubquery}`;
  });
}

type Fixtures = {
  cleanFavorites: () => Promise<void>;
  cleanTrips: () => Promise<void>;
  cleanFinancePlans: () => Promise<void>;
  cleanBoard: () => Promise<void>;
  cleanRoadPaths: () => Promise<void>;
  resetUserData: () => Promise<void>;
};

function requireEmail(): string {
  const email = process.env.TEST_USER_EMAIL;
  if (!email) throw new Error("Missing TEST_USER_EMAIL");
  return email;
}

// `use` here is Playwright's fixture-setup callback (a function), not React's
// `use` hook, so the rules-of-hooks rule doesn't fire here.

export const test = base.extend<Fixtures>({
  cleanFavorites: async ({}, use) => {
    const email = requireEmail();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => cleanFavoritesFor(email));
  },
  cleanTrips: async ({}, use) => {
    const email = requireEmail();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => cleanTripsFor(email));
  },
  cleanFinancePlans: async ({}, use) => {
    const email = requireEmail();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => cleanFinancePlansFor(email));
  },
  cleanBoard: async ({}, use) => {
    const email = requireEmail();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => cleanBoardFor(email));
  },
  cleanRoadPaths: async ({}, use) => {
    const email = requireEmail();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => cleanRoadPathsFor(email));
  },
  resetUserData: async ({}, use) => {
    const email = requireEmail();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(() => resetUserDataFor(email));
  },
});

export { expect } from "@playwright/test";
