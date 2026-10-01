"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  CalendarDays,
  Camera,
  ClipboardCheck,
  GitBranch,
  LineChart,
  type LucideIcon,
  MoreHorizontal,
  Star,
  Table2,
  Unlink,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/portal/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";

import { useRegisterDevTool } from "@/components/dev-tools/dev-tools-context";
import { runDailySnapshotsAction } from "@/app/actions/dev-tools";

import { ConfirmationDialog } from "./confirmation-dialog";
import { PeriodCompareDialog } from "./period-compare-dialog";
import { FinancialHealthDonut } from "./financial-health-donut";
import { PlanLineEditor } from "./plan-line-editor";
import { PlanDebtEditor } from "./plan-debt-editor";
import { PlanForm } from "./plan-form";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

// Recharts is one of the heaviest deps in the app — lazy-load the chart so the
// projection editor's initial bundle stays small. The skeleton matches the
// rendered chart's responsive height so swapping in the real chart doesn't
// shift the hero (it's the first thing on screen).
// The calendar is the largest module in the editor and the table is the least
// visited view; neither is on screen until the reader switches to it, so they
// join the chart in loading on demand.
const PlanCalendar = dynamic(
  () => import("./plan-calendar").then((mod) => mod.PlanCalendar),
  { loading: () => <Skeleton className="min-h-80 w-full" /> }
);

const ProjectionTable = dynamic(
  () => import("./projection-table").then((mod) => mod.ProjectionTable),
  { loading: () => <Skeleton className="h-72 w-full" /> }
);

const ProjectionChart = dynamic(
  () => import("./projection-chart").then((mod) => mod.ProjectionChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full sm:h-80 xl:h-full" />,
  }
);

import {
  addPlanDebtAction,
  addPlanExpenseAction,
  addPlanIncomeAction,
  createScenarioAction,
  deleteLineOverrideAction,
  deletePlanDebtAction,
  deletePlanExpenseAction,
  deletePlanIncomeAction,
  setMainPlanAction,
  updatePlanAction,
  updatePlanDebtAction,
  updatePlanExpenseAction,
  updatePlanIncomeAction,
  upsertLineOverrideAction,
} from "@/app/actions/finance-plans";
import type { ActionResult } from "@/lib/actions/safe";
import { cn } from "@/lib/utils";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import { periodIndexForDate, periodRangeFor } from "@/lib/finance/period";
import {
  alignTodayPoint,
  buildChartSeries,
  describeDebtFree,
  forecastKpiPoints,
  formatDebtFree,
  mapGhostValues,
  mapPortfolioValues,
  type PlanHistoryPoint,
} from "@/lib/finance/chart-series";
import { planOccurrences } from "@/lib/finance/schedule";
import { compareScenario } from "@/lib/finance/scenario";
import type {
  DebtStrategy,
  FinancePlanWithLines,
  InvestmentMethodOption,
  Projection,
  StrategyComparison,
  TodayState,
} from "@/types/finance";

/** Figures for one accounting period, previewed in the sidebar while hovering
 *  a chart point. Health/surplus derive from these, so they're not stored. */
type PeriodFigures = {
  /** Chip label, e.g. "Apr 2026". */
  label: string;
  income: number;
  livingExpenses: number;
  minDebtPayments: number;
  totalDebt: number;
};

// Chip label for the hovered period — UTC for the same reason as the chart's
// axis formatter (projection dates are UTC midnights).
const HOVER_PERIOD_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Animates toward `target` whenever it changes (easeOutQuint, like the health
 * donut), so the sidebar figures count up/down on hover instead of snapping.
 * Initial render starts AT the target — no mount animation. With reduced
 * motion the figure simply changes.
 */
function useAnimatedNumber(target: number, duration = 350): number {
  const reducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(target);
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    let from: number | null = null;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 5);
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      setDisplay((curr) => {
        if (from === null) from = curr;
        return from + (target - from) * ease(t);
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target, duration, reducedMotion]);
  return reducedMotion ? target : display;
}

/** What a mutation hands to `wrap`: any server action's result. */
type Wrap = <T>(fn: () => Promise<ActionResult<T>>) => Promise<void>;

/** For fire-and-forget calls to `wrap`, which has already toasted a failure. */
function settle(promise: Promise<void>): void {
  promise.catch(() => undefined);
}

/** Base plan overlay data for scenario plans (plans with basedOnPlanId). */
type GhostPlan = {
  name: string;
  color: string;
  /** The base plan projected from its plan as written (see page.tsx). */
  projection: Projection;
  /** The base plan's day-aware position today, for the ghost's today point. */
  today: TodayState | null;
};

type PlanEditorProps = {
  plan: FinancePlanWithLines;
  /** Plan calibrated from the latest confirmation (on its day) — drives every
   *  figure. The raw `plan` is what the line/debt editors mutate. */
  baseline: FinancePlanWithLines;
  projection: Projection;
  /** The plan as written — flows for hovered periods before the calibration
   *  start. Equals `projection` while the plan has no confirmation. */
  pastProjection: Projection;
  /** The plan's own forecast as the chart's past, only while it has never been
   *  confirmed; null once real confirmed values exist. */
  simulatedPast: Projection | null;
  /** Where the plan stands today — THE "today" figure (KPI, chart dot,
   *  sidebar debt, confirmation pre-fill). */
  today: TodayState | null;
  /** Real snapshots for the chart's past (oldest first). */
  history: PlanHistoryPoint[];
  comparison: StrategyComparison | null;
  investmentMethods: InvestmentMethodOption[];
  /** Base plan overlay when this plan is a scenario. */
  ghost?: GhostPlan | null;
  /** This scenario projected on the same footing as `ghost.projection`. */
  scenarioBasis?: Projection | null;
  /** Recorded portfolio value history — the past of the portfolio series. */
  portfolioHistory?: { date: Date; value: number }[];
  /** Net-worth milestones from the user's global preference. */
  milestones?: readonly number[];
  title: string;
  description: string;
  /** When set, renders the header's back link to here. */
  backHref?: string;
  /** The reader's calendar day (UTC midnight), resolved on the server in their
   *  time zone. Everything "today" derives from it. */
  now: Date;
};

