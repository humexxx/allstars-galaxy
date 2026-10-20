/**
 * What drizzle-orm's migrator will do, worked out before it runs.
 *
 * drizzle records each migration it applies as a row whose `created_at` is
 * the journal entry's `when`, and on every run applies exactly the entries
 * whose `when` is later than the newest `created_at` (pg-core dialect,
 * `migrate`). It never looks at the rest, so on a database that several
 * branches migrate, counting rows says nothing:
 *   - another branch's migration makes the counts match while this branch's
 *     newer one is still missing ("up to date", column absent);
 *   - an entry older than the database's newest row is never applied at all.
 */

export type JournalEntry = { idx: number; tag: string; when: number };

export type MigrationPlan = {
  /** Journal entries already recorded in the database. */
  applied: JournalEntry[];
  /** Entries drizzle will apply on this run, in journal order. */
  pending: JournalEntry[];
  /**
   * Entries the database lacks that drizzle will never apply, because a newer
   * migration is already recorded there.
   */
  skipped: JournalEntry[];
  /** `created_at` of recorded migrations this journal has no entry for. */
  foreign: number[];
  /** The newest recorded `created_at`, or null on a fresh database. */
  lastAppliedAt: number | null;
};

export function planMigrations(
  entries: readonly JournalEntry[],
  appliedAt: readonly number[]
): MigrationPlan {
  const sorted = [...entries].sort((a, b) => a.idx - b.idx);
  const recorded = new Set(appliedAt);
  const known = new Set(sorted.map((e) => e.when));
  const lastAppliedAt = appliedAt.length > 0 ? Math.max(...appliedAt) : null;

  const applied: JournalEntry[] = [];
  const pending: JournalEntry[] = [];
  const skipped: JournalEntry[] = [];
  for (const entry of sorted) {
    if (recorded.has(entry.when)) applied.push(entry);
    else if (lastAppliedAt === null || entry.when > lastAppliedAt) pending.push(entry);
    else skipped.push(entry);
  }

  const foreign = [...recorded].filter((at) => !known.has(at)).sort((a, b) => a - b);
  return { applied, pending, skipped, foreign, lastAppliedAt };
}
