import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  investmentMethods,
  methodAllocations,
  priceAssets,
  transactionAllocations,
  transactions,
} from "@/db/schema";
import {
  isCompleteAllocation,
  splitContribution,
  unitsFor,
  type Allocation,
} from "@/lib/finance/allocation";
import {
  closeOnOrBefore,
  fetchDailyCloses,
  MASSIVE_CALLS_PER_RUN,
  type HistoricalBar,
} from "./price-providers/massive";

export type MethodAllocationRow = {
  assetId: string;
  symbol: string;
  name: string;
  percent: number;
};

/** Replace a method's policy wholesale — partial edits would leave gaps. */
export async function setMethodAllocations(
  methodId: string,
  allocations: Allocation[]
): Promise<void> {
  if (allocations.length > 0 && !isCompleteAllocation(allocations)) {
    throw new Error("Allocations must total 100%");
  }
  await db.transaction(async (tx) => {
    await tx.delete(methodAllocations).where(eq(methodAllocations.methodId, methodId));
    if (allocations.length > 0) {
      await tx.insert(methodAllocations).values(
        allocations.map((a) => ({
          methodId,
          assetId: a.assetId,
          percent: a.percent.toFixed(3),
        }))
      );
    }
  });
}

export type BackfillResult = {
  priced: number;
  skipped: number;
  errors: string[];
};

/** A backfill plus the Massive requests it spent, for a run that shares the budget. */
export type BackfillRun = BackfillResult & { massiveCalls: number };

/**
 * Price every settled contribution to `ownerUserId`'s methods that is missing
 * allocation rows.
 *
 * Runs against history, not live prices: each contribution is valued at its
 * own date, so the resulting position is what the money would really have
 * bought. Already-priced rows are never touched — the whole point of storing
 * `priceAtPurchase` is that it stops being a question.
 *
 * Rejected and pending transactions are excluded: no money moved, so nothing
 * was bought.
 */
export async function backfillTransactionAllocations(
  ownerUserId: string
): Promise<BackfillResult> {
  const owned = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(eq(investmentMethods.ownerUserId, ownerUserId));

  const { priced, skipped, errors } = await backfillMethods(owned.map((m) => m.id));
  return { priced, skipped, errors };
}

/**
 * Price outstanding contributions for every method owner.
 *
 * The price cron runs this so a contribution approved between runs does not
 * sit unpriced and silently missing from the margin until somebody presses a
 * button. Every owner's methods go through one pass, so each asset's history
 * is fetched once rather than once per owner holding it.
 */
export async function backfillAllOwners(): Promise<BackfillRun> {
  const owned = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(isNotNull(investmentMethods.ownerUserId));

  return backfillMethods(owned.map((m) => m.id));
}

type PricingJob = {
  transactionId: string;
  day: string;
  direction: "buy" | "withdrawal";
  parts: { assetId: string; amount: number }[];
};

