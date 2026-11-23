export type Sex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very-active";
export type Goal = "lose" | "maintain" | "gain";

export const ACTIVITY_LEVELS: readonly {
  key: ActivityLevel;
  label: string;
  description: string;
  factor: number;
}[] = [
  { key: "sedentary", label: "Sedentary", description: "Desk job, little or no exercise.", factor: 1.2 },
  { key: "light", label: "Lightly active", description: "Light exercise or walking 1–3 days a week.", factor: 1.375 },
  { key: "moderate", label: "Moderately active", description: "Moderate exercise 3–5 days a week.", factor: 1.55 },
  { key: "active", label: "Active", description: "Hard exercise 6–7 days a week.", factor: 1.725 },
  { key: "very-active", label: "Very active", description: "Hard daily training or a physical job.", factor: 1.9 },
];

export const PACES_KG_PER_WEEK = [0.25, 0.5, 0.75] as const;
export type Pace = (typeof PACES_KG_PER_WEEK)[number];

export const KCAL_PER_KG = 7700;
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };
export const PROTEIN_G_PER_KG = 1.8;
export const FAT_SHARE = 0.25;

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export type CalorieInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  paceKgPerWeek: number;
};

export type CalorieResult = {
  bmr: number;
  activityFactor: number;
  maintenance: number;
  /** kcal a day the goal adds (gain) or takes off (lose) before the floor. */
  dailyAdjustment: number;
  target: number;
  floor: number;
  /** The goal asked for less than the floor, so the target was raised to it. */
  clamped: boolean;
  /** What the target actually works out to, kg a week (negative = losing). */
  weeklyChangeKg: number;
  macros: { proteinG: number; fatG: number; carbsG: number };
};

/** Mifflin-St Jeor: kcal a day at complete rest. */
export function mifflinStJeor(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((a) => a.key === level)!.factor;
}

export function dailyAdjustment(goal: Goal, paceKgPerWeek: number): number {
  if (goal === "maintain") return 0;
  const kcal = (paceKgPerWeek * KCAL_PER_KG) / 7;
  return goal === "lose" ? -kcal : kcal;
}

/**
 * The protein comes off first (per kg of body weight), the fat is a share of
 * the calories, and carbs take what is left — never below zero, so a very
 * heavy person on a low target gets no carbs rather than a negative figure.
 */
export function macroSplit(targetKcal: number, weightKg: number): CalorieResult["macros"] {
  const proteinG = Math.round(PROTEIN_G_PER_KG * weightKg);
  const fatG = Math.round((targetKcal * FAT_SHARE) / 9);
  const carbsG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG };
}

/**
 * The floor only stops a deficit: maintaining or gaining already eats at or
 * above maintenance, and raising those to a floor would turn them into a gain.
 * Nor may it turn a deficit into a surplus: when maintenance itself is under
 * the floor, the safe answer to "lose" is to eat at maintenance.
 */
export function calculateCalories(input: CalorieInput): CalorieResult {
  const bmr = Math.round(mifflinStJeor(input.sex, input.age, input.heightCm, input.weightKg));
  const factor = activityFactor(input.activity);
  const maintenance = Math.round(bmr * factor);
  const adjustment = Math.round(dailyAdjustment(input.goal, input.paceKgPerWeek));
  const floor = CALORIE_FLOOR[input.sex];
  const wanted = maintenance + adjustment;
  const clamped = input.goal === "lose" && wanted < floor;
  const target = clamped ? Math.min(floor, maintenance) : wanted;
  const weeklyChangeKg = ((target - maintenance) * 7) / KCAL_PER_KG;

  return {
    bmr,
    activityFactor: factor,
    maintenance,
    dailyAdjustment: adjustment,
    target,
    floor,
    clamped,
    weeklyChangeKg,
    macros: macroSplit(target, input.weightKg),
  };
}
