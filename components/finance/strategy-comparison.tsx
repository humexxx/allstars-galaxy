import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Zap, Clock } from "lucide-react";

import { formatCurrency } from "@/lib/utils/format";
import type { DebtStrategy, StrategyComparison } from "@/types/finance";

type StrategyComparisonCardProps = {
  comparison: StrategyComparison;
  currentStrategy: DebtStrategy;
};

const STRATEGY_LABEL: Record<DebtStrategy, string> = {
  avalanche: "Avalanche",
  snowball: "Snowball",
  none: "No acceleration",
};

export function StrategyComparisonCard({
  comparison,
  currentStrategy,
}: StrategyComparisonCardProps) {
  const rows: { key: DebtStrategy; data: StrategyComparison["avalanche"] }[] = [
    { key: "avalanche", data: comparison.avalanche },
    { key: "snowball", data: comparison.snowball },
    { key: "none", data: comparison.none },
  ];

  const minInterest = Math.min(
    comparison.avalanche.totalInterestPaid,
    comparison.snowball.totalInterestPaid,
    comparison.none.totalInterestPaid
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Debt payoff strategy
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Same plan, three strategies. Pick the one that fits — math vs. momentum.
            </p>
          </div>
          {comparison.interestSaved > 0 && (
            <Badge variant="outline" className="gap-1 border-green-500/40 text-green-700 dark:text-green-300">
              <TrendingDown className="h-3 w-3" />
              {STRATEGY_LABEL[comparison.recommended]} saves {formatCurrency(comparison.interestSaved)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {rows.map(({ key, data }) => {
            const isCurrent = key === currentStrategy;
            const isBest = Math.abs(data.totalInterestPaid - minInterest) < 0.5;

            return (
              <div
                key={key}
                className={`relative rounded-md border p-4 ${
                  isCurrent ? "border-foreground" : ""
                } ${isBest && key !== "none" ? "bg-green-500/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{STRATEGY_LABEL[key]}</p>
                  {isCurrent && <Badge variant="secondary" className="text-xs">Active</Badge>}
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Total interest paid
                    </dt>
                    <dd className="text-lg font-semibold">
                      {formatCurrency(data.totalInterestPaid)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <dt className="text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      Debt-free in
                    </dt>
                    <dd className="text-sm font-medium">
                      {data.monthsToDebtFree !== null
                        ? `${data.monthsToDebtFree} mo`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-muted-foreground">Ending net worth</dt>
                    <dd className="text-sm font-medium">
                      {formatCurrency(data.endingNetWorth)}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
        {comparison.interestSaved === 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            With your current debts the three strategies tie — they only diverge when
            you have multiple debts with different rates and balances.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
