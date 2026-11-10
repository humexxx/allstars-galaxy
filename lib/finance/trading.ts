import type {
  EquityPoint,
  JournalBreakdownRow,
  JournalCashMovement,
  JournalDay,
  JournalMonth,
  JournalStats,
  JournalTrade,
  TradeLegs,
  TradingCashMovementRow,
  TradingJournal,
  TradingTradeRow,
} from "@/types/trading";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** How many complete months the plan's growth rate averages. */
export const GROWTH_MONTHS = 6;
/**
 * The most one month counts for in that average, either way. A month's return
 * is its P&L over the money it had, so one good trade on a nearly empty
 * account reads as thousands of percent, and a plan would compound it.
 */
export const MAX_MONTHLY_RETURN = 1;

const num = (v: string | null): number => (v == null ? 0 : parseFloat(v));
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round8 = (n: number): number => Math.round(n * 1e8) / 1e8;

/** Days between two YYYY-MM-DD calendar days. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * A closed trade's realized P&L: the price move times the position, against
 * a short, less fees. Null while the trade is open.
 */
export function tradePnl(t: TradeLegs): number | null {
  if (t.exitPrice == null) return null;
  const direction = t.side === "long" ? 1 : -1;
  return round2(direction * (t.exitPrice - t.entryPrice) * t.quantity * t.multiplier - t.fees);
}

/**
 * Whether a trade was recorded by its result alone: one unit bought at zero
 * and sold for the gain, or bought for the loss and sold at zero. Such a trade
 * has no position worth showing.
 */
export function isResultOnly(t: TradeLegs): boolean {
  return (
    t.side === "long" &&
    t.quantity === 1 &&
    t.multiplier === 1 &&
    t.fees === 0 &&
    (t.exitPrice == null ? t.entryPrice === 0 : Math.min(t.entryPrice, t.exitPrice) === 0)
  );
}

/**
 * The legs that make a trade's P&L come out at `pnl` (null leaves it open).
 * A trade `held` with a real position keeps it and moves only its exit price;
 * anything else — a new trade, one recorded by result, a position no exit
 * price reaches that figure on — becomes the one-unit form `isResultOnly` reads.
 */
export function legsForResult(pnl: number | null, held?: TradeLegs): TradeLegs {
  if (held && !isResultOnly(held)) {
    if (pnl == null) return { ...held, exitPrice: null };
    if (tradePnl(held) === pnl) return held;
    const direction = held.side === "long" ? 1 : -1;
    const exitPrice = round8(held.entryPrice + (direction * (pnl + held.fees)) / (held.quantity * held.multiplier));
    const moved = { ...held, exitPrice };
    if (exitPrice >= 0 && tradePnl(moved) === pnl) return moved;
  }
  return {
    side: "long",
    quantity: 1,
    multiplier: 1,
    fees: 0,
    entryPrice: pnl == null ? 0 : Math.max(0, -pnl),
    exitPrice: pnl == null ? null : Math.max(0, pnl),
  };
}

const amount = (n: number): string => n.toLocaleString("en-US", { maximumFractionDigits: 8 });

/** A trade's position in words — "Long 10 ×100 at 2.5" — or null for one recorded by its result alone. */
export function positionLabel(t: TradeLegs): string | null {
  if (isResultOnly(t)) return null;
  const size = t.multiplier === 1 ? amount(t.quantity) : `${amount(t.quantity)} ×${amount(t.multiplier)}`;
  return `${t.side === "long" ? "Long" : "Short"} ${size} at ${amount(t.entryPrice)}`;
}

export function tradeLegs(row: TradingTradeRow): TradeLegs {
  return {
    side: row.side,
    quantity: num(row.quantity),
    multiplier: num(row.multiplier) || 1,
    entryPrice: num(row.entryPrice),
    exitPrice: row.exitPrice == null ? null : num(row.exitPrice),
    fees: num(row.fees),
  };
}

