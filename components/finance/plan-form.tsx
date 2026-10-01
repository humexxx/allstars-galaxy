"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono, Text } from "@/components/ui/typography";

import { createPlanAction, updatePlanAction } from "@/app/actions/finance-plans";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/utils/date";
import {
  createFinancePlanSchema,
  type CreateFinancePlanData,
} from "@/schemas/finance";
import type {
  DebtStrategy,
  FinancePlan,
  InvestmentMethodOption,
} from "@/types/finance";

type PlanFormProps = {
  plan?: FinancePlan;
  investmentMethods: InvestmentMethodOption[];
  /** The reader's calendar day (UTC midnight), resolved on the server in
   *  their zone: a new plan starts in THEIR month. `new Date()` read in UTC
   *  started an evening plan in Costa Rica a month late. */
  today?: Date;
};

// The month input holds a "YYYY-MM" string; the schema's z.coerce.date()
// parses it as UTC month start on submit.
type PlanFormValues = z.input<typeof createFinancePlanSchema>;

function toMonthInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

export function PlanForm({
  plan,
  investmentMethods,
  today,
}: PlanFormProps): React.ReactElement {
  const router = useRouter();
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
    plan?.debtStrategy ?? "avalanche"
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues, unknown, CreateFinancePlanData>({
    resolver: zodResolver(createFinancePlanSchema),
    defaultValues: {
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      startMonth: toMonthInputValue(plan?.startMonth ?? today ?? new Date()),
      // Default 120 (10 years) for new plans matches the schema default and lets the
      // chart densifier kick in (first 12 months monthly, then year-ends after).
      monthsAhead: plan?.monthsAhead ?? 120,
      initialSavings: plan?.initialSavings ?? "0",
      monthlySavingsRate: plan?.monthlySavingsRate ?? "0",
      initialInvestments: plan?.initialInvestments ?? "0",
      // Monthly confirmation prompt: 0 disables, 1..28 sets the trigger day.
      confirmationDayOfMonth: plan?.confirmationDayOfMonth ?? 1,
    },
  });

  const onSubmit = async (data: CreateFinancePlanData): Promise<void> => {
    const surplusValue = accelerate ? (surplusPct / 100).toFixed(4) : "0";
    const investValue = autoInvest && investMethodId ? (investPct / 100).toFixed(4) : "0";
    const payload = {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      includePortfolio,
      surplusToDebtsPercent: surplusValue,
      debtStrategy: strategy,
      autoInvestPercent: investValue,
      autoInvestMethodId: autoInvest && investMethodId ? investMethodId : null,
      color,
    };

    const result = plan
      ? await updatePlanAction({ id: plan.id, ...payload })
      : await createPlanAction(payload);

    if (result.success) {
      toast.success(plan ? "Plan saved" : "Plan created");
      // The action revalidated the plans segment; the push alone lands on
      // fresh data.
      router.push(`/portal/plans/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  };

  // The day the opening balances were stated on. The field shows THAT
  // figure, not today's balance (which the plan page shows), so its hint
  // must not call it "your balance today".
  const statedOn = plan ? formatDay(plan.balancesAsOf ?? plan.createdAt) : null;

  /** Wires one registered field to its error the way screen readers expect. */
  const invalid = (message: string | undefined, id: string) =>
    message
      ? { "aria-invalid": true, "aria-describedby": `${id}-error` }
      : {};

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{plan ? "Plan settings" : "Basics"}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* noValidate: the browser's own bubbles stopped at the first empty
              field and hid the schema's messages for every other one. */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            id="plan-form"
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-2 sm:col-span-2" data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor="plan-name">Name</FieldLabel>
                <Input
                  id="plan-name"
                  placeholder="Base scenario"
                  required
                  {...invalid(errors.name?.message, "plan-name")}
                  {...register("name")}
                />
                <FieldError id="plan-name-error" errors={[errors.name]} />
              </Field>
              <Field
                className="gap-2 sm:col-span-2"
                data-invalid={!!errors.description || undefined}
              >
                <FieldLabel htmlFor="plan-description">Description</FieldLabel>
                <Textarea
                  id="plan-description"
                  placeholder="Notes about this scenario"
                  rows={2}
                  {...invalid(errors.description?.message, "plan-description")}
                  {...register("description")}
                />
                <FieldError id="plan-description-error" errors={[errors.description]} />
              </Field>
              <Field className="gap-2" data-invalid={!!errors.startMonth || undefined}>
                <FieldLabel htmlFor="plan-start">Start month</FieldLabel>
                <Input
                  id="plan-start"
                  type="month"
                  required
                  {...invalid(errors.startMonth?.message, "plan-start")}
                  {...register("startMonth")}
                />
                <FieldError id="plan-start-error" errors={[errors.startMonth]} />
              </Field>
              <Field className="gap-2" data-invalid={!!errors.monthsAhead || undefined}>
                <FieldLabel htmlFor="plan-months">Months ahead</FieldLabel>
                <Input
                  id="plan-months"
                  type="number"
                  min={12}
                  max={120}
                  step={1}
                  required
                  {...invalid(errors.monthsAhead?.message, "plan-months")}
                  {...register("monthsAhead", { valueAsNumber: true })}
                />
                <FieldError id="plan-months-error" errors={[errors.monthsAhead]} />
                <FieldDescription>
                  Minimum 12 months · default 120 (10 years).
                </FieldDescription>
              </Field>
              <Field className="gap-2" data-invalid={!!errors.initialSavings || undefined}>
                <FieldLabel htmlFor="plan-savings">Initial savings</FieldLabel>
                <Input
                  id="plan-savings"
                  inputMode="decimal"
                  {...invalid(errors.initialSavings?.message, "plan-savings")}
                  {...register("initialSavings", {
                    setValueAs: (v: string) => (v === "" ? "0" : v),
                  })}
                />
                <FieldError id="plan-savings-error" errors={[errors.initialSavings]} />
                <FieldDescription>
                  {plan
                    ? `As stated on ${statedOn}. Enter what you hold today to restate the plan's opening balances as of today: the others roll forward to where the plan has them now, and nothing already paid in or out is counted again.`
                    : "Your balance on the day you create the plan — anything already paid in or out this period is in it, so it isn't counted again."}
                </FieldDescription>
              </Field>
              <Field
                className="gap-2"
                data-invalid={!!errors.monthlySavingsRate || undefined}
              >
                <FieldLabel htmlFor="plan-rate">Monthly savings rate</FieldLabel>
                <Input
                  id="plan-rate"
                  inputMode="decimal"
                  placeholder="0.007"
                  {...invalid(errors.monthlySavingsRate?.message, "plan-rate")}
                  {...register("monthlySavingsRate", {
                    setValueAs: (v: string) => (v === "" ? "0" : v),
                  })}
                />
                <FieldError id="plan-rate-error" errors={[errors.monthlySavingsRate]} />
                <FieldDescription>
                  Decimal monthly rate. 0.007 ≈ 0.70% per month.
                </FieldDescription>
              </Field>
              <Field className="gap-2 sm:col-span-2">
                <FieldTitle id="plan-color-label">Chart color</FieldTitle>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={color}
                  onValueChange={(v) => v && setColor(v)}
                  aria-labelledby="plan-color-label"
                  className="gap-2"
                >
                  {COLORS.map((c, i) => (
                    <ToggleGroupItem
                      key={c}
                      value={c}
                      aria-label={`Colour ${i + 1}`}
                      className="size-7 min-w-0 flex-none rounded-full border-2 border-transparent p-0 shadow-none data-[state=on]:border-foreground"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </ToggleGroup>
              </Field>
              <Field
                orientation="horizontal"
                className="justify-between rounded-lg border p-3 sm:col-span-2"
              >
                <FieldContent>
                  <FieldLabel htmlFor="plan-include-portfolio" className="cursor-pointer">
                    Include current portfolio in net worth
                  </FieldLabel>
                  <FieldDescription>
                    Adds your live portfolio value to the projection&apos;s net worth line.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="plan-include-portfolio"
                  checked={includePortfolio}
                  onCheckedChange={setIncludePortfolio}
                />
              </Field>

              <Field
                className="gap-2 sm:col-span-2"
                data-invalid={!!errors.confirmationDayOfMonth || undefined}
              >
                <FieldLabel htmlFor="plan-confirmation-day">Monthly confirmation day</FieldLabel>
                <Input
                  id="plan-confirmation-day"
                  type="number"
                  min={0}
                  max={28}
                  step={1}
                  {...invalid(errors.confirmationDayOfMonth?.message, "plan-confirmation-day")}
                  {...register("confirmationDayOfMonth", {
                    setValueAs: (v: string) => (v === "" ? 0 : Number(v)),
                  })}
                />
                <FieldError
                  id="plan-confirmation-day-error"
                  errors={[errors.confirmationDayOfMonth]}
                />
                <FieldDescription>
                  Day of the month (1–28) when a dialog will ask you to confirm your
                  real balances. Set to <strong>0</strong> to disable.
                </FieldDescription>
              </Field>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Debt acceleration</CardTitle>
          <CardDescription>
            When your monthly cash flow is positive, route part of the surplus into
            extra debt principal. Avalanche almost always pays less interest, but
            snowball is easier to stick with.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field orientation="horizontal" className="justify-between rounded-lg border p-3">
            <FieldContent>
              <FieldLabel htmlFor="plan-accelerate" className="cursor-pointer">
                Apply surplus to debts
              </FieldLabel>
              <FieldDescription>
                Off → all surplus goes to savings. On → split surplus between extra debt
                payments and savings using the slider below.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="plan-accelerate"
              checked={accelerate}
              onCheckedChange={setAccelerate}
            />
          </Field>

          {/* `inert` rather than pointer-events: a dimmed section must also be
              out of the tab order, or the keyboard can still drive it. */}
          <div
            inert={!accelerate}
            className={cn("flex flex-col gap-6", !accelerate && "opacity-50")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <FieldTitle>Surplus aggressiveness</FieldTitle>
                <div className="flex items-baseline gap-2">
                  <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {surplusPct}%
                  </Mono>
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
              <div className="flex justify-between">
                <Text variant="small" as="span">30% · keeps savings growing</Text>
                <Text variant="small" as="span">100% · all-in on debt</Text>
              </div>
              <Text variant="small">
                Recommended starting point: <strong>60%</strong>.
              </Text>
            </div>

            <FieldSet className="gap-3">
              <FieldLegend variant="label" className="mb-3">
                Payoff method
              </FieldLegend>
              <RadioGroup
                value={strategy}
                onValueChange={(v) => setStrategy(v as DebtStrategy)}
                className="grid gap-2"
              >
                <label
                  htmlFor="strategy-avalanche"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
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
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
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
            </FieldSet>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Auto-invest</CardTitle>
          <CardDescription>
            After surplus → debts runs, route part of what&apos;s left into a compounding
            investments bucket modelled against an investment method&apos;s monthly ROI.
            The investments balance grows every month and counts toward your net worth.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field orientation="horizontal" className="justify-between rounded-lg border p-3">
            <FieldContent>
              <FieldLabel htmlFor="plan-autoinvest" className="cursor-pointer">
                Auto-invest the remainder
              </FieldLabel>
              <FieldDescription>
                Off → all the remainder stays as savings. On → split between
                investments and savings using the slider.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="plan-autoinvest"
              checked={autoInvest}
              onCheckedChange={setAutoInvest}
            />
          </Field>

          <div
            inert={!autoInvest}
            className={cn("flex flex-col gap-6", !autoInvest && "opacity-50")}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <FieldTitle>Share of remainder → investments</FieldTitle>
                <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
                  {investPct}%
                </Mono>
              </div>
              <Slider
                value={[investPct]}
                min={10}
                max={100}
                step={5}
                onValueChange={(v) => setInvestPct(v[0])}
                aria-label="Auto-invest percentage"
              />
              <div className="flex justify-between">
                <Text variant="small" as="span">10% · most stays as savings</Text>
                <Text variant="small" as="span">100% · all remainder invested</Text>
              </div>
            </div>

            <Field className="gap-2">
              <FieldLabel htmlFor="plan-invest-method">Investment method</FieldLabel>
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
              <FieldDescription>
                Disabled methods can be used here as hypothetical scenarios. They are
                hidden from your real portfolio.
              </FieldDescription>
            </Field>

            <Field
              className="gap-2"
              data-invalid={!!errors.initialInvestments || undefined}
            >
              <FieldLabel htmlFor="plan-init-investments">Initial investments balance</FieldLabel>
              <Input
                id="plan-init-investments"
                inputMode="decimal"
                {...invalid(errors.initialInvestments?.message, "plan-init-investments")}
                {...register("initialInvestments", {
                  setValueAs: (v: string) => (v === "" ? "0" : v),
                })}
              />
              <FieldError
                id="plan-init-investments-error"
                errors={[errors.initialInvestments]}
              />
              <FieldDescription>
                {plan
                  ? `The investments bucket as stated on ${statedOn}. Changing it restates the opening balances as of today, like Initial savings.`
                  : "What the investments bucket holds on the day you create the plan."}
              </FieldDescription>
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" form="plan-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          {isSubmitting ? "Saving…" : plan ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </div>
  );
}