export function PlanEditor({
  plan,
  baseline,
  projection,
  pastProjection,
  simulatedPast,
  today: todayState,
  history,
  comparison,
  investmentMethods,
  ghost = null,
  scenarioBasis = null,
  portfolioHistory = [],
  milestones,
  title,
  description,
  backHref,
  now,
}: PlanEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // The one place a mutation's failure is announced. It rejects so the caller
  // can keep its dialog open, and callers must not toast again. It settles
  // even when the action itself throws (a dropped connection), or a form's
  // "Saving…" would never clear.
  const wrap: Wrap = (fn) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          const result = await fn();
          if (result.success) {
            resolve();
          } else {
            toast.error(result.error);
            reject(new Error(result.error));
          }
        } catch (err) {
          toast.error("Failed to save changes");
          reject(err);
        }
      });
    });

  // The accounting period that contains today — the one the sidebar's cycle
  // figures describe. `today.periodIndex` is resolved by the engine (clamped
  // into the horizon: the first period for a plan that hasn't started, the
  // last for one that ended).
  const currentPeriodIdx = Math.min(
    Math.max(
      0,
      todayState?.periodIndex ??
        periodIndexForDate(baseline.startMonth, baseline.confirmationDayOfMonth, now)
    ),
    Math.max(0, projection.months.length - 1)
  );
  const current = projection.months[currentPeriodIdx];
  // Pre-fill for the confirmation dialog: the projected position ON today.
  // A confirmation records the balances on the day it's made, so saving the
  // pre-fill unchanged leaves the forecast exactly where it was.
  const confirmationPrefill = {
    savings: todayState?.savings ?? parseFloat(baseline.initialSavings),
    investments: todayState?.investments ?? parseFloat(baseline.initialInvestments),
    debts:
      todayState?.debts ??
      baseline.debts.map((d) => ({
        debtId: d.id,
        name: d.name,
        balance: parseFloat(d.initialBalance),
      })),
  };
  // Cycle figures: the WHOLE current period's flows (occurrences dated before
  // the as-of day are included here even though the confirmed balance
  // already holds them — this is the period's budget, not what's left of it).
  const income = current?.income ?? 0;
  const livingExpenses = current?.expenses ?? 0;
  const minDebtPayments = current?.scheduledDebtPayments ?? 0;
  const extraDebtPayments = current?.extraDebtPayments ?? 0;
  // Fixed outflow: living + debt minimums — the gauge numerator.
  const fixedOutflow = livingExpenses + minDebtPayments;
  const surplus = income - fixedOutflow;
  const investmentsContribution = Math.max(0, current?.investmentsContribution ?? 0);
  const toWealth = surplus - extraDebtPayments;
  const savingsContribution = Math.max(0, toWealth - investmentsContribution);

  // Debt NOW (day-aware, the same figure as the chart's today dot), not the
  // projected close of the period.
  const totalDebt = todayState?.totalDebt ?? current?.totalDebt ?? 0;

  // Chart-hover preview: while the pointer is over a chart point, the sidebar
  // cards show THAT period's figures; on leave they snap back.
  const [hoverFigures, setHoverFigures] = useState<PeriodFigures | null>(null);
  const isPreview = hoverFigures !== null;
  const dIncome = hoverFigures?.income ?? income;
  const dLivingExpenses = hoverFigures?.livingExpenses ?? livingExpenses;
  const dMinDebtPayments = hoverFigures?.minDebtPayments ?? minDebtPayments;
  const dFixedOutflow = dLivingExpenses + dMinDebtPayments;
  const dSurplus = dIncome - dFixedOutflow;
  const dTotalDebt = hoverFigures?.totalDebt ?? totalDebt;

  // Current accounting PERIOD (anchor→anchor, e.g. day 5 ⇒ Apr 5 – May 4).
  const anchorDay = plan.confirmationDayOfMonth;
  const effectiveAnchorDay = anchorDay > 0 ? anchorDay : 1;
  const isPeriodMode = anchorDay > 1;
  const currentMonthDate = current?.date ?? new Date(plan.startMonth);
  const currentPeriod = periodRangeFor(currentMonthDate, effectiveAnchorDay);

  const fmtPeriodDay = (d: Date): string =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d);
  const periodLabel = isPeriodMode
    ? `${fmtPeriodDay(currentPeriod.start)} – ${fmtPeriodDay(currentPeriod.end)}`
    : null;
  const incomeLabel = isPeriodMode ? "Period income" : "Monthly income";
  // The row is living expenses PLUS debt minimums (the gauge numerator), so it
  // must not be called "Living expenses": the Surplus breakdown uses that name
  // for the expenses alone, and the two showed different figures.
  const expensesLabel = isPeriodMode ? "Period expenses & debt" : "Expenses & debt";

  // Breakdown lines: the SAME occurrences the engine counted for this period
  // (overrides applied — skipped lines are gone, amounts swapped, moved dates
  // honoured, a line hitting twice listed twice), so each list adds up to the
  // figure above it.
  const periodOccurrences = planOccurrences(
    baseline,
    currentPeriod.start,
    currentPeriod.end
  );
  const occurrenceItems = (side: "income" | "expense") =>
    periodOccurrences
      .filter((o) => o.side === side)
      .map((o) => ({
        name: o.name,
        amount: o.amount ?? 0,
        hint: o.moved ? `${fmtPeriodDay(o.date)} · moved` : fmtPeriodDay(o.date),
      }));
  const incomeItems = occurrenceItems("income");
  const expenseItems = occurrenceItems("expense");
  // Debt minimums: each payment the engine made this period, on its day, at
  // the amount actually paid (capped at the balance).
  const debtPaymentItems = (current?.debts ?? [])
    .flatMap((d) => d.payments.map((p) => ({ name: d.name, amount: p.amount, date: p.date })))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => ({ name: p.name, amount: p.amount, hint: fmtPeriodDay(p.date) }));
  const debtBalanceLines = (todayState?.debts ?? current?.debts ?? []).map((d) => ({
    name: d.name,
    balance: d.balance,
  }));
  const debtFreeLabel = formatDebtFree(
    describeDebtFree(projection, effectiveAnchorDay, now)
  );

  // Label for the confirmation dialog header. Period mode shows the window
  // (e.g. "Apr 5 – May 4"); calendar mode shows month + year.
  const confirmDialogLabel =
    periodLabel ??
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(currentMonthDate);

  // Controlled tab value. Overview is the primary surface (it hosts the
  // Graph / Table / Calendar view-switcher); Setup / Settings are reached via
  // the More dropdown.
  const [tab, setTab] = useState<"overview" | "setup" | "settings">("overview");

  // Debt payoff strategy lives in the Overview sidebar (not the chart card),
  // so its change handler is owned here and threaded into the `sidebar` node
  // below. Only meaningful when the plan has debts.
  const currentStrategy = plan.debtStrategy as DebtStrategy;
  const debtComparison = plan.debts.length > 0 ? comparison : null;
  // updateFinancePlanSchema defaults every field, so a partial payload would
  // silently reset the ones left out — every single-field update below must
  // send the FULL current plan and override just its field.
  const fullPlanPayload = () => ({
    id: plan.id,
    name: plan.name,
    description: plan.description ?? null,
    startMonth: plan.startMonth,
    monthsAhead: plan.monthsAhead,
    initialSavings: plan.initialSavings,
    monthlySavingsRate: plan.monthlySavingsRate,
    includePortfolio: plan.includePortfolio,
    surplusToDebtsPercent: plan.surplusToDebtsPercent,
    debtStrategy: plan.debtStrategy as DebtStrategy,
    autoInvestPercent: plan.autoInvestPercent,
    autoInvestMethodId: plan.autoInvestMethodId,
    initialInvestments: plan.initialInvestments,
    confirmationDayOfMonth: plan.confirmationDayOfMonth,
    color: plan.color,
  });
  const handleChangeStrategy = (next: DebtStrategy) =>
    wrap(() => updatePlanAction({ ...fullPlanPayload(), debtStrategy: next }));

  // Chart-level portfolio switch — persists to the plan's includePortfolio
  // flag (same setting as the Settings form), then refreshes so the server
  // recomputes the projection with the portfolio value + blended growth.
  const handleTogglePortfolio = (next: boolean) =>
    wrap(() =>
      updatePlanAction({ ...fullPlanPayload(), includePortfolio: next })
    );

  // Spin off a linked what-if copy of this plan and jump straight into it.
  const handleCreateScenario = () =>
    wrap(async () => {
      const result = await createScenarioAction(plan.id, `${plan.name} (scenario)`);
      if (result.success) {
        toast.success("Scenario created");
        router.push(`/portal/plans/${result.data.id}`);
      }
      return result;
    });

  // Dev-tools: force-open the monthly confirmation dialog from this plan,
  // bypassing the date + dismiss gates so the whole confirm-and-update flow
  // can be exercised on demand. The helper is built once via useState so it
  // keeps a stable identity (useRegisterDevTool re-registers on identity
  // change, which would loop with an inline object).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const openConfirmation = useCallback(() => setConfirmOpen(true), [setConfirmOpen]);
  const [forceConfirmationTool] = useState(() => ({
    id: "finance:force-confirmation",
    kind: "action" as const,
    label: "Force confirmation dialog",
    description:
      "Open the monthly confirmation + balance-update dialog now, ignoring the confirmation day and the per-day dismiss.",
    section: "Finance",
    icon: ClipboardCheck,
    onRun: () => setConfirmOpen(true),
  }));
  useRegisterDevTool(forceConfirmationTool);

  // Dev-tools: run the daily snapshot job (finance + portfolio) on demand so
  // snapshot creation can be verified without waiting for the midnight cron.
  // Admin-gated server-side. Built once for a stable identity.
  const [runSnapshotsTool] = useState(() => ({
    id: "finance:run-daily-snapshots",
    kind: "action" as const,
    label: "Run daily snapshot now",
    description:
      "Trigger the daily finance + portfolio snapshot job (the midnight cron) on demand. Admin only.",
    section: "Finance",
    icon: Camera,
    onRun: async () => {
      const res = await runDailySnapshotsAction();
      if (res.success) {
        toast.success(`Snapshots run — ${res.message ?? "done"}`);
      } else {
        toast.error(res.error);
      }
    },
  }));
  useRegisterDevTool(runSnapshotsTool);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as typeof tab)}
      className="gap-6"
    >
      {/* Title, tabs and the rest of the plan's actions share one header row
          so the chart starts higher; it wraps to two rows on phones. */}
      <PageHeader
        size="compact"
        back={backHref ? { href: backHref, label: "Plans" } : undefined}
        title={title}
        badge={
          ghost && (
            <Badge variant="outline">
              <GitBranch />
              Based on: {ghost.name}
            </Badge>
          )
        }
        description={description}
        meta={periodLabel && `Current period · ${periodLabel}`}
        actions={
          <>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More plan actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isPending}
                  onSelect={() => settle(handleCreateScenario())}
                >
                  <GitBranch />
                  Create scenario
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <TabsContent value="overview" className="flex flex-col gap-6">
        <ProjectionPanel
          projection={projection}
          pastProjection={pastProjection}
          simulatedPast={simulatedPast}
          today={todayState}
          baseline={baseline}
          history={history}
          ghost={ghost}
          portfolioHistory={portfolioHistory}
          portfolioEnabled={plan.includePortfolio}
          onTogglePortfolio={handleTogglePortfolio}
          onHoverFigures={setHoverFigures}
          milestones={milestones}
          onConfirmToday={openConfirmation}
          onOpenSetup={() => setTab("setup")}
          now={now}
          calendar={
            <PlanCalendar
              plan={plan}
              projections={[projection, pastProjection]}
              onAddIncome={(input) =>
                wrap(() => addPlanIncomeAction(plan.id, input))
              }
              onAddExpense={(input) =>
                wrap(() => addPlanExpenseAction(plan.id, input))
              }
              onUpdateIncome={(id, input) =>
                wrap(() => updatePlanIncomeAction(plan.id, { id, ...input }))
              }
              onUpdateExpense={(id, input) =>
                wrap(() => updatePlanExpenseAction(plan.id, { id, ...input }))
              }
              onUpdateDebt={(id, input) =>
                wrap(() => updatePlanDebtAction(plan.id, { id, ...input }))
              }
              onUpsertOverride={(input) =>
                wrap(() => upsertLineOverrideAction(plan.id, input))
              }
              onDeleteOverride={(input) =>
                wrap(() => deleteLineOverrideAction(plan.id, input))
              }
            />
          }
          sidebar={
            // Condensed Polymarket-style rail (right 1/4 on desktop, stacked
            // under the chart on mobile): a figures card — health gauge on top,
            // cycle figures as compact rows (tap a row for its breakdown) — and,
            // below it, the debt payoff strategy card when the plan has debts.
            <>
            {/* The preview chip straddles the card's top edge, and `Card`
                clips its children (`overflow-hidden`) — so it has to be a
                SIBLING of the card, not a child, or it renders sliced in half.
                This wrapper is what it positions against. */}
            {/* No min-h-0: the column may grow past the main panel rather
                than clip this card (the fixed-height column cut off Total
                debt and Surplus once the strategy card grew). */}
            <div className="relative flex flex-col xl:flex-1">
              {isPreview && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-popover px-2.5 py-0.5 text-2xs font-medium shadow-sm"
                >
                  {hoverFigures.label}
                </div>
              )}
            <Card
              className={cn(
                // xl:flex-1 — fills the sidebar column so its bottom edge
                // tracks the main panel's fixed height (see ProjectionPanel's
                // grid). Below xl the cards sit top-aligned, unstretched.
                "transition-all duration-200 xl:flex-1",
                // Card already draws the ring; the preview only darkens it.
                isPreview && "bg-muted/40 ring-foreground/10"
              )}
            >
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col items-center gap-1.5">
                  <FinancialHealthDonut
                    obligations={dFixedOutflow}
                    income={dIncome}
                    size={120}
                    showFooter={false}
                  />
                  <Eyebrow size="sm" as="p">
                    {isPeriodMode ? "Period health" : "Monthly health"}
                  </Eyebrow>
                </div>
                <div>
                  <StatRow
                    label={incomeLabel}
                    value={dIncome}
                    tone={moneySign(dIncome) > 0 ? "positive" : undefined}
                    description="Every income landing in the current period."
                    breakdown={
                      <BreakdownList
                        items={incomeItems}
                        emptyLabel="No income sources yet"
                        total={income}
                      />
                    }
                  />
                  <StatRow
                    label={expensesLabel}
                    value={dFixedOutflow}
                    description="Expenses and debt minimums due this period."
                    breakdown={
                      <BreakdownList
                        groups={[
                          { heading: "Expenses", items: expenseItems },
                          { heading: "Debt minimums", items: debtPaymentItems },
                        ]}
                        emptyLabel="No fixed obligations yet"
                        total={fixedOutflow}
                      />
                    }
                  />
                  <StatRow
                    label="Total debt"
                    value={dTotalDebt}
                    description="What each debt stands at today."
                    tone={moneySign(dTotalDebt) > 0 ? "negative" : undefined}
                    hint={plan.debts.length === 0 ? undefined : debtFreeLabel}
                    breakdown={
                      <BreakdownList
                        items={debtBalanceLines.map((d) => ({
                          name: d.name,
                          amount: d.balance,
                        }))}
                        emptyLabel="No active debts"
                        total={totalDebt}
                      />
                    }
                  />
                  <StatRow
                    label="Surplus"
                    value={dSurplus}
                    description="Income less fixed obligations, and where the rest goes."
                    tone={
                      moneySign(dSurplus) > 0
                        ? "positive"
                        : moneySign(dSurplus) < 0
                          ? "negative"
                          : undefined
                    }
                    hint={moneySign(dSurplus) < 0 ? "Spends more than it earns" : undefined}
                    breakdown={
                      <SurplusBreakdown
                        income={income}
                        livingExpenses={livingExpenses}
                        minDebtPayments={minDebtPayments}
                        surplus={surplus}
                        toExtraDebt={extraDebtPayments}
                        toInvestments={investmentsContribution}
                        toSavings={savingsContribution}
                      />
                    }
                  />
                </div>
              </CardContent>
            </Card>
            </div>
            {ghost && scenarioBasis && (
              <ScenarioDeltaCard
                ghost={ghost}
                scenario={scenarioBasis}
                anchorDay={effectiveAnchorDay}
                today={now}
              />
            )}
            {debtComparison && (
              // gap-3: the stock 24px between header and rows is what pushed
              // the sidebar past the main panel's height on xl.
              <Card className="gap-3">
                <CardHeader>
                  <Eyebrow asChild>
                    <h2 id="debt-strategy-heading">Debt payoff strategy</h2>
                  </Eyebrow>
                </CardHeader>
                {/* All three options on screen with their cost, rather than a
                    badge you have to expand: the choice is a trade-off, and
                    hiding the alternatives hid the trade-off. */}
                <CardContent>
                  <StrategyPicker
                    comparison={debtComparison}
                    currentStrategy={currentStrategy}
                    onChange={handleChangeStrategy}
                    pending={isPending}
                    hadDebt={projection.hadDebt}
                    anchorDay={effectiveAnchorDay}
                    today={now}
                  />
                </CardContent>
              </Card>
            )}
            </>
          }
        />
      </TabsContent>

      <TabsContent value="setup" className="flex flex-col gap-6">
        <Card>
          <CardContent>
            <PlanLineEditor
              variant="income"
              title="Income"
              description="Recurring income or one-time receipts."
              emptyLabel="No income sources yet"
              lines={plan.incomes}
              addLabel="Add income"
              onAdd={(input) =>
                wrap(() => addPlanIncomeAction(plan.id, input))
              }
              onUpdate={(id, input) =>
                wrap(() => updatePlanIncomeAction(plan.id, { id, ...input }))
              }
              onDelete={(id) => wrap(() => deletePlanIncomeAction(plan.id, id))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <PlanLineEditor
              variant="expense"
              title="Expenses"
              description="Recurring expenses or one-time payments."
              emptyLabel="No expense categories yet"
              lines={plan.expenses}
              addLabel="Add expense"
              onAdd={(input) =>
                wrap(() => addPlanExpenseAction(plan.id, input))
              }
              onUpdate={(id, input) =>
                wrap(() => updatePlanExpenseAction(plan.id, { id, ...input }))
              }
              onDelete={(id) => wrap(() => deletePlanExpenseAction(plan.id, id))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <PlanDebtEditor
              debts={plan.debts}
              onAdd={(input) =>
                wrap(() => addPlanDebtAction(plan.id, input))
              }
              onUpdate={(id, input) =>
                wrap(() => updatePlanDebtAction(plan.id, { id, ...input }))
              }
              onDelete={(id) => wrap(() => deletePlanDebtAction(plan.id, id))}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings" className="flex flex-col gap-6">
        <MainPlanToggle plan={plan} wrap={wrap} pending={isPending} />
        {plan.basedOnPlanId && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <GitBranch className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <Text weight="medium">Scenario plan</Text>
                  <Text variant="small">
                    {ghost
                      ? `Based on "${ghost.name}" — its projection shows as a reference line on this plan's chart.`
                      : "Linked to a base plan that could not be loaded."}
                  </Text>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  settle(
                    wrap(async () => {
                      const result = await updatePlanAction({
                        ...fullPlanPayload(),
                        basedOnPlanId: null,
                      });
                      if (result.success) toast.success("Detached from base plan");
                      return result;
                    })
                  )
                }
              >
                {isPending ? <Spinner /> : <Unlink />}
                Detach
              </Button>
            </CardContent>
          </Card>
        )}
        <PlanForm plan={plan} investmentMethods={investmentMethods} />
      </TabsContent>

      {/* The confirmation dialog for the CURRENT period. Reached by clicking
          today's point on the chart (clicking any other point compares that
          period instead), and force-openable from the dev drawer's Finance
          section. Saving it writes a real confirmation and recalibrates the
          projection, exactly like the dashboard prompt. */}
      {/* Mounted only while open: the dialog seeds its inputs from props once,
          so a debt added after mount, or figures refreshed by an edit, would
          otherwise never reach it (and a new debt was confirmed at $0). */}
      {confirmOpen && (
        <ConfirmationDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          planId={plan.id}
          planName={plan.name}
          monthLabel={confirmDialogLabel}
          projected={confirmationPrefill}
          debts={plan.debts}
        />
      )}
    </Tabs>
  );
}