/** A stored trade as the journal reads it. Its `returnPct` needs the whole journal: `buildJournal` sets it. */
export function toJournalTrade(row: TradingTradeRow, dayOf: (d: Date) => string): JournalTrade {
  const base = tradeLegs(row);
  const pnl = tradePnl(base);
  const openedDay = dayOf(row.openedAt);
  const closedDay = row.closedAt ? dayOf(row.closedAt) : null;
  return {
    id: row.id,
    symbol: row.symbol,
    ...base,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    openedDay,
    closedDay,
    setup: row.setup,
    notes: row.notes,
    status: pnl == null ? "open" : "closed",
    pnl,
    returnPct: null,
    holdDays: closedDay ? Math.max(0, daysBetween(openedDay, closedDay)) : null,
  };
}

export function toJournalCash(
  row: TradingCashMovementRow,
  dayOf: (d: Date) => string
): JournalCashMovement {
  return {
    id: row.id,
    kind: row.kind,
    amount: num(row.amount),
    occurredAt: row.occurredAt.toISOString(),
    day: dayOf(row.occurredAt),
    note: row.note,
  };
}

/** Closed trades, oldest close first. */
function closedInOrder(trades: readonly JournalTrade[]): (JournalTrade & { pnl: number; closedDay: string })[] {
  return trades
    .filter((t): t is JournalTrade & { pnl: number; closedDay: string } => t.pnl != null && t.closedDay != null)
    .sort((a, b) => (a.closedAt ?? "").localeCompare(b.closedAt ?? ""));
}

const cashFlow = (c: JournalCashMovement): number => (c.kind === "deposit" ? c.amount : -c.amount);

/**
 * What the account held as a trade closing at `at` did: every deposit and
 * withdrawal up to that instant, and the P&L of the trades closed before it.
 * `exceptId` leaves one trade out — the one being edited.
 */
export function balanceBefore(
  trades: readonly JournalTrade[],
  cash: readonly JournalCashMovement[],
  at: string,
  exceptId?: string
): number {
  const moved = cash.filter((c) => c.occurredAt <= at).reduce((s, c) => s + cashFlow(c), 0);
  const made = trades
    .filter((t) => t.id !== exceptId && t.closedAt != null && t.closedAt < at)
    .reduce((s, t) => s + (t.pnl ?? 0), 0);
  return round2(moved + made);
}

/**
 * Each closed trade's P&L as a share of `balanceBefore` its close, by trade
 * id; null when the account held nothing. Trades closing at the same instant
 * share one base.
 */
export function returnsOnBalance(
  trades: readonly JournalTrade[],
  cash: readonly JournalCashMovement[]
): Map<string, number | null> {
  const closed = closedInOrder(trades);
  const moves = [...cash].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const returns = new Map<string, number | null>();
  let balance = 0;
  let next = 0;
  for (let i = 0; i < closed.length; ) {
    const at = closed[i].closedAt ?? "";
    for (; next < moves.length && moves[next].occurredAt <= at; next++) balance += cashFlow(moves[next]);
    const base = round2(balance);
    for (; i < closed.length && closed[i].closedAt === at; i++) {
      returns.set(closed[i].id, base > 0 ? closed[i].pnl / base : null);
      balance += closed[i].pnl;
    }
  }
  return returns;
}

export function journalStats(trades: readonly JournalTrade[]): JournalStats {
  const closed = closedInOrder(trades);
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = -losses.reduce((s, t) => s + t.pnl, 0);
  const netPnl = grossProfit - grossLoss;

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  let streak = 0;
  let bestStreak = 0;
  let worstStreak = 0;
  for (const t of closed) {
    cumulative += t.pnl;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    if (t.pnl > 0) streak = streak > 0 ? streak + 1 : 1;
    else if (t.pnl < 0) streak = streak < 0 ? streak - 1 : -1;
    else streak = 0;
    bestStreak = Math.max(bestStreak, streak);
    worstStreak = Math.max(worstStreak, -streak);
  }

  const holds = closed.map((t) => t.holdDays ?? 0);
  return {
    netPnl: round2(netPnl),
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length > 0 ? wins.length / closed.length : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: closed.length > 0 ? netPnl / closed.length : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    largestWin: wins.reduce((m, t) => Math.max(m, t.pnl), 0),
    largestLoss: losses.reduce((m, t) => Math.max(m, -t.pnl), 0),
    maxDrawdown: round2(maxDrawdown),
    avgHoldDays: holds.length > 0 ? holds.reduce((s, h) => s + h, 0) / holds.length : null,
    bestStreak,
    worstStreak,
  };
}

