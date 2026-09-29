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
    loading: () => <Skeleton className="h-72 w-full sm:h-80 lg:h-full" />,
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
import { formatCurrency } from "@/lib/utils/format";
import {
  isDateInPeriod,
  monthsInPeriod,
  periodIndexForDate,
  periodRangeFor,
} from "@/lib/finance/period";
import {
  buildChartSeries,
  computeProjectionWindow,
  mapGhostValues,
  mapPortfolioValues,
  type ChartPoint,
  type PlanHistoryPoint,
} from "@/lib/finance/chart-series";
import type {
  DebtStrategy,
  FinancePlanLineOverride,
  FinancePlanWithLines,
  InvestmentMethodOption,
  Projection,
  ProjectionMonth,
  RecurrenceType,
  StrategyComparison,
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
  /** The base plan's calibrated lines — lets today's ghost point be day-aware. */
  plan?: FinancePlanWithLines;
  projection: Projection;
};

type PlanEditorProps = {
  plan: FinancePlanWithLines;
  /** Plan calibrated from the latest confirmation — drives the projection and
   *  the "today" seed. Equals `plan` when there are no confirmations. The raw
   *  `plan` is what the line/debt editors mutate. */
  baseline: FinancePlanWithLines;
  projection: Projection;
  /** Raw (un-calibrated) projection — re-simulates the chart's past when there
   *  are no real snapshots, so confirming the current period doesn't blank the
   *  chart history. Equals `projection` when there are no confirmations. */
  pastProjection: Projection;
  /** Real monthly snapshots for the chart's past (newest-last). */
  history: PlanHistoryPoint[];
  comparison: StrategyComparison | null;
  investmentMethods: InvestmentMethodOption[];
  /** Base plan's calibrated projection when this plan is a scenario. */
  ghost?: GhostPlan | null;
  /** Recorded portfolio value history — the past segment of the chart's
   *  portfolio series when the plan includes the portfolio. */
  portfolioHistory?: { date: Date; value: number }[];
  /** Live portfolio value (0 when the plan excludes the portfolio). */
  portfolioValue?: number;
  /** Net-worth milestones from the user's global preference. */
  milestones?: readonly number[];
  title: string;
  description: string;
  /** When set, renders the header's back link to here. */
  backHref?: string;
  /** The server's clock for this render. "Today" — the current period, the
   *  KPIs, the chart's today point — is derived from it rather than from
   *  `new Date()` on each side, which rendered a different day on the client
   *  than the server did around midnight. */
  now: Date;
};