/**
 * Banner card in the Settings tab that surfaces whether THIS plan is the
 * user's main plan, and offers a one-click promotion when it isn't. The
 * `wrap` helper threads through PlanEditor's startTransition so its failure
 * toast stays consistent with every other server-action button.
 */
function MainPlanToggle({
  plan,
  wrap,
  pending,
}: {
  plan: FinancePlanWithLines;
  wrap: Wrap;
  pending: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Star
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0",
              plan.isMain ? "fill-warning text-warning" : "text-muted-foreground"
            )}
          />
          <div className="flex flex-col gap-0.5">
            <Text weight="medium">
              {plan.isMain ? "Main plan" : "Set as main plan"}
            </Text>
            <Text variant="small">
              {plan.isMain
                ? "This is the plan the dashboard follows and the only one that fires the monthly confirmation prompt."
                : "Make this the plan the dashboard follows. The current main plan will lose the flag."}
            </Text>
          </div>
        </div>
        {!plan.isMain && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              settle(
                wrap(async () => {
                  const result = await setMainPlanAction(plan.id);
                  if (result.success) toast.success(`${plan.name} is now your main plan`);
                  return result;
                })
              )
            }
          >
            {pending && <Spinner />}
            Make main
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Sidebar card for scenario plans: scenario vs base on ONE footing — both
 * projected from their plans as written, compared at the same period (the
 * earlier end date), debt-free compared as dates. Green when the scenario wins.
 */
