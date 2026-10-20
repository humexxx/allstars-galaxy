import { spansDays } from "./item-fields";
import type { TripItemCategory } from "@/types/travel";

/** Days are compared as YYYY-MM-DD strings — no timezone anywhere near them. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from one ISO day to another; negative when it goes backwards. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  );
}

/** The same day shifted by whole days, still as a local ISO day string. */
export function shiftDay(day: string, delta: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + delta);
  return isoDay(d);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Whole weeks covering one calendar month, Sunday-first. */
export function monthWeeks(month: string): string[][] {
  const [y, m] = month.split("-").map(Number);
  const cursor = new Date(y, m - 1, 1);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const last = new Date(y, m, 0);
  const end = new Date(last);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const weeks: string[][] = [];
  while (cursor <= end) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(isoDay(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export type CalendarItem = {
  id: string;
  title: string;
  category: TripItemCategory;
  scheduledOn: string | null;
  endsOn: string | null;
};

/** The day ranges an item actually occupies. */
export type RunLeg = "only" | "out" | "back";

export function occupiedRuns(
  item: CalendarItem
): { from: string; to: string; leg: RunLeg }[] {
  if (!item.scheduledOn) return [];
  const end = item.endsOn;
  if (!end || end === item.scheduledOn) {
    return [{ from: item.scheduledOn, to: item.scheduledOn, leg: "only" }];
  }
  // A stay runs through; a return trip is two separate days with the whole
  // holiday in between belonging to something else.
  return spansDays(item.category)
    ? [{ from: item.scheduledOn, to: end, leg: "only" as const }]
    : [
        { from: item.scheduledOn, to: item.scheduledOn, leg: "out" as const },
        { from: end, to: end, leg: "back" as const },
      ];
}

/** Any run of whole days, whatever it belongs to. */
export type DayRun<T> = { value: T; from: string; to: string };

export type PackedRun<T> = {
  value: T;
  /** 0–6 within the week. */
  start: number;
  span: number;
  /** False when the run began before this week / continues past it. */
  opensRun: boolean;
  closesRun: boolean;
  /** Which stacked row inside the week this bar sits on. */
  lane: number;
};

export type WeekSegment = Omit<PackedRun<unknown>, "value"> & {
  item: CalendarItem;
  /**
   * Which half of a there-and-back this is.
   *
   * A return flight is two bars, and both of them open a run — so both were
   * printing the fare, and one $600–$800 booking read as $1,200–$1,600 of
   * flights on a month whose itinerary says $600–$800. The price belongs to
   * the outbound bar only.
   */
  leg: RunLeg;
};

/**
 * Lays a week's runs out in lanes so two of them never draw on top of each
 * other.
 *
 * Greedy first-fit over runs sorted by start day, which is what every calendar
 * does: the earliest thing takes the top lane, and anything that would overlap
 * it drops to the next one. Lanes are decided per week, so a run that wraps
 * can sit on a different lane in the next row — Google Calendar does the same.
 */
export function packWeek<T>(week: string[], source: DayRun<T>[]): PackedRun<T>[] {
  const first = week[0];
  const last = week[6];

  const runs: Omit<PackedRun<T>, "lane">[] = [];
  for (const run of source) {
    if (run.to < first || run.from > last) continue;
    const from = run.from < first ? first : run.from;
    const to = run.to > last ? last : run.to;
    const start = week.indexOf(from);
    const span = week.indexOf(to) - start + 1;
    // A range stored backwards would compute a negative span, which loses
    // the column class entirely and records a lane as ending before it
    // starts. Data that nonsensical is dropped rather than drawn.
    if (start < 0 || span < 1) continue;
    runs.push({
      value: run.value,
      start,
      span,
      opensRun: run.from >= first,
      closesRun: run.to <= last,
    });
  }

  runs.sort((a, b) => a.start - b.start || b.span - a.span);

  const laneEnds: number[] = [];
  return runs.map((run) => {
    let lane = laneEnds.findIndex((end) => end <= run.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = run.start + run.span;
    return { ...run, lane };
  });
}

/** How many lanes a packed week needs. */
export function laneCount(runs: { lane: number }[]): number {
  return runs.reduce((n, run) => Math.max(n, run.lane + 1), 0);
}

/** A trip's bars on one week: the trip itself is the run, start to end. */
export function layOutTrips<T extends { startDate: string; endDate: string | null }>(
  week: string[],
  trips: T[]
): PackedRun<T>[] {
  return packWeek(
    week,
    trips.map((trip) => ({ value: trip, from: trip.startDate, to: trip.endDate ?? trip.startDate }))
  );
}

/** An item's bars on one week, each half of a there-and-back on its own. */
export function layOutWeek(week: string[], items: CalendarItem[]): WeekSegment[] {
  const runs = items.flatMap((item) =>
    occupiedRuns(item).map((run) => ({ value: { item, leg: run.leg }, from: run.from, to: run.to }))
  );
  return packWeek(week, runs).map(({ value, ...seg }) => ({ ...seg, ...value }));
}
