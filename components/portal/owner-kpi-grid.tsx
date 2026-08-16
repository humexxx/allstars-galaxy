"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatCard, maskValue } from "@/components/ui/stat-card";
import { formatCurrency, formatPercent } from "@/lib/utils/format";

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
  onToggleHideValues,
}: {
  kpis: OwnerKpis;
  hideValues: boolean;
  onToggleHideValues: () => void;
}) {
  const money = (v: number) => {
    const formatted = formatCurrency(v);
    return hideValues ? maskValue(formatted) : formatted;
  };

  const coverage = kpis.liability > 0 ? (kpis.deployed / kpis.liability) * 100 : null;
  const vsContributed =
    kpis.contributed > 0 ? ((kpis.deployed - kpis.contributed) / kpis.contributed) * 100 : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Contributed"
        value={money(kpis.contributed)}
        sublabel="Cash in, yours and theirs"
        action={
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={hideValues ? "Show values" : "Hide values"}
            aria-pressed={hideValues}
            onClick={onToggleHideValues}
          >
            {hideValues ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        }
      />

      <StatCard
        label="Allocations today"
        value={money(kpis.deployed)}
        tone={vsContributed !== null && vsContributed < 0 ? "negative" : "positive"}
        sublabel={
          vsContributed === null
            ? "What the money actually bought"
            : `${formatPercent(vsContributed)} vs contributed`
        }
      />

      <StatCard
        label="Owed to investors"
        value={money(kpis.liability)}
        sublabel={
          coverage === null
            ? "Their promised return"
            : `Allocations cover ${coverage.toFixed(0)}% of it`
        }
      />

      <StatCard
        label="Margin"
        value={money(kpis.margin)}
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
              } this month`
        }
      />
    </div>
  );
}