function ScenarioDeltaCard({
  ghost,
  scenario,
  anchorDay,
  today,
}: {
  ghost: GhostPlan;
  scenario: Projection;
  anchorDay: number;
  today: Date;
}) {
  const cmp = compareScenario(scenario, ghost.projection, anchorDay);
  const netWorthDelta = cmp.netWorthDelta;
  const debtFreeDelta = cmp.debtFreeDeltaMonths;
  const atLabel = cmp.at ? FORMATTER.format(cmp.at) : null;
  const scenarioDebtFree = formatDebtFree(describeDebtFree(scenario, anchorDay, today));
  return (
    <Card>
      <CardHeader>
        <Eyebrow asChild>
          <h2>Scenario vs base</h2>
        </Eyebrow>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <Text variant="small" as="p" className="flex items-center gap-1.5 pb-1">
          <GitBranch className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{ghost.name}</span>
          {/* Both plans are compared as written (a scenario copies no
              confirmations), so the base's figures here are not the ones its
              own page shows once it has been confirmed. Say so. */}
          <span className="shrink-0">· as written</span>
        </Text>
        {netWorthDelta !== null && (
          <div className="flex items-center justify-between gap-3 border-t py-2">
            <Text variant="small" as="span">
              Net worth{atLabel ? ` · ${atLabel}` : ""}
            </Text>
            <Mono
              className={cn(
                "text-sm font-semibold",
                moneySign(netWorthDelta) >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {moneySign(netWorthDelta) === 0 ? "same" : formatSignedCurrency(netWorthDelta)}
            </Mono>
          </div>
        )}
        {debtFreeDelta !== null && (
          <div className="flex items-center justify-between gap-3 border-t py-2">
            <Text variant="small" as="span">
              Debt-free
            </Text>
            <Mono
              className={cn(
                "text-sm font-semibold",
                debtFreeDelta <= 0 ? "text-success" : "text-destructive"
              )}
              title={scenarioDebtFree}
            >
              {debtFreeDelta === 0
                ? "same month"
                : `${Math.abs(debtFreeDelta)} mo ${debtFreeDelta < 0 ? "sooner" : "later"}`}
            </Mono>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type ProjectionPanelProps = {
  projection: Projection;
  /** The plan as written — hover flows before the calibration start. */
  pastProjection: Projection;
  /** The plan's own forecast as the past, only while never confirmed. */
  simulatedPast: Projection | null;
  /** Where the plan stands today (see PlanEditorProps). */
  today: TodayState | null;
  /** Confirmation-calibrated plan behind `projection`. */
  baseline: FinancePlanWithLines;
  /** Real monthly snapshots for the chart's past (newest-last). */
  history: PlanHistoryPoint[];
  /** The Calendar view of the switcher (PlanCalendar, built by the parent which
   *  owns the line/debt mutation handlers). Brings its own Card. */
  calendar: React.ReactNode;
  /** Right-hand sidebar content (health gauge + cycle figures + debt strategy).
   *  Rendered in the narrow column beside the chart on desktop, stacked below
   *  the chart on mobile. */
  sidebar: React.ReactNode;
  /** Receives the hovered chart point's period figures (null on leave / when
   *  hovering today's point) so the parent can preview them in the sidebar. */
  onHoverFigures?: (figures: PeriodFigures | null) => void;
  /** Clicking TODAY's point isn't a preview — it's "record what actually
   *  happened", so the parent opens the confirmation dialog instead. */
  onConfirmToday?: () => void;
  /** Base plan overlay when this plan is a scenario (ghost line + delta). */
  ghost?: GhostPlan | null;
  /** Recorded portfolio history for the portfolio series' past segment. */
  portfolioHistory?: { date: Date; value: number }[];
  /** Net-worth milestones annotated on the chart (user preference). */
  milestones?: readonly number[];
  /** Current includePortfolio flag; drives the chart's Portfolio switch. */
  portfolioEnabled: boolean;
  /** Persists a new includePortfolio value (full-payload plan update). */
  onTogglePortfolio: (next: boolean) => Promise<void>;
  /** The server's clock for this render — see PlanEditorProps. */
  now: Date;
  /** Opens the Setup tab — the empty chart's call to action. */
  onOpenSetup?: () => void;
};

/** Green above zero, red below, plain at zero ($0.00 is not a gain). */
function signTone(value: number): string | undefined {
  const sign = moneySign(value);
  return sign > 0 ? "text-success" : sign < 0 ? "text-destructive" : undefined;
}

const STRATEGY_LABEL: Record<DebtStrategy, string> = {
  avalanche: "Avalanche",
  snowball: "Snowball",
  none: "No acceleration",
};

// Same UTC-anchored display formatter the chart uses — keeps the header KPIs
// in sync with the chart's month labels even in negative-offset timezones.
const FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Projection horizon presets shown in the top-right of the panel. The window
// always includes ~25% past + 75% future so "today" sits about a quarter of
// the way from the left edge regardless of which horizon is active — that
// keeps the early-history context visible without dominating the forecast.
const HORIZON_PRESETS: ReadonlyArray<{ months: number; label: string }> = [
  { months: 12, label: "12 mo" },
  { months: 24, label: "2 yr" },
  { months: 60, label: "5 yr" },
  { months: 120, label: "10 yr" },
];

// The three views the Overview switcher alternates between (order = swipe order).
const PLAN_VIEWS = ["chart", "table", "calendar"] as const;
type PlanView = (typeof PLAN_VIEWS)[number];
const PLAN_VIEW_LABEL: Record<PlanView, string> = {
  chart: "Graph",
  table: "Table",
  calendar: "Calendar",
};
const PLAN_VIEW_ICON: Record<PlanView, LucideIcon> = {
  chart: LineChart,
  table: Table2,
  calendar: CalendarDays,
};

// Segmented control for the view switcher — clear on every device. On touch a
// horizontal swipe offers the carousel-style alternative.
function ViewSwitcher({
  value,
  onChange,
}: {
  value: PlanView;
  onChange: (next: PlanView) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as PlanView)}
      aria-label="Plan view"
    >
      {PLAN_VIEWS.map((v) => {
        const Icon = PLAN_VIEW_ICON[v];
        return (
          <ToggleGroupItem key={v} value={v} aria-label={PLAN_VIEW_LABEL[v]}>
            <Icon />
            {/* Icon-only on phones: this shares a row with the Portfolio
                switch and four horizon presets, and the labels pushed that
                cluster onto three lines. The icons are distinct and the
                aria-label carries the name. */}
            <span className="hidden sm:inline">{PLAN_VIEW_LABEL[v]}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

// True when `target` sits inside a horizontally-scrollable element (up to
// `boundary`). Used so a swipe that begins on the projection table — which
// scrolls sideways on mobile — pans the table instead of changing the view.
function isInHorizontalScroller(
  target: HTMLElement | null,
  boundary: HTMLElement
): boolean {
  let node: HTMLElement | null = target;
  while (node && node !== boundary) {
    const overflowX = getComputedStyle(node).overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 1
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

// Touch swipe → previous/next view. Requires a deliberate horizontal gesture
// (≥60px, clearly more horizontal than vertical) and ignores swipes that begin
// inside a sideways-scrolling region. No wrap-around at the ends.
function useSwitcherSwipe(view: PlanView, goView: (next: PlanView) => void) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const ignore = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    ignore.current = isInHorizontalScroller(
      e.target as HTMLElement,
      e.currentTarget as HTMLElement
    );
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const sx = startX.current;
    const sy = startY.current;
    startX.current = null;
    startY.current = null;
    if (sx === null || sy === null || ignore.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = PLAN_VIEWS.indexOf(view);
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= PLAN_VIEWS.length) return;
    goView(PLAN_VIEWS[nextIdx]);
  };

  return { onTouchStart, onTouchEnd };
}

const TODAY_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * Projection chart with a header that surfaces the headline number — how much
 * the net worth is expected to grow over the chosen horizon. Preset buttons
 * (12 mo / 2 yr / 5 yr / 10 yr) let the user switch horizons; the chart and KPIs
 * re-render against whatever is selected.
 */
function ProjectionPanel({
  projection,
  pastProjection,
  simulatedPast,
  today: todayState,
  baseline,
  history,
  calendar,
  sidebar,
  onHoverFigures,
  onConfirmToday,
  milestones,
  ghost = null,
  portfolioHistory = [],
  portfolioEnabled,
  onTogglePortfolio,
  now,
  onOpenSetup,
}: ProjectionPanelProps) {
  // No income, expense or debt: the "projection" is a flat line at the
  // opening balance under a $0 milestone marker, which says nothing.
  const hasNoLines =
    baseline.incomes.length === 0 &&
    baseline.expenses.length === 0 &&
    baseline.debts.length === 0;
  // View switcher — Graph (chart) / Table / Calendar. Segmented control (every
  // device) sits at the BOTTOM, Polymarket-style; horizontal swipe on touch
  // changes view too. A plain fade on switch — no horizontal slide, so nothing
  // clips the active view's card.
  const [view, setView] = useState<PlanView>("chart");
  const goView = (next: PlanView) => {
    // Leaving the chart view unmounts it mid-hover — drop any active preview
    // so the sidebar doesn't stay stuck on a hovered period.
    onHoverFigures?.(null);
    setView(next);
  };
  const swipe = useSwitcherSwipe(view, goView);

  // Horizon — 12 mo by default; bumps up to 2 / 5 / 10 yr when the user picks
  // a preset above the chart.
  const maxAvailable = projection.months.length;
  const [horizonMonths, setHorizonMonths] = useState<number>(
    Math.min(12, maxAvailable)
  );

  // Accounting-period anchor (the plan's confirmation day). The window / chart /
  // today-seed all resolve "today" against this so a non-1 anchor lands on the
  // period that actually contains today, not a raw calendar-month bucket.
  const anchorDay = baseline.confirmationDayOfMonth;

  // Chart series: real snapshots (as period closes) for the past, the
  // calibrated projection from today's period on; today's point carries the
  // day-aware position. The End KPI and the table read this same series.
  const chartSeries = useMemo(
    () =>
      alignTodayPoint(
        buildChartSeries(history, projection, horizonMonths, now, anchorDay, simulatedPast),
        todayState,
        anchorDay
      ),
    [history, projection, horizonMonths, now, anchorDay, simulatedPast, todayState]
  );

  // Scenario ghost: the base plan's net worth aligned to this chart's points
  // (matched by accounting period — the base can have a different startMonth).
  // Hidden via the "vs base" chip without losing the alignment work.
  const [showGhost, setShowGhost] = useState(true);
  const ghostValues = useMemo<(number | null)[] | undefined>(() => {
    if (!ghost || !showGhost) return undefined;
    const values = mapGhostValues(chartSeries.points, ghost.projection, anchorDay);
    // The main series' today point is the day-aware position; the ghost is
    // read the same way, or the two show a spurious delta at today.
    if (ghost.today?.status === "in-range" && values[chartSeries.pastCount] != null) {
      values[chartSeries.pastCount] = ghost.today.netWorth;
    }
    return values;
  }, [ghost, showGhost, chartSeries.points, chartSeries.pastCount, anchorDay]);

  // Portfolio series: recorded snapshots for the past, the projection's
  // (growing) portfolioValue for the future. Only when the plan includes it.
  const [portfolioPending, setPortfolioPending] = useState(false);
  const portfolioValues = useMemo<(number | null)[] | undefined>(
    () =>
      portfolioEnabled
        ? mapPortfolioValues(
            chartSeries.points,
            portfolioHistory,
            projection,
            chartSeries.pastCount,
            anchorDay
          )
        : undefined,
    [portfolioEnabled, chartSeries, portfolioHistory, projection, anchorDay]
  );
  // The switch stays enabled while saving: disabling the control that has
  // focus drops keyboard focus to <body>. Input is ignored instead.
  const handlePortfolioSwitch = (next: boolean) => {
    if (portfolioPending) return;
    setPortfolioPending(true);
    onTogglePortfolio(next)
      .catch(() => undefined)
      .finally(() => setPortfolioPending(false));
  };

  // Per-point period figures for the sidebar hover preview. Flows (income /
  // expenses / debt minimums) come from the projection month sharing the
  // point's period — the calibrated one first, falling back to the raw past
  // projection for periods before the calibration start. Debt prefers the
  // point's own value (the REAL snapshot balance for past points).
  const pointFigures = useMemo<(PeriodFigures | null)[]>(() => {
    const effAnchor = anchorDay > 0 ? anchorDay : 1;
    return chartSeries.points.map((p) => {
      const inSamePeriod = (m: { date: Date }) =>
        periodIndexForDate(m.date, effAnchor, p.date) === 0;
      const m =
        projection.months.find(inSamePeriod) ??
        pastProjection.months.find(inSamePeriod);
      if (!m) return null;
      return {
        label: HOVER_PERIOD_LABEL.format(p.date),
        income: m.income,
        livingExpenses: m.expenses,
        minDebtPayments: m.scheduledDebtPayments,
        totalDebt: p.totalDebt ?? m.totalDebt,
      };
    });
  }, [chartSeries.points, projection, pastProjection, anchorDay]);

  // Only an in-range today has a "today" point. Before the plan starts the
  // first point is its first CLOSE (a future period like any other), and the
  // Today KPI holds the opening figures instead.
  const beforeStart = todayState?.status === "before-start";
  const todayIsOnChart = todayState?.status === "in-range";

  // Hovering today's point is "the present" — treat it as no preview so the
  // sidebar only takes the backdrop/chip treatment for OTHER periods.
  const handleHoverIndex = useCallback(
    (idx: number | null): void => {
      if (!onHoverFigures) return;
      if (idx === null || (todayIsOnChart && idx === chartSeries.pastCount)) {
        onHoverFigures(null);
        return;
      }
      onHoverFigures(pointFigures[idx] ?? null);
    },
    [onHoverFigures, chartSeries.pastCount, pointFigures, todayIsOnChart]
  );

  const [comparedIdx, setComparedIdx] = useState<number | null>(null);

  // Clicking today means "record what actually happened", not "preview" — so it
  // hands off to the confirmation dialog. Every other point opens the compare
  // dialog for that period.
  // Not before the plan starts: a confirmation dated today would rebase the
  // plan onto today's period, months before the start it was given.
  const handleSelectIndex = useCallback(
    (idx: number): void => {
      if (todayIsOnChart && idx === chartSeries.pastCount) {
        onConfirmToday?.();
        return;
      }
      setComparedIdx(idx);
    },
    [chartSeries.pastCount, onConfirmToday, todayIsOnChart]
  );
  const effAnchor = anchorDay > 0 ? anchorDay : 1;
  // Today / Next as the header and the compare dialog read them — see
  // `forecastKpiPoints` (before the start: the opening, then the FIRST close).
  const { todayPoint, nextPoint } = forecastKpiPoints(chartSeries, todayState);
  // End = the chart's last point, so the header, the chart and the table end
  // on the same period.
  const endPoint = chartSeries.points[chartSeries.points.length - 1];
  const today = todayState?.netWorth ?? todayPoint?.netWorth ?? 0;
  const next = nextPoint?.netWorth;
  const future = endPoint?.netWorth ?? today;
  const todayCaption =
    todayState?.status === "before-start"
      ? `Starts ${FORMATTER.format(todayState.periodStart)}`
      : todayState?.status === "after-end"
        ? `Ended ${FORMATTER.format(todayState.periodStart)}`
        : `Today ${TODAY_LABEL.format(now)}`;

  // Horizon-end delta vs the base plan (scenario only) — matched by period.
  const ghostFuture =
    ghost && endPoint
      ? ghost.projection.months.find(
          (m) => periodIndexForDate(m.date, effAnchor, endPoint.date) === 0
        )?.netWorth ?? null
      : null;
  const endDelta = ghostFuture !== null ? future - ghostFuture : null;

  // Table rows: the projection periods the chart window covers.
  const tableRange = useMemo(() => {
    const first = chartSeries.points[0];
    const last = chartSeries.points[chartSeries.points.length - 1];
    if (!first || !last) return { startIndex: 0, count: 0 };
    const startIndex = projection.months.findIndex(
      (m) => periodIndexForDate(first.date, effAnchor, m.date) >= 0
    );
    if (startIndex < 0) return { startIndex: 0, count: 0 };
    let endIndex = startIndex;
    for (let i = startIndex; i < projection.months.length; i++) {
      if (periodIndexForDate(last.date, effAnchor, projection.months[i].date) <= 0) {
        endIndex = i;
      }
    }
    return { startIndex, count: endIndex - startIndex + 1 };
  }, [chartSeries.points, projection, effAnchor]);

  const comparedPoint = comparedIdx !== null ? chartSeries.points[comparedIdx] : null;

  // Forecast header (Today / Next / End KPIs + horizon picker) — shared by the
  // Graph and Table views (both are horizon-driven forecast views). It sits in
  // the card header so the number reads as the headline, Polymarket-style.
  const forecastHeader = (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <div>
          <Eyebrow size="sm" as="p">
            {todayCaption}
          </Eyebrow>
          <Mono
            as="p"
            className={cn("text-xl font-semibold tabular-nums sm:text-2xl", signTone(today))}
          >
            {formatCurrency(today)}
          </Mono>
        </div>
        {nextPoint && next !== undefined && (
          <div>
            <Eyebrow size="sm" as="p">
              Next {FORMATTER.format(nextPoint.date)}
            </Eyebrow>
            <Mono
              as="p"
              className={cn("text-sm font-semibold", signTone(next))}
            >
              {formatCurrency(next)}
            </Mono>
          </div>
        )}
        <div>
          <Eyebrow size="sm" as="p">
            End {endPoint ? FORMATTER.format(endPoint.date) : ""}
          </Eyebrow>
          <Mono
            as="p"
            className={cn("text-sm font-semibold", signTone(future))}
          >
            {formatCurrency(future)}
          </Mono>
          {endDelta !== null && (
            <Text
              variant="small"
              as="p"
              className={cn(
                "text-2xs",
                moneySign(endDelta) >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatSignedCurrency(endDelta)} vs base
            </Text>
          )}
        </div>
      </div>
      {/* Every control here is h-8, so the cluster wraps as one row height. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View first — it decides what the rest of this cluster even applies
            to (Portfolio and the horizon presets only shape the Graph). */}
        <ViewSwitcher value={view} onChange={goView} />
        {/* The keyboard path to what clicking today's chart point does. */}
        {onConfirmToday && todayIsOnChart && (
          <Button variant="outline" size="sm" onClick={onConfirmToday}>
            <ClipboardCheck />
            Confirm period
          </Button>
        )}
        {/* Chart toggles: portfolio series (persists to the plan) and the
            scenario ghost line (view-only). Sit beside the horizon presets so
            everything that shapes the chart lives in one cluster. */}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 text-xs font-medium text-muted-foreground">
          <Switch
            checked={portfolioEnabled}
            onCheckedChange={handlePortfolioSwitch}
            aria-disabled={portfolioPending}
            aria-busy={portfolioPending}
          />
          Portfolio
        </label>
        {ghost && (
          <Toggle
            variant="outline"
            pressed={showGhost}
            onPressedChange={setShowGhost}
            className="text-xs"
          >
            vs base
          </Toggle>
        )}
        <ToggleGroup
          type="single"
          size="sm"
          value={String(horizonMonths)}
          onValueChange={(v) => v && setHorizonMonths(Number(v))}
          aria-label="Projection horizon"
        >
          {HORIZON_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset.months}
              value={String(preset.months)}
              disabled={preset.months > maxAvailable}
            >
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );

  return (
    // Polymarket-style hero: the main panel fills 3/4 of the row on desktop, the
    // narrow sidebar (gauge + cycle figures + debt strategy) rides the right
    // 1/4. One column on mobile.
    //
    // The split starts at xl, not lg: beside the app sidebar a 1024px screen
    // leaves the quarter column ~155px, which clipped the figures card (Total
    // debt and Surplus were cut off) and squeezed the strategy names to
    // nothing. Below xl the sidebar cards sit under the panel, two abreast
    // from lg where there is room for both.
    //
    // Equal heights on desktop: the view area is FIXED at xl:h-160 — every
    // view (graph / table / calendar) fills exactly that box, scrolling
    // internally when taller — and the sidebar column is xl:min-h-160 so its
    // cards stretch to the same bottom edge (min- rather than fixed, so the
    // expanded strategy picker can grow past it instead of clipping). Keep the
    // two values in sync. On mobile everything sizes naturally.
    <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
      {/* min-w-0 on both grid children: grid items default to min-width:auto,
          so wide content (the table, recharts' measured svg) would inflate the
          column past the viewport on mobile instead of shrinking. */}
      <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
        {/* Active view. Swipe handlers on the stable wrapper; the keyed child
            fades in on switch (no horizontal slide → nothing clips the card's
            border/shadow). The active view brings its own Card. */}
        <div
          className="touch-pan-y xl:h-160"
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <div key={view} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 xl:h-full">
            {view === "calendar" ? (
              // The calendar card is taller than the panel box — scroll it
              // inside so the Calendar view keeps the same footprint.
              <div className="xl:h-full xl:overflow-y-auto">{calendar}</div>
            ) : (
              <Card className="xl:h-full">
                <CardHeader className="gap-3">{forecastHeader}</CardHeader>
                <CardContent
                  className={cn(
                    "xl:min-h-0 xl:flex-1",
                    view === "table" && "xl:overflow-y-auto"
                  )}
                >
                  {view === "chart" && hasNoLines ? (
                    <EmptyState
                      icon={LineChart}
                      title="Nothing to project yet"
                      description="Add income, expenses or debts and the projection draws itself."
                      className="flex h-72 flex-col justify-center sm:h-80 xl:h-full"
                      action={
                        onOpenSetup && (
                          <Button size="sm" onClick={onOpenSetup}>
                            Open Setup
                          </Button>
                        )
                      }
                    />
                  ) : view === "chart" ? (
                    <ProjectionChart
                      points={chartSeries.points}
                      pastCount={chartSeries.pastCount}
                      color={projection.plan.color}
                      heightClass="h-72 sm:h-80 xl:h-full"
                      onHoverIndex={handleHoverIndex}
                      onSelectIndex={handleSelectIndex}
                      milestones={milestones}
                      todayLabel={todayIsOnChart ? todayCaption : undefined}
                      markToday={!beforeStart}
                      ghostValues={ghostValues}
                      ghostLabel={ghost ? `${ghost.name} (as written)` : undefined}
                      portfolioValues={portfolioValues}
                    />
                  ) : (
                    <ProjectionTable
                      projection={projection}
                      monthsToShow={tableRange.count}
                      startIndex={tableRange.startIndex}
                      currentIndex={todayIsOnChart ? todayState?.periodIndex : undefined}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>

      {/* flex column so the figures card (xl:flex-1, set by the parent) absorbs
          the leftover height and the sidebar's bottom edge lines up with the
          main panel's. */}
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 xl:flex xl:min-h-160 xl:flex-col xl:items-stretch xl:gap-4">
        {sidebar}
      </div>

      <PeriodCompareDialog
        open={comparedIdx !== null}
        onOpenChange={(next) => {
          if (!next) setComparedIdx(null);
        }}
        anchorDay={effAnchor}
        todayLabel={todayCaption}
        todayPoint={todayPoint ?? null}
        targetLabel={comparedPoint ? HOVER_PERIOD_LABEL.format(comparedPoint.date) : ""}
        targetPoint={comparedPoint}
      />
    </div>
  );
}

function StrategyPicker({
  comparison,
  currentStrategy,
  onChange,
  pending,
  hadDebt,
  anchorDay,
  today,
}: {
  comparison: StrategyComparison;
  currentStrategy: DebtStrategy;
  onChange: (next: DebtStrategy) => Promise<void>;
  pending: boolean;
  hadDebt: boolean;
  anchorDay: number;
  today: Date;
}) {
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
  // Every row is run with the plan's own surplus-to-debts share, so it
  // describes what selecting it would actually do.
  const surplusPct = Math.round(comparison.surplusToDebtsPercent * 100);

  return (
    <div className="flex flex-col gap-2">
      <Text variant="small" as="p" className="text-2xs">
        {surplusPct === 0
          ? "Total interest. 0% of surplus goes to debt, so the strategies only decide where a paid-off debt's minimum rolls over. Turn on “Apply surplus to debts” in Settings to accelerate."
          : `Total interest, with ${surplusPct}% of surplus to debt and freed minimums rolled over.`}
      </Text>
      {/* Not `disabled` while saving: that would disable the radio that has
          just taken focus and drop the keyboard to <body>. */}
      <RadioGroup
        value={currentStrategy}
        onValueChange={(v) => {
          if (!pending) settle(onChange(v as DebtStrategy));
        }}
        aria-labelledby="debt-strategy-heading"
        aria-busy={pending}
        className="gap-1.5"
      >
        {rows.map(({ key, data }) => {
          // What this option costs against the cheapest one — the number that
          // actually decides it, so it sits on the row instead of behind a click.
          const costVsBest = data.totalInterestPaid - minInterest;
          const isCheapest = costVsBest < 0.5;
          const id = `debt-strategy-${key}`;
          // Every row is about payoff, so "Debt-free in" is implied: dropping
          // it keeps the line to one row in the narrow sidebar.
          const debtFree = formatDebtFree(
            describeDebtFree({ hadDebt, debtFreeDate: data.debtFreeDate }, anchorDay, today)
          ).replace(/^Debt-free in /, "in ");
          return (
            <label
              key={key}
              htmlFor={id}
              className="flex w-full cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 transition hover:border-foreground/60 hover:bg-muted/30 has-data-checked:border-foreground has-data-checked:bg-muted/40"
            >
              {/* Two lines, not two columns: side by side, the debt-free text
                  took the whole width of the narrow sidebar and squeezed the
                  strategy's own name down to nothing. */}
              <RadioGroupItem id={id} value={key} className="mt-px" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-medium">
                      {STRATEGY_LABEL[key]}
                    </span>
                    {isCheapest && (
                      <Zap className="size-3 shrink-0 text-warning" aria-hidden="true" />
                    )}
                  </span>
                  {/* The cheapest row states the interest itself; the others
                      what they cost on top of it. */}
                  <Mono
                    className={cn(
                      "shrink-0 text-2xs",
                      isCheapest ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {isCheapest
                      ? formatCurrency(data.totalInterestPaid)
                      : `+${formatCurrency(costVsBest)}`}
                    <span className="sr-only">
                      {isCheapest ? " interest, the cheapest" : " more interest"}
                    </span>
                  </Mono>
                </span>
                <Mono className="text-2xs text-muted-foreground">{debtFree}</Mono>
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

/**
 * Compact label/value row for the condensed Overview sidebar. Tapping a row
 * (when it has a `breakdown`) opens the per-line detail in a dialog — which is
 * already a bottom sheet on phones.
 */
function StatRow({
  label,
  value,
  tone,
  hint,
  description,
  breakdown,
}: {
  label: string;
  value: number;
  tone?: "positive" | "negative";
  /** Optional one-line context shown under the value (e.g. "Debt-free in 8 mo"). */
  hint?: string;
  /** One line under the breakdown dialog's title. */
  description?: string;
  breakdown?: React.ReactNode;
}) {
  // Count up/down toward the latest value (e.g. while a chart point is
  // hovered) instead of snapping. No-op on mount and for static values.
  const animatedValue = useAnimatedNumber(value);

  const inner = (
    <>
      <Text variant="small" as="span">{label}</Text>
      <span className="text-right">
        <Mono
          className={cn(
            "block text-sm font-semibold",
            tone === "positive" && "text-success",
            tone === "negative" && "text-destructive"
          )}
        >
          {formatCurrency(animatedValue)}
        </Mono>
        {hint && (
          <Text variant="small" as="span" className="block text-2xs">
            {hint}
          </Text>
        )}
      </span>
    </>
  );

  const rowClass = "flex items-center justify-between gap-3 border-t py-2";

  if (!breakdown) {
    return <div className={rowClass}>{inner}</div>;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* No aria-label: it would replace the visible figure in the name. */}
        <button
          type="button"
          className={cn(rowClass, "w-full text-left transition hover:bg-muted/30")}
        >
          {inner}
          <span className="sr-only">, show breakdown</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {breakdown}
      </DialogContent>
    </Dialog>
  );
}

type BreakdownItem = { name: string; amount: number; hint?: string };
type BreakdownGroup = { heading?: string; items: BreakdownItem[] };

function BreakdownList({
  items,
  groups,
  emptyLabel,
  total,
}: {
  items?: BreakdownItem[];
  groups?: BreakdownGroup[];
  emptyLabel: string;
  total: number;
}) {
  // Normalise to one shape: a list of groups. Callers can pass either a flat
  // `items` (single anonymous group) or pre-grouped `groups` with headings.
  const sections: BreakdownGroup[] = groups ?? [{ items: items ?? [] }];
  const hasAny = sections.some((g) => g.items.length > 0);
  if (!hasAny) {
    return <EmptyState title={emptyLabel} />;
  }
  return (
    // min-w-0: DialogContent is a grid, and a grid item is as wide as its
    // longest unbreakable word — one long line name pushed every amount off
    // the side of the sheet instead of truncating.
    <div className="flex min-w-0 flex-col gap-3 text-sm">
      {sections.map((section, gi) =>
        section.items.length === 0 ? null : (
          <div key={gi} className="flex flex-col gap-1.5">
            {section.heading && (
              <Eyebrow size="sm" as="div">
                {section.heading}
              </Eyebrow>
            )}
            <ul className="flex flex-col gap-1.5">
              {section.items.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  className="flex items-start justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{item.name}</span>
                    {item.hint && (
                      <Text variant="small" as="span" className="mt-0.5 block">
                        {item.hint}
                      </Text>
                    )}
                  </span>
                  <Mono className="shrink-0">
                    {formatCurrency(item.amount)}
                  </Mono>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      <div className="flex items-baseline justify-between gap-4 border-t pt-2 font-semibold">
        <span>Total</span>
        <Mono>{formatCurrency(total)}</Mono>
      </div>
    </div>
  );
}


function SurplusBreakdown({
  income,
  livingExpenses,
  minDebtPayments,
  surplus,
  toExtraDebt,
  toInvestments,
  toSavings,
}: {
  income: number;
  livingExpenses: number;
  minDebtPayments: number;
  surplus: number;
  toExtraDebt: number;
  toInvestments: number;
  toSavings: number;
}) {
  const rows: { label: string; value: string; op?: string }[] = [
    { label: "Income", value: formatCurrency(income) },
    { label: "Living expenses", value: formatCurrency(livingExpenses), op: "−" },
    { label: "Debt minimums", value: formatCurrency(minDebtPayments), op: "−" },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-3 text-sm">
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-4">
            <span>
              {r.op && <span className="mr-1 text-muted-foreground">{r.op}</span>}
              {r.label}
            </span>
            <Mono>{r.value}</Mono>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4 border-t pt-2 font-semibold">
        <span>= Surplus</span>
        <Mono className={signTone(surplus)}>
          {formatCurrency(surplus)}
        </Mono>
      </div>
      {moneySign(surplus) > 0 && (
        <ul className="flex flex-col gap-1.5 border-t pt-2 text-muted-foreground">
          <li className="flex items-baseline justify-between gap-4">
            <span>→ Extra debt</span>
            <Mono>{formatCurrency(toExtraDebt)}</Mono>
          </li>
          <li className="flex items-baseline justify-between gap-4">
            <span>→ Investments</span>
            <Mono>{formatCurrency(toInvestments)}</Mono>
          </li>
          <li className="flex items-baseline justify-between gap-4">
            <span>→ Savings</span>
            <Mono>{formatCurrency(toSavings)}</Mono>
          </li>
        </ul>
      )}
    </div>
  );
}
