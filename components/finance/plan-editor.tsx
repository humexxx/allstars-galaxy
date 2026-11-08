"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardCheck,
  GitBranch,
  Info,
  LineChart,
  type LucideIcon,
  MoreHorizontal,
  RotateCcw,
  Star,
  Table2,
  TriangleAlert,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statToneClass } from "@/components/ui/stat-card";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";

import { useRegisterDevTool } from "@/components/dev-tools/dev-tools-context";
import { runDailySnapshotsAction } from "@/app/actions/dev-tools";

import { ConfirmationDialog } from "./confirmation-dialog";
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
import { rowStepFor } from "@/lib/finance/table-rows";
import type { TradingSummary } from "@/types/trading";
import { formatProjectionMonth } from "@/lib/utils/date";
import {
  DEFAULT_PLAN_VIEW,
  PLAN_VIEWS,
  hrefWithPlanView,
  type PlanView,
} from "@/lib/finance/plan-view";
import {
  alignTodayPoint,
  buildChartSeries,
  describeDebtFree,
  forecastKpiPoints,
  formatDebtFree,
  mapGhostValues,
  portfolioSeries,
  type PlanHistoryPoint,
} from "@/lib/finance/chart-series";
import { planOccurrences } from "@/lib/finance/schedule";
import { planStartDate } from "@/lib/finance/projection";
import { owedAfter, owedRepayments } from "@/lib/finance/receivables";
import { compareScenario } from "@/lib/finance/scenario";
import type {
  DebtStrategy,
  FinancePlanWithLines,
  InvestmentMethodOption,
  Projection,
  StrategyComparison,
  TodayState,
} from "@/types/finance";
import { changeBaseline, checkpointLabels } from "@/lib/finance/dashboard";
import { CountUpCurrency } from "./count-up";
import { DeltaChip } from "./delta-chip";
import { dashboardSeries, type DashboardSeries } from "./dashboard-finance-series";
import { SeriesSwatch } from "./series-swatch";

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
  /** The base plan's calibrated projection, as its own page shows it. */
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
  /** The main plan's current period has no confirmation yet. */
  confirmationDue?: boolean;
  /** The user's last own confirmation (YYYY-MM-DD): net worth's change is from there. */
  lastConfirmedDay?: string | null;
  /** The Overview view the page opens on, read from `?view=`. */
  initialView?: PlanView;
  /** The trading journal's balance and pace; null without a journal (or with the module off). */
  trading?: TradingSummary | null;
  /** The Portfolio module is on for the account: off, the plan shows none of it. */
  portfolioOn?: boolean;
  /** The account runs investment methods: only then does the Portfolio card
   *  break the managed margin out from its own money. */
  managesMoney?: boolean;
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
  confirmationDue = false,
  lastConfirmedDay = null,
  initialView = DEFAULT_PLAN_VIEW,
  trading = null,
  portfolioOn = true,
  managesMoney = false,
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
  // Pre-fill for the confirmation dialog — and for the Settings form's
  // balance fields: the projected position ON today. A confirmation records
  // the balances on the day it's made, so saving the pre-fill unchanged
  // leaves the forecast exactly where it was.
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
  // Fixed outflow: living + debt minimums — the gauge numerator.
  const fixedOutflow = livingExpenses + minDebtPayments;

  // Debt NOW (day-aware, the same figure as the chart's today dot), not the
  // projected close of the period.
  const totalDebt = todayState?.totalDebt ?? current?.totalDebt ?? 0;

  // A period picked on the chart: the sidebar shows THAT period's figures until
  // the reader goes back to today. Hovering only shows the chart's tooltip —
  // a sidebar that changed under every pointer move read as flicker.
  const [picked, setPicked] = useState<{ index: number; figures: PeriodFigures } | null>(null);
  const hoverFigures = picked?.figures ?? null;
  // The chart's horizon, here so the Portfolio card reads the same window.
  const [horizonMonths, setHorizonMonths] = useState(12);
  const isPreview = hoverFigures !== null;
  const dIncome = hoverFigures?.income ?? income;
  const dLivingExpenses = hoverFigures?.livingExpenses ?? livingExpenses;
  const dMinDebtPayments = hoverFigures?.minDebtPayments ?? minDebtPayments;
  const dFixedOutflow = dLivingExpenses + dMinDebtPayments;
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
  // What is still owed to the user today, by line.
  const owedToYou = todayState?.receivables ?? 0;
  const owedItems = baseline.incomes
    .filter((l) => l.owedToMe)
    .map((l) => ({
      name: l.name,
      amount: owedAfter(
        owedRepayments({ startMonth: new Date(baseline.startMonth), incomes: [l], overrides: baseline.overrides }, planStartDate(baseline)),
        now
      ),
      hint: l.kind === "one_time" ? (l.date ?? undefined) : l.endDate ? `until ${l.endDate}` : undefined,
    }))
    .filter((i) => i.amount > 0);
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
  // send the FULL current plan and override just its field. The opening
  // balances are the exception: they are left out, because any balance sent
  // is an edit and restates the set as of today.
  const fullPlanPayload = () => ({
    id: plan.id,
    name: plan.name,
    description: plan.description ?? null,
    startMonth: plan.startMonth,
    monthsAhead: plan.monthsAhead,
    monthlySavingsRate: plan.monthlySavingsRate,
    includePortfolio: plan.includePortfolio,
    surplusToDebtsPercent: plan.surplusToDebtsPercent,
    debtStrategy: plan.debtStrategy as DebtStrategy,
    autoInvestPercent: plan.autoInvestPercent,
    autoInvestMethodId: plan.autoInvestMethodId,
    confirmationDayOfMonth: plan.confirmationDayOfMonth,
    color: plan.color,
  });
  const handleChangeStrategy = (next: DebtStrategy) =>
    wrap(() => updatePlanAction({ ...fullPlanPayload(), debtStrategy: next }));

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
          <>
            {/* The description sits behind an icon: under the title it was a
                line of help pushing the chart down on every visit. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`About this plan: ${description}`}
                  className="text-muted-foreground"
                >
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{description}</TooltipContent>
            </Tooltip>
            {ghost && (
              <Badge variant="outline">
                <GitBranch />
                Based on: {ghost.name}
              </Badge>
            )}
            {/* Beside the title rather than under it: one line less above the chart. */}
            {periodLabel && (
              <Text variant="small" as="span" className="tabular-nums">
                Current period · {periodLabel}
              </Text>
            )}
          </>
        }
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
          portfolioEnabled={plan.includePortfolio && portfolioOn}
          showTrading={trading !== null}
          horizonMonths={horizonMonths}
          onHorizonChange={setHorizonMonths}
          selectedIndex={picked?.index ?? null}
          onSelectPeriod={(index, figures) =>
            setPicked(index !== null && figures ? { index, figures } : null)
          }
          milestones={milestones}
          // Only the main plan records reality; a what-if reads its past.
          onConfirmToday={plan.isMain ? openConfirmation : undefined}
          confirmationDue={plan.isMain && confirmationDue}
          lastConfirmedDay={lastConfirmedDay}
          initialView={initialView}
          now={now}
          calendar={(header) => (
            <PlanCalendar
              plan={plan}
              header={header}
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
          )}
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
                <div className="relative flex flex-col items-center gap-1.5">
                  {isPreview && (
                    <Button
                      variant="outline"
                      size="xs"
                      className="absolute top-0 right-0"
                      onClick={() => setPicked(null)}
                    >
                      <RotateCcw />
                      Today
                    </Button>
                  )}
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
                    series={dashboardSeries("debt")}
                    value={dTotalDebt}
                    description="What each debt stands at today."
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
                  {owedToYou > 0 && (
                    <StatRow
                      label="Owed to you"
                      series={dashboardSeries("receivables")}
                      value={owedToYou}
                      description="Money still to be paid back to you, counted in net worth."
                      breakdown={
                        <BreakdownList items={owedItems} emptyLabel="Nothing owed to you" total={owedToYou} />
                      }
                    />
                  )}
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
            {portfolioOn && (
            <PortfolioCard
              enabled={plan.includePortfolio}
              managesMoney={managesMoney}
              today={{
                managed:
                  (todayState?.portfolioValue ?? projection.months[currentPeriodIdx]?.portfolioValue ?? 0) -
                  (todayState?.portfolioClaims ?? 0),
                own: todayState?.investments ?? projection.months[currentPeriodIdx]?.investments ?? 0,
              }}
              horizonLabel={(() => {
                const last = projection.months.length - 1;
                if (currentPeriodIdx + horizonMonths > last && last >= 0) {
                  return `By ${formatProjectionMonth(projection.months[last].date)}`;
                }
                return horizonMonths % 12 === 0 && horizonMonths > 12
                  ? `In ${horizonMonths / 12} years`
                  : `In ${horizonMonths} months`;
              })()}
              atHorizon={(() => {
                const m =
                  projection.months[Math.min(projection.months.length - 1, currentPeriodIdx + horizonMonths)];
                return m
                  ? { managed: m.portfolioValue - (m.portfolioClaims ?? 0), own: m.investments }
                  : null;
              })()}
            />
            )}
            {trading && (
              <TradingCard
                today={todayState?.tradingValue ?? trading.balance}
                atHorizon={
                  projection.months[Math.min(projection.months.length - 1, currentPeriodIdx + horizonMonths)]
                    ?.tradingValue ?? null
                }
                horizonMonths={horizonMonths}
              />
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
              today={now}
              schedule={{ startMonth: plan.startMonth, overrides: plan.overrides }}
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
              today={now}
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
        {debtComparison && (
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
        <PlanForm
          plan={plan}
          current={confirmationPrefill}
          investmentMethods={investmentMethods}
        />
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

/** The portfolio's two parts, as each counts in net worth. */
type PortfolioAmounts = { managed: number; own: number };

const total = (a: PortfolioAmounts, managedCounts: boolean): number =>
  a.own + (managedCounts ? a.managed : 0);

/**
 * A card figure that explains itself on hover or focus: a dotted underline
 * says there is more, the tooltip holds it. Keeps the small print off the
 * card.
 */
function FigureWithTip({
  className,
  tip,
  children,
}: {
  className?: string;
  tip: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-help font-mono tabular-nums underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The portfolio: the plan's own investments (what the surplus invests) plus
 * the margin on the money managed for others — the positions their money
 * bought less what is owed to them. Both always count, as the chart's
 * portfolio line does; the two sides of the margin stay off the card, for
 * room (the dashboard's note and the Portfolio page carry them).
 */
function PortfolioCard({
  enabled,
  managesMoney,
  today,
  horizonLabel,
  atHorizon,
}: {
  /** The plan counts the managed money (`includePortfolio`). */
  enabled: boolean;
  /** The account runs methods. A client's "positions" are its own holdings,
   *  so it gets no managed breakdown at all. */
  managesMoney: boolean;
  today: PortfolioAmounts;
  /** Where the chart's horizon ends ("In 12 months", or "By May ’36" when the
   *  plan ends first), and what each part is there. */
  horizonLabel: string;
  atHorizon: PortfolioAmounts | null;
}): React.ReactElement {
  const row = (label: string, value: number): React.ReactElement => (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <Mono>{formatCurrency(value)}</Mono>
    </div>
  );
  return (
    <Card className="gap-3">
      <CardHeader className="flex items-center justify-between gap-2">
        <Eyebrow asChild>
          <h2 className="flex items-center gap-1.5">
            <SeriesSwatch series={dashboardSeries("investments")} />
            Portfolio
          </h2>
        </Eyebrow>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/portal/portfolio">
            Open
            <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <Text variant="small" as="span">
            Today
          </Text>
          {/* What it is made of rides in a tooltip, off the card. */}
          {managesMoney ? (
            <FigureWithTip
              className="text-sm font-semibold"
              tip={
                <div className="flex flex-col gap-1">
                  {row("Our own", today.own)}
                  {enabled && row("Managed margin", today.managed)}
                </div>
              }
            >
              {formatCurrency(total(today, enabled))}
            </FigureWithTip>
          ) : (
            <Mono className="text-sm font-semibold">{formatCurrency(total(today, enabled))}</Mono>
          )}
        </div>
        {atHorizon !== null && (
          <div className="flex items-baseline justify-between gap-3">
            <Text variant="small" as="span">
              {horizonLabel}
            </Text>
            {/* An estimate, at the expected rate: "≈" says so before the figure. */}
            <Mono className="text-sm text-muted-foreground">
              ≈ {formatCurrency(total(atHorizon, enabled))}
            </Mono>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The trading journal in the plan: its balance today and where it is heading,
 * grown at the average return of its last complete months (none yet: held
 * flat), with a way into the journal.
 */
function TradingCard({
  today,
  atHorizon,
  horizonMonths,
}: {
  today: number;
  atHorizon: number | null;
  horizonMonths: number;
}): React.ReactElement {
  return (
    <Card className="gap-3">
      <CardHeader className="flex items-center justify-between gap-2">
        <Eyebrow asChild>
          <h2 className="flex items-center gap-1.5">
            <SeriesSwatch series={dashboardSeries("trading")} />
            Trading
          </h2>
        </Eyebrow>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/portal/trading">
            Journal
            <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <Text variant="small" as="span">
            Today
          </Text>
          <Mono className="text-sm font-semibold">{formatCurrency(today)}</Mono>
        </div>
        {atHorizon !== null && (
          <div className="flex items-baseline justify-between gap-3">
            <Text variant="small" as="span">
              {horizonMonths % 12 === 0 && horizonMonths > 12 ? `In ${horizonMonths / 12} years` : `In ${horizonMonths} months`}
            </Text>
            <Mono className="text-sm text-muted-foreground">≈ {formatCurrency(atHorizon)}</Mono>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Sidebar card for scenario plans: scenario vs base on ONE footing — both
 * calibrated from the user's confirmations, compared at the same period (the
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
   *  owns the line/debt mutation handlers). Brings its own Card, and puts the
   *  panel's headline at its top. */
  calendar: (header: React.ReactNode) => React.ReactNode;
  /** Right-hand sidebar content (health gauge + cycle figures + debt strategy).
   *  Rendered in the narrow column beside the chart on desktop, stacked below
   *  the chart on mobile. */
  sidebar: React.ReactNode;
  /** The chart point the reader picked (its figures fill the sidebar), or
   *  null for today. */
  /** Months the chart shows ahead (6 mo … 10 yr), held by the editor. */
  horizonMonths: number;
  onHorizonChange: (months: number) => void;
  selectedIndex?: number | null;
  /** A point clicked, with its period's figures; null, null for back to
   *  today (today's own point, a new horizon, another view). */
  onSelectPeriod?: (index: number | null, figures: PeriodFigures | null) => void;
  /** Opens the confirmation dialog — the warning icon's action. */
  onConfirmToday?: () => void;
  /** Base plan overlay when this plan is a scenario (ghost line + delta). */
  ghost?: GhostPlan | null;
  /** Recorded portfolio history for the portfolio series' past segment. */
  portfolioHistory?: { date: Date; value: number }[];
  /** Net-worth milestones annotated on the chart (user preference). */
  milestones?: readonly number[];
  /** Current includePortfolio flag: the chart draws the portfolio when set. */
  portfolioEnabled: boolean;
  /** The account has a trading journal (and the module): the chart draws it. */
  showTrading: boolean;
  /** The current period still waits for a confirmation (main plan only). */
  confirmationDue?: boolean;
  /** The user's last own confirmation (YYYY-MM-DD). */
  lastConfirmedDay?: string | null;
  /** The server's clock for this render — see PlanEditorProps. */
  now: Date;
  initialView: PlanView;
};

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
  { months: 6, label: "6 mo" },
  { months: 12, label: "12 mo" },
  { months: 24, label: "2 yr" },
  { months: 60, label: "5 yr" },
  { months: 120, label: "10 yr" },
];

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
  horizonMonths: horizonPick,
  onHorizonChange,
  selectedIndex = null,
  onSelectPeriod,
  onConfirmToday,
  milestones,
  ghost = null,
  portfolioHistory = [],
  portfolioEnabled,
  showTrading,
  confirmationDue = false,
  lastConfirmedDay = null,
  now,
  initialView,
}: ProjectionPanelProps) {
  // View switcher — Graph (chart) / Table / Calendar. Segmented control (every
  // device) sits at the BOTTOM, Polymarket-style; horizontal swipe on touch
  // changes view too. A plain fade on switch — no horizontal slide, so nothing
  // clips the active view's card.
  const [view, setView] = useState<PlanView>(initialView);
  const goView = (next: PlanView) => {
    // Leaving the chart view unmounts it mid-hover — drop any active preview
    // so the sidebar doesn't stay stuck on a hovered period.
    onSelectPeriod?.(null, null);
    setView(next);
    // Kept in the address so a reload reopens it. The History API, not the
    // router: a router navigation would re-render this dynamic page on the server.
    window.history.replaceState(null, "", hrefWithPlanView(window.location.href, next));
  };
  const swipe = useSwitcherSwipe(view, goView);

  // Horizon — 12 mo by default (held by the editor, which the Portfolio card
  // reads too), never past what the plan projects.
  const maxAvailable = projection.months.length;
  const horizonMonths = Math.min(horizonPick, maxAvailable);

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
    // The past is the user's, the same under both plans: the base branches
    // off at today like the scenario does.
    return values.map((v, i) => (i < chartSeries.pastCount ? null : v));
  }, [ghost, showGhost, chartSeries.points, chartSeries.pastCount, anchorDay]);

  // The Portfolio series (see `portfolioSeries`): the same one the
  // dashboard card draws.
  const portfolioValues = useMemo<(number | null)[]>(
    () => portfolioSeries(chartSeries, portfolioHistory, projection, anchorDay, portfolioEnabled),
    [portfolioEnabled, chartSeries, portfolioHistory, projection, anchorDay]
  );
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

  // Clicking a point shows its period in the sidebar and marks it on the
  // chart; clicking today's point (or the one already picked) goes back.
  const handleSelectIndex = useCallback(
    (idx: number): void => {
      if ((todayIsOnChart && idx === chartSeries.pastCount) || idx === selectedIndex) {
        onSelectPeriod?.(null, null);
        return;
      }
      onSelectPeriod?.(idx, pointFigures[idx] ?? null);
    },
    [chartSeries.pastCount, onSelectPeriod, pointFigures, selectedIndex, todayIsOnChart]
  );
  const effAnchor = anchorDay > 0 ? anchorDay : 1;
  // Today as the header and the compare dialog read it — see
  // `forecastKpiPoints` (before the start: the opening).
  const { todayPoint } = forecastKpiPoints(chartSeries, todayState);
  const today = todayState?.netWorth ?? todayPoint?.netWorth ?? 0;
  const todayCaption =
    todayState?.status === "before-start"
      ? `Starts ${FORMATTER.format(todayState.periodStart)}`
      : todayState?.status === "after-end"
        ? `Ended ${FORMATTER.format(todayState.periodStart)}`
        : `Today ${TODAY_LABEL.format(now)}`;

  // Table rows: the horizon the picker names, from today's period — plus the
  // closed periods before it the projection still has, as many as the chart
  // shows of the past — so 12 mo is twelve months ahead, not whatever the
  // chart's points happened to span.
  const tableRange = useMemo(() => {
    const months = projection.months;
    if (months.length === 0) return { startIndex: 0, count: 0 };
    const todayIdx = Math.min(
      months.length - 1,
      Math.max(0, periodIndexForDate(months[0].date, effAnchor, now))
    );
    const past = Math.min(todayIdx, Math.max(1, Math.round(horizonMonths * 0.25)));
    return { startIndex: todayIdx - past, count: past + horizonMonths };
  }, [projection, effAnchor, now, horizonMonths]);


  // The last closed period, for the "since" chip beside today's figure.
  // Net worth's change: from the user's last confirmation, else the last close.
  const changeFrom = changeBaseline(
    // A skipped period is a straight-line guess, never a baseline.
    chartSeries.points.slice(0, chartSeries.pastCount).filter((p) => !p.skipped),
    (p) => checkpointLabels(p.date).time,
    (p) => checkpointLabels(p.date),
    lastConfirmedDay
  );
  const sinceClose = changeFrom && todayIsOnChart ? today - changeFrom.point.netWorth : null;

  // Every control here is h-8 from `sm` (h-9 to h-10 on a phone, where they
  // step up for a thumb), so the cluster wraps as one row height.
  const viewControls = (
    <div className="flex flex-wrap items-center gap-2">
      {confirmationDue && onConfirmToday && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onConfirmToday}
              aria-label="This period isn't confirmed yet: confirm your balances"
              className="text-warning"
            >
              <TriangleAlert />
            </Button>
          </TooltipTrigger>
          <TooltipContent>This period isn&apos;t confirmed yet — confirm your balances</TooltipContent>
        </Tooltip>
      )}
      <ViewSwitcher value={view} onChange={goView} />
    </div>
  );

  // Forecast header (today's net worth + its change since the last close, and
  // the horizon picker) — every view's card opens with it, so the number reads
  // as the headline, as on the dashboard. The calendar has no horizon.
  const forecastHeader = (withHorizon: boolean): React.ReactNode => (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Eyebrow size="sm" as="p" className="flex items-center gap-1.5">
          <SeriesSwatch series={dashboardSeries("netWorth")} />
          {todayCaption}
        </Eyebrow>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Mono
            as="p"
            className={cn(
              "text-3xl font-semibold sm:text-4xl",
              statToneClass(moneySign(today) >= 0 ? "positive" : "negative")
            )}
          >
            <CountUpCurrency value={today} />
          </Mono>
          {changeFrom && sinceClose !== null && <DeltaChip delta={sinceClose} since={changeFrom.since} />}
        </div>
        {todayState && todayState.receivables > 0 && (
          <Text variant="small" as="p" className="text-2xs">
            incl. {formatCurrency(todayState.receivables)} owed to you
          </Text>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        {viewControls}
        {withHorizon && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {ghost && (
              <Toggle
                variant="outline"
                size="sm"
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
              onValueChange={(v) => {
                if (!v) return;
                // The picked point's index means another month on a new horizon.
                onSelectPeriod?.(null, null);
                onHorizonChange(Number(v));
              }}
              aria-label="Projection horizon"
            >
              {HORIZON_PRESETS.map((preset, i) => (
                <ToggleGroupItem
                  key={preset.months}
                  value={String(preset.months)}
                  // A horizon past the plan's end still runs to it, so it is
                  // off only when it would show nothing the one before shows.
                  disabled={i > 0 && HORIZON_PRESETS[i - 1].months >= maxAvailable}
                >
                  {preset.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
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
    // Equal heights on desktop: the view area is FIXED to the screen's height
    // below the page header (never under 40rem; see "Plan panel" in
    // SPACING.md) — every view (graph / table / calendar) fills exactly that
    // box, scrolling internally when taller — and the sidebar column takes the
    // same value as a min-height so its cards stretch to the same bottom edge
    // (min- rather than fixed, so the expanded strategy picker can grow past
    // it instead of clipping). Keep the two values in sync, and in the
    // skeleton. On mobile everything sizes naturally.
    <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
      {/* min-w-0 on both grid children: grid items default to min-width:auto,
          so wide content (the table, recharts' measured svg) would inflate the
          column past the viewport on mobile instead of shrinking. */}
      <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
        {/* Active view. Swipe handlers on the stable wrapper; the keyed child
            fades in on switch (no horizontal slide → nothing clips the card's
            border/shadow). The active view brings its own Card. */}
        <div
          className="touch-pan-y xl:h-[max(40rem,calc(100svh-11.5rem))]"
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <div key={view} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 xl:h-full">
            {view === "calendar" ? (
              calendar(forecastHeader(false))
            ) : (
              <Card className="xl:h-full">
                <CardHeader className="gap-3">{forecastHeader(true)}</CardHeader>
                <CardContent className="xl:min-h-0 xl:flex-1">
                  {view === "chart" ? (
                    <ProjectionChart
                      points={chartSeries.points}
                      pastCount={chartSeries.pastCount}
                      heightClass="h-72 sm:h-80 xl:h-full"
                      onSelectIndex={handleSelectIndex}
                      selectedIndex={selectedIndex}
                      milestones={milestones}
                      todayLabel={todayIsOnChart ? todayCaption : undefined}
                      markToday={!beforeStart}
                      ghostValues={ghostValues}
                      ghostLabel={ghost?.name}
                      portfolioValues={portfolioValues}
                      showTrading={showTrading}
                    />
                  ) : (
                    <ProjectionTable
                      projection={projection}
                      monthsToShow={tableRange.count}
                      startIndex={tableRange.startIndex}
                      currentIndex={todayIsOnChart ? todayState?.periodIndex : undefined}
                      rowStep={rowStepFor(horizonMonths)}
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
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 xl:flex xl:min-h-[max(40rem,calc(100svh-11.5rem))] xl:flex-col xl:items-stretch xl:gap-4">
        {sidebar}
      </div>

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
  series,
  value,
  tone,
  hint,
  description,
  breakdown,
}: {
  label: string;
  /** The chart series this figure reads, whose swatch keys it as on the dashboard. */
  series?: DashboardSeries;
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
      <Text variant="small" as="span" className="flex items-center gap-1.5">
        {series && <SeriesSwatch series={series} />}
        {label}
      </Text>
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
          className={cn(rowClass, "w-full cursor-pointer text-left transition hover:bg-muted/30")}
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


