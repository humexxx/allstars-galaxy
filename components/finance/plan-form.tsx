"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono, Text } from "@/components/ui/typography";

import { createPlanAction, updatePlanAction } from "@/app/actions/finance-plans";
import type { DebtStrategy, FinancePlan } from "@/types/finance";

export type InvestmentMethodOption = {
  id: string;
  name: string;
  monthlyRoi: string;
  enabled: boolean;
};

type PlanFormProps = {
  plan?: FinancePlan;
  investmentMethods: InvestmentMethodOption[];
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

// 60% is the recommended starting point for new plans — aggressive enough to
// meaningfully shorten the debt timeline without starving savings.
const DEFAULT_NEW_SURPLUS = 60;

function percentLabel(pct: number): string {
  if (pct === 0) return "Off";
  if (pct < 40) return "Conservative";
  if (pct < 60) return "Balanced";
  if (pct < 80) return "Aggressive";
  return "Very aggressive";
}

export function PlanForm({ plan, investmentMethods }: PlanFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [startMonth, setStartMonth] = useState(
    toMonthInputValue(plan?.startMonth ?? new Date())
  );
  // Default 120 (10 years) for new plans matches the schema default and lets the
  // chart densifier kick in (first 12 months monthly, then year-ends after).
  const [monthsAhead, setMonthsAhead] = useState(String(plan?.monthsAhead ?? 120));
  const [initialSavings, setInitialSavings] = useState(plan?.initialSavings ?? "0");
  const [monthlyRate, setMonthlyRate] = useState(plan?.monthlySavingsRate ?? "0");
  const [includePortfolio, setIncludePortfolio] = useState(
    plan?.includePortfolio ?? false
  );
  const [color, setColor] = useState(plan?.color ?? COLORS[0]);

  // Surplus acceleration: stored as numeric string 0..1 in the DB. We convert to
  // an integer 0..100 for the slider UX.
  const initialSurplusPct = plan
    ? Math.round(parseFloat(plan.surplusToDebtsPercent) * 100)
    : DEFAULT_NEW_SURPLUS;
  const [accelerate, setAccelerate] = useState<boolean>(initialSurplusPct > 0);
  const [surplusPct, setSurplusPct] = useState<number>(
    initialSurplusPct > 0 ? initialSurplusPct : DEFAULT_NEW_SURPLUS
  );
  const [strategy, setStrategy] = useState<DebtStrategy>(
    (plan?.debtStrategy as DebtStrategy) ?? "avalanche"
  );

  // Auto-invest after the surplus → debts step. Same UX pattern as the
  // acceleration switch: off snaps surplusPercent to 0 in the payload, on uses
  // the slider value.
  const initialInvestPct = plan
    ? Math.round(parseFloat(plan.autoInvestPercent) * 100)
    : 0;
  const [autoInvest, setAutoInvest] = useState<boolean>(initialInvestPct > 0);
  const [investPct, setInvestPct] = useState<number>(
    initialInvestPct > 0 ? initialInvestPct : 50
  );
  const [investMethodId, setInvestMethodId] = useState<string>(
    plan?.autoInvestMethodId ?? investmentMethods[0]?.id ?? ""
  );
  const [initialInvestments, setInitialInvestments] = useState(
    plan?.initialInvestments ?? "0"
  );

  // Monthly confirmation prompt: 0 disables, 1..28 sets the trigger day.
  const [confirmationDay, setConfirmationDay] = useState<string>(
    String(plan?.confirmationDayOfMonth ?? 1)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Plan needs a name");
      return;
    }

    startTransition(async () => {
      const surplusValue = accelerate ? (surplusPct / 100).toFixed(4) : "0";
      const investValue = autoInvest && investMethodId ? (investPct / 100).toFixed(4) : "0";
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        startMonth: fromMonthInputValue(startMonth),
        monthsAhead: Number(monthsAhead) || 24,
        initialSavings: initialSavings || "0",
        monthlySavingsRate: monthlyRate || "0",
        includePortfolio,
        surplusToDebtsPercent: surplusValue,
        debtStrategy: strategy,
        autoInvestPercent: investValue,
        autoInvestMethodId: autoInvest && investMethodId ? investMethodId : null,
        initialInvestments: initialInvestments || "0",
        confirmationDayOfMonth: Math.max(0, Math.min(28, Number(confirmationDay) || 0)),
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{plan ? "Plan settings" : "New plan"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} id="plan-form" className="space-y-4">
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
                  min={12}
                  max={120}
                  step={1}
                  value={monthsAhead}
                  onChange={(e) => setMonthsAhead(e.target.value)}
                  required
                />
                <Text variant="small">
                  Minimum 12 months · default 120 (10 years).
                </Text>
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
                <Text variant="small">
                  Decimal monthly rate. 0.007 ≈ 0.70% per month.
                </Text>
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
                  <Text variant="small">
                    Adds your live portfolio value to the projection&apos;s net worth line.
                  </Text>
                </div>
                <Switch
                  id="plan-include-portfolio"
                  checked={includePortfolio}
                  onCheckedChange={setIncludePortfolio}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="plan-confirmation-day">Monthly confirmation day</Label>
                <Input
                  id="plan-confirmation-day"
                  type="number"
                  min={0}
                  max={28}
                  step={1}
                  value={confirmationDay}
                  onChange={(e) => setConfirmationDay(e.target.value)}
                />
                <Text variant="small">
                  Day of the month (1–28) when a dialog will ask you to confirm your
                  real balances. Set to <strong>0</strong> to disable.
                </Text>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debt acceleration</CardTitle>
          <Text variant="muted">
            When your monthly cash flow is positive, route part of the surplus into
            extra debt principal. Avalanche almost always pays less interest, but
            snowball is easier to stick with.
          </Text>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="plan-accelerate" className="cursor-pointer">
                Apply surplus to debts
              </Label>
              <Text variant="small">
                Off → all surplus goes to savings. On → split surplus between extra debt
                payments and savings using the slider below.
              </Text>
            </div>
            <Switch
              id="plan-accelerate"
              checked={accelerate}
              onCheckedChange={setAccelerate}
            />
          </div>

          <div className={accelerate ? "space-y-6" : "space-y-6 opacity-50 pointer-events-none"}>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <Label>Surplus aggressiveness</Label>
                <div className="flex items-baseline gap-2">
                  <Mono className="text-xl font-semibold tracking-tight">{surplusPct}%</Mono>
                  <Text variant="small" as="span">{percentLabel(surplusPct)}</Text>
                </div>
              </div>
              <Slider
                value={[surplusPct]}
                min={30}
                max={100}
                step={5}
                onValueChange={(v) => setSurplusPct(v[0])}
                aria-label="Surplus to debts percentage"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <Text variant="small" as="span">30% · keeps savings growing</Text>
                <Text variant="small" as="span">100% · all-in on debt</Text>
              </div>
              <Text variant="small">
                Recommended starting point: <strong>60%</strong>.
              </Text>
            </div>

            <div className="space-y-3">
              <Label>Payoff method</Label>
              <RadioGroup
                value={strategy}
                onValueChange={(v) => setStrategy(v as DebtStrategy)}
                className="grid gap-2"
              >
                <label
                  htmlFor="strategy-avalanche"
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <RadioGroupItem id="strategy-avalanche" value="avalanche" className="mt-0.5" />
                  <div>
                    <Text variant="body" weight="medium">Avalanche · highest interest first</Text>
                    <Text variant="small">
                      Mathematically optimal — minimises total interest paid.
                    </Text>
                  </div>
                </label>
                <label
                  htmlFor="strategy-snowball"
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <RadioGroupItem id="strategy-snowball" value="snowball" className="mt-0.5" />
                  <div>
                    <Text variant="body" weight="medium">Snowball · smallest balance first</Text>
                    <Text variant="small">
                      Psychologically optimal — quick wins to build momentum.
                    </Text>
                  </div>
                </label>
              </RadioGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-invest</CardTitle>
          <Text variant="muted">
            After surplus → debts runs, route part of what&apos;s left into a compounding
            investments bucket modelled against an investment method&apos;s monthly ROI.
            The investments balance grows every month and counts toward your net worth.
          </Text>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="plan-autoinvest" className="cursor-pointer">
                Auto-invest the remainder
              </Label>
              <Text variant="small">
                Off → all the remainder stays as savings. On → split between
                investments and savings using the slider.
              </Text>
            </div>
            <Switch
              id="plan-autoinvest"
              checked={autoInvest}
              onCheckedChange={setAutoInvest}
            />
          </div>

          <div
            className={
              autoInvest
                ? "space-y-6"
                : "space-y-6 pointer-events-none opacity-50"
            }
          >
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <Label>Share of remainder → investments</Label>
                <Mono className="text-xl font-semibold tracking-tight">{investPct}%</Mono>
              </div>
              <Slider
                value={[investPct]}
                min={10}
                max={100}
                step={5}
                onValueChange={(v) => setInvestPct(v[0])}
                aria-label="Auto-invest percentage"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <Text variant="small" as="span">10% · most stays as savings</Text>
                <Text variant="small" as="span">100% · all remainder invested</Text>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-invest-method">Investment method</Label>
              <Select value={investMethodId} onValueChange={setInvestMethodId}>
                <SelectTrigger id="plan-invest-method">
                  <SelectValue placeholder="Pick a method" />
                </SelectTrigger>
                <SelectContent>
                  {investmentMethods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        {m.name} · {m.monthlyRoi}%/mo
                        {!m.enabled && (
                          <Badge variant="outline" className="text-2xs">
                            Disabled in portfolio
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Text variant="small">
                Disabled methods can be used here as hypothetical scenarios. They are
                hidden from your real portfolio.
              </Text>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-init-investments">Initial investments balance</Label>
              <Input
                id="plan-init-investments"
                inputMode="decimal"
                value={initialInvestments}
                onChange={(e) => setInitialInvestments(e.target.value)}
              />
              <Text variant="small">
                Opening balance for the investments bucket at the start month.
              </Text>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" form="plan-form" disabled={isPending}>
          {isPending ? "Saving…" : plan ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </div>
  );
}
