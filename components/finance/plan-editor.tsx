"use client";

import dynamic from "next/dynamic";
import { toast } from "sonner";

import {
  Camera,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Star,
  TrendingDown,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";

import { useRegisterDevTool } from "@/components/dev-tools/dev-tools-context";
import { runDailySnapshotsAction } from "@/app/actions/dev-tools";

import { ConfirmationDialog } from "./confirmation-dialog";
import { FinancialHealthDonut } from "./financial-health-donut";
import { PlanCalendar } from "./plan-calendar";
import { PlanLineEditor } from "./plan-line-editor";
import { PlanDebtEditor } from "./plan-debt-editor";
import { PlanForm, type InvestmentMethodOption } from "./plan-form";
import { ProjectionTable } from "./projection-table";
import { useState, useTransition } from "react";

// Recharts is one of the heaviest deps in the app — lazy-load the chart so
// the projection editor's initial bundle stays small. The chart lives below
// the fold (table/form first), so the swap to a skeleton is unobtrusive.
const ProjectionChart = dynamic(
  () => import("./projection-chart").then((mod) => mod.ProjectionChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full" />,
  }
);

import {
  addPlanDebtAction,
  addPlanExpenseAction,
  addPlanIncomeAction,
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
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { periodRangeFor } from "@/lib/finance/period";
import type {
  DebtStrategy,
  FinancePlanWithLines,
  Projection,
  StrategyComparison,
} from "@/types/finance";

type PlanEditorProps = {
  plan: FinancePlanWithLines;
  projection: Projection;
  comparison: StrategyComparison | null;
  investmentMethods: InvestmentMethodOption[];
  title: string;
  description: string;
};

export function PlanEditor({
  plan,
  projection,
  comparison,
  investmentMethods,
  title,
  description,
}: PlanEditorProps) {
  const [, startTransition] = useTransition();

  const wrap = <T,>(fn: () => Promise<{ success: boolean; error?: string } & T>) =>
    new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        const result = await fn();
        if (result.success) resolve();
        else {
          toast.error(result.error ?? "Action failed");
          reject(new Error(result.error ?? "failed"));
        }
      });
    });

  // "Today" snapshot — the projection's first row is the calibrated starting
  // state, which is the most actionable reference for the cards and gauge.
  const today = projection.months[0];
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

  // Filter income / expense lines to ONLY those that contribute to the
  // current projection month, so the breakdown tooltips don't show one-time
  // entries from other months or recurring entries outside their active
  // window. Mirrors what `projectPlan` itself counts toward `today.income`
  // / `today.expenses`, so the tooltip total matches the card value.
  const currentMonthDate = today?.date ?? new Date(plan.startMonth);
  const currentYear = currentMonthDate.getUTCFullYear();
  const currentMonthIdx = currentMonthDate.getUTCMonth();
  const planStartMonthDate = new Date(plan.startMonth);
  const isLineInCurrentMonth = (
    line:
      | FinancePlanWithLines["incomes"][number]
      | FinancePlanWithLines["expenses"][number]
  ): boolean => {
    if (line.kind === "one_time") {
      const d = readDateParts(line.date);
      return !!d && d.year === currentYear && d.month === currentMonthIdx;
    }
    // Recurring: hit-day must exist (catches off-cycle every_n_months) AND
    // fall inside [startDate, endDate] at day precision. Incomes carry the
    // window; expenses don't, so we read defensively from the line type.
    const hitDay = recurringHitDayInMonth(
      line,
      currentYear,
      currentMonthIdx,
      planStartMonthDate
    );
    if (hitDay === null) return false;
    const startISO = "startDate" in line ? line.startDate : null;
    const endISO = "endDate" in line ? line.endDate : null;
    return hitDayWithinWindow(currentYear, currentMonthIdx, hitDay, startISO, endISO);
  };
  const activeIncomes = plan.incomes.filter(isLineInCurrentMonth);
  const activeExpenses = plan.expenses.filter(isLineInCurrentMonth);

  // Debt-line lookups: payment-this-month for the Living-expenses tooltip,
  // current balance for the Total-debt tooltip.
  const debtPaymentLines = (today?.debts ?? []).map((d) => ({
    name: d.name,
    scheduled: d.scheduledPayment,
    extra: d.extraPayment,
  }));
  const debtBalanceLines = (today?.debts ?? []).map((d) => ({
    name: d.name,
    balance: d.balance,
  }));

  // Period anchoring: when the plan confirms on a day other than the 1st (or
  // the disabled sentinel 0), the projection rows are custom accounting
  // periods, not calendar months. Reflect that in the card wording and show
  // the exact date window so the numbers aren't misread as a calendar month.
  const anchorDay = plan.confirmationDayOfMonth;
  const isPeriodMode = anchorDay > 1;
  const periodRange = isPeriodMode
    ? periodRangeFor(currentMonthDate, anchorDay)
    : null;
  const fmtPeriodDay = (d: Date): string =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d);
  const periodLabel = periodRange
    ? `${fmtPeriodDay(periodRange.start)} – ${fmtPeriodDay(periodRange.end)}`
    : null;
  const incomeLabel = isPeriodMode ? "Period income" : "Monthly income";
  const expensesLabel = isPeriodMode ? "Period expenses" : "Living expenses";

  // Label for the confirmation dialog header. Period mode shows the window
  // (e.g. "Apr 5 – May 4"); calendar mode shows month + year.
  const confirmDialogLabel =
    periodLabel ??
    new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(currentMonthDate);

  // Controlled tab value so the dropdown items (Setup / Settings) can drive
  // the same surface as the visible TabsTriggers (Overview / Calendar).
  const [tab, setTab] = useState<"overview" | "setup" | "calendar" | "settings">(
    "overview"
  );

  // Dev-tools: force-open the monthly confirmation dialog from this plan,
  // bypassing the date + dismiss gates so the whole confirm-and-update flow
  // can be exercised on demand. The helper is built once via useState so it
  // keeps a stable identity (useRegisterDevTool re-registers on identity
  // change, which would loop with an inline object).
  const [devConfirmOpen, setDevConfirmOpen] = useState(false);
  const [forceConfirmationTool] = useState(() => ({
    id: "finance:force-confirmation",
    kind: "action" as const,
    label: "Force confirmation dialog",
    description:
      "Open the monthly confirmation + balance-update dialog now, ignoring the confirmation day and the per-day dismiss.",
    section: "Finance",
    icon: ClipboardCheck,
    onRun: () => setDevConfirmOpen(true),
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
  // Label shown on the More dropdown — surfaces the current sub-section when
  // one is active so users always see where they are.
  const moreLabel =
    tab === "setup" ? "Setup" : tab === "settings" ? "Settings" : "More";
  const moreActive = tab === "setup" || tab === "settings";

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-6">
      {/* Header: title + subtitle + tabs share the left column; the gauge
          anchors the right column. `items-end` aligns the bottom of the
          gauge with the bottom of the TabsList so both sit on the same
          baseline, regardless of the gauge's larger height. */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        {/* space-y-7 between the title block and the tabs gives the tabs
            visual room to breathe and matches the original PageHeader gap. On
            mobile this column fills the row so the compact gauge can pin to the
            title's top-right; on desktop it shrinks back and the full gauge
            anchors the far-right column (below). */}
        <div className="min-w-0 flex-1 space-y-7 sm:flex-none">
          {/* Title row: text on the left; on mobile the compact gauge sits in
              the top-right corner to reclaim the vertical space its own row
              used to eat. Hidden from `sm` up, where the full gauge takes over. */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              {/* Match the original PageHeader's title size: text-2xl + bold.
                  Heading "h3" is the closest variant; override semibold→bold. */}
              <Heading level="h3" className="font-bold">
                {title}
              </Heading>
              <Text variant="muted">{description}</Text>
              {periodLabel && (
                <Text variant="muted" className="font-mono text-xs">
                  Current period · {periodLabel}
                </Text>
              )}
            </div>
            <div className="shrink-0 sm:hidden">
              <FinancialHealthDonut
                obligations={fixedOutflow}
                income={income}
                size={96}
                showFooter={false}
              />
            </div>
          </div>
          {/* Primary tabs (Overview / Calendar) sit in the TabsList; Setup
              and Settings — used less often and more "admin"-flavoured —
              live in the More dropdown next to it. */}
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={moreActive ? "default" : "outline"}
                  size="sm"
                  className="h-9"
                >
                  {moreLabel}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setTab("setup")}>
                  Setup
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("settings")}>
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Desktop gauge: keeps the original right-column position, bottom-
            aligned with the tabs. Hidden on mobile, where the compact gauge
            above takes its place. */}
        <div className="hidden sm:block">
          <FinancialHealthDonut obligations={fixedOutflow} income={income} />
        </div>
      </div>

      <TabsContent value="overview" className="space-y-6">
        {/* Mobile: a single horizontal-scroll rail where each card is ~44% wide
            so a quarter of the third card peeks in to signal there's more to
            scroll. The scrollbar is hidden and scroll snaps card-to-card. From
            `sm` up it falls back to the regular 2- then 4-column grid.
            `overflow-x-auto` also clips the cross axis, so `py-1` keeps the
            cards' ring + shadow from being shaved top/bottom. NO horizontal
            margin/padding: a negative `-mx-1` shifted the first card 4px left
            of the title and the projection card below it; the 1px faint ring
            on the scroll edges is not worth the misalignment. */}
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:py-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          <SummaryCard
            className="w-[44%] shrink-0 snap-start sm:w-auto"
            label={incomeLabel}
            value={income}
            tone="positive"
            sublabel="From all active sources"
            breakdown={
              <BreakdownList
                items={activeIncomes.map((i) => ({
                  name: i.name,
                  amount: Number(i.monthlyAmount),
                }))}
                emptyLabel="No income sources yet"
                total={income}
              />
            }
          />
          <SummaryCard
            className="w-[44%] shrink-0 snap-start sm:w-auto"
            label={expensesLabel}
            value={fixedOutflow}
            sublabel="Includes debt minimums"
            breakdown={
              <BreakdownList
                groups={[
                  {
                    heading: "Expenses",
                    items: activeExpenses.map((e) => ({
                      name: e.name,
                      amount: Number(e.monthlyAmount),
                    })),
                  },
                  {
                    heading: "Debt minimums",
                    items: debtPaymentLines.map((d) => ({
                      name: d.name,
                      amount: d.scheduled,
                    })),
                  },
                ]}
                emptyLabel="No fixed obligations yet"
                total={fixedOutflow}
              />
            }
          />
          <SummaryCard
            className="w-[44%] shrink-0 snap-start sm:w-auto"
            label="Total debt"
            value={totalDebt}
            tone={totalDebt > 0 ? "negative" : undefined}
            sublabel={
              plan.debts.length === 0
                ? "No active debts"
                : projection.monthsToDebtFree !== null
                ? `Debt-free in ${projection.monthsToDebtFree} mo`
                : "Not within plan horizon"
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
          <SummaryCard
            className="w-[44%] shrink-0 snap-start sm:w-auto"
            label="Surplus"
            value={surplus}
            tone={surplus >= 0 ? "positive" : "negative"}
            sublabel={
              surplus > 0 ? (
                <div className="space-y-0.5">
                  <SublabelLine
                    label="→ Extra debt"
                    amount={extraDebtPayments}
                  />
                  <SublabelLine
                    label="→ Savings & invest"
                    amount={Math.max(0, toWealth)}
                  />
                </div>
              ) : surplus === 0 ? (
                "Nothing left after fixed obligations"
              ) : (
                "Plan spends more than it earns"
              )
            }
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

        <ProjectionPanel
          projection={projection}
          plan={plan}
          comparison={plan.debts.length > 0 ? comparison : null}
          currentStrategy={plan.debtStrategy as DebtStrategy}
          onChangeStrategy={(next) =>
            wrap(() =>
              updatePlanAction({
                id: plan.id,
                name: plan.name,
                description: plan.description ?? null,
                startMonth: plan.startMonth,
                monthsAhead: plan.monthsAhead,
                initialSavings: plan.initialSavings,
                monthlySavingsRate: plan.monthlySavingsRate,
                includePortfolio: plan.includePortfolio,
                surplusToDebtsPercent: plan.surplusToDebtsPercent,
                debtStrategy: next,
                autoInvestPercent: plan.autoInvestPercent,
                autoInvestMethodId: plan.autoInvestMethodId,
                initialInvestments: plan.initialInvestments,
                confirmationDayOfMonth: plan.confirmationDayOfMonth,
                color: plan.color,
              })
            )
          }
        />
      </TabsContent>

      <TabsContent value="setup" className="space-y-6">
        <Card>
          <CardContent className="pt-6">
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
          <CardContent className="pt-6">
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
          <CardContent className="pt-6">
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

      <TabsContent value="calendar">
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
      </TabsContent>

      <TabsContent value="settings" className="space-y-4">
        <MainPlanToggle plan={plan} wrap={wrap} />
        <PlanForm plan={plan} investmentMethods={investmentMethods} />
      </TabsContent>

      {/* Dev-only: force-openable confirmation dialog (see the dev drawer's
          Finance section). Saving it writes a real confirmation and
          recalibrates the projection, exactly like the dashboard prompt. */}
      <ConfirmationDialog
        open={devConfirmOpen}
        onOpenChange={setDevConfirmOpen}
        planId={plan.id}
        planName={plan.name}
        monthLabel={confirmDialogLabel}
        projected={{
          savings: today?.savings ?? 0,
          investments: today?.investments ?? 0,
          debts: (today?.debts ?? []).map((d) => ({
            debtId: d.debtId,
            name: d.name,
            balance: d.balance,
          })),
        }}
        debts={plan.debts}
      />
    </Tabs>
  );
}

/**
 * Banner card in the Settings tab that surfaces whether THIS plan is the
 * user's main plan, and offers a one-click promotion when it isn't. The
 * `wrap` helper threads through PlanEditor's startTransition so the toast +
 * router.refresh stays consistent with every other server-action button.
 */
function MainPlanToggle({
  plan,
  wrap,
}: {
  plan: FinancePlanWithLines;
  wrap: <T,>(
    fn: () => Promise<{ success: boolean; error?: string } & T>
  ) => Promise<void>;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="flex items-center gap-3">
          <Star
            className={`h-5 w-5 shrink-0 ${
              plan.isMain
                ? "fill-yellow-400 text-yellow-500"
                : "text-muted-foreground"
            }`}
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {plan.isMain ? "Main plan" : "Set as main plan"}
            </p>
            <p className="text-xs text-muted-foreground">
              {plan.isMain
                ? "This is the plan the dashboard follows and the only one that fires the monthly confirmation prompt."
                : "Make this the plan the dashboard follows. The current main plan will lose the flag."}
            </p>
          </div>
        </div>
        {!plan.isMain && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              wrap(async () => {
                const result = await setMainPlanAction(plan.id);
                if (result.success) toast.success(`${plan.name} is now your main plan`);
                return result;
              })
            }
          >
            Make main
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

type ProjectionPanelProps = {
  projection: Projection;
  /** Plan with lines, needed so the Today KPI can back out income / expense
   *  that hasn't hit yet this month. */
  plan: FinancePlanWithLines;
  /** Pre-computed projections for the three debt strategies — null when the
   *  plan has no debts (the comparison is meaningless). */
  comparison: StrategyComparison | null;
  currentStrategy: DebtStrategy;
  onChangeStrategy: (next: DebtStrategy) => Promise<void>;
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
    recurrenceType: "monthly_day" | "monthly_weekday" | "every_n_months";
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
    const anchor = row.recurrenceStart
      ? (() => {
          const [y, m] = row.recurrenceStart!
            .split("-")
            .map((p) => parseInt(p, 10));
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
  monthDate: Date;
};

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
 * Computes today's net worth as a *partial-month* snapshot built from
 * scratch — NOT from the projection's end-of-month aggregate. This matches
 * the user's mental model: "what does my bank/debt look like right now,
 * given what has actually hit so far this month?".
 *
 * Algorithm:
 *   1. Seed savings/investments/per-debt balances from end-of-previous-month
 *      (= start of current month). For month 0, use the plan's initial state.
 *   2. Walk every income/expense line; if its hit-day this month is ≤ today,
 *      apply it as cash in/out of savings.
 *   3. For each debt, if the scheduled payment day this month is ≤ today,
 *      subtract the scheduled payment from savings and swap the debt balance
 *      for the projection's end-of-month value (captures interest + extra).
 *      Payments after today leave the balance at start-of-month.
 *   4. Net worth = savings + investments + portfolio − total debt.
 *
 * Trade-offs: extra payments only happen at month-end (after surplus routing)
 * so subtracting them from savings mid-month would be wrong; instead they
 * stay in the debt balance via the EoM swap. Mid-month interest accrual is
 * approximated by trusting the projection's EoM balance once today >= payment
 * day; before payment day, the start-of-month balance carries no interest at
 * all (mild under-statement for high-rate debts in the first ~half of a
 * month, accepted to keep the snapshot O(lines) instead of a full re-walk).
 */
function computeTodaySnapshot(
  plan: FinancePlanWithLines,
  projection: Projection
): TodaySnapshot | null {
  const now = new Date();
  const planStart = new Date(plan.startMonth);
  const planStartKey =
    planStart.getUTCFullYear() * 12 + planStart.getUTCMonth();
  const todayKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const monthOffset = todayKey - planStartKey;

  if (monthOffset < 0 || monthOffset >= projection.months.length) return null;

  const currentMonth = projection.months[monthOffset];
  const year = now.getUTCFullYear();
  const monthIdx = now.getUTCMonth();
  const todayDay = now.getUTCDate();

  // Seed from end-of-previous-month — that's exactly the state at start of
  // the current month, including any surplus routed to savings in prior
  // months. For month 0, fall back to the plan's initial figures.
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

  // ---- Income / expense cashflow ------------------------------------------
  for (const inc of plan.incomes) {
    if (inc.kind === "one_time") {
      const d = readDateParts(inc.date);
      if (d && d.year === year && d.month === monthIdx && d.day <= todayDay) {
        savings += Number(inc.monthlyAmount);
      }
      continue;
    }
    const hitDay = recurringHitDayInMonth(inc, year, monthIdx, planStart);
    if (hitDay === null || hitDay > todayDay) continue;
    if (!hitDayWithinWindow(year, monthIdx, hitDay, inc.startDate, inc.endDate)) {
      continue;
    }
    savings += Number(inc.monthlyAmount);
  }
  for (const exp of plan.expenses) {
    if (exp.kind === "one_time") {
      const d = readDateParts(exp.date);
      if (d && d.year === year && d.month === monthIdx && d.day <= todayDay) {
        savings -= Number(exp.monthlyAmount);
      }
      continue;
    }
    // Expenses don't carry a start/end window in the schema; the hit-day
    // check is sufficient.
    const hitDay = recurringHitDayInMonth(exp, year, monthIdx, planStart);
    if (hitDay === null || hitDay > todayDay) continue;
    savings -= Number(exp.monthlyAmount);
  }

  // ---- Debt payments hit this month ---------------------------------------
  for (const debt of plan.debts) {
    const eomDebt = currentMonth.debts.find((d) => d.debtId === debt.id);
    if (!eomDebt) continue;
    const hitDay = recurringHitDayInMonth(debt, year, monthIdx, planStart);
    if (hitDay === null || hitDay > todayDay) continue;
    // Scheduled payment already left the bank by today. Extra payments
    // happen at month-end (after surplus routing) so we don't deduct them
    // from savings here — but we do trust the projection's end-of-month
    // balance for accuracy (captures interest + extra).
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
    monthDate: currentMonth.date,
  };
}

function computeProjectionWindow(
  projection: Projection,
  totalMonths: number
): {
  startIndex: number;
  count: number;
  pastCount: number;
  todayIndex: number; // index in the SLICED window
} {
  // ~25% of the window is past, the rest is future.
  const targetPast = Math.max(1, Math.round(totalMonths * 0.25));
  // Projection dates are generated at UTC midnight. Comparing them against
  // the user's LOCAL year/month would shift a month in negative-offset
  // timezones (e.g. UTC-5 sees May 1 UTC as Apr 30 local) and the chart
  // would treat plan-start = May as if today were Apr. Use UTC on both sides
  // so the bucket comparison is stable.
  const now = new Date();
  const todayKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  let projIdx = projection.months.findIndex(
    (m) => m.date.getUTCFullYear() * 12 + m.date.getUTCMonth() === todayKey
  );
  if (projIdx === -1) projIdx = 0;
  const pastCount = Math.min(targetPast, projIdx);
  const startIndex = Math.max(0, projIdx - pastCount);
  const count = Math.min(totalMonths, projection.months.length - startIndex);
  return {
    startIndex,
    count,
    pastCount,
    todayIndex: pastCount, // boundary point in the slice
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
  plan,
  comparison,
  currentStrategy,
  onChangeStrategy,
}: ProjectionPanelProps) {
  // Strategy picker — collapsed by default, surfacing just a compact badge in
  // the header. Expands to show the three comparison cards inline.
  const [strategyOpen, setStrategyOpen] = useState(false);

  // Horizon — 12 mo by default; bumps up to 2 / 5 / 10 yr when the user picks
  // a preset above the chart.
  const maxAvailable = projection.months.length;
  const [horizonMonths, setHorizonMonths] = useState<number>(
    Math.min(12, maxAvailable)
  );

  // Window with the active horizon: ~25% past + 75% future. Edges shift when
  // the plan started recently so we never look past data we don't have.
  const window = computeProjectionWindow(projection, horizonMonths);
  const todayMonthIdx = window.startIndex + window.pastCount;
  const todayMonth = projection.months[todayMonthIdx];
  // "Next month" forecast — the month-end projection for the month right after
  // today. Falls back to undefined when we're already at the last month of
  // the plan (the KPI is hidden in that case).
  const nextMonth = projection.months[todayMonthIdx + 1];
  const futureMonth =
    projection.months[window.startIndex + window.count - 1] ?? todayMonth;
  // Day-aware "today" net worth: strips income/expense from the month-end
  // value when they haven't actually hit yet (e.g. paycheque on day 30 when
  // today is day 25). Falls back to month-end when we're outside the
  // projection range.
  const todaySnapshot = computeTodaySnapshot(plan, projection);
  const today = todaySnapshot?.netWorth ?? todayMonth?.netWorth ?? 0;
  const next = nextMonth?.netWorth;
  const future = futureMonth?.netWorth ?? today;

  return (
    <Card>
      <CardHeader className="space-y-4 pb-2">
        {/* Title left, strategy picker pinned top-right. `items-start` +
            no-wrap keeps the badge in the corner on mobile (the title block
            shrinks via `min-w-0` and its description wraps) instead of the
            badge dropping to its own full-width row below. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Projection</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Solid line is past, dashed is forecast
            </p>
          </div>
          {comparison && (
            <StrategyBadge
              comparison={comparison}
              currentStrategy={currentStrategy}
              open={strategyOpen}
              onToggle={() => setStrategyOpen((v) => !v)}
            />
          )}
        </div>

        {/* Today / End-of-window KPIs share a row with the horizon picker.
            The KPIs cluster on the left; the picker sits on the right via
            `ml-auto` so it lines up with the Strategy card above on wide
            viewports and wraps neatly underneath on narrow ones. */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Today {todayMonth ? `(${FORMATTER.format(todayMonth.date)})` : ""}
            </p>
            <p
              className={`text-base font-semibold sm:text-lg ${
                today >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(today)}
            </p>
          </div>
          {nextMonth && next !== undefined && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Next month ({FORMATTER.format(nextMonth.date)})
              </p>
              <p
                className={`text-base font-semibold sm:text-lg ${
                  next >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(next)}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              End of window{" "}
              {futureMonth ? `(${FORMATTER.format(futureMonth.date)})` : ""}
            </p>
            <p
              className={`text-base font-semibold sm:text-lg ${
                future >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(future)}
            </p>
          </div>
          <div
            role="group"
            aria-label="Projection horizon"
            className="ml-auto inline-flex items-center gap-1 rounded-md border bg-muted/30 p-1"
          >
            {HORIZON_PRESETS.map((preset) => {
              const disabled = preset.months > maxAvailable;
              const active = horizonMonths === preset.months;
              return (
                <button
                  key={preset.months}
                  type="button"
                  onClick={() => setHorizonMonths(preset.months)}
                  disabled={disabled}
                  aria-pressed={active}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {comparison && strategyOpen && (
          <StrategyPicker
            comparison={comparison}
            currentStrategy={currentStrategy}
            onChange={onChangeStrategy}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        <ProjectionChart
          projection={projection}
          monthsToShow={window.count}
          startIndex={window.startIndex}
          pastCount={window.pastCount}
        />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Monthly breakdown</h3>
          <ProjectionTable projection={projection} monthsToShow={window.count} />
        </div>
      </CardContent>
    </Card>
  );
}

// Compact badge in the projection header that shows the active strategy + how
// much it saves vs. the worst option. Click to open the full picker below.
function StrategyBadge({
  comparison,
  currentStrategy,
  open,
  onToggle,
}: {
  comparison: StrategyComparison;
  currentStrategy: DebtStrategy;
  open: boolean;
  onToggle: () => void;
}) {
  const saves = comparison.interestSaved;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex shrink-0 items-start gap-2 rounded-md border bg-muted/20 px-3 py-2 text-left transition hover:bg-muted/40"
    >
      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-0.5">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Strategy
        </div>
        <div className="text-sm font-semibold">
          {STRATEGY_LABEL[currentStrategy]}
        </div>
        {saves > 0 && (
          // Hidden on mobile so the badge stays narrow enough to pin top-right
          // next to the title without crushing the description. The savings
          // figure still shows on desktop and inside the expanded picker.
          <div className="hidden items-center gap-1 text-[11px] text-green-700 sm:flex dark:text-green-300">
            <TrendingDown className="h-3 w-3" />
            saves {formatCurrency(saves)} vs. worst
          </div>
        )}
      </div>
      <ChevronDown
        className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

// Clickable 3-up grid. Selecting a non-active card persists the new strategy
// via onChange; the chart re-renders once the server revalidates the page.
function StrategyPicker({
  comparison,
  currentStrategy,
  onChange,
}: {
  comparison: StrategyComparison;
  currentStrategy: DebtStrategy;
  onChange: (next: DebtStrategy) => Promise<void>;
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
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map(({ key, data }) => {
        const isCurrent = key === currentStrategy;
        const isBest =
          key !== "none" &&
          Math.abs(data.totalInterestPaid - minInterest) < 0.5;
        return (
          <button
            key={key}
            type="button"
            disabled={isCurrent}
            onClick={() => void onChange(key)}
            aria-pressed={isCurrent}
            className={`relative rounded-md border p-4 text-left transition ${
              isCurrent
                ? "cursor-default border-foreground bg-muted/40"
                : "hover:border-foreground/60 hover:bg-muted/30"
            } ${isBest && !isCurrent ? "bg-green-500/5" : ""}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold">{STRATEGY_LABEL[key]}</p>
              {isCurrent && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total interest paid
                </dt>
                <dd className="text-lg font-semibold">
                  {formatCurrency(data.totalInterestPaid)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <dt className="text-xs text-muted-foreground">
                  <Clock className="mr-1 inline h-3 w-3" />
                  Debt-free in
                </dt>
                <dd className="text-sm font-medium">
                  {data.monthsToDebtFree !== null
                    ? `${data.monthsToDebtFree} mo`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted-foreground">Ending net worth</dt>
                <dd className="text-sm font-medium">
                  {formatCurrency(data.endingNetWorth)}
                </dd>
              </div>
            </dl>
            {!isCurrent && (
              <p className="mt-3 text-[11px] italic text-muted-foreground">
                Click to switch
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  sublabel,
  breakdown,
  className,
}: {
  label: string;
  value: number | string;
  tone?: "positive" | "negative";
  sublabel?: React.ReactNode;
  breakdown?: React.ReactNode;
  /** Extra classes for the card root — used to size cards inside the mobile
   *  horizontal-scroll rail (peek of the next card) vs the desktop grid. */
  className?: string;
}) {
  const display =
    typeof value === "number" ? formatCurrency(value) : value;
  const colorClass =
    tone === "positive"
      ? "text-green-600"
      : tone === "negative"
      ? "text-red-600"
      : "";

  const card = (
    <Card
      size="sm"
      className={cn(
        breakdown &&
          "cursor-pointer text-left transition hover:border-foreground/30 focus-visible:border-foreground/40 focus-visible:outline-none",
        className
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:text-xs">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        <p className={`text-lg font-semibold sm:text-xl lg:text-2xl ${colorClass}`}>
          {display}
        </p>
        {sublabel && (
          <div className="line-clamp-2 text-[11px] text-muted-foreground lg:line-clamp-none lg:text-xs">
            {sublabel}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!breakdown) return card;

  return (
    <Sheet>
      <SheetTrigger asChild aria-label={`Show ${label} breakdown`}>
        {card}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">{breakdown}</div>
      </SheetContent>
    </Sheet>
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
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {sections.map((section, gi) =>
        section.items.length === 0 ? null : (
          <div key={gi} className="space-y-1.5">
            {section.heading && (
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {section.heading}
              </div>
            )}
            <ul className="space-y-1.5">
              {section.items.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="truncate">
                    {item.name}
                    {item.hint && (
                      <span className="ml-1 text-muted-foreground">· {item.hint}</span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      <div className="flex items-baseline justify-between gap-4 border-t pt-2 font-semibold">
        <span>Total</span>
        <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function SublabelLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span>{label}</span>
      <span className="font-mono tabular-nums">{formatCurrency(amount)}</span>
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
    <div className="space-y-3 text-sm">
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-4">
            <span>
              {r.op && <span className="mr-1 text-muted-foreground">{r.op}</span>}
              {r.label}
            </span>
            <span className="font-mono tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4 border-t pt-2 font-semibold">
        <span>= Surplus</span>
        <span
          className={`font-mono tabular-nums ${
            surplus >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(surplus)}
        </span>
      </div>
      {surplus > 0 && (
        <ul className="space-y-1.5 border-t pt-2 text-muted-foreground">
          <li className="flex items-baseline justify-between gap-4">
            <span>→ Extra debt</span>
            <span className="font-mono tabular-nums">{formatCurrency(toExtraDebt)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-4">
            <span>→ Investments</span>
            <span className="font-mono tabular-nums">{formatCurrency(toInvestments)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-4">
            <span>→ Savings</span>
            <span className="font-mono tabular-nums">{formatCurrency(toSavings)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
