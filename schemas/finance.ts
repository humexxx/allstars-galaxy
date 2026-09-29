import { z } from "zod";

import { idSchema, isoDateSchema, moneySchema } from "@/schemas/common";
import {
  DEBT_PAYMENT_TYPES,
  DEBT_STRATEGIES,
  OVERRIDE_ACTIONS,
  OVERRIDE_SIDES,
  RECURRENCE_TYPES,
} from "@/types/finance";

// Money is non-negative at every layer: the DB carries the same CHECK.
const decimal = moneySchema;

// Non-negative numeric rate.
const rate = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Must be a non-negative numeric rate");

// Monthly rates are DECIMALS (the UI says so: "0.02 = 2% per month"). Typing
// an APR or a percentage ("24" for 24%) meant 2,400% a month and a projection
// that exploded; anything above 1 (100% a month) is refused with a message
// that says how to write it.
export const MONTHLY_RATE_TOO_HIGH =
  "Monthly rate is a decimal: 0.02 means 2% per month. Values above 1 (100% a month) aren't valid — divide an annual % by 1200.";
const monthlyRate = rate.refine((v) => parseFloat(v) <= 1, MONTHLY_RATE_TOO_HIGH);

// A share of something (0..1) — surplus to debts, auto-invest, minimum
// payment percent.
export const SHARE_TOO_HIGH = "Use a decimal between 0 and 1 (0.03 means 3%).";
const share = rate.refine((v) => parseFloat(v) <= 1, SHARE_TOO_HIGH);

const isoDate = isoDateSchema;

const lineKind = z.enum(["recurring", "one_time"]);

// Recurrence model shared by income / expense / debt. monthly_day is the
// historical behaviour (and the default) so existing rows keep working with no
// migration of values — only the column type was added.
export const recurrenceTypeSchema = z.enum(RECURRENCE_TYPES);

// Fields a recurring entry can carry depending on recurrenceType. All optional
// at the validation surface; superRefine below enforces which ones are needed
// per type so we keep clear error paths.
const recurrenceFields = {
  recurrenceType: recurrenceTypeSchema.default("monthly_day"),
  weekOfMonth: z.number().int().min(1).max(5).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  intervalMonths: z.number().int().min(1).max(12).nullable().optional(),
  recurrenceStart: isoDate.nullable().optional(),
};

type RecurrenceShape = {
  recurrenceType?: RecurrenceTypeData;
  weekOfMonth?: number | null;
  dayOfWeek?: number | null;
  intervalMonths?: number | null;
  recurrenceStart?: string | null;
};

// Validates that fields specific to a recurrenceType are present when chosen.
// Pulled out so the same logic powers create + update for every line side.
function refineRecurrence<T extends RecurrenceShape>(val: T, ctx: z.RefinementCtx): void {
  if (val.recurrenceType === "monthly_weekday") {
    if (val.weekOfMonth == null) {
      ctx.addIssue({
        code: "custom",
        path: ["weekOfMonth"],
        message: "Pick which week (1–5) for monthly-weekday recurrence",
      });
    }
    if (val.dayOfWeek == null) {
      ctx.addIssue({
        code: "custom",
        path: ["dayOfWeek"],
        message: "Pick which weekday for monthly-weekday recurrence",
      });
    }
  } else if (val.recurrenceType === "every_n_months") {
    if (val.intervalMonths == null) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalMonths"],
        message: "Set the month interval (1–12)",
      });
    }
  }
}

export const planNameSchema = z.string().trim().min(1).max(120);

export const createFinancePlanSchema = z.object({
  name: planNameSchema,
  description: z.string().max(1000).optional().nullable(),
  startMonth: z.coerce.date(),
  monthsAhead: z.number().int().min(12).max(120),
  initialSavings: decimal.default("0"),
  monthlySavingsRate: monthlyRate.default("0"),
  includePortfolio: z.boolean().default(false),
  surplusToDebtsPercent: share.default("0"),
  debtStrategy: z.enum(DEBT_STRATEGIES).default("avalanche"),
  autoInvestPercent: share.default("0"),
  autoInvestMethodId: idSchema.nullable().optional(),
  initialInvestments: decimal.default("0"),
  // 0 = disabled monthly confirmation. Otherwise day of month 1..28.
  confirmationDayOfMonth: z.number().int().min(0).max(28).default(1),
  color: z.string().min(1).max(60).default("var(--chart-1)"),
});

/**
 * Colour-only update, so the rail's swatch picker doesn't have to round-trip
 * the whole plan through `updateFinancePlanSchema` (which requires every
 * field). Restricted to a theme token or a 6-digit hex: the value is written
 * straight into a `style` attribute and an SVG `stroke`, so arbitrary CSS has
 * no business there.
 */
export const planColorSchema = z.object({
  id: idSchema,
  color: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6}|var\(--chart-[1-5]\))$/, "Unsupported colour"),
});

export const updateFinancePlanSchema = createFinancePlanSchema.extend({
  id: idSchema,
  // Scenario link. Only settable via update (scenarios are created by cloning);
  // null detaches the scenario from its base plan.
  basedOnPlanId: idSchema.nullable().optional(),
});

