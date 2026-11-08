import Link from "next/link";
import {
  ArrowRight,
  PlusCircle,
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
import { statToneClass } from "@/components/ui/stat-card";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { CountUpCurrency } from "./count-up";
import { DeltaChip } from "./delta-chip";
import { SeriesSwatch } from "./series-swatch";
import { ProjectionChart } from "./projection-chart";
import { drawDelay } from "./dashboard-motion";
import {
  dashboardSeries,
  visibleSeriesKeys,
  type DashboardSeries,
} from "./dashboard-finance-series";
import { formatCurrency, formatSignedPercent, moneySign } from "@/lib/utils/format";
import {
  getMainPlan,
  getPlanWithLines,
  listUserPlans,
} from "@/lib/services/finance-plan-service";
import { getRecentMonthlySnapshots, loadCalibratedView } from "@/lib/services/finance-snapshot-service";
import {
  alignTodayPoint,
  buildChartSeries,
  buildPlanTimeline,
  portfolioSeries,
} from "@/lib/finance/chart-series";
import { buildDashboardFigures, changeBaseline, dashboardGoal } from "@/lib/finance/dashboard";
import { getPortfolioPerformanceData } from "@/lib/services/chart-service";
import { getUserPortfolio } from "@/lib/services/portfolio-service";
import { getLastConfirmedDay } from "@/lib/services/finance-confirmation-service";
import { getManagedAssets } from "@/lib/services/margin-service";
import { isModuleEnabled } from "@/lib/services/module-access-service";
import { getUserPreferences } from "@/lib/services/user-preferences-service";
import type { ManagedAssets } from "@/types/margin";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { todayInTimeZone } from "@/lib/utils/date";

/** The plan page's default horizon: the card shows what the page opens on. */
const DASHBOARD_HORIZON = 12;

const TODAY_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The live portfolio's recorded value over time: the past of the Portfolio series. */
async function portfolioHistoryOf(userId: string): Promise<{ date: Date; value: number }[]> {
  const portfolio = await getUserPortfolio(userId);
  if (!portfolio) return [];
  const points = await getPortfolioPerformanceData(portfolio.id, "All");
  return points.map((p) => ({ date: new Date(p.date), value: p.value }));
}

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
  const anchorDay = full.confirmationDayOfMonth;
  const withPortfolio = full.includePortfolio && (await isModuleEnabled(userId, "portfolio"));
  const [view, history, preferences, managed, lastConfirmedDay, tradingOn, portfolioHistory] = await Promise.all([
    loadCalibratedView(full, userId, now, { timeZone }),
    // The plan page's own read: its chart and this one draw the same series.
    getRecentMonthlySnapshots(full.id, userId, 36, now, anchorDay),
    getUserPreferences(userId),
    // Same request-cached read the projection already made for net worth.
    withPortfolio ? getManagedAssets(userId) : Promise.resolve(null),
    getLastConfirmedDay(userId),
    isModuleEnabled(userId, "trading"),
    withPortfolio ? portfolioHistoryOf(userId) : Promise.resolve([]),
  ]);
  const simulatedPast = view.baseline.baselineSource === "plan" ? view.projection : null;
  // The months before today come off the plan page's own timeline: recorded
  // snapshots, or the plan's forecast while it has none.
  const timeline = buildPlanTimeline(history, view.projection, now, anchorDay, simulatedPast);
  const fig = buildDashboardFigures(
    view.projection,
    view.today,
    // A period never confirmed is only a place on the plan page's axis; the
    // card's axis is time, so the line crosses it anyway.
    timeline.points.slice(0, timeline.todayIndex).filter((p) => !p.skipped),
    anchorDay
  );
  // The chart IS the plan page's, on its 12-month horizon: the same points
  // (checkpoints, today, the closes ahead) and the same Portfolio series.
  const chart = alignTodayPoint(
    buildChartSeries(history, view.projection, DASHBOARD_HORIZON, now, anchorDay, simulatedPast),
    view.today,
    anchorDay
  );
  const portfolioValues = portfolioSeries(chart, portfolioHistory, view.projection, anchorDay, withPortfolio);
  const goal = dashboardGoal(view.projection, view.today, preferences.financeMilestones, anchorDay, now);
  const points = fig.points;

  // Only net worth is coloured by its sign. Each part wore its own colour
  // (blue investments, red debt), which clashed with the chart's series
  // colours that the swatches beside these labels now carry.
  // Net worth leads the card under its title, against the user's last
  // confirmation (else the last closed period): the number the whole card is
  // about, and whether it moved.
  const changeFrom = changeBaseline(
    points.slice(0, fig.pastCount).filter((p) => p.kind === "close"),
    (p) => p.time,
    (p) => p,
    lastConfirmedDay
  );
  const sinceClose = changeFrom ? fig.netWorth - changeFrom.point.netWorth : null;
  // The parts the plan page shows: Portfolio always, Trading for an account
  // with the module, Owed to you and Debt when the chart's range has any — a
  // $0.00 debt tile on a plan with none is noise. No cash, as on the plan.
  const visible = visibleSeriesKeys(points, { trading: tradingOn });
  const breakdown: Figure[] = [
    {
      series: dashboardSeries("investments"),
      label: "Portfolio",
      amount: fig.investments,
      note: managedNote(managed, fig.positions, fig.claims),
      href: "/portal/portfolio",
    },
    ...(visible.has("trading")
      ? [
          {
            series: dashboardSeries("trading"),
            label: "Trading",
            amount: fig.trading,
            href: "/portal/trading",
          },
        ]
      : []),
    ...(visible.has("receivables")
      ? [
          {
            series: dashboardSeries("receivables"),
            label: "Owed to you",
            amount: fig.receivables,
          },
        ]
      : []),
    ...(visible.has("debt")
      ? [
          {
            series: dashboardSeries("debt"),
            label: "Debt",
            amount: fig.debt,
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
                <SeriesSwatch series={dashboardSeries("netWorth")} />
                Net worth
              </Eyebrow>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Mono
                  className={cn(
                    "text-3xl font-semibold sm:text-4xl",
                    statToneClass(moneySign(fig.netWorth) >= 0 ? "positive" : "negative")
                  )}
                >
                  <CountUpCurrency value={fig.netWorth} delay={drawDelay("netWorth")} />
                </Mono>
                {changeFrom && sinceClose !== null && (
                  <DeltaChip delta={sinceClose} since={changeFrom.since} />
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
          <ProjectionChart
            points={chart.points}
            pastCount={chart.pastCount}
            portfolioValues={portfolioValues}
            showTrading={tradingOn}
            milestones={preferences.financeMilestones}
            todayLabel={view.today?.status === "in-range" ? `Today ${TODAY_LABEL.format(now)}` : undefined}
            markToday={view.today?.status !== "before-start"}
            heightClass="aspect-auto h-64 sm:h-72 @2xl:h-full @2xl:min-h-96"
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
  /** Counts up from $0 on load, in its series' turn of the chart's draw-in. */
  amount: number;
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
/**
 * The two sides of the managed margin the Portfolio figure holds — the
 * positions and what is owed to the investors, the plan's Portfolio card's
 * figures — and that margin as a share of what is owed, this month and to
 * date. Only for an account that runs methods: a client has none.
 */
function managedNote(managed: ManagedAssets | null, positions: number, claims: number): React.ReactNode {
  if (!managed || managed.value <= 0 || managed.allTimeMarginPercent === null) return undefined;
  const part = (pct: number, label: string) => (
    <span className={statToneClass(pct >= 0 ? "positive" : "negative")}>
      {formatSignedPercent(pct, 1)} {label}
    </span>
  );
  return (
    <Mono className="block text-2xs text-muted-foreground">
      {claims > 0 && (
        <>
          {formatCurrency(positions)} positions · {formatCurrency(claims)} owed ·{" "}
        </>
      )}
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
  const { series, label, amount, tone, change, note, href } = figure;
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
          <SeriesSwatch series={series} />
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
          <Mono className={cn("text-sm font-semibold sm:text-base", statToneClass(tone))}>
            <CountUpCurrency value={amount} delay={drawDelay(series.key === "savings" ? "netWorth" : series.key)} />
          </Mono>
          {change}
        </div>
        {note}
      </dd>
    </div>
  );
}
