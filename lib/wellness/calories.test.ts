import { describe, expect, it } from "vitest";

import { calorieFormSchema, type CalorieFormInput } from "@/schemas/wellness";

import {
  calculateCalories,
  cmToFeetInches,
  dailyAdjustment,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  macroSplit,
  mifflinStJeor,
  type CalorieInput,
} from "./calories";

const man: CalorieInput = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: "moderate",
  goal: "maintain",
  paceKgPerWeek: 0.5,
};

describe("calorie maths", () => {
  it("uses Mifflin-St Jeor for the resting rate", () => {
    expect(mifflinStJeor("male", 30, 180, 80)).toBe(1780);
    expect(mifflinStJeor("female", 30, 165, 60)).toBeCloseTo(1320.25);
  });

  it("multiplies the resting rate by the activity factor for maintenance", () => {
    const r = calculateCalories(man);
    expect(r.bmr).toBe(1780);
    expect(r.activityFactor).toBe(1.55);
    expect(r.maintenance).toBe(2759);
    expect(r.target).toBe(2759);
    expect(r.weeklyChangeKg).toBe(0);
  });

  it("turns a weekly pace into a daily deficit or surplus at 7700 kcal per kg", () => {
    expect(dailyAdjustment("lose", 0.5)).toBe(-550);
    expect(dailyAdjustment("gain", 0.25)).toBe(275);
    expect(dailyAdjustment("maintain", 0.75)).toBe(0);
    const lose = calculateCalories({ ...man, goal: "lose", paceKgPerWeek: 0.75 });
    expect(lose.target).toBe(2759 - 825);
    expect(lose.clamped).toBe(false);
    expect(lose.weeklyChangeKg).toBeCloseTo(-0.75);
  });

  it("never sets a deficit below the floor, and says so", () => {
    const small: CalorieInput = {
      sex: "female",
      age: 60,
      heightCm: 150,
      weightKg: 48,
      activity: "sedentary",
      goal: "lose",
      paceKgPerWeek: 0.75,
    };
    const r = calculateCalories(small);
    expect(r.target).toBe(1200);
    expect(r.floor).toBe(1200);
    expect(r.clamped).toBe(true);
    expect(r.weeklyChangeKg).toBeGreaterThan(-0.75);

    const male = calculateCalories({ ...small, sex: "male" });
    expect(male.target).toBeGreaterThanOrEqual(1500);
  });

  it("leaves maintaining and gaining alone even under the floor", () => {
    const tiny: CalorieInput = { ...man, sex: "female", age: 80, heightCm: 140, weightKg: 38, activity: "sedentary" };
    const r = calculateCalories(tiny);
    expect(r.maintenance).toBeLessThan(1200);
    expect(r.target).toBe(r.maintenance);
    expect(r.clamped).toBe(false);
  });

  it("splits the target into protein per kg, a quarter fat and carbs for the rest", () => {
    expect(macroSplit(2000, 70)).toEqual({ proteinG: 126, fatG: 56, carbsG: 248 });
    expect(macroSplit(1200, 200).carbsG).toBe(0);
  });

  it("converts between metric and imperial", () => {
    expect(lbToKg(176)).toBeCloseTo(79.83, 2);
    expect(kgToLb(80)).toBeCloseTo(176.37, 2);
    expect(feetInchesToCm(5, 11)).toBeCloseTo(180.34);
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 });
    expect(cmToFeetInches(182.88)).toEqual({ feet: 6, inches: 0 });
  });
});

describe("calorie form schema", () => {
  const form: CalorieFormInput = {
    units: "metric",
    sex: "male",
    age: "30",
    heightCm: "180",
    weightKg: "80",
    heightFt: "",
    heightIn: "",
    weightLb: "",
    activity: "moderate",
    goal: "lose",
    pace: "0.5",
  };

  it("parses typed metric values", () => {
    expect(calorieFormSchema.parse(form)).toEqual({ ...man, goal: "lose", paceKgPerWeek: 0.5 });
  });

  it("accepts a decimal comma", () => {
    expect(calorieFormSchema.parse({ ...form, weightKg: "80,5" }).weightKg).toBe(80.5);
  });

  it("parses imperial values into metric", () => {
    const r = calorieFormSchema.parse({ ...form, units: "imperial", heightFt: "5", heightIn: "11", weightLb: "176" });
    expect(r.heightCm).toBeCloseTo(180.34);
    expect(r.weightKg).toBeCloseTo(79.83, 2);
  });

  it("rejects blanks and values out of range, on the field that is wrong", () => {
    const blank = calorieFormSchema.safeParse({ ...form, age: "" });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0]).toMatchObject({ path: ["age"], message: "Enter your age" });

    const tall = calorieFormSchema.safeParse({ ...form, heightCm: "300" });
    expect(tall.error?.issues[0]?.path).toEqual(["heightCm"]);

    expect(calorieFormSchema.safeParse({ ...form, age: "30.5" }).success).toBe(false);
    expect(calorieFormSchema.safeParse({ ...form, weightKg: "abc" }).success).toBe(false);
    expect(
      calorieFormSchema.safeParse({ ...form, units: "imperial", heightFt: "8", weightLb: "176" }).error?.issues[0]?.path
    ).toEqual(["heightFt"]);
  });

  it("ignores the other unit system's empty fields", () => {
    expect(calorieFormSchema.safeParse({ ...form, heightFt: "x", weightLb: "" }).success).toBe(true);
  });
});
