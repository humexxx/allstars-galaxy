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
 *   - reads drizzle.__drizzle_migrations to see how many have been applied
 *   - drizzle uses ORDINAL ORDER (not file hashes) to decide what to apply, so a
 *     plain count is the correct signal
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

type JournalEntry = { idx: number; tag: string; when: number };
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

async function countApplied(sql: postgres.Sql): Promise<number> {
  try {
    const [row] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations
    `;
    return row?.count ?? 0;
  } catch {
    // Fresh DB — table doesn't exist yet.
    return 0;
  }
}

async function main() {
  const sql = postgres(url!, { max: 1, idle_timeout: 5 });

  try {
    const journal = loadJournal();
    const sortedEntries = [...journal.entries].sort((a, b) => a.idx - b.idx);

    const appliedBefore = await countApplied(sql);
    const pending = sortedEntries.slice(appliedBefore);

    if (pending.length === 0) {
      console.log(
        `✓ Database is up to date (${appliedBefore} migration${appliedBefore === 1 ? "" : "s"} applied, 0 pending)`
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

    const appliedAfter = await countApplied(sql);
    const newlyApplied = appliedAfter - appliedBefore;

    if (newlyApplied === pending.length) {
      for (const entry of pending) console.log(`  ✓ ${entry.tag}`);
      console.log(`\n✓ Applied ${newlyApplied} migration${newlyApplied === 1 ? "" : "s"}`);
    } else if (newlyApplied > 0) {
      const applied = pending.slice(0, newlyApplied);
      const failed = pending.slice(newlyApplied);
      for (const entry of applied) console.log(`  ✓ ${entry.tag}`);
      for (const entry of failed) console.log(`  ✗ ${entry.tag}  (did not land)`);
      console.log(`\n✗ ${newlyApplied} applied, ${failed.length} failed`);
      process.exit(1);
    } else {
      console.log("\n✗ No migrations were applied — check the error output above.");
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
