import { db } from "@/db";
import { portfolios, portfolioSnapshots, transactions } from "@/db/schema";
import { eq, and, sql, lte, gt, desc } from "drizzle-orm";
import type { SnapshotSource } from "@/schemas/snapshot";

/**
 * Create daily snapshots for all portfolios.
 * Optimized as a batch: 3 queries total regardless of portfolio count.
 *   1. SUM(currentValue) per portfolio for approved buy transactions.
 *   2. Latest snapshot value per portfolio (to decide whether to write a zero row).
 *   3. Single bulk INSERT for all eligible portfolios.
 */
export async function createDailySnapshots(): Promise<{
  date: Date;
  snapshotsCreated: number;
  totalPortfolios: number;
  errors: string[];
}> {
  const today = new Date();

  // 1. Aggregate balances per portfolio in a single query.
  const balances = await db
    .select({
      portfolioId: transactions.portfolioId,
      totalValue: sql<string>`COALESCE(SUM(${transactions.currentValue}), 0)`,
      txCount: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "approved"),
        eq(transactions.type, "buy"),
        lte(transactions.date, today)
      )
    )
    .groupBy(transactions.portfolioId);

  if (balances.length === 0) {
    const totalPortfolios = await db.$count(portfolios);
    return { date: today, snapshotsCreated: 0, totalPortfolios, errors: [] };
  }

  // 2. Latest snapshot per portfolio, for the zero-value branch logic.
  const portfolioIds = balances.map((b) => b.portfolioId);
  const latestSnapshots = await db
    .selectDistinctOn([portfolioSnapshots.portfolioId], {
      portfolioId: portfolioSnapshots.portfolioId,
      totalValue: portfolioSnapshots.totalValue,
    })
    .from(portfolioSnapshots)
    .where(sql`${portfolioSnapshots.portfolioId} = ANY(${portfolioIds})`)
    .orderBy(portfolioSnapshots.portfolioId, desc(portfolioSnapshots.date));

  const latestByPortfolio = new Map(
    latestSnapshots.map((s) => [s.portfolioId, parseFloat(s.totalValue)])
  );

  // 3. Decide which rows to insert.
  const rowsToInsert = balances
    .filter((b) => {
      const totalValue = parseFloat(b.totalValue);
      if (totalValue > 0) return true;
      // Only insert a zero-value snapshot if the previous one was non-zero
      // (signals a real transition to empty).
      const prev = latestByPortfolio.get(b.portfolioId);
      return prev !== undefined && prev > 0;
    })
    .map((b) => ({
      portfolioId: b.portfolioId,
      date: today,
      totalValue: parseFloat(b.totalValue).toFixed(2),
      source: "system_cron" as SnapshotSource,
    }));

  if (rowsToInsert.length > 0) {
    await db.insert(portfolioSnapshots).values(rowsToInsert);
  }

  return {
    date: today,
    snapshotsCreated: rowsToInsert.length,
    totalPortfolios: balances.length,
    errors: [],
  };
}

/**
 * Create snapshot when approving a transaction
 * Does NOT delete existing snapshots - allows multiple snapshots per day
 * Uses the transaction date for the snapshot
 */
export async function createApprovalSnapshot(portfolioId: string, transactionDate: Date): Promise<void> {
  await createSnapshotForPortfolio(portfolioId, "admin_approval", transactionDate);
}

/**
 * Create a manual snapshot for a portfolio
 * Used by users to take a manual snapshot
 */
export async function createManualSnapshot(
  portfolioId: string,
  date: Date = new Date(),
  source: SnapshotSource = "manual"
): Promise<{ created: boolean; totalValue: number }> {
  return await createSnapshotForPortfolio(portfolioId, source, date);
}

/**
 * Delete all manual snapshots for a portfolio
 */
export async function deleteManualSnapshots(portfolioId: string): Promise<void> {
  await db
    .delete(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.portfolioId, portfolioId),
        eq(portfolioSnapshots.source, "manual")
      )
    );
}

/**
 * Internal function to create a snapshot for a portfolio
 */
async function createSnapshotForPortfolio(
  portfolioId: string,
  source: SnapshotSource,
  date: Date = new Date()
): Promise<{ created: boolean; totalValue: number }> {
  // Count and sum currentValue of all approved buy transactions with date <= snapshot date
  const result = await db
    .select({
      totalValue: sql<string>`COALESCE(SUM(${transactions.currentValue}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.portfolioId, portfolioId),
        eq(transactions.status, "approved"),
        eq(transactions.type, "buy"),
        lte(transactions.date, date)
      )
    );

  const totalValue = parseFloat(result[0]?.totalValue || "0");
  const transactionCount = result[0]?.count || 0;

  // Skip if no transactions match the criteria (date filter)
  if (transactionCount === 0) {
    return { created: false, totalValue: 0 };
  }

  // If totalValue is 0, check if there are transactions after this date
  // Only create 0-value snapshot if this represents a real state (had value before or will have after)
  if (totalValue === 0) {
    const futureTransactions = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.portfolioId, portfolioId),
          eq(transactions.status, "approved"),
          eq(transactions.type, "buy"),
          gt(transactions.date, date)
        )
      );

    const hasFutureTransactions = (futureTransactions[0]?.count || 0) > 0;

    // Skip snapshot if value is 0 and there are future transactions
    // (means we're creating a snapshot before any transactions existed)
    if (hasFutureTransactions) {
      return { created: false, totalValue: 0 };
    }
  }

  let shouldCreate = totalValue > 0;

  if (totalValue === 0) {
    const lastSnapshot = await db.query.portfolioSnapshots.findFirst({
      where: eq(portfolioSnapshots.portfolioId, portfolioId),
      orderBy: (snapshots, { desc }) => [desc(snapshots.date)],
    });

    const lastValue = lastSnapshot ? parseFloat(lastSnapshot.totalValue) : null;

    if (lastValue !== null && lastValue > 0) {
      shouldCreate = true;
    } else if ((source === "manual" || source === "admin_enforce") && lastValue !== 0) {
      shouldCreate = true;
    }
  }

  if (shouldCreate) {
    await db.insert(portfolioSnapshots).values({
      portfolioId,
      date,
      totalValue: totalValue.toFixed(2),
      source,
    });

    return { created: true, totalValue };
  }

  return { created: false, totalValue };
}