async function backfillMethods(methodIds: string[]): Promise<BackfillRun> {
  if (methodIds.length === 0) return { priced: 0, skipped: 0, errors: [], massiveCalls: 0 };

  // One query for every method's policy, grouped in memory — a query per
  // method made this O(methods) round-trips on every backfill.
  const policyRows = await db
    .select({
      methodId: methodAllocations.methodId,
      assetId: methodAllocations.assetId,
      percent: methodAllocations.percent,
      symbol: priceAssets.symbol,
      name: priceAssets.name,
    })
    .from(methodAllocations)
    .innerJoin(priceAssets, eq(methodAllocations.assetId, priceAssets.id))
    .where(inArray(methodAllocations.methodId, methodIds));

  const policies = new Map<string, MethodAllocationRow[]>(
    methodIds.map((id) => [id, []])
  );
  for (const { methodId, ...row } of policyRows) {
    policies.get(methodId)?.push({ ...row, percent: parseFloat(row.percent) });
  }

  const pending = await db
    .select({
      id: transactions.id,
      methodId: transactions.investmentMethodId,
      date: transactions.date,
      type: transactions.type,
      total: transactions.total,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.investmentMethodId, methodIds),
        // The same statuses `getDerivedHoldings` reads. A buy withdrawn to
        // zero flips to "closed"; pricing only "approved" priced its
        // withdrawal alone, so the method held negative units and the buy
        // stayed in the unpriced count forever.
        inArray(transactions.status, ["approved", "closed"])
      )
    );

  // Keyed per (transaction, asset): a split contribution whose second asset's
  // lookup failed has one row, and keying on the transaction alone counted it
  // done, so that half of the money was never priced.
  const existing = new Map<string, Map<string, string>>();
  const existingRows = await db
    .select({
      transactionId: transactionAllocations.transactionId,
      assetId: transactionAllocations.assetId,
      amount: transactionAllocations.amount,
    })
    .from(transactionAllocations);
  for (const r of existingRows) {
    const byAsset = existing.get(r.transactionId) ?? new Map<string, string>();
    byAsset.set(r.assetId, r.amount);
    existing.set(r.transactionId, byAsset);
  }

  const errors: string[] = [];
  let skipped = 0;
  const jobs: PricingJob[] = [];

  for (const t of pending) {
    const priced = existing.get(t.id);
    // Whole once its rows carry all the money that moved, under whatever
    // policy priced them — a later policy edit must not reopen it.
    if (priced && coversTotal(priced, t)) continue;
    const policy = policies.get(t.methodId) ?? [];
    if (policy.length === 0) {
      if (!priced) skipped++;
      continue;
    }
    // splitContribution hands the last slice the remainder, so a policy that
    // does not reach 100% would silently overweight its last asset — forever,
    // since the allocation rows are immutable.
    if (!isCompleteAllocation(policy)) {
      if (!priced) {
        skipped++;
        errors.push(`method ${t.methodId} allocation policy does not total 100%`);
      }
      continue;
    }

    const direction = t.type === "withdrawal" ? "withdrawal" : "buy";
    const parts = splitContribution(parseFloat(t.total), policy).map((p) => ({
      assetId: p.assetId,
      amount: direction === "withdrawal" ? -p.amount : p.amount,
    }));

    let missing = parts;
    if (priced) {
      // Completing a partly-priced contribution is only safe while the policy
      // still splits it the way the rows already stored did. After a policy
      // edit the missing slice would be computed from different percentages
      // and the parts would no longer add up to the money that moved.
      const consistent = [...priced].every(([assetId, amount]) =>
        parts.some((p) => p.assetId === assetId && p.amount.toFixed(2) === parseFloat(amount).toFixed(2))
      );
      if (!consistent) {
        skipped++;
        errors.push(`transaction ${t.id} is partly priced under a different allocation policy`);
        continue;
      }
      missing = parts.filter((p) => !priced.has(p.assetId));
    }
    if (missing.length === 0) continue;

    jobs.push({
      transactionId: t.id,
      day: new Date(t.date).toISOString().slice(0, 10),
      direction,
      parts: missing,
    });
  }

  if (jobs.length === 0) {
    const nothingConfigured = pending.length > 0 && policyRows.length === 0;
    return {
      priced: 0,
      skipped: skipped > 0 ? skipped : pending.length,
      errors: nothingConfigured ? ["no allocation configured", ...errors] : errors,
      massiveCalls: 0,
    };
  }

  const assetIds = new Set(jobs.flatMap((j) => j.parts.map((p) => p.assetId)));
  const dates = jobs.map((j) => j.day).sort();
  const from = shiftDays(dates[0], -7); // cushion for weekends before the first buy
  const to = dates[dates.length - 1];

  const assets = await db
    .select()
    .from(priceAssets)
    .where(inArray(priceAssets.id, [...assetIds]));
  const symbols = new Map(assets.map((a) => [a.id, a.symbol]));

  // One history request per asset covering the full span of contributions,
  // rather than one per contribution, capped at the run's Massive budget.
  const history = new Map<string, HistoricalBar[]>();
  let massiveCalls = 0;

  for (const asset of assets) {
    // Only Massive serves history here. Asking it for a CoinGecko id
    // ("bitcoin") spent a request on a ticker that cannot exist.
    if (asset.source !== "massive") {
      errors.push(`${asset.symbol}: historical pricing unsupported for source ${asset.source}`);
      continue;
    }
    if (!asset.externalId) {
      errors.push(`${asset.symbol} has no provider id`);
      continue;
    }
    if (massiveCalls >= MASSIVE_CALLS_PER_RUN) {
      errors.push(`${asset.symbol}: rate limit, history deferred to the next run`);
      continue;
    }
    massiveCalls++;
    const { bars, error } = await fetchDailyCloses(asset.externalId, from, to);
    if (error) errors.push(`${asset.symbol}: ${error}`);
    history.set(asset.id, bars);
  }

  const rows: (typeof transactionAllocations.$inferInsert)[] = [];

  for (const job of jobs) {
    for (const part of job.parts) {
      const bars = history.get(part.assetId);
      const bar = bars ? closeOnOrBefore(bars, job.day) : null;
      if (!bar) {
        // The asset-level reason is already in `errors` when there was no read.
        if (bars) errors.push(`no price for ${symbols.get(part.assetId) ?? "asset"} on ${job.day}`);
        skipped++;
        continue;
      }
      rows.push({
        transactionId: job.transactionId,
        assetId: part.assetId,
        amount: part.amount.toFixed(2),
        priceAtPurchase: bar.close.toFixed(8),
        quantity: unitsFor(Math.abs(part.amount), bar.close, job.direction).toFixed(8),
        pricedOn: new Date(`${bar.day}T00:00:00.000Z`),
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(transactionAllocations).values(rows).onConflictDoNothing();
  }

  return { priced: rows.length, skipped, errors, massiveCalls };
}

export type DerivedHoldingRow = {
  transactionId: string;
  methodId: string;
  assetId: string;
  quantity: string;
  amount: string;
  priceAtPurchase: string;
  pricedOn: Date;
  symbol: string;
  name: string;
};

/** Positions derived from every priced contribution, grouped by method. */
export async function getDerivedHoldings(methodIds: string[]): Promise<DerivedHoldingRow[]> {
  if (methodIds.length === 0) return [];

  return db
    .select({
      transactionId: transactionAllocations.transactionId,
      methodId: transactions.investmentMethodId,
      assetId: transactionAllocations.assetId,
      quantity: transactionAllocations.quantity,
      amount: transactionAllocations.amount,
      priceAtPurchase: transactionAllocations.priceAtPurchase,
      pricedOn: transactionAllocations.pricedOn,
      symbol: priceAssets.symbol,
      name: priceAssets.name,
    })
    .from(transactionAllocations)
    .innerJoin(transactions, eq(transactionAllocations.transactionId, transactions.id))
    .innerJoin(priceAssets, eq(transactionAllocations.assetId, priceAssets.id))
    .where(
      and(
        inArray(transactions.investmentMethodId, methodIds),
        // A buy drained by withdrawals flips to "closed" but its units were
        // real; dropping them left the withdrawal's negative units unmatched.
        inArray(transactions.status, ["approved", "closed"])
      )
    );
}

function coversTotal(
  priced: Map<string, string>,
  t: { type: string; total: string }
): boolean {
  const signed = parseFloat(t.total) * (t.type === "withdrawal" ? -1 : 1);
  let sum = 0;
  for (const amount of priced.values()) sum += parseFloat(amount);
  return Math.abs(sum - signed) < 0.005;
}

function shiftDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export type TransactionAllocation = {
  symbol: string;
  name: string;
  /** Units bought, signed. */
  quantity: number;
  /** Cash routed to this asset. */
  invested: number;
  /** The asset's close on the day the money landed — fixed forever. */
  priceAtPurchase: number;
};

/**
 * What each transaction bought, keyed by transaction id.
 *
 * Lets a transaction row show the position it created — units at the price of
 * that day — rather than only the cash that moved. Without it a contribution
 * is just an amount, and the whole point of the model is that the amount
 * became a specific number of units at a specific price.
 */
export async function getAllocationsByTransaction(
  transactionIds: string[]
): Promise<Map<string, TransactionAllocation[]>> {
  const out = new Map<string, TransactionAllocation[]>();
  if (transactionIds.length === 0) return out;

  const rows = await db
    .select({
      transactionId: transactionAllocations.transactionId,
      quantity: transactionAllocations.quantity,
      amount: transactionAllocations.amount,
      priceAtPurchase: transactionAllocations.priceAtPurchase,
      symbol: priceAssets.symbol,
      name: priceAssets.name,
    })
    .from(transactionAllocations)
    .innerJoin(priceAssets, eq(transactionAllocations.assetId, priceAssets.id))
    .where(inArray(transactionAllocations.transactionId, transactionIds));

  for (const r of rows) {
    const list = out.get(r.transactionId) ?? [];
    list.push({
      symbol: r.symbol,
      name: r.name,
      quantity: parseFloat(r.quantity),
      invested: parseFloat(r.amount),
      priceAtPurchase: parseFloat(r.priceAtPurchase),
    });
    out.set(r.transactionId, list);
  }
  return out;
}