/** Copy a plan (or branch a scenario off it) under a new name. */
export const cloneFinancePlanSchema = z.object({
  planId: idSchema,
  name: planNameSchema,
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
): void {
  if (val.kind === "one_time") {
    if (!val.date) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "One-time income requires a date",
      });
    }
    return;
  }
  // Recurring branch — start/end window + recurrence-specific fields.
  if (val.startDate && val.endDate && val.startDate > val.endDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be on or after start date",
    });
  }
  refineRecurrence(val, ctx);
}

export const planIncomeSchema = z.object(incomeShape).superRefine(refineIncome);
export const updatePlanIncomeSchema = z
  .object({ id: idSchema, ...incomeShape })
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
): void {
  if (val.kind === "one_time") {
    if (!val.date) {
      ctx.addIssue({
        code: "custom",
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
  .object({ id: idSchema, ...expenseShape })
  .superRefine(refineExpense);

// Debts are always recurring — the recurrence-type refinement runs
// unconditionally.
const debtShape = {
  name: z.string().min(1).max(120),
  initialBalance: decimal.default("0"),
  monthlyInterestRate: monthlyRate.default("0"),
  monthlyPayment: decimal.default("0"),
  paymentType: z.enum(DEBT_PAYMENT_TYPES).default("fixed"),
  minPaymentPercent: share.default("0"),
  minPaymentFloor: decimal.default("0"),
  // Day of the month the minimum payment is due. Null = treated as day 1 by
  // the calendar / projection — preserves behaviour for legacy debts.
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  ...recurrenceFields,
  sortOrder: z.number().optional(),
};

export const FIXED_DEBT_NEEDS_PAYMENT =
  "Fixed-payment debt with interest needs a non-zero monthly payment.";

function refineDebt(
  val: z.infer<z.ZodObject<typeof debtShape>>,
  ctx: z.RefinementCtx
): void {
  refineRecurrence(val, ctx);
  // A fixed payment of zero on a debt that accrues interest grows forever in
  // the projection, and a percent rule is the only other way it gets paid.
  if (
    val.paymentType === "fixed" &&
    parseFloat(val.monthlyPayment) === 0 &&
    parseFloat(val.monthlyInterestRate) > 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["monthlyPayment"],
      message: FIXED_DEBT_NEEDS_PAYMENT,
    });
  }
}

export const planDebtSchema = z.object(debtShape).superRefine(refineDebt);
export const updatePlanDebtSchema = z
  .object({ id: idSchema, ...debtShape })
  .superRefine(refineDebt);

// Per-month override for a recurring line. monthYear should be the FIRST of the
// targeted month ("2026-08-01") — the service normalises and persists it as is.
export const lineOverrideSchema = z
  .object({
    parentSide: z.enum(OVERRIDE_SIDES),
    parentId: idSchema,
    monthYear: isoDate,
    action: z.enum(OVERRIDE_ACTIONS),
    date: isoDate.nullable().optional(),
    monthlyAmount: decimal.nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === "reschedule" && !val.date) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: "Reschedule overrides require a target date",
      });
    }
    if (val.action === "amount" && (val.monthlyAmount == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyAmount"],
        message: "Amount overrides require an amount",
      });
    }
  });

export const deleteLineOverrideSchema = z.object({
  parentSide: z.enum(OVERRIDE_SIDES),
  parentId: idSchema,
  monthYear: isoDate,
});

export type RecurrenceTypeData = z.infer<typeof recurrenceTypeSchema>;
export type LineOverrideData = z.infer<typeof lineOverrideSchema>;
export type DeleteLineOverrideData = z.infer<typeof deleteLineOverrideSchema>;

/** What a caller may send: every defaulted field is optional here. */
export type CreateFinancePlanInput = z.input<typeof createFinancePlanSchema>;
export type CreateFinancePlanData = z.infer<typeof createFinancePlanSchema>;
export type UpdateFinancePlanInput = z.input<typeof updateFinancePlanSchema>;
export type UpdateFinancePlanData = z.infer<typeof updateFinancePlanSchema>;
export type CloneFinancePlanData = z.infer<typeof cloneFinancePlanSchema>;
export type PlanColorData = z.infer<typeof planColorSchema>;
export type PlanIncomeInput = z.input<typeof planIncomeSchema>;
export type PlanIncomeData = z.infer<typeof planIncomeSchema>;
export type UpdatePlanIncomeInput = z.input<typeof updatePlanIncomeSchema>;
export type UpdatePlanIncomeData = z.infer<typeof updatePlanIncomeSchema>;
export type PlanExpenseInput = z.input<typeof planExpenseSchema>;
export type PlanExpenseData = z.infer<typeof planExpenseSchema>;
export type UpdatePlanExpenseInput = z.input<typeof updatePlanExpenseSchema>;
export type UpdatePlanExpenseData = z.infer<typeof updatePlanExpenseSchema>;
export type PlanDebtInput = z.input<typeof planDebtSchema>;
export type PlanDebtData = z.infer<typeof planDebtSchema>;
export type UpdatePlanDebtInput = z.input<typeof updatePlanDebtSchema>;
export type UpdatePlanDebtData = z.infer<typeof updatePlanDebtSchema>;
