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
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import {
  getMainPlan,
  getPlanWithLines,
  listUserPlans,
} from "@/lib/services/finance-plan-service";
import { loadCalibratedView } from "@/lib/services/finance-snapshot-service";
import { buildDashboardFigures } from "@/lib/finance/dashboard";
import { formatDebtFree } from "@/lib/finance/chart-series";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";

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

  // Exactly what the plan page shows: the calibrated plan (portfolio growth
  // included), with "now" as the day-aware position in the reader's zone.
  const timeZone = await getRequestTimeZone();
  const now = todayInTimeZone(timeZone);
  const view = await loadCalibratedView(full, userId, now, { timeZone });
  const fig = buildDashboardFigures(
    view.projection,
    view.today,
    full.confirmationDayOfMonth,
    now
  );
  const points = fig.points;
  const delta = fig.delta;

  const kpis: Array<{ label: string; value: string; tone?: KpiTone }> = [
    {
      label: fig.status === "before-start" ? "Savings at start" : "Savings now",
      value: formatCurrency(fig.savings),
    },
    { label: "Investments", value: formatCurrency(fig.investments), tone: "primary" },
    { label: "Debt now", value: formatCurrency(fig.totalDebt) },
    {
      label: "Debt-free",
      value:
        full.debts.length === 0 && fig.debtFree.kind === "no-debt"
          ? "—"
          : formatDebtFree(fig.debtFree).replace(/^Debt-free in /, "in "),
    },
    {
      label: "Net worth",
      value: formatCurrency(fig.netWorth),
      tone: moneySign(fig.netWorth) >= 0 ? "positive" : "negative",
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
          <Badge variant={moneySign(delta) >= 0 ? "success" : "destructive"} className="font-mono tabular-nums">
            {moneySign(delta) >= 0 ? <TrendingUp /> : <TrendingDown />}
            {formatSignedCurrency(delta)} · {fig.deltaPeriods} mo
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
