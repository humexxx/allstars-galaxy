/**
 * Opening balances are a SET — savings, investments and every debt's balance
 * — stated as of one calendar day (`finance_plans.balances_as_of`). Anything
 * dated on/before that day is already in them.
 *
 * Editing one of them restates the whole set as of TODAY: the edited figure
 * takes the new value, and every other figure moves to where the plan
 * projects it today. Re-dating only the edited figure would leave the others
 * stated as of an older day while being treated as of today — payments made
 * in between would silently vanish (or be replayed) — and on a confirmed plan
 * the stale creation-time savings would suddenly override the confirmation.
 */
import type { FinancePlanWithLines, TodayState } from "@/types/finance";

import { isoDay } from "./schedule";

export type OpeningBalanceEdits = {
  /** New initial savings, when the plan form sent one. */
  savings?: string;
  /** New initial investments, when the plan form sent one. */
  investments?: string;
  /** New opening balance per EXISTING debt id. */
  debts?: Record<string, string>;
  /** A debt being added, with its opening balance. */
  addedDebtBalance?: string;
};

export type OpeningRestatement = {
  initialSavings: string;
  initialInvestments: string;
  /** Opening balance for every existing debt of the plan. */
  debtBalances: Record<string, string>;
  /** YYYY-MM-DD — the new `balances_as_of`. */
  balancesAsOf: string;
};

function cents(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function money(value: number): string {
  const r = Math.round(value * 100) / 100;
  return (r === 0 ? 0 : r).toFixed(2);
}

/**
 * True when the edits actually change an opening balance (compared at cent
 * precision against what the plan stores). Saving a form unchanged, or adding
 * a debt with a zero balance, restates nothing and must not re-date anything.
 */
export function changesOpeningBalances(
  plan: Pick<FinancePlanWithLines, "initialSavings" | "initialInvestments" | "debts">,
  edits: OpeningBalanceEdits
): boolean {
  if (edits.savings !== undefined && cents(edits.savings) !== cents(plan.initialSavings)) {
    return true;
  }
  if (
    edits.investments !== undefined &&
    cents(edits.investments) !== cents(plan.initialInvestments)
  ) {
    return true;
  }
  for (const [id, balance] of Object.entries(edits.debts ?? {})) {
    const debt = plan.debts.find((d) => d.id === id);
    if (debt && cents(balance) !== cents(debt.initialBalance)) return true;
  }
  if (edits.addedDebtBalance !== undefined && cents(edits.addedDebtBalance) !== 0) {
    return true;
  }
  return false;
}

/**
 * The restated set: edited figures as given, the rest from `projectedToday`
 * (where the calibrated plan stands on `today` — see `projectStateAt`).
 */
export function restateOpeningSet(
  plan: Pick<FinancePlanWithLines, "debts">,
  projectedToday: TodayState,
  edits: OpeningBalanceEdits,
  today: Date
): OpeningRestatement {
  const projectedDebt = new Map(projectedToday.debts.map((d) => [d.debtId, d.balance]));
  const debtBalances: Record<string, string> = {};
  for (const d of plan.debts) {
    const edited = edits.debts?.[d.id];
    debtBalances[d.id] =
      edited !== undefined
        ? money(parseFloat(edited))
        : money(Math.max(0, projectedDebt.get(d.id) ?? parseFloat(d.initialBalance)));
  }
  return {
    initialSavings:
      edits.savings !== undefined ? money(parseFloat(edits.savings)) : money(projectedToday.savings),
    initialInvestments:
      edits.investments !== undefined
        ? money(parseFloat(edits.investments))
        : money(Math.max(0, projectedToday.investments)),
    debtBalances,
    balancesAsOf: isoDay(today),
  };
}
