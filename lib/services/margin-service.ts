import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  investmentMethods,
  portfolios,
  priceAssets,
  transactionAllocations,
  transactions,
  users,
} from "@/db/schema";

import {
  computeMethodMargin,
  splitLiability,
  totalMargin,
  type MarginHolding,
  type MethodMargin,
} from "@/lib/finance/margin";
import { netPositions } from "@/lib/finance/allocation";
import { buildMarginHistory, type MarginPoint } from "@/lib/finance/margin-history";
import { getDerivedHoldings } from "./allocation-service";
import { getMethodInvestors } from "./portfolio-service";
import { getLatestPrices, getMonthlyPrices } from "./price-service";

export type MarginOverview = {
  methods: MethodMargin[];
  totals: ReturnType<typeof totalMargin>;
  /** True when nothing has been priced yet — the UI shows an empty state
   *  rather than a pile of zeroes that look like a total loss. */
  unconfigured: boolean;
};

/**
 * What the owner of the investment methods is really making.
 *
 * Positions are DERIVED, never typed in: each contribution was split by the
 * method's allocation and priced at the day it landed, so the unit count is a
 * consequence of real money and real historical prices. Editing the allocation
 * changes where future money goes and leaves the past alone.
 *
 * The owner's own money in their own method is capital, not liability — you
 * cannot owe yourself a fixed return. It is carried separately as
 * `ownPosition` so the margin answers the question that matters: after paying
 * everyone else what they were promised, what is left.
 */
export async function getMarginOverview(ownerUserId: string): Promise<MarginOverview> {
  const methods = await getMethodInvestors(ownerUserId);
  if (methods.length === 0) {
    return { methods: [], totals: totalMargin([]), unconfigured: true };
  }

  const methodIds = methods.map((m) => m.methodId);
  const rows = await getDerivedHoldings(methodIds);
  const prices = await getLatestPrices([...new Set(rows.map((r) => r.assetId))]);

  // Group first by method, then net each asset across that method's
  // contributions — a withdrawal cancels units bought earlier.
  const byMethod = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byMethod.get(r.methodId!) ?? [];
    list.push(r);
    byMethod.set(r.methodId!, list);
  }

  const holdingsFor = (methodId: string): MarginHolding[] => {
    const list = byMethod.get(methodId) ?? [];
    const meta = new Map(list.map((r) => [r.assetId, { symbol: r.symbol, name: r.name }]));
    const positions = netPositions(
      list.map((r) => ({
        assetId: r.assetId,
        quantity: parseFloat(r.quantity),
        amount: parseFloat(r.amount),
      }))
    );

    return [...positions]
      // A fully-exited position nets to zero units; showing it as a row would
      // clutter the table with things no longer held.
      .filter(([, p]) => Math.abs(p.quantity) > 1e-8)
      .map(([assetId, p]) => ({
        id: assetId,
        assetId,
        symbol: meta.get(assetId)?.symbol ?? "?",
        name: meta.get(assetId)?.name ?? "Unknown asset",
        quantity: p.quantity,
        price: prices.get(assetId) ?? null,
        costBasis: p.invested,
      }));
  };

  const computed = methods.map((m) => {
    const { liability, ownPosition } = splitLiability(m.investors, ownerUserId);
    return computeMethodMargin({
      methodId: m.methodId,
      methodName: m.methodName,
      liability,
      ownPosition,
      holdings: holdingsFor(m.methodId),
    });
  });

  return {
    methods: computed,
    totals: totalMargin(computed),
    unconfigured: rows.length === 0,
  };
}

/**
 * The margin month by month, for the area chart.
 *
 * Reads prices from `price_quotes` rather than calling the provider: the
 * history is backfilled once (see `backfillHistoricalQuotes`) so rendering
 * this page never spends an API call against the 5 req/min free tier.
 */
export async function getMarginHistory(ownerUserId: string): Promise<MarginPoint[]> {
  const owned = await db
    .select({ id: investmentMethods.id, monthlyRoi: investmentMethods.monthlyRoi })
    .from(investmentMethods)
    .where(eq(investmentMethods.ownerUserId, ownerUserId));
  if (owned.length === 0) return [];

  const methodIds = owned.map((m) => m.id);
  const roiByMethod = new Map(owned.map((m) => [m.id, parseFloat(m.monthlyRoi) / 100]));

  const [allocRows, txRows] = await Promise.all([
    getDerivedHoldings(methodIds),
    db
      .select({
        methodId: transactions.investmentMethodId,
        date: transactions.date,
        currentValue: transactions.currentValue,
        investorId: portfolios.userId,
      })
      .from(transactions)
      .innerJoin(portfolios, eq(transactions.portfolioId, portfolios.id))
      .where(
        and(
          inArray(transactions.investmentMethodId, methodIds),
          eq(transactions.status, "approved"),
          eq(transactions.type, "buy")
        )
      ),
  ]);

  const prices = await getMonthlyPrices([...new Set(allocRows.map((r) => r.assetId))]);
  const today = new Date().toISOString().slice(0, 7);

  return buildMarginHistory({
    contributions: allocRows.map((r) => ({
      month: new Date(r.pricedOn).toISOString().slice(0, 7),
      assetId: r.assetId,
      quantity: parseFloat(r.quantity),
      amount: parseFloat(r.amount),
    })),
    liabilities: txRows.map((t) => ({
      month: new Date(t.date).toISOString().slice(0, 7),
      currentValue: parseFloat(t.currentValue ?? "0"),
      monthlyRoi: roiByMethod.get(t.methodId!) ?? 0,
      isOwn: t.investorId === ownerUserId,
    })),
    prices,
    today,
  });
}