export function PlanEditor({
  plan,
  baseline,
  projection,
  pastProjection,
  history,
  comparison,
  investmentMethods,
  ghost = null,
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

  // "Today" snapshot — locate the projection row for the accounting period that
  // actually CONTAINS today. Using months[0] (the plan/calibration START period)
  // went stale as time passed or when the last confirmation was old, so the
  // cards/gauge could show start-of-plan figures labelled "now". The projection
  // is built from `baseline`, so index relative to its startMonth + anchor day.
  const currentPeriodIdx = Math.min(
    Math.max(
      0,
      periodIndexForDate(
        baseline.startMonth,
        baseline.confirmationDayOfMonth,
        now
      )
    ),
    Math.max(0, projection.months.length - 1)
  );
  const today = projection.months[currentPeriodIdx];
  // What the confirmation dialog pre-fills: the OPENING of the current period
  // (= the previous period's close, or the calibrated initials for the first
  // period). That is exactly what saveConfirmation stores as the new baseline;
  // pre-filling the close made a blind Save jump the baseline a whole period.
  const periodOpening =
    currentPeriodIdx > 0
      ? (() => {
          const prev = projection.months[currentPeriodIdx - 1];
          return {
            savings: prev.savings,
            investments: prev.investments,
            debts: prev.debts.map((d) => ({
              debtId: d.debtId,
              name: d.name,
              balance: d.balance,
            })),
          };
        })()
      : {
          savings: parseFloat(baseline.initialSavings),
          investments: parseFloat(baseline.initialInvestments),
          debts: baseline.debts.map((d) => ({
            debtId: d.id,
            name: d.name,
            balance: parseFloat(d.initialBalance),
          })),
        };
  const income = today?.income ?? 0;
  const livingExpenses = today?.expenses ?? 0;
  const minDebtPayments = today?.scheduledDebtPayments ?? 0;
  const extraDebtPayments = today?.extraDebtPayments ?? 0;
  // Fixed monthly outflow: living + debt minimums. These are non-negotiable —
  // they hit the bank whether or not we accelerate debt or invest. This is the
  // value behind both the "Living expenses" card and the gauge numerator.
  const fixedOutflow = livingExpenses + minDebtPayments;
  // Surplus = what's left after fixed obligations. This equals the projection's
  // monthly `cashFlow` field by construction (income − expenses − minimums).
  const surplus = income - fixedOutflow;
  // Surplus routing: extras come straight from the projection; the wealth
  // bucket (= investments + savings contributions) is whatever survives.
  const investmentsContribution = Math.max(0, today?.investmentsContribution ?? 0);
  const toWealth = surplus - extraDebtPayments;
  const savingsContribution = Math.max(0, toWealth - investmentsContribution);

  const totalDebt = today?.totalDebt ?? 0;

  // Chart-hover preview: while the pointer is over a chart point, the sidebar
  // cards show THAT period's figures (with a backdrop + period chip so it reads
  // as "not the present"); on leave they snap back to the current period.
  // Health/surplus are pure functions of these inputs, so nothing is stored.
  const [hoverFigures, setHoverFigures] = useState<PeriodFigures | null>(null);
  const isPreview = hoverFigures !== null;
  const dIncome = hoverFigures?.income ?? income;
  const dLivingExpenses = hoverFigures?.livingExpenses ?? livingExpenses;
  const dMinDebtPayments = hoverFigures?.minDebtPayments ?? minDebtPayments;
  const dFixedOutflow = dLivingExpenses + dMinDebtPayments;
  const dSurplus = dIncome - dFixedOutflow;
  const dTotalDebt = hoverFigures?.totalDebt ?? totalDebt;

  // Current accounting PERIOD. With an anchor day (confirmationDayOfMonth) the
  // period runs anchor→anchor and straddles two calendar months — e.g. day 5
  // ⇒ Apr 5 – May 4 — so every "what's active / when does it land" question
  // below is answered against THIS window, not a single calendar month. Day 0/1
  // falls back to the plain calendar month.
  const anchorDay = plan.confirmationDayOfMonth;
  const effectiveAnchorDay = anchorDay > 0 ? anchorDay : 1;
  const isPeriodMode = anchorDay > 1;
  const currentMonthDate = today?.date ?? new Date(plan.startMonth);
  const currentPeriod = periodRangeFor(currentMonthDate, effectiveAnchorDay);
  const planStartMonthDate = new Date(plan.startMonth);

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
  const expensesLabel = isPeriodMode ? "Period expenses" : "Living expenses";

  // The exact date a line lands on within the current period, or null when it
  // doesn't hit this period. Walks the 1–2 calendar months the period touches,
  // so an anchor-day window (e.g. a paycheque on the 2nd that belongs to the
  // Apr 5 – May 4 period as May 2) resolves correctly instead of being judged
  // against only the period's start month.
  const lineHitDateInPeriod = (
    line:
      | FinancePlanWithLines["incomes"][number]
      | FinancePlanWithLines["expenses"][number]
  ): Date | null => {
    if (line.kind === "one_time") {
      const d = readDateParts(line.date);
      if (!d) return null;
      const dt = new Date(Date.UTC(d.year, d.month, d.day));
      return isDateInPeriod(dt, currentPeriod) ? dt : null;
    }
    // Recurring: incomes carry a [startDate, endDate] window; expenses don't,
    // so we read it defensively from the line type.
    const startISO = "startDate" in line ? line.startDate : null;
    const endISO = "endDate" in line ? line.endDate : null;
    for (const { year, monthIdx } of monthsInPeriod(currentPeriod)) {
      const hitDay = recurringHitDayInMonth(line, year, monthIdx, planStartMonthDate);
      if (hitDay === null) continue;
      const dt = new Date(Date.UTC(year, monthIdx, hitDay));
      if (!isDateInPeriod(dt, currentPeriod)) continue;
      if (!hitDayWithinWindow(year, monthIdx, hitDay, startISO, endISO)) continue;
      return dt;
    }
    return null;
  };

  // Pair each active line with its hit date and sort chronologically — this
  // drives both the breakdown dialogs' order and their per-line date hint.
  const datedSorted = <L,>(
    lines: readonly L[],
    dateOf: (line: L) => Date | null
  ): { line: L; date: Date }[] =>
    lines
      .map((line) => ({ line, date: dateOf(line) }))
      .filter((r): r is { line: L; date: Date } => r.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

  const activeIncomeRows = datedSorted(plan.incomes, lineHitDateInPeriod);
  const activeExpenseRows = datedSorted(plan.expenses, lineHitDateInPeriod);

  // Debt payment day within the period (monthly debts hit once per period).
  const debtHitDateInPeriod = (debtId: string): Date | null => {
    const debt = plan.debts.find((d) => d.id === debtId);
    if (!debt) return null;
    for (const { year, monthIdx } of monthsInPeriod(currentPeriod)) {
      const hitDay = recurringHitDayInMonth(debt, year, monthIdx, planStartMonthDate);
      if (hitDay === null) continue;
      const dt = new Date(Date.UTC(year, monthIdx, hitDay));
      if (isDateInPeriod(dt, currentPeriod)) return dt;
    }
    return null;
  };

  // Debt-line lookups: scheduled payment-this-period (sorted by payment date)
  // for the expenses breakdown, current balance for the total-debt breakdown.
  const debtPaymentRows = (today?.debts ?? [])
    .map((d) => ({
      name: d.name,
      amount: d.scheduledPayment,
      date: debtHitDateInPeriod(d.debtId),
    }))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });
  const debtBalanceLines = (today?.debts ?? []).map((d) => ({
    name: d.name,
    balance: d.balance,
  }));

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
          baseline={baseline}
          history={history}
          ghost={ghost}
          portfolioHistory={portfolioHistory}
          portfolioEnabled={plan.includePortfolio}
          onTogglePortfolio={handleTogglePortfolio}
          onHoverFigures={setHoverFigures}
          milestones={milestones}
          onConfirmToday={openConfirmation}
          now={now}
          calendar={
            <PlanCalendar
              plan={plan}
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
            <div className="relative flex min-h-0 flex-col lg:flex-1">
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
                // lg:flex-1 — fills the sidebar column so its bottom edge tracks
                // the main panel's fixed height (see ProjectionPanel's grid).
                "transition-all duration-200 lg:flex-1",
                // Card already draws the ring; the preview only darkens it.
                isPreview && "bg-muted/40 ring-foreground/10"
              )}
            >
              <CardContent className="flex flex-col gap-4">
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
                    tone="positive"
                    description="Every income landing in the current period."
                    breakdown={
                      <BreakdownList
                        items={activeIncomeRows.map((r) => ({
                          name: r.line.name,
                          amount: Number(r.line.monthlyAmount),
                          hint: fmtPeriodDay(r.date),
                        }))}
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
                          {
                            heading: "Expenses",
                            items: activeExpenseRows.map((r) => ({
                              name: r.line.name,
                              amount: Number(r.line.monthlyAmount),
                              hint: fmtPeriodDay(r.date),
                            })),
                          },
                          {
                            heading: "Debt minimums",
                            items: debtPaymentRows.map((d) => ({
                              name: d.name,
                              amount: d.amount,
                              hint: d.date ? fmtPeriodDay(d.date) : undefined,
                            })),
                          },
                        ]}
                        emptyLabel="No fixed obligations yet"
                        total={fixedOutflow}
                      />
                    }
                  />
                  <StatRow
                    label="Total debt"
                    value={dTotalDebt}
                    description="What each debt stands at this period."
                    tone={dTotalDebt > 0 ? "negative" : undefined}
                    hint={
                      plan.debts.length === 0
                        ? undefined
                        : projection.monthsToDebtFree !== null
                        ? `Debt-free in ${projection.monthsToDebtFree} mo`
                        : "Beyond horizon"
                    }
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
                    tone={dSurplus >= 0 ? "positive" : "negative"}
                    hint={dSurplus < 0 ? "Spends more than it earns" : undefined}
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
            {ghost && (
              <ScenarioDeltaCard ghost={ghost} projection={projection} />
            )}
            {debtComparison && (
              <Card className="min-h-0">
                <CardHeader>
                  <Eyebrow asChild>
                    <h2 id="debt-strategy-heading">Debt payoff strategy</h2>
                  </Eyebrow>
                </CardHeader>
                {/* All three options on screen with their cost, rather than a
                    badge you have to expand: the choice is a trade-off, and
                    hiding the alternatives hid the trade-off. */}
                <CardContent className="min-h-0 overflow-y-auto">
                  <StrategyPicker
                    comparison={debtComparison}
                    currentStrategy={currentStrategy}
                    onChange={handleChangeStrategy}
                    pending={isPending}
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
              title="Income (Entradas)"
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
              title="Expenses (Salidas)"
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
          projected={periodOpening}
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
 * Sidebar card for scenario plans: names the base plan and shows the
 * horizon-independent deltas — ending net worth and months-to-debt-free —
 * between this scenario and its base. Green when the scenario wins.
 */
function ScenarioDeltaCard({
  ghost,
  projection,
}: {
  ghost: GhostPlan;
  projection: Projection;
}) {
  const netWorthDelta = projection.endingNetWorth - ghost.projection.endingNetWorth;
  const scenarioDebtFree = projection.monthsToDebtFree;
  const baseDebtFree = ghost.projection.monthsToDebtFree;
  const debtFreeDelta =
    scenarioDebtFree !== null && baseDebtFree !== null
      ? scenarioDebtFree - baseDebtFree
      : null;
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
        <div className="flex items-center justify-between gap-3 border-t py-2">
          <Text variant="small" as="span">Ending net worth</Text>
          <Mono
            className={cn(
              "text-sm font-semibold",
              netWorthDelta >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {netWorthDelta >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(netWorthDelta))}
          </Mono>
        </div>
        {debtFreeDelta !== null && (
          <div className="flex items-center justify-between gap-3 border-t py-2">
            <Text variant="small" as="span">Debt-free</Text>
            <Mono
              className={cn(
                "text-sm font-semibold",
                debtFreeDelta <= 0 ? "text-success" : "text-destructive"
              )}
            >
              {debtFreeDelta === 0
                ? "same"
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
  /** Raw (un-calibrated) projection for re-simulating the chart's past when
   *  there are no real snapshots. See PlanEditorProps. */
  pastProjection: Projection;
  /** Confirmation-calibrated plan — drives the projection and the "today"
   *  partial-month seed (its startMonth/initials match `projection`). The Today
   *  KPI uses it to back out income / expense that hasn't hit yet this month. */
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

// Day-of-month a recurring line lands on in (year, monthIdx). Mirrors the
// calendar's resolver so the Today snapshot can ask "did this entry hit
// already?" using the exact same dates the user sees on their calendar.
function nthWeekdayOfMonth(
  year: number,
  monthIdx: number,
  weekOfMonth: number,
  dayOfWeek: number
): number {
  const firstDow = new Date(year, monthIdx, 1).getDay();
  const firstOccurrence = 1 + ((dayOfWeek - firstDow + 7) % 7);
  let target = firstOccurrence + (weekOfMonth - 1) * 7;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  if (target > lastDay) target -= 7;
  return target;
}

function recurringHitDayInMonth(
  row: {
    recurrenceType: RecurrenceType;
    dayOfMonth: number | null;
    weekOfMonth: number | null;
    dayOfWeek: number | null;
    intervalMonths: number | null;
    recurrenceStart: string | null;
  },
  year: number,
  monthIdx: number,
  planStartMonth: Date
): number | null {
  if (
    row.recurrenceType === "monthly_weekday" &&
    row.weekOfMonth != null &&
    row.dayOfWeek != null
  ) {
    return nthWeekdayOfMonth(year, monthIdx, row.weekOfMonth, row.dayOfWeek);
  }
  if (row.recurrenceType === "every_n_months") {
    if (!row.intervalMonths || row.intervalMonths < 1) return null;
    const start = row.recurrenceStart;
    const anchor = start
      ? (() => {
          const [y, m] = start.split("-").map((p) => parseInt(p, 10));
          return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + (m - 1) : null;
        })()
      : planStartMonth.getUTCFullYear() * 12 + planStartMonth.getUTCMonth();
    if (anchor === null) return null;
    const mk = year * 12 + monthIdx;
    if (mk < anchor || (mk - anchor) % row.intervalMonths !== 0) return null;
  }
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  return Math.min(row.dayOfMonth ?? 1, lastDay);
}

// Reads "YYYY-MM-DD" date strings (the form DB returns from `date` columns)
// into a {y, m, d} triplet at UTC.
function readDateParts(
  iso: string | null
): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { year: y, month: m - 1, day: d };
}

type TodaySnapshot = {
  netWorth: number;
  totalDebt: number;
  investments: number;
  monthDate: Date;
};

/**
 * Puts the day-aware "today" figures onto the chart's today point.
 *
 * `buildChartSeries` draws today from `projection.months[today]`, which is the
 * period's CLOSE — every flow of the period already applied. The Today KPI is
 * `computeTodaySnapshot`, the position as of this morning. Both were labelled
 * "today" and disagreed by a paycheque, so the dot (and its tooltip) now carry
 * the KPI's numbers and the dashed forecast sets off from where the reader
 * actually stands. No-op when today falls outside the projection.
 */
function alignTodayPoint(
  series: { points: ChartPoint[]; pastCount: number },
  snapshot: TodaySnapshot | null,
  anchorDay: number
): { points: ChartPoint[]; pastCount: number } {
  if (!snapshot) return series;
  const point = series.points[series.pastCount];
  if (
    !point ||
    periodIndexForDate(point.date, anchorDay > 0 ? anchorDay : 1, snapshot.monthDate) !== 0
  ) {
    return series;
  }
  const points = series.points.slice();
  points[series.pastCount] = {
    ...point,
    netWorth: snapshot.netWorth,
    totalDebt: snapshot.totalDebt,
    investments: snapshot.investments,
  };
  return { points, pastCount: series.pastCount };
}

// Day-precise window check: is the hit date (year, monthIdx, day) on/after
// startISO and on/before endISO? Either bound is optional. Lives at module
// level so the breakdown filter and the partial-month walker share semantics
// with the server-side projection's `dateWithinWindow`.
function hitDayWithinWindow(
  year: number,
  monthIdx: number,
  hitDay: number,
  startISO: string | null,
  endISO: string | null
): boolean {
  const hitMs = Date.UTC(year, monthIdx, hitDay);
  const s = readDateParts(startISO);
  if (s && Date.UTC(s.year, s.month, s.day) > hitMs) return false;
  const e = readDateParts(endISO);
  if (e && Date.UTC(e.year, e.month, e.day) < hitMs) return false;
  return true;
}

/**
 * Computes today's net worth as a *partial-period* snapshot built from
 * scratch — NOT from the projection's end-of-period aggregate. This matches
 * the user's mental model: "what does my bank/debt look like right now,
 * given what has actually hit so far this period?".
 *
 * Period-aware: the accounting period that contains today is located via
 * `periodIndexForDate` and spans 1–2 calendar months (anchored on the plan's
 * confirmation day). We walk EACH touched month and apply only the hits that
 * fall inside the period AND on/before today — so a day-15 anchor with today on
 * the 6th correctly settles the part of the period that already elapsed in the
 * previous calendar month.
 *
 * Algorithm:
 *   1. Seed savings/investments/per-debt balances from the previous period's
 *      close (= this period's opening). For period 0, use the plan's initials.
 *   2. Walk every income/expense line; if a hit lands in the period and ≤ today,
 *      apply it as cash in/out of savings.
 *   3. For each debt, if its scheduled payment has hit in the period by today,
 *      subtract the scheduled payment from savings and swap the debt balance
 *      for the projection's end-of-period value (captures interest + extra).
 *      Payments still ahead leave the balance at period-opening.
 *   4. Net worth = savings + investments + portfolio − total debt.
 *
 * Trade-offs: extra payments only happen at period-end (after surplus routing)
 * so subtracting them from savings mid-period would be wrong; instead they stay
 * in the debt balance via the end-of-period swap. Mid-period interest accrual
 * is approximated by trusting the projection's end-of-period balance once the
 * payment has hit; before that, the opening balance carries no interest (mild
 * under-statement for high-rate debts early in a period, accepted to keep the
 * snapshot O(lines) instead of a full re-walk).
 */
function computeTodaySnapshot(
  plan: FinancePlanWithLines,
  projection: Projection,
  anchorDay: number,
  now: Date
): TodaySnapshot | null {
  const planStart = new Date(plan.startMonth);
  const monthOffset = periodIndexForDate(planStart, anchorDay, now);

  if (monthOffset < 0 || monthOffset >= projection.months.length) return null;

  const currentMonth = projection.months[monthOffset];
  // The accounting period that contains today (1–2 calendar months).
  const period = periodRangeFor(now, anchorDay > 0 ? anchorDay : 1);
  const periodStartMs = period.start.getTime();
  const periodEndMs = period.end.getTime();
  const nowMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const touchedMonths = monthsInPeriod(period);

  // A hit on (year, monthIdx, day) counts when it lands inside the current
  // period AND has already occurred (on/before today).
  const hitIsLive = (year: number, monthIdx: number, day: number): boolean => {
    const ms = Date.UTC(year, monthIdx, day);
    return ms >= periodStartMs && ms <= periodEndMs && ms <= nowMs;
  };

  // Seed from the previous period's close (= this period's opening). For the
  // first period, fall back to the plan's initial figures.
  const prevMonth = monthOffset > 0 ? projection.months[monthOffset - 1] : null;
  let savings = prevMonth ? prevMonth.savings : parseFloat(plan.initialSavings);
  const investments = prevMonth
    ? prevMonth.investments
    : parseFloat(plan.initialInvestments);
  const debtBalances = new Map<string, number>();
  if (prevMonth) {
    for (const d of prevMonth.debts) debtBalances.set(d.debtId, d.balance);
  } else {
    for (const d of plan.debts) {
      debtBalances.set(d.id, parseFloat(d.initialBalance));
    }
  }

  // Per-month overrides, indexed the way projectPlan indexes them. Without
  // this the Today KPI (and the chart's today dot, which copies it) still
  // charged a rent the user had skipped for this month.
  const overrideIndex = new Map<string, FinancePlanLineOverride>();
  for (const o of plan.overrides ?? []) {
    const [y, mo] = o.monthYear.slice(0, 10).split("-").map(Number);
    if (!y || !mo) continue;
    overrideIndex.set(`${o.parentSide}:${o.parentId}:${y * 12 + (mo - 1)}`, o);
  }
  const overriddenAmount = (
    side: "income" | "expense",
    id: string,
    year: number,
    monthIdx: number,
    base: number
  ): number | null => {
    const ov = overrideIndex.get(`${side}:${id}:${year * 12 + monthIdx}`);
    if (!ov) return base;
    if (ov.action === "skip") return null;
    if (ov.action === "amount" && ov.monthlyAmount !== null) {
      return Math.max(0, Number(ov.monthlyAmount));
    }
    return base;
  };

  // ---- Income / expense cashflow ------------------------------------------
  for (const inc of plan.incomes) {
    if (inc.kind === "one_time") {
      const d = readDateParts(inc.date);
      if (d && hitIsLive(d.year, d.month, d.day)) {
        savings += Number(inc.monthlyAmount);
      }
      continue;
    }
    for (const cm of touchedMonths) {
      const hitDay = recurringHitDayInMonth(inc, cm.year, cm.monthIdx, planStart);
      if (hitDay === null || !hitIsLive(cm.year, cm.monthIdx, hitDay)) continue;
      if (
        !hitDayWithinWindow(cm.year, cm.monthIdx, hitDay, inc.startDate, inc.endDate)
      ) {
        continue;
      }
      const amount = overriddenAmount("income", inc.id, cm.year, cm.monthIdx, Number(inc.monthlyAmount));
      if (amount === null) continue;
      savings += amount;
    }
  }
  for (const exp of plan.expenses) {
    if (exp.kind === "one_time") {
      const d = readDateParts(exp.date);
      if (d && hitIsLive(d.year, d.month, d.day)) {
        savings -= Number(exp.monthlyAmount);
      }
      continue;
    }
    // Expenses don't carry a start/end window in the schema; the hit check is
    // sufficient.
    for (const cm of touchedMonths) {
      const hitDay = recurringHitDayInMonth(exp, cm.year, cm.monthIdx, planStart);
      if (hitDay === null || !hitIsLive(cm.year, cm.monthIdx, hitDay)) continue;
      const amount = overriddenAmount("expense", exp.id, cm.year, cm.monthIdx, Number(exp.monthlyAmount));
      if (amount === null) continue;
      savings -= amount;
    }
  }

  // ---- Debt payments that have hit so far this period ----------------------
  for (const debt of plan.debts) {
    const eomDebt = currentMonth.debts.find((d) => d.debtId === debt.id);
    if (!eomDebt) continue;
    let hit = false;
    for (const cm of touchedMonths) {
      const hitDay = recurringHitDayInMonth(debt, cm.year, cm.monthIdx, planStart);
      if (hitDay !== null && hitIsLive(cm.year, cm.monthIdx, hitDay)) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    // Scheduled payment already left the bank this period. Extra payments
    // happen at period-end (after surplus routing) so we don't deduct them
    // here — but we trust the projection's end-of-period balance for accuracy
    // (captures interest + extra).
    savings -= eomDebt.scheduledPayment;
    debtBalances.set(debt.id, eomDebt.balance);
  }

  const totalDebt = Array.from(debtBalances.values()).reduce(
    (sum, b) => sum + Math.max(0, b),
    0
  );
  const portfolioValue = currentMonth.portfolioValue ?? 0;

  return {
    netWorth: savings + investments + portfolioValue - totalDebt,
    totalDebt,
    investments,
    monthDate: currentMonth.date,
  };
}

/**
 * Projection chart with a header that surfaces the headline number — how much
 * the net worth is expected to grow over the chosen horizon. Preset buttons
 * (12 mo / 2 yr / 5 yr / 10 yr) let the user switch horizons; the chart and KPIs
 * re-render against whatever is selected.
 */
function ProjectionPanel({
  projection,
  pastProjection,
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
}: ProjectionPanelProps) {
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

  // Window with the active horizon: ~25% past + 75% future. Edges shift when
  // the plan started recently so we never look past data we don't have. Used
  // for the KPIs + the monthly-breakdown table (both are forecast views).
  //
  // Everything below is memoised: hovering the chart re-renders the editor on
  // every point, and without it the series (and every figure derived from it)
  // was rebuilt each time, handing the chart new props mid-hover.
  const window = useMemo(
    () => computeProjectionWindow(projection, horizonMonths, now, anchorDay),
    [projection, horizonMonths, now, anchorDay]
  );

  // Day-aware "today" net worth: strips income/expense from the period-end
  // value when they haven't actually hit yet (e.g. paycheque on day 30 when
  // today is day 25). Null when we're outside the projection range.
  // Refined against the CALIBRATED baseline — its startMonth + initials match
  // the projection we're refining, so period indexing and the period-0 seed
  // line up with confirmed reality.
  const todaySnapshot = useMemo(
    () => computeTodaySnapshot(baseline, projection, anchorDay, now),
    [baseline, projection, anchorDay, now]
  );

  // Chart series: real snapshots for the past, calibrated projection for the
  // future. Falls back to the projection-only window when there's no history.
  // Today's point carries the same figures as the Today KPI.
  const chartSeries = useMemo(
    () =>
      alignTodayPoint(
        buildChartSeries(history, projection, horizonMonths, now, anchorDay, pastProjection),
        todaySnapshot,
        anchorDay
      ),
    [history, projection, horizonMonths, now, anchorDay, pastProjection, todaySnapshot]
  );

  // Scenario ghost: the base plan's net worth aligned to this chart's points
  // (matched by accounting period — the base can have a different startMonth).
  // Hidden via the "vs base" chip without losing the alignment work.
  const [showGhost, setShowGhost] = useState(true);
  const ghostValues = useMemo<(number | null)[] | undefined>(() => {
    if (!ghost || !showGhost) return undefined;
    const values = mapGhostValues(chartSeries.points, ghost.projection, anchorDay);
    // The main series' today point is the day-aware snapshot (see
    // `alignTodayPoint`); the ghost has to be read the same way or the two
    // plans show a spurious delta at today equal to the flows still to come.
    if (ghost.plan && values[chartSeries.pastCount] != null) {
      const snap = computeTodaySnapshot(ghost.plan, ghost.projection, anchorDay, now);
      if (snap) values[chartSeries.pastCount] = snap.netWorth;
    }
    return values;
  }, [ghost, showGhost, chartSeries.points, chartSeries.pastCount, anchorDay, now]);

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

  // Hovering today's point is "the present" — treat it as no preview so the
  // sidebar only takes the backdrop/chip treatment for OTHER periods.
  const handleHoverIndex = useCallback(
    (idx: number | null): void => {
      if (!onHoverFigures) return;
      if (idx === null || idx === chartSeries.pastCount) {
        onHoverFigures(null);
        return;
      }
      onHoverFigures(pointFigures[idx] ?? null);
    },
    [onHoverFigures, chartSeries.pastCount, pointFigures]
  );

  // Full projection month behind each chart point, resolved by accounting
  // PERIOD (not calendar month) for the same reason as `pointFigures`.
  const monthByPoint = useMemo<(ProjectionMonth | null)[]>(() => {
    const effAnchor = anchorDay > 0 ? anchorDay : 1;
    return chartSeries.points.map((p) => {
      const inSamePeriod = (m: { date: Date }) =>
        periodIndexForDate(m.date, effAnchor, p.date) === 0;
      return (
        projection.months.find(inSamePeriod) ??
        pastProjection.months.find(inSamePeriod) ??
        null
      );
    });
  }, [chartSeries.points, projection, pastProjection, anchorDay]);

  const [comparedIdx, setComparedIdx] = useState<number | null>(null);

  // Clicking today means "record what actually happened", not "preview" — so it
  // hands off to the confirmation dialog. Every other point opens the compare
  // dialog for that period.
  const handleSelectIndex = useCallback(
    (idx: number): void => {
      if (idx === chartSeries.pastCount) {
        onConfirmToday?.();
        return;
      }
      setComparedIdx(idx);
    },
    [chartSeries.pastCount, onConfirmToday]
  );
  const todayMonthIdx = window.startIndex + window.pastCount;
  const todayMonth = projection.months[todayMonthIdx];
  // "Next period" forecast — the projection for the period right after today.
  // Falls back to undefined when we're already at the last period of the plan
  // (the KPI is hidden in that case).
  const nextMonth = projection.months[todayMonthIdx + 1];
  const futureMonth =
    projection.months[window.startIndex + window.count - 1] ?? todayMonth;
  // Falls back to the period close when today sits outside the projection.
  const today = todaySnapshot?.netWorth ?? todayMonth?.netWorth ?? 0;
  const next = nextMonth?.netWorth;
  const future = futureMonth?.netWorth ?? today;

  // Horizon-end delta vs the base plan (scenario only) — matched by period so
  // a different base startMonth still compares the same calendar window.
  const ghostFuture =
    ghost && futureMonth
      ? ghost.projection.months.find(
          (m) =>
            periodIndexForDate(
              m.date,
              anchorDay > 0 ? anchorDay : 1,
              futureMonth.date
            ) === 0
        )?.netWorth ?? null
      : null;
  const endDelta = ghostFuture !== null ? future - ghostFuture : null;

  // Forecast header (Today / Next / End KPIs + horizon picker) — shared by the
  // Graph and Table views (both are horizon-driven forecast views). It sits in
  // the card header so the number reads as the headline, Polymarket-style.
  const forecastHeader = (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <div>
          <Eyebrow size="sm" as="p">
            Today {todayMonth ? FORMATTER.format(todayMonth.date) : ""}
          </Eyebrow>
          <Mono
            as="p"
            className={cn(
              "text-xl font-semibold tabular-nums sm:text-2xl",
              today >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {formatCurrency(today)}
          </Mono>
        </div>
        {nextMonth && next !== undefined && (
          <div>
            <Eyebrow size="sm" as="p">
              Next {FORMATTER.format(nextMonth.date)}
            </Eyebrow>
            <Mono
              as="p"
              className={cn(
                "text-sm font-semibold",
                next >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatCurrency(next)}
            </Mono>
          </div>
        )}
        <div>
          <Eyebrow size="sm" as="p">
            End {futureMonth ? FORMATTER.format(futureMonth.date) : ""}
          </Eyebrow>
          <Mono
            as="p"
            className={cn(
              "text-sm font-semibold",
              future >= 0 ? "text-success" : "text-destructive"
            )}
          >
            {formatCurrency(future)}
          </Mono>
          {endDelta !== null && (
            <Text
              variant="small"
              as="p"
              className={cn(
                "text-2xs",
                endDelta >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {endDelta >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(endDelta))} vs base
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
        {onConfirmToday && (
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
    // Equal heights on desktop: the view area is FIXED at lg:h-160 — every
    // view (graph / table / calendar) fills exactly that box, scrolling
    // internally when taller — and the sidebar column is lg:h-160 so its
    // cards stretch to the same bottom edge (min- rather than fixed, so the
    // expanded strategy picker can grow past it instead of clipping). Keep the
    // two values in sync. On mobile everything sizes naturally.
    <div className="grid gap-4 lg:grid-cols-4 lg:items-start">
      {/* min-w-0 on both grid children: grid items default to min-width:auto,
          so wide content (the table, recharts' measured svg) would inflate the
          column past the viewport on mobile instead of shrinking. */}
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-3">
        {/* Active view. Swipe handlers on the stable wrapper; the keyed child
            fades in on switch (no horizontal slide → nothing clips the card's
            border/shadow). The active view brings its own Card. */}
        <div
          className="touch-pan-y lg:h-160"
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <div key={view} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 lg:h-full">
            {view === "calendar" ? (
              // The calendar card is taller than the panel box — scroll it
              // inside so the Calendar view keeps the same footprint.
              <div className="lg:h-full lg:overflow-y-auto">{calendar}</div>
            ) : (
              <Card className="lg:h-full">
                <CardHeader className="gap-3">{forecastHeader}</CardHeader>
                <CardContent
                  className={cn(
                    "lg:min-h-0 lg:flex-1",
                    view === "table" && "lg:overflow-y-auto"
                  )}
                >
                  {view === "chart" ? (
                    <ProjectionChart
                      points={chartSeries.points}
                      pastCount={chartSeries.pastCount}
                      color={projection.plan.color}
                      heightClass="h-72 sm:h-80 lg:h-full"
                      onHoverIndex={handleHoverIndex}
                      onSelectIndex={handleSelectIndex}
                      milestones={milestones}
                      ghostValues={ghostValues}
                      ghostLabel={ghost?.name}
                      portfolioValues={portfolioValues}
                    />
                  ) : (
                    <ProjectionTable
                      projection={projection}
                      monthsToShow={window.count}
                      startIndex={window.startIndex}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      </div>

      {/* flex column so the figures card (lg:flex-1, set by the parent) absorbs
          the leftover height and the sidebar's bottom edge lines up with the
          main panel's. */}
      <div className="flex min-w-0 flex-col gap-3 lg:h-160 lg:gap-4">
        {sidebar}
      </div>

      <PeriodCompareDialog
        open={comparedIdx !== null}
        onOpenChange={(next) => {
          if (!next) setComparedIdx(null);
        }}
        todayLabel={
          chartSeries.points[chartSeries.pastCount]
            ? HOVER_PERIOD_LABEL.format(
                chartSeries.points[chartSeries.pastCount].date
              )
            : "Today"
        }
        todayMonth={monthByPoint[chartSeries.pastCount] ?? null}
        targetLabel={
          comparedIdx !== null && chartSeries.points[comparedIdx]
            ? HOVER_PERIOD_LABEL.format(chartSeries.points[comparedIdx].date)
            : ""
        }
        targetMonth={comparedIdx !== null ? monthByPoint[comparedIdx] : null}
      />
    </div>
  );
}

function StrategyPicker({
  comparison,
  currentStrategy,
  onChange,
  pending,
}: {
  comparison: StrategyComparison;
  currentStrategy: DebtStrategy;
  onChange: (next: DebtStrategy) => Promise<void>;
  pending: boolean;
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

  return (
    // Not `disabled` while saving: that would disable the radio that has just
    // taken focus and drop the keyboard to <body>. Input is ignored instead.
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
        return (
          <label
            key={key}
            htmlFor={id}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition hover:border-foreground/60 hover:bg-muted/30 has-data-checked:border-foreground has-data-checked:bg-muted/40"
          >
            <span className="flex min-w-0 items-center gap-2">
              <RadioGroupItem id={id} value={key} />
              <span className="truncate text-xs font-medium">
                {STRATEGY_LABEL[key]}
              </span>
              {isCheapest && (
                <Zap className="size-3 shrink-0 text-warning" aria-hidden="true" />
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end leading-tight">
              <Mono className="text-2xs text-muted-foreground">
                {data.monthsToDebtFree !== null
                  ? `${data.monthsToDebtFree} mo`
                  : "beyond horizon"}
              </Mono>
              <Mono
                className={cn(
                  "text-2xs",
                  isCheapest ? "text-success" : "text-muted-foreground"
                )}
              >
                {isCheapest ? "cheapest" : `+${formatCurrency(costVsBest)}`}
              </Mono>
            </span>
          </label>
        );
      })}
    </RadioGroup>
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
    <div className="flex flex-col gap-3 text-sm">
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
    <div className="flex flex-col gap-3 text-sm">
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
        <Mono className={surplus >= 0 ? "text-success" : "text-destructive"}>
          {formatCurrency(surplus)}
        </Mono>
      </div>
      {surplus > 0 && (
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
