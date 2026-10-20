/**
 * How fresh the prices behind a book are, when the price run is next due, and
 * whether fetching again could return anything newer. Pure, so the page, the
 * refresh action and the tests all get the same answer.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * The shortest gap between two on-demand refreshes, across every user: the
 * Massive key allows 5 requests a minute and the cron spends from the same
 * budget.
 */
export const PRICE_REFRESH_COOLDOWN_MS = 5 * MINUTE_MS;

/** Vercel's Hobby plan may start a daily cron at any point inside its hour. */
const RUN_GRACE_MS = HOUR_MS;

/**
 * Sources whose quotes are a daily close. The refresh path asks Massive for
 * yesterday's bar (`/prev`, or the grouped crypto day), so a second fetch on
 * the same UTC day returns the same close — whatever the plan.
 */
const DAILY_CLOSE_SOURCES = new Set(["massive"]);

const MANUAL = "manual";

/** A UTC cron line this module can reason about: daily or hourly at a fixed minute. */
export type PriceSchedule = { minute: number; hour: number | null };

export type QuoteAge = { assetId: string; source: string; fetchedAt: Date | null };

/**
 * `"30 0 * * *"` → daily at 00:30 UTC, `"30 * * * *"` → hourly at :30.
 * Anything else is null: better no "next update" than a wrong one.
 */
export function parseCronSchedule(expression: string): PriceSchedule | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, ...rest] = fields;
  if (rest.some((field) => field !== "*")) return null;

  const m = cronNumber(minute, 59);
  if (m === null) return null;
  if (hour === "*") return { minute: m, hour: null };
  const h = cronNumber(hour, 23);
  return h === null ? null : { minute: m, hour: h };
}

function cronNumber(field: string, max: number): number | null {
  if (!/^\d{1,2}$/.test(field)) return null;
  const n = Number(field);
  return n <= max ? n : null;
}

function periodOf(schedule: PriceSchedule): number {
  return schedule.hour === null ? HOUR_MS : DAY_MS;
}

/** The first scheduled run strictly after `now`. */
export function nextRunAfter(schedule: PriceSchedule, now: Date): Date {
  const run = new Date(now);
  run.setUTCHours(schedule.hour ?? now.getUTCHours(), schedule.minute, 0, 0);
  while (run.getTime() <= now.getTime()) run.setTime(run.getTime() + periodOf(schedule));
  return run;
}

/** The last scheduled run at or before `now`. */
export function lastRunAtOrBefore(schedule: PriceSchedule, now: Date): Date {
  return new Date(nextRunAfter(schedule, now).getTime() - periodOf(schedule));
}

/**
 * Whether fetching again could return a newer price than the one stored.
 * A daily close is current for the rest of its UTC day; a live source for the
 * length of the cooldown. Manual prices are never fetched.
 */
export function isQuoteCurrent(source: string, fetchedAt: Date | null, now: Date): boolean {
  if (source === MANUAL) return true;
  if (!fetchedAt) return false;
  if (DAILY_CLOSE_SOURCES.has(source)) return utcDay(fetchedAt) === utcDay(now);
  return now.getTime() - fetchedAt.getTime() < PRICE_REFRESH_COOLDOWN_MS;
}

/** When a quote that is current stops being so. */
function newerQuoteAt(source: string, fetchedAt: Date, now: Date): Date {
  if (DAILY_CLOSE_SOURCES.has(source)) {
    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    return midnight;
  }
  return new Date(fetchedAt.getTime() + PRICE_REFRESH_COOLDOWN_MS);
}

/**
 * Which assets a refresh should ask the providers for, and — when none — the
 * earliest moment one of them could have a newer price.
 */
export function planPriceRefresh(
  quotes: QuoteAge[],
  now: Date
): { stale: string[]; newerAt: Date | null } {
  const stale: string[] = [];
  let newerAt: Date | null = null;
  for (const q of quotes) {
    if (q.source === MANUAL) continue;
    if (!q.fetchedAt || !isQuoteCurrent(q.source, q.fetchedAt, now)) {
      stale.push(q.assetId);
      continue;
    }
    const at = newerQuoteAt(q.source, q.fetchedAt, now);
    if (!newerAt || at < newerAt) newerAt = at;
  }
  return { stale, newerAt };
}

/**
 * True when the price run should already have replaced this quote: it is
 * older than the last run that is at least an hour in the past, and fetching
 * now would return something newer.
 */
export function isQuoteOverdue(
  source: string,
  fetchedAt: Date,
  schedule: PriceSchedule,
  now: Date
): boolean {
  if (isQuoteCurrent(source, fetchedAt, now)) return false;
  const expected = lastRunAtOrBefore(schedule, new Date(now.getTime() - RUN_GRACE_MS));
  return fetchedAt.getTime() < expected.getTime();
}

/** "12 min", "3 h", "2 d" — the gap between two instants, unsigned, never under "1 min". */
export function formatSpan(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < MINUTE_MS) return "1 min";
  if (abs < HOUR_MS) return `${Math.floor(abs / MINUTE_MS)} min`;
  if (abs < DAY_MS) return `${Math.floor(abs / HOUR_MS)} h`;
  return `${Math.floor(abs / DAY_MS)} d`;
}

/** "just now" under a minute, otherwise "12 min ago". */
export function formatAgo(ms: number): string {
  return ms < MINUTE_MS ? "just now" : `${formatSpan(ms)} ago`;
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
