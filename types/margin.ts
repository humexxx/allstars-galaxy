import type { MethodMargin, totalMargin } from "@/lib/finance/margin";
import type {
  CashFlow,
  ContributionUnits,
  LiabilityEntry,
  MarginPoint,
} from "@/lib/finance/margin-history";

/**
 * The owner's side of the book: what the capital raised by their methods is
 * really worth against what they promised. Shared by the margin service and
 * the owner panels on the portfolio page.
 */
export type MarginOverview = {
  methods: MethodMargin[];
  totals: ReturnType<typeof totalMargin>;
  /** True when nothing has been priced yet — the UI shows an empty state
   *  rather than a pile of zeroes that look like a total loss. */
  unconfigured: boolean;
  /** Approved contributions in these methods that have no allocation rows
   *  yet. Their cash is in "Contributed" but not in "Allocations today", so
   *  the UI has to say the comparison is incomplete. */
  unpriced: number;
};

export type InvestorBreakdown = {
  investorId: string;
  name: string;
  isOwn: boolean;
  /** Cash they put in, net of what they withdrew. */
  contributed: number;
  /** Cash they took back out — already netted out of `contributed`. */
  withdrawn: number;
  /** What they are owed today — their promised return, compounded. */
  owed: number;
  /** What their share of the pooled capital actually bought. */
  positions: {
    symbol: string;
    name: string;
    quantity: number;
    invested: number;
    price: number | null;
    value: number | null;
  }[];
  /** Present value of those positions, null when any price is missing. */
  positionValue: number;
  /** positionValue - owed. Negative means their promise costs more than their
   *  money earned. */
  profitLoss: number;
};

/**
 * Raw inputs for the margin chart, sent to the browser so it can re-derive the
 * series under any filter without another round trip. It is a handful of rows
 * — cheaper to ship than to re-query per filter change.
 */
export type MarginHistoryInput = {
  contributions: (ContributionUnits & { investorId: string; methodId: string })[];
  liabilities: (LiabilityEntry & { investorId: string; methodId: string })[];
  /** Cash in and out, from the transactions — priced or not. */
  cashFlows: (CashFlow & { investorId: string; methodId: string })[];
  /** `assetId|YYYY-MM` -> month-end price, as pairs (a Map is not serialisable). */
  prices: [string, number][];
  today: string;
  investors: { id: string; name: string; isOwn: boolean }[];
  methods: { id: string; name: string }[];
};

/** One owned method's allocation policy — where new money goes. */
export type MethodAllocationSummary = {
  methodId: string;
  allocations: { assetId: string; symbol: string; percent: number }[];
};

export type ManagedOverview = {
  overview: MarginOverview;
  history: MarginPoint[];
  historyInput: MarginHistoryInput;
  investors: InvestorBreakdown[];
  allocations: MethodAllocationSummary[];
};
