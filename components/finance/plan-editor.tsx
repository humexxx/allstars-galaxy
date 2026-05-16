"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PlanLineEditor } from "./plan-line-editor";
import { PlanDebtEditor } from "./plan-debt-editor";
import { PlanForm } from "./plan-form";
import { ProjectionChart } from "./projection-chart";
import { ProjectionTable } from "./projection-table";

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
import type { FinancePlanWithLines, Projection } from "@/types/finance";

type PlanEditorProps = {
  plan: FinancePlanWithLines;
  projection: Projection;
};

export function PlanEditor({ plan, projection }: PlanEditorProps) {
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

        <Card>
          <CardHeader>
            <CardTitle>Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectionChart projection={projection} />
          </CardContent>
        </Card>

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
        <PlanForm plan={plan} />
      </TabsContent>
    </Tabs>
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
