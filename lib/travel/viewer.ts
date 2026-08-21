import { itemCost, type PricedItem } from "./pricing";

/**
 * The traveller a view is costed for, or null for the whole trip.
 *
 * `lines` is what `splitTrip` worked out this person owes per item, keyed by
 * item id. Passing the already-split figures down rather than re-deriving them
 * per view is what keeps the banner, the itinerary and the calendar agreeing.
 */
export type ItineraryViewer = {
  name: string;
  isYou: boolean;
  lines: Map<string, { low: number; high: number }>;
};

/** What one item costs the current reader: their share, or the whole thing. */
export function readerCost(
  item: PricedItem & { id: string },
  partySize: number,
  viewer: ItineraryViewer | null
): { low: number; high: number } {
  if (viewer) return viewer.lines.get(item.id) ?? { low: 0, high: 0 };
  const cost = itemCost(item, partySize);
  return { low: cost.low, high: cost.high };
}
