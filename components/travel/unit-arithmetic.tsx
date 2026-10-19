import { Mono } from "@/components/ui/typography";
import { formatTripMoney } from "@/lib/travel/format";
import { unitSuffix } from "@/lib/travel/pricing";
import type { TripPriceUnit } from "@/types/travel";

/**
 * The line under a figure a unit was applied to: "$120 / night × 3", or a
 * bare "/ night" when it applies once.
 *
 * Show the arithmetic. A hotel that reads $400 when you typed $200 looks wrong
 * until you can see the x2. The planner and the shared page both print it from
 * here: the shared page once wrote its own, and printed a three-night total
 * over a bare "/ night", which reads as the nightly rate.
 */
export function UnitArithmetic({
  low,
  high,
  unit,
  times,
  currency,
}: {
  /** The price per unit as entered; a `high` above it makes it a range. */
  low: number;
  high: number;
  unit: TripPriceUnit;
  /** Nights, or the travellers a fare is for. */
  times: number;
  currency: string;
}) {
  if (times > 1) {
    return (
      <Mono className="block whitespace-nowrap text-2xs text-muted-foreground">
        {formatTripMoney(low, currency)}
        {high > low && <>~{formatTripMoney(high, currency)}</>}{" "}
        {unitSuffix(unit)} × {times}
      </Mono>
    );
  }
  if (unit === "total") return null;
  return <Mono className="block text-2xs text-muted-foreground">{unitSuffix(unit)}</Mono>;
}
