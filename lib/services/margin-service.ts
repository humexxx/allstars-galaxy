import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  investmentMethods,
  methodAllocations,
  portfolios,
  priceAssets,
  priceQuotes,
  transactions,
  users,
} from "@/db/schema";

import {
  computeMethodMargin,
  splitLiability,
  totalMargin,
  type MarginHolding,
} from "@/lib/finance/margin";
import { netPositions } from "@/lib/finance/allocation";
import { buildMarginHistory, type MarginPoint } from "@/lib/finance/margin-history";
import type {
  InvestorBreakdown,
  ManagedOverview,
  MarginHistoryInput,
  MarginOverview,
} from "@/types/margin";
import { getDerivedHoldings, type DerivedHoldingRow } from "./allocation-service";
import { getMethodInvestors } from "./portfolio-service";

export type {
  InvestorBreakdown,
  ManagedOverview,
  MarginHistoryInput,
  MarginOverview,
} from "@/types/margin";

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
      historyInput: {
        contributions: [],
        liabilities: [],
        prices: [],
        today: new Date().toISOString().slice(0, 7),
        investors: [],
        methods: [],
      },
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

  // Which investor each allocation belongs to, so the chart can filter by
  // person: allocations carry a transaction, and a transaction carries an
  // investor.
  const investorByTx = new Map(txRows.map((t) => [t.txId, t.investorId]));
  const today = new Date().toISOString().slice(0, 7);

  const historyInput: MarginHistoryInput = {
    contributions: allocRows.map((r) => ({
      month: new Date(r.pricedOn).toISOString().slice(0, 7),
      assetId: r.assetId,
      quantity: parseFloat(r.quantity),
      amount: parseFloat(r.amount),
      investorId: investorByTx.get(r.transactionId) ?? "",
      methodId: r.methodId,
    })),
    liabilities: txRows.map((t) => ({
      month: new Date(t.date).toISOString().slice(0, 7),
      currentValue: parseFloat(t.currentValue ?? "0"),
      monthlyRoi: roiByMethod.get(t.methodId) ?? 0,
      isOwn: t.investorId === ownerUserId,
      investorId: t.investorId,
      methodId: t.methodId,
    })),
    prices: [...monthly],
    today,
    investors: [
      ...new Map(
        txRows.map((t) => [
          t.investorId,
          {
            id: t.investorId,
            name: t.fullName || t.email?.split("@")[0] || "Unknown",
            isOwn: t.investorId === ownerUserId,
          },
        ])
      ).values(),
    ],
    methods: owned.map((m) => ({ id: m.id, name: m.name })),
  };

  return {
    overview: buildOverview(methodInvestors, allocRows, latest, ownerUserId),
    history: buildHistory(allocRows, txRows, roiByMethod, monthly, ownerUserId),
    historyInput,
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
async function loadQuotes(
  assetIds: string[]
): Promise<{ latest: Map<string, number>; monthly: Map<string, number> }> {
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

type AllocRow = DerivedHoldingRow;
type TxRow = {
  txId: string;
  methodId: string;
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
    const list = byMethod.get(r.methodId) ?? [];
    list.push(r);
    byMethod.set(r.methodId, list);
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
      monthlyRoi: roiByMethod.get(t.methodId) ?? 0,
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
