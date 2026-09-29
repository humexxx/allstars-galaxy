import Link from "next/link";
import {
  ArrowRight,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statToneClass } from "@/components/ui/stat-card";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { DashboardFinanceMiniChart } from "./dashboard-finance-mini-chart";
import { formatDay } from "@/lib/utils/date";
import { formatCurrency, formatSignedCurrency } from "@/lib/utils/format";
import {
  getAutoInvestRate,
  getMainPlan,
  getPlanWithLines,
  getPortfolioValueForUser,
  listUserPlans,
  projectPlan,
} from "@/lib/services/finance-plan-service";
import { buildCalibratedPlan } from "@/lib/services/finance-snapshot-service";
import { periodIndexForDate } from "@/lib/finance/period";

// UTC-anchored — projection.months[i].date is generated at UTC midnight; local
// formatting would shift a month for users in negative-offset timezones.
const MONTH_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

type DashboardFinanceCardProps = {
  userId: string;
};

export async function DashboardFinanceCard({ userId }: DashboardFinanceCardProps) {
  const plans = await listUserPlans(userId);

  if (plans.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Wallet className="size-5 shrink-0" aria-hidden="true" />
            Finance plan
          </CardTitle>
          <CardDescription>
            Build a plan to project your savings, debts and net worth month by month.
          </CardDescription>
          <CardAction>
            <Button asChild>
              <Link href="/portal/plans/new">
                <PlusCircle />
                Create plan
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>
    );
  }

  const featured =
    (await getMainPlan(userId)) ??
    plans.slice().sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    )[0];
  const full = await getPlanWithLines(featured.id, userId);
  if (!full) return null;

  // Calibrate from the latest confirmation so the card reflects the user's real
  // numbers (the [id] page does the same). Raw plan would ignore confirmations.
  const baseline = await buildCalibratedPlan(full);

  const [portfolioValue, autoInvestRate] = await Promise.all([
    baseline.includePortfolio
      ? getPortfolioValueForUser(userId)
      : Promise.resolve(0),
    getAutoInvestRate(baseline),
  ]);
  const projection = projectPlan(
    baseline,
    baseline.incomes,
    baseline.expenses,
    baseline.debts,
    { portfolioValue, autoInvestRate, overrides: baseline.overrides }
  );

  // Locate the accounting period that contains today (not months[0], the plan
  // START period) so the "now" figures and the 12-period preview track reality.
  const lastIdx = Math.max(0, projection.months.length - 1);
  const todayIdx = Math.min(
    Math.max(
      0,
      periodIndexForDate(baseline.startMonth, baseline.confirmationDayOfMonth, new Date())
    ),
    lastIdx
  );
  const todayMonth = projection.months[todayIdx];

  const points = projection.months.slice(todayIdx, todayIdx + 12).map((m) => ({
    month: MONTH_FMT.format(m.date),
    netWorth: Math.round(m.netWorth),
  }));

  const currentNetWorth = todayMonth?.netWorth ?? 0;
  const endNetWorth =
    projection.months[Math.min(todayIdx + 12, lastIdx)]?.netWorth ??
    currentNetWorth;
  const delta = endNetWorth - currentNetWorth;
  const totalDebt = todayMonth?.totalDebt ?? 0;

  const kpis: Array<{ label: string; value: string; tone?: KpiTone }> = [
    { label: "Savings now", value: formatCurrency(todayMonth?.savings ?? 0) },
    { label: "Investments", value: formatCurrency(todayMonth?.investments ?? 0), tone: "primary" },
    { label: "Debt now", value: formatCurrency(totalDebt) },
    {
      label: "Debt-free in",
      value:
        projection.monthsToDebtFree !== null
          ? `${Math.max(0, projection.monthsToDebtFree - todayIdx)} mo`
          : full.debts.length === 0
          ? "—"
          : ">range",
    },
    {
      label: "Net worth",
      value: formatCurrency(currentNetWorth),
      tone: currentNetWorth >= 0 ? "positive" : "negative",
    },
  ];

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle as="h2" className="flex min-w-0 items-center gap-2">
          <Wallet className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{featured.name}</span>
        </CardTitle>
        {/* The delta rides the description line, not the action slot: beside
            the button it squeezed the plan name to a few characters on phones. */}
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
          <span>12-month projection · updated {formatDay(featured.updatedAt)}</span>
          <Badge variant={delta >= 0 ? "success" : "destructive"} className="font-mono tabular-nums">
            {delta >= 0 ? <TrendingUp /> : <TrendingDown />}
            {formatSignedCurrency(delta)} · 12 mo
          </Badge>
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/plans/${featured.id}`}>
              Open
              <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {kpis.map((k) => (
            <KpiTile key={k.label} {...k} />
          ))}
        </div>
        <DashboardFinanceMiniChart data={points} />
      </CardContent>
    </Card>
  );
}

type KpiTone = "neutral" | "positive" | "negative" | "primary";

/**
 * The StatCard figure (Eyebrow label, Mono value, `statToneClass`) as a tile
 * inside this card rather than a card of its own. One step smaller than
 * StatCard's figure: five of these share a row from `sm`.
 */
function KpiTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: KpiTone;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <Eyebrow size="sm" as="div">
        {label}
      </Eyebrow>
      <Mono
        className={cn(
          "text-lg font-semibold tabular-nums sm:text-xl",
          tone === "primary" ? "text-primary" : tone !== "neutral" && statToneClass(tone)
        )}
      >
        {value}
      </Mono>
    </div>
  );
}
