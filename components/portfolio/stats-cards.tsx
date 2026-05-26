"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { formatCurrency, formatSignedCurrency, formatPercent } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type StatsCardsProps = {
  allTimeProfit: number;
  allTimeProfitPercentage: number;
  costBasis: number;
  totalInvestmentMethods?: number;
  activeTransactions?: number;
  hideValues: boolean;
};

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  valueClassName?: string;
  captionClassName?: string;
};

function StatCard({ label, value, caption, valueClassName, captionClassName }: StatCardProps): React.ReactElement {
  return (
    <Card className="bg-card py-2 gap-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <CardTitle className="text-xs font-medium">{label}</CardTitle>
          <Info className="w-3 h-3" />
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className={cn("text-lg font-bold text-foreground", valueClassName)}>{value}</div>
        {caption !== undefined && (
          <p className={cn("text-xs text-muted-foreground", captionClassName)}>{caption}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsCards({
  allTimeProfit,
  allTimeProfitPercentage,
  costBasis,
  totalInvestmentMethods = 0,
  activeTransactions = 0,
  hideValues,
}: StatsCardsProps): React.ReactElement {
  const isProfit = allTimeProfit >= 0;
  const profitTone = isProfit ? "text-green-500" : "text-red-500";

  return (
    <div className="grid gap-4 xl:grid-cols-8 lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-2">
      <StatCard
        label="All-time profit"
        value={hideValues ? "****" : formatSignedCurrency(allTimeProfit)}
        caption={`${isProfit ? "up" : "down"} ${formatPercent(Math.abs(allTimeProfitPercentage))}`}
        valueClassName={profitTone}
        captionClassName={cn("font-medium", profitTone)}
      />
      <StatCard label="Cost Basis" value={hideValues ? "****" : formatCurrency(costBasis)} />
      <StatCard label="Investment Methods" value={totalInvestmentMethods} caption="Active methods" />
      <StatCard label="Active Transactions" value={activeTransactions} caption="Open positions" />
    </div>
  );
}
