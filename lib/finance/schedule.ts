/**
 * When money moves: the dated occurrences of a plan's income, expense and debt
 * lines, with per-month overrides (skip / reschedule / amount) applied.
 *
 * This is the ONE resolver. The projection engine, the "today" figures, the
 * sidebar breakdowns and the calendar all read occurrences from here, so a
 * line lands on the same day, in the same period, with the same amount on
 * every surface. (Each surface used to carry its own copy, and they drifted:
 * the calendar moved a rescheduled paycheque the projection kept in place.)
 *
 * Dates are CALENDAR DAYS encoded as UTC midnight, like the period helpers.
 */
import type {
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanLineOverride,
  OverrideSide,
  RecurrenceType,
} from "@/types/finance";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** year * 12 + month (0-based) — a calendar-month bucket. */
export function monthKeyOf(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** "YYYY-MM-DD" → UTC midnight, or null when it doesn't parse. */
export function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/** UTC midnight → "YYYY-MM-DD". */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthIdx: number): number {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

/**
 * The Nth `dayOfWeek` (0 = Sun) of the month. When the month has no Nth (a 5th
 * Tuesday in February) it falls back to the LAST one rather than skipping.
 */
export function nthWeekdayOfMonth(
  year: number,
  monthIdx: number,
  weekOfMonth: number,
  dayOfWeek: number
): number {
  const firstDow = new Date(Date.UTC(year, monthIdx, 1)).getUTCDay();
  const firstOccurrence = 1 + ((dayOfWeek - firstDow + 7) % 7);
  let target = firstOccurrence + (weekOfMonth - 1) * 7;
  if (target > lastDayOfMonth(year, monthIdx)) target -= 7;
  return target;
}

/** The recurrence fields every line side carries. */
export type RecurrenceShape = {
  recurrenceType: RecurrenceType;
  dayOfMonth: number | null;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
  intervalMonths: number | null;
  recurrenceStart: string | null;
};

/**
 * Day of the month a recurring line lands on in (year, monthIdx), or null when
 * an every-N-months line skips that month. `fallbackAnchorKey` is the month an
 * every-N-months cycle counts from when the line has no `recurrenceStart` (the
 * plan's start month).
 */
export function hitDayInMonth(
  line: RecurrenceShape,
  year: number,
  monthIdx: number,
  fallbackAnchorKey: number
): number | null {
  if (line.recurrenceType === "every_n_months") {
    if (line.intervalMonths && line.intervalMonths >= 1) {
      const start = parseIsoDay(line.recurrenceStart);
      const anchor = start ? monthKeyOf(start) : fallbackAnchorKey;
      const mk = year * 12 + monthIdx;
      if (mk < anchor || (mk - anchor) % line.intervalMonths !== 0) return null;
    }
  }
  if (
    line.recurrenceType === "monthly_weekday" &&
    line.weekOfMonth != null &&
    line.dayOfWeek != null
  ) {
    return nthWeekdayOfMonth(year, monthIdx, line.weekOfMonth, line.dayOfWeek);
  }
  return Math.min(line.dayOfMonth ?? 1, lastDayOfMonth(year, monthIdx));
}

export type OverrideIndex = Map<string, FinancePlanLineOverride>;

/** Overrides keyed `${side}:${lineId}:${monthKey}` (monthKey of `monthYear`). */
export function buildOverrideIndex(
  overrides: readonly FinancePlanLineOverride[] | null | undefined
): OverrideIndex {
  const map: OverrideIndex = new Map();
  for (const o of overrides ?? []) {
    const d = parseIsoDay(o.monthYear);
    if (!d) continue;
    map.set(`${o.parentSide}:${o.parentId}:${monthKeyOf(d)}`, o);
  }
  return map;
}

/** One dated movement of money. */
export type Occurrence = {
  side: OverrideSide;
  lineId: string;
  name: string;
  kind: "recurring" | "one_time";
  /** The day the money actually moves (after any reschedule). */
  date: Date;
  /** The day the cadence put it on (before any reschedule). */
  naturalDate: Date;
  /** Month the occurrence belongs to in the cadence — the key overrides use. */
  monthKey: number;
  /** True when a reschedule override moved it. */
  moved: boolean;
  /**
   * The amount that moves. For income and expense lines it is always set
   * (override-adjusted). For debts it is only set by an amount override —
   * otherwise the engine works it out from the balance (percent-of-balance
   * minimums, the final payment capped at what is owed).
   */
  amount: number | null;
};

type IncomeLike = Pick<
  FinancePlanIncome,
  | "id"
  | "name"
  | "monthlyAmount"
  | "kind"
  | "date"
  | "startDate"
  | "endDate"
  | "dayOfMonth"
  | "recurrenceType"
  | "weekOfMonth"
  | "dayOfWeek"
  | "intervalMonths"
  | "recurrenceStart"
>;
type ExpenseLike = Pick<
  FinancePlanExpense,
  | "id"
  | "name"
  | "monthlyAmount"
  | "kind"
  | "date"
  | "dayOfMonth"
  | "recurrenceType"
  | "weekOfMonth"
  | "dayOfWeek"
  | "intervalMonths"
  | "recurrenceStart"
>;
type DebtLike = Pick<
  FinancePlanDebt,
  | "id"
  | "name"
  | "dayOfMonth"
  | "recurrenceType"
  | "weekOfMonth"
  | "dayOfWeek"
  | "intervalMonths"
  | "recurrenceStart"
>;

export type ScheduleSource = {
  startMonth: Date;
  incomes: readonly IncomeLike[];
  expenses: readonly ExpenseLike[];
  debts: readonly DebtLike[];
  overrides?: readonly FinancePlanLineOverride[] | null;
};

// A reschedule can move an occurrence out of its own month. Walking this many
// months either side of the range picks up the ones moved INTO it.
const RESCHEDULE_MARGIN_MONTHS = 2;

function nonNegative(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function recurringOccurrences(
  side: OverrideSide,
  line: RecurrenceShape & { id: string; name: string },
  baseAmount: number | null,
  window: { start: Date | null; end: Date | null },
  from: Date,
  to: Date,
  index: OverrideIndex,
  fallbackAnchorKey: number,
  out: Occurrence[]
): void {
  const firstKey = monthKeyOf(from) - RESCHEDULE_MARGIN_MONTHS;
  const lastKey = monthKeyOf(to) + RESCHEDULE_MARGIN_MONTHS;
  const fromMs = from.getTime();
  const toMs = to.getTime();
  for (let mk = firstKey; mk <= lastKey; mk++) {
    const year = Math.floor(mk / 12);
    const monthIdx = mk - year * 12;
    const day = hitDayInMonth(line, year, monthIdx, fallbackAnchorKey);
    if (day === null) continue;
    const naturalDate = new Date(Date.UTC(year, monthIdx, day));
    // The [startDate, endDate] window is judged on the cadence date: it
    // decides whether this month's occurrence exists at all.
    if (window.start && naturalDate.getTime() < window.start.getTime()) continue;
    if (window.end && naturalDate.getTime() > window.end.getTime()) continue;

    const ov = index.get(`${side}:${line.id}:${mk}`);
    if (ov?.action === "skip") continue;
    let date = naturalDate;
    let moved = false;
    if (ov?.action === "reschedule" && ov.date) {
      const target = parseIsoDay(ov.date);
      if (target) {
        date = target;
        moved = target.getTime() !== naturalDate.getTime();
      }
    }
    if (date.getTime() < fromMs || date.getTime() > toMs) continue;
    const amount =
      ov?.action === "amount" && ov.monthlyAmount !== null
        ? nonNegative(ov.monthlyAmount)
        : baseAmount;
    out.push({
      side,
      lineId: line.id,
      name: line.name,
      kind: "recurring",
      date,
      naturalDate,
      monthKey: mk,
      moved,
      amount,
    });
  }
}

/**
 * Every occurrence dated within [from, to] (inclusive calendar days), sorted
 * by date. Overrides are keyed by the month the cadence put the occurrence in,
 * and a reschedule may carry it into another month — or another period.
 */
export function planOccurrences(
  source: ScheduleSource,
  from: Date,
  to: Date
): Occurrence[] {
  const out: Occurrence[] = [];
  const index = buildOverrideIndex(source.overrides);
  const fallbackAnchorKey = monthKeyOf(new Date(source.startMonth));
  const inRange = (d: Date): boolean =>
    d.getTime() >= from.getTime() && d.getTime() <= to.getTime();

  const oneTime = (
    side: "income" | "expense",
    line: { id: string; name: string; date: string | null; monthlyAmount: string }
  ): void => {
    const d = parseIsoDay(line.date);
    if (!d || !inRange(d)) return;
    out.push({
      side,
      lineId: line.id,
      name: line.name,
      kind: "one_time",
      date: d,
      naturalDate: d,
      monthKey: monthKeyOf(d),
      moved: false,
      amount: nonNegative(line.monthlyAmount),
    });
  };

  for (const inc of source.incomes) {
    if (inc.kind === "one_time") {
      oneTime("income", inc);
      continue;
    }
    recurringOccurrences(
      "income",
      inc,
      nonNegative(inc.monthlyAmount),
      { start: parseIsoDay(inc.startDate), end: parseIsoDay(inc.endDate) },
      from,
      to,
      index,
      fallbackAnchorKey,
      out
    );
  }
  for (const exp of source.expenses) {
    if (exp.kind === "one_time") {
      oneTime("expense", exp);
      continue;
    }
    recurringOccurrences(
      "expense",
      exp,
      nonNegative(exp.monthlyAmount),
      { start: null, end: null },
      from,
      to,
      index,
      fallbackAnchorKey,
      out
    );
  }
  for (const debt of source.debts) {
    recurringOccurrences(
      "debt",
      debt,
      null,
      { start: null, end: null },
      from,
      to,
      index,
      fallbackAnchorKey,
      out
    );
  }

  const sideOrder: Record<OverrideSide, number> = { income: 0, expense: 1, debt: 2 };
  return out.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      sideOrder[a.side] - sideOrder[b.side] ||
      a.lineId.localeCompare(b.lineId)
  );
}

/** 1-based day index of `date` inside a period that starts on `periodStart`. */
export function dayIndexInPeriod(date: Date, periodStart: Date): number {
  return Math.round((date.getTime() - periodStart.getTime()) / MS_PER_DAY) + 1;
}
