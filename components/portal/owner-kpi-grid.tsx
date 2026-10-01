"use client";

import { StatCard, maskValue } from "@/components/ui/stat-card";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/utils/format";

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
  priced = true,
  hideValues,
}: {
  kpis: OwnerKpis;
  /** False when no contribution has been priced yet: "Allocations today" is
   *  then unknown, not $0 — and a $0 against what is owed would read as the
   *  whole book being lost. */
  priced?: boolean;
  hideValues: boolean;
}) {
  const money = (v: number): string => {
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  // Every figure carries a share that still reads when the amount is masked.
  // Contributed is the base everything else is measured against, so its own
  // share is trivially 100% — shown so the row reads consistently, and only
  // when there is something for it to be 100% of.
  const coverage = kpis.liability > 0 ? (kpis.deployed / kpis.liability) * 100 : null;
  const vsContributed =
    kpis.contributed > 0 ? ((kpis.deployed - kpis.contributed) / kpis.contributed) * 100 : null;
  const owedShare =
    kpis.contributed > 0 && kpis.liability > 0
      ? (kpis.liability / kpis.contributed) * 100
      : null;
  const marginShare = kpis.liability > 0 ? (kpis.margin / kpis.liability) * 100 : null;
  const pct = (v: number | null, signed = true): string | undefined =>
    v === null ? undefined : signed ? formatSignedPercent(v, 1) : formatPercent(v, 1);

  return (
    <div className="@container">
      {/* Columns follow the width the grid actually has, not the viewport: at
         1024px the sidebar leaves ~670px, and four cards there clipped every
         figure mid-number. */}
      <div className="grid gap-4 @md:grid-cols-2 @4xl:grid-cols-4">
        <StatCard
          label="Contributed"
          value={money(kpis.contributed)}
          percent={kpis.contributed > 0 ? "100%" : undefined}
          sublabel="Cash in, yours and theirs"
        />
  
        {priced ? (
          <StatCard
            label="Allocations today"
            value={money(kpis.deployed)}
            percent={pct(vsContributed)}
            tone={vsContributed !== null && vsContributed < 0 ? "negative" : "positive"}
            sublabel="Against what was contributed"
          />
        ) : (
          <StatCard label="Allocations today" value="—" sublabel="Not priced yet" />
        )}
  
        <StatCard
          label="Owed to investors"
          value={money(kpis.liability)}
          percent={pct(owedShare, false)}
          sublabel={
            kpis.liability === 0
              ? "No outside investors yet"
              : coverage === null || !priced
                ? "Their promised return"
                : `Allocations cover ${formatPercent(coverage, 0)} of it`
          }
        />
  
        {priced ? (
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
                : `${
                    hideValues
                      ? `${kpis.monthlyChange >= 0 ? "+" : "-"}${maskValue(
                          formatCurrency(Math.abs(kpis.monthlyChange))
                        )}`
                      : formatSignedCurrency(kpis.monthlyChange)
                  }${
                    kpis.liability > 0
                      ? ` (${formatSignedPercent((kpis.monthlyChange / kpis.liability) * 100, 1)})`
                      : ""
                  } this month`
            }
          />
        ) : (
          <StatCard label="Margin" value="—" sublabel="Needs priced allocations" />
        )}
      </div>
    </div>
  );
}
