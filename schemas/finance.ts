import { z } from "zod";

// Non-negative monetary value (no leading minus). Mirrors the CHECK constraints
// in the DB so values must be >= 0 at every layer.
const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative number with up to 2 decimals");

// Non-negative numeric rate.
const rate = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Must be a non-negative numeric rate");

// ISO date string YYYY-MM-DD. We accept the string form because the date column
// in Postgres is calendar-day-only — no timezone. Client passes "2026-08-15".
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date");

const lineKind = z.enum(["recurring", "one_time"]);

// Recurrence model shared by income / expense / debt. monthly_day is the
// historical behaviour (and the default) so existing rows keep working with no
// migration of values — only the column type was added.
const recurrenceType = z.enum([
  "monthly_day",
  "monthly_weekday",
  "every_n_months",
]);

// Fields a recurring entry can carry depending on recurrenceType. All optional
// at the validation surface; superRefine below enforces which ones are needed
// per type so we keep clear error paths.
const recurrenceFields = {
  recurrenceType: recurrenceType.default("monthly_day"),
  weekOfMonth: z.number().int().min(1).max(5).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  intervalMonths: z.number().int().min(1).max(12).nullable().optional(),
  recurrenceStart: isoDate.nullable().optional(),
};

type RecurrenceShape = {
  recurrenceType?: z.infer<typeof recurrenceType>;
  weekOfMonth?: number | null;
  dayOfWeek?: number | null;
  intervalMonths?: number | null;
  recurrenceStart?: string | null;
};

// Validates that fields specific to a recurrenceType are present when chosen.
// Pulled out so the same logic powers create + update for every line side.
function refineRecurrence<T extends RecurrenceShape>(val: T, ctx: z.RefinementCtx) {
  if (val.recurrenceType === "monthly_weekday") {
    if (val.weekOfMonth == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weekOfMonth"],
        message: "Pick which week (1–5) for monthly-weekday recurrence",
      });
    }
    if (val.dayOfWeek == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfWeek"],
        message: "Pick which weekday for monthly-weekday recurrence",
      });
    }
  } else if (val.recurrenceType === "every_n_months") {
    if (val.intervalMonths == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intervalMonths"],
        message: "Set the month interval (1–12)",
      });
    }
  }
}

export const createFinancePlanSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  startMonth: z.coerce.date(),
  monthsAhead: z.number().int().min(12).max(120),
  initialSavings: decimal.default("0"),
  monthlySavingsRate: rate.default("0"),
  includePortfolio: z.boolean().default(false),
  surplusToDebtsPercent: rate.default("0"),
  debtStrategy: z.enum(["avalanche", "snowball", "none"]).default("avalanche"),
  autoInvestPercent: rate.default("0"),
  autoInvestMethodId: z.string().uuid().nullable().optional(),
  initialInvestments: decimal.default("0"),
  // 0 = disabled monthly confirmation. Otherwise day of month 1..28.
  confirmationDayOfMonth: z.number().int().min(0).max(28).default(1),
  color: z.string().min(1).max(60).default("var(--chart-1)"),
});

export const updateFinancePlanSchema = createFinancePlanSchema.extend({
  id: z.string().uuid(),
});

// Income line shape + refinement. kind=one_time needs a date; kind=recurring
// with monthly_weekday or every_n_months gates the per-type required fields.
const incomeShape = {
  name: z.string().min(1).max(120),
  monthlyAmount: decimal.default("0"),
  kind: lineKind.default("recurring"),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  date: isoDate.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  ...recurrenceFields,
  sortOrder: z.number().optional(),
};

function refineIncome(
  val: z.infer<z.ZodObject<typeof incomeShape>>,
  ctx: z.RefinementCtx
) {
  if (val.kind === "one_time") {
    if (!val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "One-time income requires a date",
      });
    }
    return;
  }
  // Recurring branch — start/end window + recurrence-specific fields.
  if (val.startDate && val.endDate && val.startDate > val.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be on or after start date",
    });
  }
  refineRecurrence(val, ctx);
}

export const planIncomeSchema = z.object(incomeShape).superRefine(refineIncome);
export const updatePlanIncomeSchema = z
  .object({ id: z.string().uuid(), ...incomeShape })
  .superRefine(refineIncome);

// Expense line shape + refinement. Same shape as income minus start/end window.
const expenseShape = {
  name: z.string().min(1).max(120),
  monthlyAmount: decimal.default("0"),
  kind: lineKind.default("recurring"),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  date: isoDate.nullable().optional(),
  ...recurrenceFields,
  sortOrder: z.number().optional(),
};

function refineExpense(
  val: z.infer<z.ZodObject<typeof expenseShape>>,
  ctx: z.RefinementCtx
) {
  if (val.kind === "one_time") {
    if (!val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "One-time expense requires a date",
      });
    }
    return;
  }
  refineRecurrence(val, ctx);
}

export const planExpenseSchema = z.object(expenseShape).superRefine(refineExpense);
export const updatePlanExpenseSchema = z
  .object({ id: z.string().uuid(), ...expenseShape })
  .superRefine(refineExpense);

// Debts are always recurring — the recurrence-type refinement runs
// unconditionally.
const debtShape = {
  name: z.string().min(1).max(120),
  initialBalance: decimal.default("0"),
  monthlyInterestRate: rate.default("0"),
  monthlyPayment: decimal.default("0"),
  paymentType: z.enum(["fixed", "percent_of_balance"]).default("fixed"),
  minPaymentPercent: rate.default("0"),
  minPaymentFloor: decimal.default("0"),
  // Day of the month the minimum payment is due. Null = treated as day 1 by
  // the calendar / projection — preserves behaviour for legacy debts.
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  ...recurrenceFields,
  sortOrder: z.number().optional(),
};

function refineDebt(
  val: z.infer<z.ZodObject<typeof debtShape>>,
  ctx: z.RefinementCtx
) {
  refineRecurrence(val, ctx);
}

export const planDebtSchema = z.object(debtShape).superRefine(refineDebt);
export const updatePlanDebtSchema = z
  .object({ id: z.string().uuid(), ...debtShape })
  .superRefine(refineDebt);

export type CreateFinancePlanInput = z.infer<typeof createFinancePlanSchema>;
export type UpdateFinancePlanInput = z.infer<typeof updateFinancePlanSchema>;
export type PlanIncomeInput = z.infer<typeof planIncomeSchema>;
export type UpdatePlanIncomeInput = z.infer<typeof updatePlanIncomeSchema>;
export type PlanExpenseInput = z.infer<typeof planExpenseSchema>;
export type UpdatePlanExpenseInput = z.infer<typeof updatePlanExpenseSchema>;
export type PlanDebtInput = z.infer<typeof planDebtSchema>;
export type UpdatePlanDebtInput = z.infer<typeof updatePlanDebtSchema>;
export type RecurrenceType = z.infer<typeof recurrenceType>;
