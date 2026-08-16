"use client";

import { StatCard, maskValue } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils/format";

export type OwnerKpis = {
  /** Cash everyone put in, the owner's included. */
  contributed: number;
  /** What the deployed capital is worth today. */
  deployed: number;
  /** Promised return owed to everyone but the owner. */
  liability: number;
  /** deployed - liability. */
  margin: number;
  /** Change in margin since last month, null with under two months of data. */
  monthlyChange: number | null;
};

/**
 * The owner's headline figures.
 *
 * These deliberately do NOT show "total portfolio value". That figure sums the
 * promised balances — what investors are told they have — and for someone
 * running the methods it is a liability, not an asset. Showing it as the
 * headline made a position that is heavily underwater read as healthy growth.
 *
 * What an owner needs is the pair that actually decides whether the business
 * works: what the money bought, against what it owes.
 */
export function OwnerKpiGrid({
  kpis,
  hideValues,
}: {
  kpis: OwnerKpis;
  hideValues: boolean;
}) {
  const money = (v: number) => {
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  // Every figure carries a share that still reads when the amount is masked.
  // Contributed is the base everything else is measured against, so its own
  // share is trivially 100% — it is shown so the row reads consistently.
  const coverage = kpis.liability > 0 ? (kpis.deployed / kpis.liability) * 100 : null;
  const vsContributed =
    kpis.contributed > 0 ? ((kpis.deployed - kpis.contributed) / kpis.contributed) * 100 : null;
  const owedShare =
    kpis.contributed > 0 ? (kpis.liability / kpis.contributed) * 100 : null;
  const marginShare = kpis.liability > 0 ? (kpis.margin / kpis.liability) * 100 : null;
  const pct = (v: number | null, signed = true) =>
    v === null ? undefined : `${signed && v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Contributed"
        value={money(kpis.contributed)}
        percent="100%"
        sublabel="Cash in, yours and theirs"
      />

      <StatCard
        label="Allocations today"
        value={money(kpis.deployed)}
        percent={pct(vsContributed)}
        tone={vsContributed !== null && vsContributed < 0 ? "negative" : "positive"}
        sublabel="Against what was contributed"
      />

      <StatCard
        label="Owed to investors"
        value={money(kpis.liability)}
        percent={pct(owedShare, false)}
        sublabel={
          coverage === null
            ? "Their promised return"
            : `Allocations cover ${coverage.toFixed(0)}% of it`
        }
      />

      <StatCard
        label="Margin"
        value={money(kpis.margin)}
        percent={pct(marginShare)}
        tone={kpis.margin >= 0 ? "positive" : "negative"}
        sublabel={
          kpis.monthlyChange === null
            ? kpis.margin >= 0
              ? "Yours after paying everyone"
              : "Covered out of pocket"
            : `${kpis.monthlyChange >= 0 ? "+" : "−"}${
                hideValues
                  ? maskValue(formatCurrency(Math.abs(kpis.monthlyChange)))
                  : formatCurrency(Math.abs(kpis.monthlyChange))
              }${
                kpis.liability > 0
                  ? ` (${kpis.monthlyChange >= 0 ? "+" : ""}${(
                      (kpis.monthlyChange / kpis.liability) *
                      100
                    ).toFixed(1)}%)`
                  : ""
              } this month`
        }
      />
    </div>
  );
}