/** Each day that closed a trade, with what it made. Oldest first. */
export function journalDays(trades: readonly JournalTrade[]): JournalDay[] {
  const byDay = new Map<string, JournalDay>();
  for (const t of closedInOrder(trades)) {
    const d = byDay.get(t.closedDay) ?? { day: t.closedDay, pnl: 0, trades: 0, wins: 0, losses: 0 };
    d.pnl = round2(d.pnl + t.pnl);
    d.trades += 1;
    if (t.pnl > 0) d.wins += 1;
    if (t.pnl < 0) d.losses += 1;
    byDay.set(t.closedDay, d);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

type DayFlow = { cashIn: number; cashOut: number; pnl: number };

/** Money moving through the account, by day: deposits, withdrawals and realized P&L. */
function dailyFlows(
  trades: readonly JournalTrade[],
  cash: readonly JournalCashMovement[]
): Map<string, DayFlow> {
  const flows = new Map<string, DayFlow>();
  const at = (day: string): DayFlow => {
    const f = flows.get(day) ?? { cashIn: 0, cashOut: 0, pnl: 0 };
    flows.set(day, f);
    return f;
  };
  for (const c of cash) {
    if (c.kind === "deposit") at(c.day).cashIn += c.amount;
    else at(c.day).cashOut += c.amount;
  }
  for (const t of closedInOrder(trades)) at(t.closedDay).pnl += t.pnl;
  return flows;
}

/** The balance at the end of every day that moved it, oldest first. */
export function equityCurve(
  trades: readonly JournalTrade[],
  cash: readonly JournalCashMovement[]
): EquityPoint[] {
  const flows = dailyFlows(trades, cash);
  let balance = 0;
  let cumulativePnl = 0;
  return [...flows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, f]) => {
      balance += f.cashIn - f.cashOut + f.pnl;
      cumulativePnl += f.pnl;
      return { day, balance: round2(balance), cumulativePnl: round2(cumulativePnl) };
    });
}

function breakdown(
  trades: readonly JournalTrade[],
  keyOf: (t: JournalTrade & { pnl: number; closedDay: string }) => string
): JournalBreakdownRow[] {
  const rows = new Map<string, JournalBreakdownRow>();
  for (const t of closedInOrder(trades)) {
    const key = keyOf(t);
    const r = rows.get(key) ?? { key, pnl: 0, trades: 0, wins: 0 };
    r.pnl = round2(r.pnl + t.pnl);
    r.trades += 1;
    if (t.pnl > 0) r.wins += 1;
    rows.set(key, r);
  }
  return [...rows.values()];
}

/** P&L by the weekday trades closed on, Monday first; every weekday listed. */
export function pnlByWeekday(trades: readonly JournalTrade[]): JournalBreakdownRow[] {
  const rows = breakdown(trades, (t) => WEEKDAYS[(new Date(`${t.closedDay}T00:00:00Z`).getUTCDay() + 6) % 7]);
  return WEEKDAYS.map((key) => rows.find((r) => r.key === key) ?? { key, pnl: 0, trades: 0, wins: 0 });
}

/** P&L by symbol, best first. */
export function pnlBySymbol(trades: readonly JournalTrade[]): JournalBreakdownRow[] {
  return breakdown(trades, (t) => t.symbol.toUpperCase()).sort((a, b) => b.pnl - a.pnl);
}

/** P&L by setup, best first; trades without one under "No setup". */
export function pnlBySetup(trades: readonly JournalTrade[]): JournalBreakdownRow[] {
  return breakdown(trades, (t) => t.setup?.trim() || "No setup").sort((a, b) => b.pnl - a.pnl);
}

