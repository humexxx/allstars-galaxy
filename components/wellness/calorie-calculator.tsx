"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Flame, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import {
  ACTIVITY_LEVELS,
  CALORIE_FLOOR,
  FAT_SHARE,
  KCAL_PER_KG,
  PACES_KG_PER_WEEK,
  PROTEIN_G_PER_KG,
  calculateCalories,
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  type CalorieInput,
  type CalorieResult,
} from "@/lib/wellness/calories";
import { calorieFormSchema, type CalorieFormData, type CalorieFormInput } from "@/schemas/wellness";

const STORAGE_KEY = "wellness:calories:v1";

const DEFAULTS: CalorieFormInput = {
  units: "metric",
  sex: undefined as unknown as CalorieFormInput["sex"],
  age: "",
  heightCm: "",
  weightKg: "",
  heightFt: "",
  heightIn: "",
  weightLb: "",
  activity: "light",
  goal: "maintain",
  pace: "0.5",
};

function readSaved(): Partial<CalorieFormInput> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<CalorieFormInput>) : null;
  } catch {
    return null;
  }
}

function save(values: Partial<CalorieFormInput>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Private mode or blocked storage: the form still works, it just won't be remembered.
  }
}

/** Only the fields the form knows, each kept only if it is still a valid choice. */
function restore(saved: Partial<CalorieFormInput>): CalorieFormInput {
  const merged = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof CalorieFormInput)[]) {
    const value = saved[key];
    if (typeof value === "string") (merged as Record<string, string>)[key] = value;
  }
  const probe = calorieFormSchema.safeParse(merged);
  const badChoice = probe.error?.issues.some((i) =>
    ["units", "activity", "goal", "pace"].includes(String(i.path[0]))
  );
  return badChoice ? { ...DEFAULTS, age: merged.age, heightCm: merged.heightCm, weightKg: merged.weightKg } : merged;
}

const kcal = (n: number): string => Math.round(n).toLocaleString("en-US");
const one = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("en-US");
const two = (n: number): string => (Math.round(n * 100) / 100).toLocaleString("en-US");

