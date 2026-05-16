"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { createPlanAction, updatePlanAction } from "@/app/actions/finance-plans";
import type { FinancePlan } from "@/types/finance";

type PlanFormProps = {
  plan?: FinancePlan;
};

function toMonthInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fromMonthInputValue(value: string): Date {
  const [y, m] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function PlanForm({ plan }: PlanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [startMonth, setStartMonth] = useState(
    toMonthInputValue(plan?.startMonth ?? new Date())
  );
  const [monthsAhead, setMonthsAhead] = useState(String(plan?.monthsAhead ?? 24));
  const [initialSavings, setInitialSavings] = useState(plan?.initialSavings ?? "0");
  const [monthlyRate, setMonthlyRate] = useState(plan?.monthlySavingsRate ?? "0");
  const [includePortfolio, setIncludePortfolio] = useState(
    plan?.includePortfolio ?? false
  );
  const [color, setColor] = useState(plan?.color ?? COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Plan needs a name");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        startMonth: fromMonthInputValue(startMonth),
        monthsAhead: Number(monthsAhead) || 24,
        initialSavings: initialSavings || "0",
        monthlySavingsRate: monthlyRate || "0",
        includePortfolio,
        color,
      };

      const result = plan
        ? await updatePlanAction({ id: plan.id, ...payload })
        : await createPlanAction(payload);

      if (result.success) {
        toast.success(plan ? "Plan saved" : "Plan created");
        router.push(`/portal/plans/${result.data!.id}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan ? "Plan settings" : "New plan"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Base scenario"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about this scenario"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-start">Start month</Label>
              <Input
                id="plan-start"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-months">Months ahead</Label>
              <Input
                id="plan-months"
                type="number"
                min={1}
                max={120}
                value={monthsAhead}
                onChange={(e) => setMonthsAhead(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-savings">Initial savings</Label>
              <Input
                id="plan-savings"
                inputMode="decimal"
                value={initialSavings}
                onChange={(e) => setInitialSavings(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-rate">Monthly savings rate</Label>
              <Input
                id="plan-rate"
                inputMode="decimal"
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                placeholder="0.007"
              />
              <p className="text-xs text-muted-foreground">
                Decimal monthly rate. 0.007 ≈ 0.70% per month.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Chart color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use color ${c}`}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full border-2 ${
                      color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="plan-include-portfolio" className="cursor-pointer">
                  Include current portfolio in net worth
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adds your live portfolio value to the projection&apos;s net worth line.
                </p>
              </div>
              <Switch
                id="plan-include-portfolio"
                checked={includePortfolio}
                onCheckedChange={setIncludePortfolio}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : plan ? "Save changes" : "Create plan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
