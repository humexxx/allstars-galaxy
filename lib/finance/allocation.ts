/**
 * Turning contributions into positions.
 *
 * A method declares an allocation — "every dollar that arrives goes 100% into
 * Cardano", or 50/50 across two assets. When money lands, that rule plus the
 * asset's price *on that day* fixes how many units were bought, permanently.
 *
 * The split between rule and fact matters. Editing the allocation changes
 * where FUTURE money goes; it must never rewrite what past contributions
 * already bought, or the owner's position would silently rewrite itself every
 * time they changed their mind.
 */

export type Allocation = { assetId: string; percent: number };

/** Percentages must land on 100 — anything else means money with nowhere to go. */
export const ALLOCATION_TOLERANCE = 0.001;

export function allocationTotal(allocations: Allocation[]): number {
  return allocations.reduce((sum, a) => sum + a.percent, 0);
}

export function isCompleteAllocation(allocations: Allocation[]): boolean {
  if (allocations.length === 0) return false;
  return Math.abs(allocationTotal(allocations) - 100) <= ALLOCATION_TOLERANCE;
}

export type ContributionSplit = {
  assetId: string;
  amount: number;
};

/**
 * Divide one contribution across the method's assets.
 *
 * The last slice absorbs the rounding remainder so the parts always sum back
 * to the original amount to the cent. Distributing it evenly instead would
 * leave the position short by fractions that compound across many
 * contributions.
 */
export function splitContribution(
  amount: number,
  allocations: Allocation[]
): ContributionSplit[] {
  if (allocations.length === 0) return [];

  const out: ContributionSplit[] = [];
  let assigned = 0;

  allocations.forEach((a, i) => {
    const isLast = i === allocations.length - 1;
    const slice = isLast
      ? round2(amount - assigned)
      : round2((amount * a.percent) / 100);
    assigned = round2(assigned + slice);
    out.push({ assetId: a.assetId, amount: slice });
  });

  return out;
}

/**
 * Units bought (or sold) for a cash amount at a given price.
 *
 * `direction` is what makes a withdrawal reduce the position: it sells units
 * at that day's price rather than removing a cash figure from a unit count.
 */
export function unitsFor(
  amount: number,
  price: number,
  direction: "buy" | "withdrawal"
): number {
  if (!(price > 0)) return 0;
  const units = amount / price;
  return direction === "withdrawal" ? -units : units;
}

/** Net position per asset across every priced contribution. */
export function netPositions(
  entries: { assetId: string; quantity: number; amount: number }[]
): Map<string, { quantity: number; invested: number }> {
  const out = new Map<string, { quantity: number; invested: number }>();
  for (const e of entries) {
    const cur = out.get(e.assetId) ?? { quantity: 0, invested: 0 };
    cur.quantity += e.quantity;
    cur.invested += e.amount;
    out.set(e.assetId, cur);
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
