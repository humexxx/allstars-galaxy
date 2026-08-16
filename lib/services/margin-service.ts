import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { methodHoldings, priceAssets } from "@/db/schema";
import {
  computeMethodMargin,
  splitLiability,
  totalMargin,
  type MarginHolding,
  type MethodMargin,
} from "@/lib/finance/margin";
import { getMethodInvestors } from "./portfolio-service";
import { getLatestPrices } from "./price-service";

export type MarginOverview = {
  methods: MethodMargin[];
  totals: ReturnType<typeof totalMargin>;
  /** True when nothing has been configured yet — the UI shows an empty state
   *  rather than a pile of zeroes that look like a loss. */
  unconfigured: boolean;
};

/**
 * What the owner of the investment methods is really making.
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

  const holdingRows = await db
    .select({
      id: methodHoldings.id,
      methodId: methodHoldings.methodId,
      assetId: methodHoldings.assetId,
      quantity: methodHoldings.quantity,
      costBasis: methodHoldings.costBasis,
      note: methodHoldings.note,
      symbol: priceAssets.symbol,
      name: priceAssets.name,
    })
    .from(methodHoldings)
    .innerJoin(priceAssets, eq(methodHoldings.assetId, priceAssets.id))
    .where(inArray(methodHoldings.methodId, methodIds));

  const prices = await getLatestPrices([...new Set(holdingRows.map((h) => h.assetId))]);

  const byMethod = new Map<string, MarginHolding[]>();
  for (const h of holdingRows) {
    const list = byMethod.get(h.methodId) ?? [];
    list.push({
      id: h.id,
      assetId: h.assetId,
      symbol: h.symbol,
      name: h.name,
      quantity: parseFloat(h.quantity),
      price: prices.get(h.assetId) ?? null,
      costBasis: parseFloat(h.costBasis),
    });
    byMethod.set(h.methodId, list);
  }

  const computed = methods.map((m) => {
    const { liability, ownPosition } = splitLiability(m.investors, ownerUserId);
    return computeMethodMargin({
      methodId: m.methodId,
      methodName: m.methodName,
      liability,
      ownPosition,
      holdings: byMethod.get(m.methodId) ?? [],
    });
  });

  return {
    methods: computed,
    totals: totalMargin(computed),
    unconfigured: holdingRows.length === 0,
  };
}

/** Holdings for one method, for the configuration screen. */
export async function getMethodHoldings(methodId: string) {
  const rows = await db
    .select({
      id: methodHoldings.id,
      assetId: methodHoldings.assetId,
      quantity: methodHoldings.quantity,
      costBasis: methodHoldings.costBasis,
      note: methodHoldings.note,
      symbol: priceAssets.symbol,
      name: priceAssets.name,
      source: priceAssets.source,
    })
    .from(methodHoldings)
    .innerJoin(priceAssets, eq(methodHoldings.assetId, priceAssets.id))
    .where(eq(methodHoldings.methodId, methodId));

  const prices = await getLatestPrices(rows.map((r) => r.assetId));

  return rows.map((r) => ({
    ...r,
    quantity: parseFloat(r.quantity),
    costBasis: parseFloat(r.costBasis),
    price: prices.get(r.assetId) ?? null,
  }));
}
