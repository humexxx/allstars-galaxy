"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PlanLineEditor } from "./plan-line-editor";
import { PlanDebtEditor } from "./plan-debt-editor";
import { PlanForm, type InvestmentMethodOption } from "./plan-form";
import { ProjectionChart, type HistoricalSnapshot } from "./projection-chart";
import { ProjectionTable } from "./projection-table";
import { StrategyComparisonCard } from "./strategy-comparison";
import { TrendingUp, TrendingDown } from "lucide-react";

import {
  addPlanDebtAction,
  addPlanExpenseAction,
  addPlanIncomeAction,
  deletePlanDebtAction,
  deletePlanExpenseAction,
  deletePlanIncomeAction,
  updatePlanDebtAction,
  updatePlanExpenseAction,
  updatePlanIncomeAction,
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
  historicalSnapshots: HistoricalSnapshot[];
};

export function PlanEditor({
  plan,
  projection,
  comparison,
  investmentMethods,
  historicalSnapshots,
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

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="setup">Setup</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <SummaryCard label="Ending savings" value={projection.endingSavings} tone="positive" />
          <SummaryCard label="Ending debt" value={projection.endingDebt} tone="negative" />
          <SummaryCard
            label="Ending net worth"
            value={projection.endingNetWorth}
            tone={projection.endingNetWorth >= 0 ? "positive" : "negative"}
          />
          <SummaryCard
            label="Debt free in"
            value={
              projection.monthsToDebtFree !== null
                ? `${projection.monthsToDebtFree} mo`
                : plan.debts.length === 0
                ? "—"
                : "Not within range"
            }
          />
        </div>

        {comparison && plan.debts.length > 0 && (
          <StrategyComparisonCard
            comparison={comparison}
            currentStrategy={plan.debtStrategy as DebtStrategy}
          />
        )}

        <ProjectionPanel
          projection={projection}
          historicalSnapshots={historicalSnapshots}
        />



        <Card>
          <CardHeader>
            <CardTitle>Monthly breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectionTable projection={projection} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="setup" className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <PlanLineEditor
              title="Income (Entradas)"
              description="Monthly recurring income sources."
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
              title="Expenses (Salidas)"
              description="Monthly recurring expenses."
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

      <TabsContent value="settings">
        <PlanForm plan={plan} investmentMethods={investmentMethods} />
      </TabsContent>
    </Tabs>
  );
}

type ProjectionPanelProps = {
  projection: Projection;
  historicalSnapshots: HistoricalSnapshot[];
};

const FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

/**
 * Projection chart with a header strip that surfaces the headline number — how
 * much the net worth is expected to grow over the next 12 months. The strip
 * always reads "today → +12 months" regardless of the underlying horizon so the
 * KPI is easy to compare across plans.
 */
function ProjectionPanel({ projection, historicalSnapshots }: ProjectionPanelProps) {
  // Today's net worth is the first month of the projection (the calibrated state
  // at startMonth). The "12 months out" point is index 11 — we guard for shorter
  // horizons just in case.
  const todayMonth = projection.months[0];
  const futureMonth =
    projection.months[Math.min(11, projection.months.length - 1)] ?? todayMonth;

  const today = todayMonth?.netWorth ?? 0;
  const future = futureMonth?.netWorth ?? today;
  const delta = future - today;

  // Compute % change against |today| so a negative starting net worth shows a
  // sensible direction. Suppressed when today is ~0 to avoid divide-by-zero.
  const pctChange =
    Math.abs(today) > 0.01 ? (delta / Math.abs(today)) * 100 : null;

  const isUp = delta >= 0;
  const TrendIcon = isUp ? TrendingUp : TrendingDown;
  const trendClass = isUp ? "text-green-600" : "text-red-600";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle>Projection</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Last 3 months · next 12 months
            </p>
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
                In 12 months {futureMonth ? `(${FORMATTER.format(futureMonth.date)})` : ""}
              </p>
              <p
                className={`text-lg font-semibold ${
                  future >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(future)}
              </p>
            </div>
            <div className={`flex items-center gap-1 ${trendClass}`}>
              <TrendIcon className="h-4 w-4" />
              <div>
                <p className="text-lg font-semibold">
                  {isUp ? "+" : "−"}
                  {formatCurrency(Math.abs(delta))}
                </p>
                {pctChange !== null && (
                  <p className="text-xs">
                    {isUp ? "+" : ""}
                    {pctChange.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ProjectionChart projection={projection} historicalSnapshots={historicalSnapshots} />
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "positive" | "negative";
}) {
  const display =
    typeof value === "number" ? formatCurrency(value) : value;
  const colorClass =
    tone === "positive"
      ? "text-green-600"
      : tone === "negative"
      ? "text-red-600"
      : "";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${colorClass}`}>{display}</p>
      </CardContent>
    </Card>
  );
}
