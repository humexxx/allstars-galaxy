import { z } from "zod";

import {
  ACTIVITY_LEVELS,
  PACES_KG_PER_WEEK,
  feetInchesToCm,
  lbToKg,
  type ActivityLevel,
  type CalorieInput,
} from "@/lib/wellness/calories";

const ACTIVITY_KEYS = ACTIVITY_LEVELS.map((a) => a.key) as [ActivityLevel, ...ActivityLevel[]];

/** A number typed into a text field: blank stays blank, so it fails as "required". */
function typedNumber(label: string, min: number, max: number, unit = ""): z.ZodType<number, string> {
  const range = `${label} must be between ${min} and ${max}${unit}`;
  return z
    .string()
    .trim()
    .min(1, `Enter your ${label.toLowerCase()}`)
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number({ error: range }).min(min, range).max(max, range));
}

const HEIGHT_CM = { min: 120, max: 230 };

/**
 * The calorie form as typed: every number a string, both unit systems' fields
 * present so a units switch keeps what was entered. The check that matters
 * runs only on the system in use.
 */
export const calorieFormSchema = z
  .object({
    units: z.enum(["metric", "imperial"]),
    sex: z.enum(["male", "female"], { error: "Pick one" }),
    age: z.string(),
    heightCm: z.string(),
    weightKg: z.string(),
    heightFt: z.string(),
    heightIn: z.string(),
    weightLb: z.string(),
    activity: z.enum(ACTIVITY_KEYS),
    goal: z.enum(["lose", "maintain", "gain"]),
    pace: z.enum(PACES_KG_PER_WEEK.map(String) as [string, ...string[]]),
  })
  .transform((data, ctx): CalorieInput => {
    const check = (path: string, schema: z.ZodType<number, string>, value: string): number => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", path: [path], message: parsed.error.issues[0]!.message });
        return Number.NaN;
      }
      return parsed.data;
    };

    const age = check("age", typedNumber("Age", 15, 100).pipe(z.number().int("Age must be whole years")), data.age);
    let heightCm: number;
    let weightKg: number;
    if (data.units === "metric") {
      heightCm = check("heightCm", typedNumber("Height", HEIGHT_CM.min, HEIGHT_CM.max, " cm"), data.heightCm);
      weightKg = check("weightKg", typedNumber("Weight", 35, 250, " kg"), data.weightKg);
    } else {
      const ft = check("heightFt", typedNumber("Feet", 3, 7), data.heightFt);
      const inches = data.heightIn.trim() === "" ? 0 : check("heightIn", typedNumber("Inches", 0, 11.9), data.heightIn);
      heightCm = feetInchesToCm(ft, inches);
      if (Number.isFinite(heightCm) && (heightCm < HEIGHT_CM.min || heightCm > HEIGHT_CM.max)) {
        ctx.addIssue({ code: "custom", path: ["heightFt"], message: "Height must be between 4 ft and 7 ft 6 in" });
      }
      weightKg = lbToKg(check("weightLb", typedNumber("Weight", 77, 550, " lb"), data.weightLb));
    }

    return {
      sex: data.sex,
      age,
      heightCm,
      weightKg,
      activity: data.activity,
      goal: data.goal,
      paceKgPerWeek: Number(data.pace),
    };
  });

export type CalorieFormInput = z.input<typeof calorieFormSchema>;
export type CalorieFormData = z.output<typeof calorieFormSchema>;
