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
  getRecentMovementSnapshots,
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
  const [view, history, preferences, managed, movements] = await Promise.all([
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
    getRecentMovementSnapshots(full.id, userId, DASHBOARD_PAST_MONTHS, now),
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
    full.confirmationDayOfMonth,
    movements
  );
  const goal = dashboardGoal(
    view.projection,
    view.today,
    preferences.financeMilestones,
    full.confirmationDayOfMonth,
    now
  );
  const points = fig.points;

  // Only net worth is coloured by its sign. Each part wore its own colour
  // (blue investments, red debt), which clashed with the chart's series
  // colours that the swatches beside these labels now carry.
  // Net worth leads the card under its title, against the last closed
  // period: the number the whole card is about, and whether it moved.
  const lastClose =
    points.slice(0, fig.pastCount).findLast((p) => p.kind === "close") ?? null;
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
      href: "/portal/portfolio",
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
            // The goal while there is debt: when it is gone.
            note:
              goal?.kind === "debt-free" ? (
                <Mono className="block text-2xs text-muted-foreground">{goal.text}</Mono>
              ) : undefined,
          },
        ]
      : []),
  ];
  // A plan with no periods has no chart, and its parts would read against
  // nothing.
  const rail = points.length > 0;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle as="h2" className="flex min-w-0 items-center gap-2">
          <Wallet className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{featured.name}</span>
        </CardTitle>
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
          Wide, net worth and its parts stack in a column on the left and the
          chart takes the rest, as tall as that column; narrow, the figures
          come first and the chart follows. */}
      <CardContent className="@container">
        <div
          className={cn(
            "grid grid-cols-1 gap-6",
            rail && "@2xl:grid-cols-[15rem_minmax(0,1fr)] @2xl:gap-x-8"
          )}
        >
          <div className="flex flex-col gap-6">
            <div className="flex min-w-0 flex-col gap-1">
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
                    "text-3xl font-semibold sm:text-4xl",
                    statToneClass(moneySign(fig.netWorth) >= 0 ? "positive" : "negative")
                  )}
                >
                  {formatCurrency(fig.netWorth)}
                </Mono>
                {lastClose && sinceClose !== null && (
                  <DeltaChip delta={sinceClose} since={lastClose} />
                )}
              </div>
              {goal?.kind === "milestone" && (
                <Mono className="block text-2xs text-muted-foreground">{goal.text}</Mono>
              )}
            </div>
            {rail && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 @2xl:grid-cols-1">
                {breakdown.map((f) => (
                  <FigureItem key={f.label} figure={f} />
                ))}
              </dl>
            )}
          </div>
          <DashboardFinanceMiniChart
            data={points}
            pastCount={fig.pastCount}
            className="h-64 sm:h-72 @2xl:h-auto @2xl:min-h-96"
          />
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
  /** Change since the last close, as a chip beside the value. */
  change?: React.ReactNode;
  /** Makes the whole figure a link; it looks like a button only on hover. */
  href?: string;
  /** Small print under the value. */
  note?: React.ReactNode;
};

/**
 * A figure's change since the last closed period: green when it moved the
 * right way (up, or down for debt), red when not, neutral when it held.
 */
function DeltaChip({
  delta,
  since,
  goodWhen = "up",
}: {
  delta: number;
  since: { month: string; label: string };
  goodWhen?: "up" | "down";
}) {
  const sign = moneySign(delta);
  const good = goodWhen === "up" ? sign > 0 : sign < 0;
  return (
    <Badge
      variant={sign === 0 ? "secondary" : good ? "success" : "destructive"}
      className="font-mono tabular-nums"
      title={`Against the close of ${since.label}`}
    >
      {sign > 0 ? <TrendingUp /> : sign < 0 ? <TrendingDown /> : null}
      {sign === 0 ? formatCurrency(0) : formatSignedCurrency(delta)} · vs {since.month}
    </Badge>
  );
}

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
    <Mono className="block text-2xs text-muted-foreground">
      ({managed.monthMarginPercent !== null && <>{part(managed.monthMarginPercent, "mo")} · </>}
      {part(managed.allTimeMarginPercent, "all")}) margin
    </Mono>
  );
}

/**
 * The StatCard figure (Eyebrow label, Mono value, `statToneClass`) as one
 * term of this card's description list. Every figure is the same size: net
 * worth leads the rail and carries the sign colour, which is emphasis enough.
 */
function FigureItem({ figure }: { figure: Figure }) {
  const { series, label, value, tone, change, note, href } = figure;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        // The negative margin cancels the padding, so the figure sits where
        // it did; only the hover surface reaches past it.
        href &&
          "relative -m-2 rounded-lg p-2 transition-colors hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring/50"
      )}
    >
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
          {href ? (
            // A stretched link: the whole figure is the target, and the
            // description list keeps its dt/dd structure.
            <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-lg">
              {label}
            </Link>
          ) : (
            label
          )}
        </dt>
      </Eyebrow>
      <dd>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Mono className={cn("text-lg font-semibold sm:text-xl", statToneClass(tone))}>
            {value}
          </Mono>
          {change}
        </div>
        {note}
      </dd>
    </div>
  );
}
