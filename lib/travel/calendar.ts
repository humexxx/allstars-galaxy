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
export function occupiedRuns(item: CalendarItem): { from: string; to: string }[] {
  if (!item.scheduledOn) return [];
  const end = item.endsOn;
  if (!end || end === item.scheduledOn) return [{ from: item.scheduledOn, to: item.scheduledOn }];
  // A stay runs through; a return trip is two separate days with the whole
  // holiday in between belonging to something else.
  return spansDays(item.category)
    ? [{ from: item.scheduledOn, to: end }]
    : [
        { from: item.scheduledOn, to: item.scheduledOn },
        { from: end, to: end },
      ];
}

export type WeekSegment = {
  item: CalendarItem;
  /** 0–6 within the week. */
  start: number;
  span: number;
  /** False when the run began before this week / continues past it. */
  opensRun: boolean;
  closesRun: boolean;
  /** Which stacked row inside the week this bar sits on. */
  lane: number;
};

/**
 * Lays a week's bars out in lanes so two runs never draw on top of each other.
 *
 * Greedy first-fit over runs sorted by start day, which is what every calendar
 * does: the earliest thing takes the top lane, and anything that would overlap
 * it drops to the next one.
 */
export function layOutWeek(week: string[], items: CalendarItem[]): WeekSegment[] {
  const first = week[0];
  const last = week[6];

  const runs: Omit<WeekSegment, "lane">[] = [];
  for (const item of items) {
    for (const run of occupiedRuns(item)) {
      if (run.to < first || run.from > last) continue;
      const from = run.from < first ? first : run.from;
      const to = run.to > last ? last : run.to;
      runs.push({
        item,
        start: week.indexOf(from),
        span: week.indexOf(to) - week.indexOf(from) + 1,
        opensRun: run.from >= first,
        closesRun: run.to <= last,
      });
    }
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

/**
 * Keeps a busy day from swallowing the month.
 *
 * The cell grows a lane at a time, which is right for the second and third
 * thing on a day and wrong for the eighth: one packed day would stretch every
 * cell in its week to match, and a month of them stops being a month at a
 * glance. Past the cap the tail collapses into a count on the last lane.
 *
 * The count is per DAY, not per week — a run hidden on Tuesday is not hidden
 * on Friday just because it passes through both.
 */
export function capLanes(
  segments: WeekSegment[],
  max: number
): { visible: WeekSegment[]; hidden: WeekSegment[]; hiddenByDay: number[] } {
  const lanes = segments.reduce((n, s) => Math.max(n, s.lane + 1), 0);
  // Collapsing to show "+1 more" in place of the one thing it hides helps
  // nobody, so the cap only bites once something is actually gained.
  if (lanes <= max) {
    return { visible: segments, hidden: [], hiddenByDay: new Array(7).fill(0) };
  }

  const cutoff = max - 1;
  const hiddenByDay = new Array(7).fill(0);
  for (const seg of segments) {
    if (seg.lane < cutoff) continue;
    for (let i = seg.start; i < seg.start + seg.span; i++) hiddenByDay[i] += 1;
  }
  return {
    visible: segments.filter((s) => s.lane < cutoff),
    hidden: segments.filter((s) => s.lane >= cutoff),
    hiddenByDay,
  };
}
