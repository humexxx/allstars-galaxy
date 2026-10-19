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
import { dashboardSeries, type DashboardSeries } from "./dashboard-finance-series";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import {
  getMainPlan,
  getPlanWithLines,
  listUserPlans,
} from "@/lib/services/finance-plan-service";
import { loadCalibratedView } from "@/lib/services/finance-snapshot-service";
import { buildDashboardFigures } from "@/lib/finance/dashboard";
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
  const fig = buildDashboardFigures(view.projection, view.today);
  const points = fig.points;
  const delta = fig.delta;
  // The reader's calendar day, not the server's: this renders on the server
  // (UTC), which dated an evening edit in Costa Rica "tomorrow".
  const updated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(featured.updatedAt);

  // Only net worth is coloured by its sign. Each part wore its own colour
  // (blue investments, red debt), which clashed with the chart's series
  // colours that the swatches beside these labels now carry.
  const netWorth: Figure = {
    series: dashboardSeries("netWorth"),
    label: "Net worth",
    value: formatCurrency(fig.netWorth),
    tone: moneySign(fig.netWorth) >= 0 ? "positive" : "negative",
  };
  const breakdown: Figure[] = [
    {
      series: dashboardSeries("savings"),
      label: fig.status === "before-start" ? "Savings at start" : "Savings now",
      value: formatCurrency(fig.savings),
    },
    {
      series: dashboardSeries("investments"),
      label: "Investments",
      value: formatCurrency(fig.investments),
    },
    {
      series: dashboardSeries("receivables"),
      label: "Owed to you",
      value: formatCurrency(fig.receivables),
    },
    {
      series: dashboardSeries("debt"),
      label: "Debt now",
      value: formatCurrency(fig.debt),
    },
  ];
  // A plan with no periods has no line to draw, and a rail beside nothing is
  // a column of figures with a hole on its left.
  const rail = points.length > 0;

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
          <span>
            12-month projection ·{" "}
            <span className="whitespace-nowrap">updated {updated}</span>
          </span>
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
      {/* Laid out on the card's width, not the viewport's: from `md` the
          sidebar takes 256px, so this card is narrower at 800px than at 700px.
          Wide, the chart fills the left and the figures stack in a rail on the
          right; narrow, net worth heads the chart it plots and the breakdown
          follows. */}
      <CardContent className="@container">
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            rail && "@xl:grid-cols-[minmax(0,1fr)_14rem] @xl:grid-rows-[auto_1fr] @xl:gap-x-8"
          )}
        >
          <dl className={cn(rail && "@xl:col-start-2")}>
            <FigureItem figure={netWorth} />
          </dl>
          <DashboardFinanceMiniChart
            data={points}
            className="h-48 sm:h-56 @xl:col-start-1 @xl:row-span-2 @xl:row-start-1 @xl:h-auto @xl:min-h-72"
          />
          <dl
            className={cn(
              "grid grid-cols-2 gap-x-4 gap-y-3",
              rail && "@xl:col-start-2 @xl:grid-cols-1 @xl:self-end"
            )}
          >
            {breakdown.map((f) => (
              <FigureItem key={f.label} figure={f} />
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

type Figure = {
  /** The chart series this figure is a reading of; its swatch is the legend. */
  series: DashboardSeries;
  label: string;
  value: string;
  tone?: "positive" | "negative";
};

/**
 * The StatCard figure (Eyebrow label, Mono value, `statToneClass`) as one
 * term of this card's description list. Every figure is the same size: net
 * worth leads the rail and carries the sign colour, which is emphasis enough.
 */
function FigureItem({ figure }: { figure: Figure }) {
  const { series, label, value, tone } = figure;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Eyebrow size="sm" asChild>
        <dt className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "shrink-0",
              series.mark === "line" ? "h-0.5 w-2.5 rounded-full" : "size-2 rounded-xs"
            )}
            style={{ backgroundColor: series.color }}
          />
          {label}
        </dt>
      </Eyebrow>
      <dd>
        <Mono className={cn("text-lg font-semibold sm:text-xl", statToneClass(tone))}>
          {value}
        </Mono>
      </dd>
    </div>
  );
}