const monthOf = (day: string): string => day.slice(0, 7);

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Every month from the first activity to `today`'s: what trades made, and
 * that as a share of the money the month had to work with — the balance it
 * opened with plus what was deposited during it.
 */
export function journalMonths(
  trades: readonly JournalTrade[],
  cash: readonly JournalCashMovement[],
  today: string
): JournalMonth[] {
  const flows = dailyFlows(trades, cash);
  const days = [...flows.keys()].sort();
  if (days.length === 0) return [];
  const byMonth = new Map<string, { cashIn: number; cashOut: number; pnl: number }>();
  for (const [day, f] of flows) {
    const m = byMonth.get(monthOf(day)) ?? { cashIn: 0, cashOut: 0, pnl: 0 };
    m.cashIn += f.cashIn;
    m.cashOut += f.cashOut;
    m.pnl += f.pnl;
    byMonth.set(monthOf(day), m);
  }
  const out: JournalMonth[] = [];
  let opening = 0;
  const last = monthOf(today) > monthOf(days.at(-1)!) ? monthOf(today) : monthOf(days.at(-1)!);
  for (let month = monthOf(days[0]); month <= last; month = nextMonth(month)) {
    const m = byMonth.get(month) ?? { cashIn: 0, cashOut: 0, pnl: 0 };
    const base = opening + m.cashIn;
    out.push({ month, pnl: round2(m.pnl), returnPct: base > 0 ? m.pnl / base : null });
    opening = opening + m.cashIn - m.cashOut + m.pnl;
  }
  return out;
}

/**
 * The monthly return the plan grows the trading balance at: the plain average
 * of the last `GROWTH_MONTHS` complete months that had money to work with,
 * each counted within ±`MAX_MONTHLY_RETURN` — today's month is still running,
 * so it is left out.
 */
export function trailingMonthlyRate(
  months: readonly JournalMonth[],
  today: string,
  count: number = GROWTH_MONTHS
): { rate: number; months: number } {
  const complete = months
    .filter((m) => m.month < monthOf(today) && m.returnPct != null)
    .slice(-count);
  if (complete.length === 0) return { rate: 0, months: 0 };
  const capped = (r: number): number => Math.max(-MAX_MONTHLY_RETURN, Math.min(MAX_MONTHLY_RETURN, r));
  const rate = complete.reduce((s, m) => s + capped(m.returnPct ?? 0), 0) / complete.length;
  return { rate, months: complete.length };
}

/** The whole journal, from the stored rows, with days read by `dayOf`. */
export function buildJournal(
  rows: { trades: readonly TradingTradeRow[]; cash: readonly TradingCashMovementRow[] },
  dayOf: (d: Date) => string,
  today: string
): TradingJournal {
  const cash = rows.cash
    .map((r) => toJournalCash(r, dayOf))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const read = rows.trades.map((r) => toJournalTrade(r, dayOf));
  const returns = returnsOnBalance(read, cash);
  const trades = read
    .map((t) => ({ ...t, returnPct: returns.get(t.id) ?? null }))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const deposited = cash.filter((c) => c.kind === "deposit").reduce((s, c) => s + c.amount, 0);
  const withdrawn = cash.filter((c) => c.kind === "withdrawal").reduce((s, c) => s + c.amount, 0);
  const realizedPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const months = journalMonths(trades, cash, today);
  const growth = trailingMonthlyRate(months, today);
  return {
    today,
    trades,
    cash,
    balance: round2(deposited - withdrawn + realizedPnl),
    deposited: round2(deposited),
    withdrawn: round2(withdrawn),
    realizedPnl: round2(realizedPnl),
    openExposure: round2(
      trades
        .filter((t) => t.status === "open")
        .reduce((s, t) => s + t.entryPrice * t.quantity * t.multiplier, 0)
    ),
    stats: journalStats(trades),
    days: journalDays(trades),
    equity: equityCurve(trades, cash),
    byWeekday: pnlByWeekday(trades),
    bySymbol: pnlBySymbol(trades),
    bySetup: pnlBySetup(trades),
    months,
    monthlyGrowthRate: growth.rate,
    growthMonths: growth.months,
  };
}
