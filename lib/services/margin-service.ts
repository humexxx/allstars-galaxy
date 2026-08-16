import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  investmentMethods,
  methodAllocations,
  portfolios,
  priceAssets,
  priceQuotes,
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

export type ManagedOverview = {
  overview: MarginOverview;
  history: MarginPoint[];
  investors: InvestorBreakdown[];
  allocations: { methodId: string; allocations: { assetId: string; symbol: string; percent: number }[] }[];
};

/**
 * Everything the Managed tab needs, in two round-trip stages.
 *
 * The three views used to load independently and each re-queried the same
 * owned methods, the same allocations and the same quotes — eleven round
 * trips, several of them sequential. Against a remote pooler where opening a
 * connection costs ~850ms and each query ~86ms, that was seconds of latency
 * for data that is one small read.
 *
 * Now: one query for the owned methods, then everything else concurrently off
 * that, and the maths runs in memory. Latest AND monthly prices come from a
 * single pass over the quotes rather than two queries.
 */
export async function getManagedOverview(ownerUserId: string): Promise<ManagedOverview> {
  const owned = await db
    .select({
      id: investmentMethods.id,
      name: investmentMethods.name,
      monthlyRoi: investmentMethods.monthlyRoi,
    })
    .from(investmentMethods)
    .where(eq(investmentMethods.ownerUserId, ownerUserId));

  if (owned.length === 0) {
    return {
      overview: { methods: [], totals: totalMargin([]), unconfigured: true },
      history: [],
      investors: [],
      allocations: [],
    };
  }

  const methodIds = owned.map((m) => m.id);
  const roiByMethod = new Map(owned.map((m) => [m.id, parseFloat(m.monthlyRoi) / 100]));

  const [methodInvestors, allocRows, txRows, policyRows] = await Promise.all([
    getMethodInvestors(ownerUserId),
    getDerivedHoldings(methodIds),
    db
      .select({
        txId: transactions.id,
        methodId: transactions.investmentMethodId,
        date: transactions.date,
        initialValue: transactions.initialValue,
        currentValue: transactions.currentValue,
        investorId: portfolios.userId,
        fullName: users.fullName,
        email: users.email,
      })
      .from(transactions)
      .innerJoin(portfolios, eq(transactions.portfolioId, portfolios.id))
      .innerJoin(users, eq(portfolios.userId, users.id))
      .where(
        and(
          inArray(transactions.investmentMethodId, methodIds),
          eq(transactions.status, "approved"),
          eq(transactions.type, "buy")
        )
      ),
    db
      .select({
        methodId: methodAllocations.methodId,
        assetId: methodAllocations.assetId,
        percent: methodAllocations.percent,
        symbol: priceAssets.symbol,
      })
      .from(methodAllocations)
      .innerJoin(priceAssets, eq(methodAllocations.assetId, priceAssets.id))
      .where(inArray(methodAllocations.methodId, methodIds)),
  ]);

  const assetIds = [...new Set(allocRows.map((r) => r.assetId))];
  const { latest, monthly } = await loadQuotes(assetIds);

  return {
    overview: buildOverview(methodInvestors, allocRows, latest, ownerUserId),
    history: buildHistory(allocRows, txRows, roiByMethod, monthly, ownerUserId),
    investors: buildInvestors(txRows, allocRows, latest, ownerUserId),
    allocations: owned.map((m) => ({
      methodId: m.id,
      allocations: policyRows
        .filter((p) => p.methodId === m.id)
        .map((p) => ({
          assetId: p.assetId,
          symbol: p.symbol,
          percent: parseFloat(p.percent),
        })),
    })),
  };
}

