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
import {
  dashboardSeries,
  visibleSeriesKeys,
  type DashboardSeries,
} from "./dashboard-finance-series";
import {
  formatCurrency,
  formatSignedCurrency,
  formatSignedPercent,
  moneySign,
} from "@/lib/utils/format";
import {
  getMainPlan,
  getPlanWithLines,
  listUserPlans,
} from "@/lib/services/finance-plan-service";
import {
  getRecentMonthlySnapshots,
  loadCalibratedView,
} from "@/lib/services/finance-snapshot-service";
import { buildPlanTimeline } from "@/lib/finance/chart-series";
import {
  buildDashboardFigures,
  dashboardGoal,
  DASHBOARD_PAST_MONTHS,
} from "@/lib/finance/dashboard";
import { getManagedAssets } from "@/lib/services/margin-service";
import { getUserPreferences } from "@/lib/services/user-preferences-service";
import type { ManagedAssets } from "@/types/margin";
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
  const [view, history, preferences, managed] = await Promise.all([
    loadCalibratedView(full, userId, now, { timeZone }),
    // One month more than the chart shows: a period's close is recorded by the
    // snapshots taken in the period after it.
    getRecentMonthlySnapshots(
      full.id,
      userId,
      DASHBOARD_PAST_MONTHS + 1,
      now,
      full.confirmationDayOfMonth
    ),
    getUserPreferences(userId),
    // Same request-cached read the projection already made for net worth.
    full.includePortfolio ? getManagedAssets(userId) : Promise.resolve(null),
  ]);
  // The months before today come off the plan page's own timeline: recorded
  // snapshots, or the plan's forecast while it has none.
  const timeline = buildPlanTimeline(
    history,
    view.projection,
    now,
    full.confirmationDayOfMonth,
    view.baseline.baselineSource === "plan" ? view.projection : null
  );
  const fig = buildDashboardFigures(
    view.projection,
    view.today,
    timeline.points.slice(0, timeline.todayIndex),
    full.confirmationDayOfMonth
  );
  const goal = dashboardGoal(
    view.projection,
    view.today,
    preferences.financeMilestones,
    full.confirmationDayOfMonth,
    now
  );
  const points = fig.points;
  const delta = fig.delta;

  // Only net worth is coloured by its sign. Each part wore its own colour
  // (blue investments, red debt), which clashed with the chart's series
  // colours that the swatches beside these labels now carry.
  // Net worth leads the card under its title, against the last closed
  // period: the number the whole card is about, and whether it moved.
  const lastClose = fig.pastCount > 0 ? points[fig.pastCount - 1] : null;
  const sinceClose = lastClose ? fig.netWorth - lastClose.netWorth : null;
  // Net worth, Portfolio and Cash always show; Owed to you and Debt when the
  // chart's range has any — a $0.00 debt tile on a plan with none is noise.
  const visible = visibleSeriesKeys(points);
  const breakdown: Figure[] = [
    {
      series: dashboardSeries("investments"),
      label: "Portfolio",
      value: formatCurrency(fig.investments),
      note: managedNote(managed),
    },
    {
      series: dashboardSeries("savings"),
      label: "Cash",
      value: formatCurrency(fig.savings),
    },
    ...(visible.has("receivables")
      ? [
          {
            series: dashboardSeries("receivables"),
            label: "Owed to you",
            value: formatCurrency(fig.receivables),
          },
        ]
      : []),
    ...(visible.has("debt")
      ? [
          {
            series: dashboardSeries("debt"),
            label: "Debt",
            value: formatCurrency(fig.debt),
          },
        ]
      : []),
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
          <span>{goal ?? "12-month projection"}</span>
          <Badge variant={moneySign(delta) >= 0 ? "success" : "destructive"} className="font-mono tabular-nums">
            {moneySign(delta) >= 0 ? <TrendingUp /> : <TrendingDown />}
            {formatSignedCurrency(delta)} · {fig.deltaPeriods} mo
          </Badge>
        </CardDescription>
        <div className="flex flex-col gap-1 pt-3">
          <Eyebrow size="sm" as="div" className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-0.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: dashboardSeries("netWorth").color }}
            />
            Net worth
          </Eyebrow>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Mono
              className={cn(
                "text-2xl font-semibold sm:text-3xl",
                statToneClass(moneySign(fig.netWorth) >= 0 ? "positive" : "negative")
              )}
            >
              {formatCurrency(fig.netWorth)}
            </Mono>
            {lastClose && sinceClose !== null && (
              <Mono
                className={cn(
                  "text-sm",
                  statToneClass(moneySign(sinceClose) >= 0 ? "positive" : "negative")
                )}
              >
                {moneySign(sinceClose) >= 0 ? "↑" : "↓"} {formatSignedCurrency(sinceClose)}{" "}
                <span className="text-muted-foreground">vs {lastClose.label} close</span>
              </Mono>
            )}
          </div>
        </div>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/portal/plans/${featured.id}`}>
              Open
              <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      {/* Laid out on the card's width, not the viewport's: from `lg` the
          sidebar takes 192px, so this card is narrower at 1050px than at 1000px.
          Wide, the chart fills the left and the parts stack in a rail on the
          right; narrow, the parts follow the chart. */}
      <CardContent className="@container">
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            rail && "@xl:grid-cols-[minmax(0,1fr)_14rem] @xl:gap-x-8"
          )}
        >
          <DashboardFinanceMiniChart
            data={points}
            pastCount={fig.pastCount}
            className="h-48 sm:h-56 @xl:h-auto @xl:min-h-72"
          />
          <dl
            className={cn(
              "grid grid-cols-2 gap-x-4 gap-y-3",
              rail && "@xl:grid-cols-1 @xl:self-center"
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
  /** Small print under the value. */
  note?: React.ReactNode;
};

/**
 * The managed book's margin as a share of what is owed, this month and to
 * date — beside the assets' value, which is what counts toward net worth.
 */
function managedNote(managed: ManagedAssets | null): React.ReactNode {
  if (!managed || managed.value <= 0 || managed.allTimeMarginPercent === null) return undefined;
  const part = (pct: number, label: string) => (
    <span className={statToneClass(pct >= 0 ? "positive" : "negative")}>
      {formatSignedPercent(pct, 1)} {label}
    </span>
  );
  return (
    <>
      ({managed.monthMarginPercent !== null && <>{part(managed.monthMarginPercent, "mo")} · </>}
      {part(managed.allTimeMarginPercent, "all")}) margin
    </>
  );
}

/**
 * The StatCard figure (Eyebrow label, Mono value, `statToneClass`) as one
 * term of this card's description list. Every figure is the same size: net
 * worth leads the rail and carries the sign colour, which is emphasis enough.
 */
function FigureItem({ figure }: { figure: Figure }) {
  const { series, label, value, tone, note } = figure;
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
        {note && <Mono className="block text-2xs text-muted-foreground">{note}</Mono>}
      </dd>
    </div>
  );
}
