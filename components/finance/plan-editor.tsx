"use client";

import dynamic from "next/dynamic";
import { toast } from "sonner";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Text } from "@/components/ui/typography";

import { FinancialHealthDonut } from "./financial-health-donut";
import { PlanCalendar } from "./plan-calendar";
import { PlanLineEditor } from "./plan-line-editor";
import { PlanDebtEditor } from "./plan-debt-editor";
import { PlanForm, type InvestmentMethodOption } from "./plan-form";
import { ProjectionTable } from "./projection-table";
import { StrategyComparisonCard } from "./strategy-comparison";
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
  updatePlanDebtAction,
  updatePlanExpenseAction,
  updatePlanIncomeAction,
  upsertLineOverrideAction,
} from "@/app/actions/finance-plans";
import { formatCurrency } from "@/lib/utils/format";
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

  // Controlled tab value so the dropdown items (Setup / Settings) can drive
  // the same surface as the visible TabsTriggers (Overview / Calendar).
  const [tab, setTab] = useState<"overview" | "setup" | "calendar" | "settings">(
    "overview"
  );
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
            visual room to breathe and matches the original PageHeader gap. */}
        <div className="space-y-7">
          <div className="space-y-1">
            {/* Match the original PageHeader's title size: text-2xl + bold.
                Heading "h3" is the closest variant; override semibold→bold. */}
            <Heading level="h3" className="font-bold">
              {title}
            </Heading>
            <Text variant="muted">{description}</Text>
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
        <FinancialHealthDonut obligations={fixedOutflow} income={income} />
      </div>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Monthly income"
            value={income}
            tone="positive"
            sublabel="From all active sources"
            breakdown={
              <BreakdownList
                items={plan.incomes.map((i) => ({
                  name: i.name,
                  amount: Number(i.monthlyAmount),
                }))}
                emptyLabel="No income sources yet"
                total={income}
              />
            }
          />
          <SummaryCard
            label="Living expenses"
            value={fixedOutflow}
            sublabel="Includes debt minimums"
            breakdown={
              <BreakdownList
                groups={[
                  {
                    heading: "Expenses",
                    items: plan.expenses.map((e) => ({
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

        {comparison && plan.debts.length > 0 && (
          <StrategyComparisonCard
            comparison={comparison}
            currentStrategy={plan.debtStrategy as DebtStrategy}
          />
        )}

        <ProjectionPanel projection={projection} />
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

      <TabsContent value="settings">
        <PlanForm plan={plan} investmentMethods={investmentMethods} />
      </TabsContent>
    </Tabs>
  );
}

type ProjectionPanelProps = {
  projection: Projection;
};

const FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

// Preset horizons surfaced as a button group in the chart header. Listed in
// ascending order; the first one ≤ the plan's monthsAhead is the initial value.
const HORIZON_PRESETS: ReadonlyArray<{ months: number; label: string }> = [
  { months: 12, label: "12 mo" },
  { months: 24, label: "2 yr" },
  { months: 60, label: "5 yr" },
  { months: 120, label: "10 yr" },
];

function monthsLabel(n: number): string {
  if (n === 1) return "1 month";
  if (n < 12) return `${n} months`;
  if (n === 12) return "1 year";
  if (n % 12 === 0) return `${n / 12} years`;
  const years = Math.floor(n / 12);
  const rem = n % 12;
  return `${years}y ${rem}mo`;
}

/**
 * Projection chart with a header that surfaces the headline number — how much
 * the net worth is expected to grow over the chosen horizon. Preset buttons
 * (12 mo / 2 yr / 5 yr / 10 yr) let the user switch horizons; the chart and KPIs
 * re-render against whatever is selected.
 */
function ProjectionPanel({ projection }: ProjectionPanelProps) {
  const maxAvailable = projection.months.length;
  // Default to 12 months when available, otherwise the plan's full horizon.
  const [monthsToShow, setMonthsToShow] = useState<number>(
    Math.min(12, maxAvailable)
  );

  // First month is the calibrated state at the plan's anchor. The "future"
  // anchor is the selected horizon, clamped to the projection length.
  const todayMonth = projection.months[0];
  const futureIndex = Math.max(0, Math.min(monthsToShow - 1, maxAvailable - 1));
  const futureMonth = projection.months[futureIndex] ?? todayMonth;

  const today = todayMonth?.netWorth ?? 0;
  const future = futureMonth?.netWorth ?? today;

  return (
    <Card>
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Projection</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Next {monthsLabel(monthsToShow)}
            </p>
          </div>
          <div
            role="group"
            aria-label="Projection horizon"
            className="inline-flex items-center gap-1 rounded-md border bg-muted/30 p-1"
          >
            {HORIZON_PRESETS.map((preset) => {
              const disabled = preset.months > maxAvailable;
              const active = monthsToShow === preset.months;
              return (
                <button
                  key={preset.months}
                  type="button"
                  onClick={() => setMonthsToShow(preset.months)}
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

        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Today {todayMonth ? `(${FORMATTER.format(todayMonth.date)})` : ""}
            </p>
            <p
              className={`text-lg font-semibold ${
                today >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(today)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              In {monthsLabel(monthsToShow)}{" "}
              {futureMonth ? `(${FORMATTER.format(futureMonth.date)})` : ""}
            </p>
            <p
              className={`text-lg font-semibold ${
                future >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(future)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <ProjectionChart projection={projection} monthsToShow={monthsToShow} />
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Monthly breakdown</h3>
          <ProjectionTable projection={projection} monthsToShow={monthsToShow} />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  sublabel,
  breakdown,
}: {
  label: string;
  value: number | string;
  tone?: "positive" | "negative";
  sublabel?: React.ReactNode;
  breakdown?: React.ReactNode;
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
      className={breakdown ? "cursor-help transition hover:border-foreground/30" : undefined}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={`text-2xl font-semibold ${colorClass}`}>{display}</p>
        {sublabel && (
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        )}
      </CardContent>
    </Card>
  );

  if (!breakdown) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      {/* Use shadcn's default TooltipContent styling (inverted bg-foreground /
          text-background "chip"). We only widen it and bump padding — colors
          stay native so this reads as the same primitive used everywhere
          else in the app. */}
      <TooltipContent side="bottom" align="start" className="max-w-sm p-3">
        {breakdown}
      </TooltipContent>
    </Tooltip>
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
    // Inside the shadcn tooltip we're on bg-foreground / text-background, so
    // standard muted-foreground would be near-invisible. text-background/70
    // gives the same "muted" feel against either light or dark tooltip bg.
    return <p className="text-xs text-background/70">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2 text-xs">
      {sections.map((section, gi) =>
        section.items.length === 0 ? null : (
          <div key={gi} className="space-y-1">
            {section.heading && (
              <div className="text-[10px] font-semibold uppercase tracking-wide text-background/60">
                {section.heading}
              </div>
            )}
            <ul className="space-y-1">
              {section.items.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="truncate">
                    {item.name}
                    {item.hint && (
                      <span className="ml-1 text-background/70">· {item.hint}</span>
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
      <div className="flex items-baseline justify-between gap-4 border-t border-background/20 pt-1.5 font-semibold">
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
    <div className="space-y-2 text-xs">
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-4">
            <span>
              {r.op && <span className="mr-1 text-background/70">{r.op}</span>}
              {r.label}
            </span>
            <span className="font-mono tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-4 border-t border-background/20 pt-1.5 font-semibold">
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
        <ul className="space-y-1 border-t border-background/20 pt-2 text-background/70">
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