/** Latest and month-end prices from ONE pass over the quote rows. */
async function loadQuotes(assetIds: string[]) {
  const latest = new Map<string, number>();
  const monthly = new Map<string, number>();
  if (assetIds.length === 0) return { latest, monthly };

  const quotes = await db
    .select()
    .from(priceQuotes)
    .where(inArray(priceQuotes.assetId, assetIds))
    .orderBy(priceQuotes.fetchedAt);

  // Ascending: the last row per asset is the newest, and the last row per
  // month is that month's close.
  for (const q of quotes) {
    const price = parseFloat(q.price);
    latest.set(q.assetId, price);
    monthly.set(`${q.assetId}|${q.fetchedAt.toISOString().slice(0, 7)}`, price);
  }
  return { latest, monthly };
}

type AllocRow = Awaited<ReturnType<typeof getDerivedHoldings>>[number];
type TxRow = {
  txId: string;
  methodId: string | null;
  date: Date | string;
  initialValue: string | null;
  currentValue: string | null;
  investorId: string;
  fullName: string | null;
  email: string | null;
};

function buildOverview(
  methods: Awaited<ReturnType<typeof getMethodInvestors>>,
  allocRows: AllocRow[],
  prices: Map<string, number>,
  ownerUserId: string
): MarginOverview {
  const byMethod = new Map<string, AllocRow[]>();
  for (const r of allocRows) {
    const list = byMethod.get(r.methodId!) ?? [];
    list.push(r);
    byMethod.set(r.methodId!, list);
  }

  const computed = methods.map((m) => {
    const list = byMethod.get(m.methodId) ?? [];
    const meta = new Map(list.map((r) => [r.assetId, { symbol: r.symbol, name: r.name }]));
    const positions = netPositions(
      list.map((r) => ({
        assetId: r.assetId,
        quantity: parseFloat(r.quantity),
        amount: parseFloat(r.amount),
      }))
    );

    const holdings: MarginHolding[] = [...positions]
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

    const { liability, ownPosition } = splitLiability(m.investors, ownerUserId);
    return computeMethodMargin({
      methodId: m.methodId,
      methodName: m.methodName,
      liability,
      ownPosition,
      holdings,
    });
  });

  return {
    methods: computed,
    totals: totalMargin(computed),
    unconfigured: allocRows.length === 0,
  };
}

function buildHistory(
  allocRows: AllocRow[],
  txRows: TxRow[],
  roiByMethod: Map<string, number>,
  monthly: Map<string, number>,
  ownerUserId: string
): MarginPoint[] {
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
    prices: monthly,
    today: new Date().toISOString().slice(0, 7),
  });
}

function buildInvestors(
  txRows: TxRow[],
  allocRows: AllocRow[],
  prices: Map<string, number>,
  ownerUserId: string
): InvestorBreakdown[] {
  const allocByTx = new Map<string, AllocRow[]>();
  for (const r of allocRows) {
    const list = allocByTx.get(r.transactionId) ?? [];
    list.push(r);
    allocByTx.set(r.transactionId, list);
  }

  const byInvestor = new Map<string, InvestorBreakdown>();

  for (const t of txRows) {
    if (!byInvestor.has(t.investorId)) {
      byInvestor.set(t.investorId, {
        investorId: t.investorId,
        name: t.fullName || t.email?.split("@")[0] || "Unknown",
        isOwn: t.investorId === ownerUserId,
        contributed: 0,
        owed: 0,
        positions: [],
        positionValue: 0,
        profitLoss: 0,
      });
    }
    const inv = byInvestor.get(t.investorId)!;
    inv.contributed += parseFloat(t.initialValue ?? "0");
    inv.owed += parseFloat(t.currentValue ?? "0");

    for (const a of allocByTx.get(t.txId) ?? []) {
      const existing = inv.positions.find((p) => p.symbol === a.symbol);
      if (existing) {
        existing.quantity += parseFloat(a.quantity);
        existing.invested += parseFloat(a.amount);
      } else {
        inv.positions.push({
          symbol: a.symbol,
          name: a.name,
          quantity: parseFloat(a.quantity),
          invested: parseFloat(a.amount),
          price: prices.get(a.assetId) ?? null,
          value: null,
        });
      }
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