export type InvestorBreakdown = {
  investorId: string;
  name: string;
  isOwn: boolean;
  /** Cash they put in. */
  contributed: number;
  /** What they are owed today — their promised return, compounded. */
  owed: number;
  /** What their share of the pooled capital actually bought. */
  positions: {
    symbol: string;
    name: string;
    quantity: number;
    invested: number;
    price: number | null;
    value: number | null;
  }[];
  /** Present value of those positions, null when any price is missing. */
  positionValue: number;
  /** positionValue - owed. Negative means their promise costs more than their
   *  money earned. */
  profitLoss: number;
};

/**
 * Per-person view: what each investor put in, what they are owed, and what
 * their money actually bought.
 *
 * Their positions are not a pro-rata slice of the pool — each of their own
 * contributions was priced on its own date, so this is exactly what their
 * money bought, not an average.
 */
export async function getInvestorBreakdown(
  ownerUserId: string
): Promise<InvestorBreakdown[]> {
  const owned = await db
    .select({ id: investmentMethods.id })
    .from(investmentMethods)
    .where(eq(investmentMethods.ownerUserId, ownerUserId));
  if (owned.length === 0) return [];
  const methodIds = owned.map((m) => m.id);

  const rows = await db
    .select({
      txId: transactions.id,
      investorId: portfolios.userId,
      fullName: users.fullName,
      email: users.email,
      initialValue: transactions.initialValue,
      currentValue: transactions.currentValue,
      quantity: transactionAllocations.quantity,
      amount: transactionAllocations.amount,
      assetId: transactionAllocations.assetId,
      symbol: priceAssets.symbol,
      assetName: priceAssets.name,
    })
    .from(transactions)
    .innerJoin(portfolios, eq(transactions.portfolioId, portfolios.id))
    .innerJoin(users, eq(portfolios.userId, users.id))
    .leftJoin(
      transactionAllocations,
      eq(transactionAllocations.transactionId, transactions.id)
    )
    .leftJoin(priceAssets, eq(transactionAllocations.assetId, priceAssets.id))
    .where(
      and(
        inArray(transactions.investmentMethodId, methodIds),
        eq(transactions.status, "approved"),
        eq(transactions.type, "buy")
      )
    );

  const prices = await getLatestPrices([
    ...new Set(rows.map((r) => r.assetId).filter((a): a is string => !!a)),
  ]);

  const byInvestor = new Map<string, InvestorBreakdown>();
  // A transaction appears once per allocated asset, so its cash figures must
  // only be counted on the first row or they multiply by the asset count.
  const countedTx = new Set<string>();

  for (const r of rows) {
    const key = r.investorId;
    if (!byInvestor.has(key)) {
      byInvestor.set(key, {
        investorId: key,
        name: r.fullName || r.email?.split("@")[0] || "Unknown",
        isOwn: key === ownerUserId,
        contributed: 0,
        owed: 0,
        positions: [],
        positionValue: 0,
        profitLoss: 0,
      });
    }
    const inv = byInvestor.get(key)!;

    // Keyed on the transaction id, not its amounts: two contributions of the
    // same size would otherwise collide and one would vanish from the totals.
    if (!countedTx.has(r.txId)) {
      countedTx.add(r.txId);
      inv.contributed += parseFloat(r.initialValue ?? "0");
      inv.owed += parseFloat(r.currentValue ?? "0");
    }

    if (!r.assetId || !r.symbol) continue;
    const qty = parseFloat(r.quantity ?? "0");
    const existing = inv.positions.find((p) => p.symbol === r.symbol);
    if (existing) {
      existing.quantity += qty;
      existing.invested += parseFloat(r.amount ?? "0");
    } else {
      inv.positions.push({
        symbol: r.symbol,
        name: r.assetName ?? r.symbol,
        quantity: qty,
        invested: parseFloat(r.amount ?? "0"),
        price: prices.get(r.assetId) ?? null,
        value: null,
      });
    }
  }

  for (const inv of byInvestor.values()) {
    inv.positionValue = 0;
    for (const p of inv.positions) {
      p.value = p.price === null ? null : p.quantity * p.price;
      inv.positionValue += p.value ?? 0;
    }
    inv.profitLoss = inv.positionValue - inv.owed;
  }

  return [...byInvestor.values()].sort((a, b) => b.contributed - a.contributed);
}
