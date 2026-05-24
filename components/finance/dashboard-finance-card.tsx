import Link from "next/link";
import { ArrowRight, PlusCircle, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { DashboardFinanceMiniChart } from "./dashboard-finance-mini-chart";
import { formatCurrency } from "@/lib/utils/format";
import {
  getAutoInvestRate,
  getPlanWithLines,
  getPortfolioValueForUser,
  listUserPlans,
  projectPlan,
} from "@/lib/services/finance-plan-service";

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "short" });

type DashboardFinanceCardProps = {
  userId: string;
};

export async function DashboardFinanceCard({ userId }: DashboardFinanceCardProps) {
  const plans = await listUserPlans(userId);

  if (plans.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Finance plan
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Build a plan to project your savings, debts and net worth month by month.
          </p>
          <Button asChild>
            <Link href="/portal/plans/new">
              <PlusCircle className="mr-1 h-4 w-4" /> Create plan
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show the most recently updated plan as the dashboard signal.
  const featured = plans.slice().sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )[0];
  const full = await getPlanWithLines(featured.id, userId);
  if (!full) return null;

  const [portfolioValue, autoInvestRate] = await Promise.all([
    full.includePortfolio ? getPortfolioValueForUser(userId) : Promise.resolve(0),
    getAutoInvestRate(full),
  ]);
  const projection = projectPlan(full, full.incomes, full.expenses, full.debts, {
    portfolioValue,
    autoInvestRate,
    overrides: full.overrides,
  });

  // Keep the dashboard mini focused on the next 12 months so the line is readable.
  const points = projection.months.slice(0, 12).map((m) => ({
    month: MONTH_FMT.format(m.date),
    netWorth: Math.round(m.netWorth),
  }));

  const firstMonth = projection.months[0];
  const currentNetWorth = firstMonth?.netWorth ?? 0;
  const endNetWorth = projection.months.slice(0, 12).at(-1)?.netWorth ?? currentNetWorth;
  const delta = endNetWorth - currentNetWorth;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {featured.name}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              12-month projection · updated {featured.updatedAt.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {delta >= 0 ? "+" : ""}
              {formatCurrency(delta)} in 12 mo
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/plans/${featured.id}`}>
                Open <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Savings now
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(parseFloat(full.initialSavings))}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Investments
            </p>
            <p className="mt-1 text-xl font-semibold text-blue-600">
              {formatCurrency(parseFloat(full.initialInvestments))}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Debt now
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                full.debts.reduce((s, d) => s + parseFloat(d.initialBalance), 0)
              )}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Debt-free in
            </p>
            <p className="mt-1 text-xl font-semibold">
              {projection.monthsToDebtFree !== null
                ? `${projection.monthsToDebtFree} mo`
                : full.debts.length === 0
                ? "—"
                : ">range"}
            </p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Net worth (now)
            </p>
            <p
              className={`mt-1 text-xl font-semibold ${
                currentNetWorth >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(currentNetWorth)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <DashboardFinanceMiniChart data={points} />
        </div>
      </CardContent>
    </Card>
  );
}
