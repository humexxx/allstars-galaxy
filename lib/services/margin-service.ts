import "server-only";

import {
  computeMethodMargin,
  splitLiability,
  totalMargin,
  type MarginHolding,
  type MethodMargin,
} from "@/lib/finance/margin";
import { netPositions } from "@/lib/finance/allocation";
import { getDerivedHoldings } from "./allocation-service";
import { getMethodInvestors } from "./portfolio-service";
import { getLatestPrices } from "./price-service";

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