function parseNumber(value: string): number | null {
  const n = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export function CalorieCalculator(): React.ReactElement {
  const {
    control,
    register,
    reset,
    subscribe,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CalorieFormInput, unknown, CalorieFormData>({
    resolver: zodResolver(calorieFormSchema),
    mode: "onChange",
    defaultValues: DEFAULTS,
  });

  // Saved from a subscription, not an effect on the watched values: the
  // first run of such an effect would write the blank defaults over what is
  // stored before the restore below has landed.
  useEffect(() => subscribe({ formState: { values: true }, callback: ({ values: next }) => save(next) }), [subscribe]);
  const values = useWatch({ control });
  useEffect(() => {
    const saved = readSaved();
    if (saved) reset(restore(saved));
  }, [reset]);

  const input = useMemo(() => {
    const parsed = calorieFormSchema.safeParse(values);
    return parsed.success ? parsed.data : null;
  }, [values]);
  const result = useMemo(() => (input ? calculateCalories(input) : null), [input]);

  const metric = values.units !== "imperial";

  const switchUnits = (next: string): void => {
    if (next !== "metric" && next !== "imperial") return;
    const v = getValues();
    if (next === v.units) return;
    // Each side is converted only when it no longer says what the other
    // does: going lb and back must not round 84 kg into 83.9.
    const cm = parseNumber(v.heightCm);
    const kg = parseNumber(v.weightKg);
    const ft = parseNumber(v.heightFt);
    const inch = parseNumber(v.heightIn) ?? 0;
    const lb = parseNumber(v.weightLb);
    const sameHeight = cm !== null && ft !== null && (() => {
      const shown = cmToFeetInches(cm);
      return shown.feet === ft && shown.inches === inch;
    })();
    const sameWeight = kg !== null && lb !== null && Math.round(kgToLb(kg)) === lb;
    if (next === "imperial") {
      if (cm && !sameHeight) {
        const { feet, inches } = cmToFeetInches(cm);
        setValue("heightFt", String(feet));
        setValue("heightIn", String(inches));
      }
      if (kg && !sameWeight) setValue("weightLb", String(Math.round(kgToLb(kg))));
    } else {
      if (ft && !sameHeight) setValue("heightCm", String(Math.round(feetInchesToCm(ft, inch))));
      if (lb && !sameWeight) setValue("weightKg", String(one(lbToKg(lb))));
    }
    setValue("units", next, { shouldValidate: false });
  };

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-5">
        <Card className="@4xl:col-span-3">
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>Nothing leaves this device: it is remembered here for next time.</CardDescription>
            <CardAction>
              <Controller
                control={control}
                name="units"
                render={({ field }) => (
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={field.value}
                    onValueChange={switchUnits}
                    aria-label="Units"
                  >
                    <ToggleGroupItem value="metric">kg · cm</ToggleGroupItem>
                    <ToggleGroupItem value="imperial">lb · ft</ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              <Field data-invalid={!!errors.sex || undefined}>
                <FieldLabel id="calories-sex-label">Sex</FieldLabel>
                <Controller
                  control={control}
                  name="sex"
                  render={({ field }) => (
                    <ToggleGroup
                      type="single"
                      value={field.value ?? ""}
                      onValueChange={(v) => v && field.onChange(v)}
                      aria-labelledby="calories-sex-label"
                      className="w-full"
                    >
                      <ToggleGroupItem value="female">Female</ToggleGroupItem>
                      <ToggleGroupItem value="male">Male</ToggleGroupItem>
                    </ToggleGroup>
                  )}
                />
                <FieldError errors={[errors.sex]} />
              </Field>
              <NumberField
                id="calories-age"
                label="Age"
                unit="years"
                inputMode="numeric"
                error={errors.age?.message}
                {...register("age")}
              />
            </div>

            {metric ? (
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <NumberField
                  id="calories-height-cm"
                  label="Height"
                  unit="cm"
                  inputMode="decimal"
                  error={errors.heightCm?.message}
                  {...register("heightCm")}
                />
                <NumberField
                  id="calories-weight-kg"
                  label="Weight"
                  unit="kg"
                  inputMode="decimal"
                  error={errors.weightKg?.message}
                  {...register("weightKg")}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <Field data-invalid={!!(errors.heightFt || errors.heightIn) || undefined}>
                  <FieldLabel htmlFor="calories-height-ft">Height</FieldLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <UnitInput id="calories-height-ft" unit="ft" inputMode="numeric" invalid={!!errors.heightFt} {...register("heightFt")} />
                    <UnitInput
                      id="calories-height-in"
                      unit="in"
                      inputMode="decimal"
                      aria-label="Inches"
                      invalid={!!errors.heightIn}
                      {...register("heightIn")}
                    />
                  </div>
                  <FieldError errors={[errors.heightFt, errors.heightIn]} />
                </Field>
                <NumberField
                  id="calories-weight-lb"
                  label="Weight"
                  unit="lb"
                  inputMode="decimal"
                  error={errors.weightLb?.message}
                  {...register("weightLb")}
                />
              </div>
            )}

            <FieldSet className="gap-3">
              <FieldLegend variant="label">How active are you?</FieldLegend>
              <Controller
                control={control}
                name="activity"
                render={({ field }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-2 @xl:grid-cols-2">
                    {ACTIVITY_LEVELS.map((level) => (
                      <label
                        key={level.key}
                        htmlFor={`calories-activity-${level.key}`}
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary has-data-checked:bg-primary/5"
                      >
                        <RadioGroupItem id={`calories-activity-${level.key}`} value={level.key} className="mt-0.5" />
                        <span className="flex min-w-0 flex-col">
                          <Text as="span" weight="medium">
                            {level.label}
                          </Text>
                          <Text as="span" variant="small">
                            {level.description}
                          </Text>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
            </FieldSet>

            <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              <Field>
                <FieldLabel id="calories-goal-label">Goal</FieldLabel>
                <Controller
                  control={control}
                  name="goal"
                  render={({ field }) => (
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      aria-labelledby="calories-goal-label"
                      className="w-full"
                    >
                      <ToggleGroupItem value="lose">Lose</ToggleGroupItem>
                      <ToggleGroupItem value="maintain">Maintain</ToggleGroupItem>
                      <ToggleGroupItem value="gain">Gain</ToggleGroupItem>
                    </ToggleGroup>
                  )}
                />
              </Field>
              {values.goal !== "maintain" && (
                <Field>
                  <FieldLabel id="calories-pace-label">Pace per week</FieldLabel>
                  <Controller
                    control={control}
                    name="pace"
                    render={({ field }) => (
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                        aria-labelledby="calories-pace-label"
                        className="w-full"
                      >
                        {PACES_KG_PER_WEEK.map((pace) => (
                          <ToggleGroupItem key={pace} value={String(pace)}>
                            {metric ? `${pace} kg` : `${one(kgToLb(pace))} lb`}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="@4xl:col-span-2">
          <div className="flex flex-col gap-6 @4xl:sticky @4xl:top-6">
            {result && input ? (
              <ResultCard input={input} result={result} metric={metric} />
            ) : (
              <EmptyResult control={control} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type UnitInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, "type"> & {
  unit: string;
  invalid?: boolean;
};

function UnitInput({ unit, invalid, ...props }: UnitInputProps): React.ReactElement {
  return (
    <InputGroup>
      <InputGroupInput type="text" autoComplete="off" aria-invalid={invalid || undefined} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{unit}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

function NumberField({
  label,
  error,
  id,
  ...props
}: UnitInputProps & { label: string; error?: string; id: string }): React.ReactElement {
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <UnitInput id={id} invalid={!!error} {...props} />
      <FieldError>{error}</FieldError>
    </Field>
  );
}

function EmptyResult({ control }: { control: Control<CalorieFormInput, unknown, CalorieFormData> }): React.ReactElement {
  const values = useWatch({ control });
  const missing = [
    !values.sex && "sex",
    !values.age && "age",
    !(values.units === "imperial" ? values.heightFt : values.heightCm) && "height",
    !(values.units === "imperial" ? values.weightLb : values.weightKg) && "weight",
  ].filter(Boolean);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Flame className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <Text weight="medium">Your daily calories show up here</Text>
        <Text variant="muted">
          {missing.length > 0 ? `Still needed: ${missing.join(", ")}.` : "Check the fields marked in red."}
        </Text>
      </CardContent>
    </Card>
  );
}

function ResultCard({
  input,
  result,
  metric,
}: {
  input: CalorieInput;
  result: CalorieResult;
  metric: boolean;
}): React.ReactElement {
  const activity = ACTIVITY_LEVELS.find((a) => a.key === input.activity)!;
  const weekly = Math.abs(result.weeklyChangeKg);
  const weeklyLabel = metric ? `${two(weekly)} kg` : `${one(kgToLb(weekly))} lb`;
  const goalLine =
    input.goal === "maintain"
      ? "to keep your weight where it is"
      : weekly < 0.05
        ? "about what keeps your weight steady"
        : result.weeklyChangeKg < 0
        ? `to lose about ${weeklyLabel} a week`
        : result.weeklyChangeKg > 0 && input.goal === "gain"
          ? `to gain about ${weeklyLabel} a week`
          : "at maintenance";
  const { proteinG, fatG, carbsG } = result.macros;

  return (
    <>
      <Card>
        <CardHeader>
          <Eyebrow as="div">Daily target</Eyebrow>
          <div className="flex items-baseline gap-2">
            <Mono data-testid="calorie-target" className="text-4xl font-semibold tracking-tight sm:text-5xl">{kcal(result.target)}</Mono>
            <Text variant="muted" as="span">
              kcal a day
            </Text>
          </div>
          <Text variant="muted">{goalLine}</Text>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {result.clamped && (
            <Alert variant="warning">
              <ShieldAlert aria-hidden="true" />
              <AlertTitle>{result.weeklyChangeKg < 0 ? "Raised to the safe floor" : "No safe deficit"}</AlertTitle>
              <AlertDescription>
                {result.weeklyChangeKg < 0
                  ? `Losing ${metric ? `${input.paceKgPerWeek} kg` : `${one(kgToLb(input.paceKgPerWeek))} lb`} a week would mean ${kcal(result.maintenance + result.dailyAdjustment)} kcal, under the ${kcal(result.floor)} kcal a day that is the usual minimum for ${input.sex === "male" ? "men" : "women"} without a doctor's supervision. A slower pace or more activity gets you there safely.`
                  : `Your maintenance is already under the ${kcal(result.floor)} kcal a day usual minimum, so there is no safe deficit to plan here. Talk to a doctor or dietitian before cutting.`}
              </AlertDescription>
            </Alert>
          )}
          <dl className="grid grid-cols-3 gap-2">
            <Figure label="Resting" value={kcal(result.bmr)} />
            <Figure label="Maintenance" value={kcal(result.maintenance)} />
            <Figure
              label={input.goal === "gain" ? "Surplus" : "Deficit"}
              value={input.goal === "maintain" ? "0" : kcal(Math.abs(result.target - result.maintenance))}
            />
          </dl>
          <div className="flex flex-col gap-2">
            <Eyebrow size="sm" as="div">
              Macros
            </Eyebrow>
            <dl className="grid grid-cols-3 gap-2">
              <Figure label="Protein" value={`${proteinG} g`} />
              <Figure label="Fat" value={`${fatG} g`} />
              <Figure label="Carbs" value={`${carbsG} g`} />
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>How it was worked out</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex list-decimal flex-col gap-3 pl-5 marker:text-muted-foreground">
            <Step title="What your body burns at rest">
              Mifflin-St Jeor: 10 × {one(input.weightKg)} kg + 6.25 × {one(input.heightCm)} cm − 5 × {input.age}{" "}
              {input.sex === "male" ? "+ 5" : "− 161"} = <Mono>{kcal(result.bmr)}</Mono> kcal.
            </Step>
            <Step title="Add your day">
              {kcal(result.bmr)} × {result.activityFactor} ({activity.label.toLowerCase()}) ={" "}
              <Mono>{kcal(result.maintenance)}</Mono> kcal keeps your weight steady.
            </Step>
            <Step title="Then the goal">
              {input.goal === "maintain"
                ? "Maintaining eats exactly that."
                : `A kilo of body weight is about ${kcal(KCAL_PER_KG)} kcal, so ${input.paceKgPerWeek} kg a week is ${kcal(Math.abs(result.dailyAdjustment))} kcal a day ${input.goal === "lose" ? "less" : "more"}`}
              {input.goal !== "maintain" &&
                (!result.clamped
                  ? "."
                  : result.target < result.floor
                    ? `, held at maintenance: it is already under the ${kcal(CALORIE_FLOOR[input.sex])} kcal floor.`
                    : `, held at the ${kcal(CALORIE_FLOOR[input.sex])} kcal floor.`)}
            </Step>
            <Step title="Split into macros">
              Protein {PROTEIN_G_PER_KG} g per kg ({proteinG} g), fat {FAT_SHARE * 100}% of the calories ({fatG} g), and
              carbs fill the rest ({carbsG} g). Protein and carbs are 4 kcal a gram, fat 9.
            </Step>
          </ol>
          <Text variant="small" className="mt-4">
            An estimate for healthy adults, not medical advice. Weigh yourself for a few weeks and adjust by 100–200
            kcal if the scale disagrees.
          </Text>
        </CardContent>
      </Card>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted/50 p-3">
      <dt>
        <Eyebrow size="sm">{label}</Eyebrow>
      </dt>
      <dd>
        <Mono className="text-base font-semibold sm:text-lg">{value}</Mono>
      </dd>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <li>
      <Text weight="medium">{title}</Text>
      <Text variant="muted">{children}</Text>
    </li>
  );
}
