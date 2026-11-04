/**
 * Replacement for `drizzle-kit migrate` that actually tells you what happened.
 *
 * drizzle-kit's own migrate command:
 *   - prints initial NOTICE lines from Postgres ("schema drizzle already exists, skipping")
 *   - applies the SQL silently
 *   - exits without confirming whether anything was applied
 *
 * This script:
 *   - reads migrations/meta/_journal.json to know every migration generated
 *   - reads drizzle.__drizzle_migrations to see which have been applied
 *   - works out what drizzle will apply by its own rule — timestamps, not a
 *     count (see `planMigrations`) — and refuses to run when an entry would be
 *     silently skipped
 *   - delegates the actual SQL execution to drizzle-orm's migrator (same engine
 *     drizzle-kit uses under the hood)
 *   - prints a final summary you can trust
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { planMigrations, type JournalEntry } from "./migration-plan";

type Journal = { entries: JournalEntry[] };

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("\n  DIRECT_URL must be set in .env for migrations.");
  console.error("  (DATABASE_URL on port 6543 is the pooler and will hang on DDL.)\n");
  process.exit(1);
}
if (url.includes(":6543/")) {
  console.error("\n  DIRECT_URL points at the transaction pooler (:6543).");
  console.error("  Use the session pooler (:5432) instead.\n");
  process.exit(1);
}

const MIGRATIONS_FOLDER = join(process.cwd(), "migrations");

function loadJournal(): Journal {
  const raw = readFileSync(join(MIGRATIONS_FOLDER, "meta", "_journal.json"), "utf8");
  return JSON.parse(raw) as Journal;
}

async function appliedAt(sql: postgres.Sql): Promise<number[]> {
  try {
    const rows = await sql<{ created_at: string }[]>`
      SELECT created_at::text AS created_at FROM drizzle.__drizzle_migrations
    `;
    return rows.map((r) => Number(r.created_at));
  } catch {
    // Fresh DB — table doesn't exist yet.
    return [];
  }
}

const day = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

async function main() {
  const sql = postgres(url!, { max: 1, idle_timeout: 5 });

  try {
    const journal = loadJournal();
    const { applied, pending, skipped, foreign, lastAppliedAt } = planMigrations(
      journal.entries,
      await appliedAt(sql)
    );

    if (foreign.length > 0) {
      console.log(
        `\n! ${foreign.length} applied migration${foreign.length === 1 ? " is" : "s are"} not in this checkout's journal (another branch's):`
      );
      for (const at of foreign) console.log(`  • created_at ${at} (${day(at)} UTC)`);
    }

    if (skipped.length > 0) {
      console.error(
        `\n✗ ${skipped.length} migration${skipped.length === 1 ? " is" : "s are"} missing from the database but older than its newest (${day(lastAppliedAt!)} UTC).`
      );
      console.error("  drizzle applies only entries newer than that, so these would never run:");
      for (const entry of skipped) console.error(`  • ${entry.tag}  (when ${entry.when})`);
      console.error(
        "\n  Nothing was applied. Move each entry's `when` in migrations/meta/_journal.json past the\n" +
          "  database's newest (and after any migration it depends on), then run this again.\n"
      );
      process.exit(1);
    }

    if (pending.length === 0) {
      console.log(
        `✓ Database is up to date (${applied.length} of ${journal.entries.length} migration${journal.entries.length === 1 ? "" : "s"} applied, 0 pending)`
      );
      return;
    }

    console.log(`\nPending migrations (${pending.length}):`);
    for (const entry of pending) {
      console.log(`  • ${entry.tag}`);
    }
    console.log("\nApplying…\n");

    // Same engine drizzle-kit uses internally — silences its own output but
    // executes the SQL correctly against the session-mode connection.
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const recorded = new Set(await appliedAt(sql));
    const landed = pending.filter((entry) => recorded.has(entry.when));
    const missing = pending.filter((entry) => !recorded.has(entry.when));
    for (const entry of landed) console.log(`  ✓ ${entry.tag}`);
    for (const entry of missing) console.log(`  ✗ ${entry.tag}  (did not land)`);

    if (missing.length === 0) {
      console.log(`\n✓ Applied ${landed.length} migration${landed.length === 1 ? "" : "s"}`);
    } else {
      console.log(`\n✗ ${landed.length} applied, ${missing.length} did not land — check the error output above.`);
      process.exit(1);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message || err);
  process.exit(1);
});
