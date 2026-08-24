import type { TripPriceUnit } from "@/types/travel";

export type PricedItem = {
  price: string | null;
  priceMax: string | null;
  priceUnit: TripPriceUnit;
  scheduledOn: string | null;
  endsOn: string | null;
  /** Who is on it. Empty (or absent) means the whole party. */
  attendeeIds?: string[];
};

/**
 * Nights between check-in and check-out.
 *
 * Nights, not days: a stay from the 15th to the 17th is two nights, and
 * charging three would overstate every hotel by one night. A missing or
 * backwards range is one night rather than zero — an unpriced stay is a gap in
 * the plan, but a free one is a lie.
 */
export function nightsBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 1;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  const nights = Math.round((end - start) / 86_400_000);
  return nights > 0 ? nights : 1;
}

/**
 * How many times an item's unit price applies.
 *
 * A per-person price counts the people it is FOR, not everybody on the trip:
 * a fare for one traveller multiplied by four is three fares nobody is taking.
 */
export function multiplier(item: PricedItem, partySize: number): number {
  switch (item.priceUnit) {
    case "per_night":
      return nightsBetween(item.scheduledOn, item.endsOn);
    case "per_person":
      return Math.max(1, item.attendeeIds?.length || partySize);
    default:
      return 1;
  }
}

export type ItemCost = {
  /** Unit price as entered. */
  unitLow: number | null;
  unitHigh: number | null;
  /** What it actually costs once the unit is applied. */
  low: number;
  high: number;
  times: number;
  ranged: boolean;
};

export function itemCost(item: PricedItem, partySize: number): ItemCost {
  const unitLow = item.price === null ? null : Number(item.price);
  const unitHigh = item.priceMax === null ? null : Number(item.priceMax);
  const low = Number.isFinite(unitLow as number) ? (unitLow as number) : 0;
  // A missing upper bound means the price IS the estimate, not that the upper
  // bound is zero.
  const high =
    unitHigh !== null && Number.isFinite(unitHigh) && unitHigh > low ? unitHigh : low;
  const times = multiplier(item, partySize);

  return {
    unitLow: Number.isFinite(unitLow as number) ? unitLow : null,
    unitHigh: unitHigh !== null && Number.isFinite(unitHigh) ? unitHigh : null,
    low: low * times,
    high: high * times,
    times,
    ranged: high > low,
  };
}

export type TripCost = {
  low: number;
  high: number;
  ranged: boolean;
  /** True when any figure depends on how many people are going. */
  perPerson: boolean;
};

export function tripCost(items: PricedItem[], partySize: number): TripCost {
  let low = 0;
  let high = 0;
  let perPerson = false;
  for (const item of items) {
    if (item.price === null) continue;
    const cost = itemCost(item, partySize);
    low += cost.low;
    high += cost.high;
    if (item.priceUnit === "per_person") perPerson = true;
  }
  return { low, high, ranged: high > low, perPerson };
}

/** "per night", "per person", or nothing at all for a plain total. */
export function unitSuffix(unit: TripPriceUnit): string {
  if (unit === "per_night") return "/ night";
  if (unit === "per_person") return "/ person";
  return "";
}
