import { itemCost, type PricedItem } from "./pricing";
import { itemConcerns } from "./split";

/**
 * The traveller a view is costed for, or null for the whole trip.
 *
 * `lines` is what `splitTrip` worked out this person owes per item, keyed by
 * item id. Passing the already-split figures down rather than re-deriving them
 * per view is what keeps the banner, the itinerary and the calendar agreeing.
 */
export type ItineraryViewer = {
  /** Null on a public scoped link, where the trip's member ids stay private. */
  memberId: string | null;
  name: string;
  isYou: boolean;
  lines: Map<string, { low: number; high: number }>;
};

/**
 * The plan as one traveller's, or the whole thing.
 *
 * Narrowed on who is ON the item, never on who pays for it. Ana's flight from
 * Mexico is not Jafet's day and should not sit there worth $0; the festival
 * IS Ana's day even though Jason and Jafet cover the package, and filtering on
 * payers took it off her itinerary — which is not where she is.
 */
export function viewerItems<T extends { attendeeIds: string[] }>(
  items: T[],
  viewer: ItineraryViewer | null
): T[] {
  if (!viewer?.memberId) return items;
  const memberId = viewer.memberId;
  return items.filter((item) => itemConcerns(item.attendeeIds, memberId));
}

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
