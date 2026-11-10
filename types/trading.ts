import type { tradingCashMovements, tradingTrades } from "@/db/schema";

export type TradingTradeRow = typeof tradingTrades.$inferSelect;
export type TradingCashMovementRow = typeof tradingCashMovements.$inferSelect;

export type TradeSide = TradingTradeRow["side"];
export type TradingCashKind = TradingCashMovementRow["kind"];

/** The numbers a trade's P&L is worked out from. */
export type TradeLegs = {
  side: TradeSide;
  quantity: number;
  multiplier: number;
  entryPrice: number;
  exitPrice: number | null;
  fees: number;
};

/** An instrument the trade form offers: a ticker and what it is. */
export type TradingInstrument = {
  symbol: string;
  name: string | null;
  /** The provider's market — stocks, crypto, fx, indices, otc; null when unknown. */
  market: string | null;
};

/**
 * A trade as the journal reads it: numbers parsed, its days on the reader's
 * calendar, and — once closed — what it made.
 */
export type JournalTrade = {
  id: string;
  symbol: string;
  side: TradeSide;
  quantity: number;
  multiplier: number;
  entryPrice: number;
  exitPrice: number | null;
  /** ISO instants. */
  openedAt: string;
  closedAt: string | null;
  /** YYYY-MM-DD on the reader's calendar. */
  openedDay: string;
  closedDay: string | null;
  fees: number;
  setup: string | null;
  notes: string | null;
  status: "open" | "closed";
  /** Realized P&L after fees; null while open. */
  pnl: number | null;
  /**
   * P&L as a share of the account's balance just before the trade closed;
   * null while open, and when the account held nothing.
   */
  returnPct: number | null;
  /** Calendar days from open to close (0 for a day trade); null while open. */
  holdDays: number | null;
};

export type JournalCashMovement = {
  id: string;
  kind: TradingCashKind;
  amount: number;
  occurredAt: string;
  day: string;
  note: string | null;
};

/** One calendar day of the journal: what closed that day. */
export type JournalDay = {
  day: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
};

/** The account's balance at the end of a day that moved it. */
export type EquityPoint = {
  day: string;
  balance: number;
  /** Realized P&L to date, without deposits and withdrawals. */
  cumulativePnl: number;
};

export type JournalStats = {
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  trades: number;
  wins: number;
  losses: number;
  /** Share of closed trades that made money, 0..1; null with none closed. */
  winRate: number | null;
  /** Gross profit ÷ gross loss; null with no losing trade. */
  profitFactor: number | null;
  /** Average P&L per closed trade. */
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  /** Deepest fall of cumulative P&L from a previous high (a positive amount). */
  maxDrawdown: number;
  avgHoldDays: number | null;
  /** Longest run of winning / losing trades in a row. */
  bestStreak: number;
  worstStreak: number;
};

export type JournalBreakdownRow = {
  key: string;
  pnl: number;
  trades: number;
  wins: number;
};

export type JournalMonth = {
  /** YYYY-MM. */
  month: string;
  pnl: number;
  /** P&L over the balance the month opened with; null when that was zero. */
  returnPct: number | null;
};

/** Everything the journal page draws, worked out on the server. */
export type TradingJournal = {
  today: string;
  trades: JournalTrade[];
  cash: JournalCashMovement[];
  balance: number;
  deposited: number;
  withdrawn: number;
  realizedPnl: number;
  /** Cost of the positions still open (entry × quantity × multiplier). */
  openExposure: number;
  stats: JournalStats;
  days: JournalDay[];
  equity: EquityPoint[];
  byWeekday: JournalBreakdownRow[];
  bySymbol: JournalBreakdownRow[];
  bySetup: JournalBreakdownRow[];
  months: JournalMonth[];
  /**
   * The monthly return the plan grows the balance at: the average of the
   * last complete months' returns (see `trailingMonthlyRate`).
   */
  monthlyGrowthRate: number;
  /** How many months that average read. */
  growthMonths: number;
};

/** The trading account in a finance plan: today's balance and its pace. */
export type TradingSummary = {
  balance: number;
  /** The day `balance` was read (ISO). */
  asOf: string;
  monthlyGrowthRate: number;
  growthMonths: number;
};
