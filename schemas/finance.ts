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

// Shared rules:
//   - recurring requires dayOfMonth (defaults to 1 if omitted at the action layer)
//   - one_time requires a `date`
//   - one_time must not have startDate/endDate (those are recurring-only concepts)
// The rules are encoded as refinements so the action layer gets clear errors.

export const planIncomeSchema = z
  .object({
    name: z.string().min(1).max(120),
    monthlyAmount: decimal.default("0"),
    kind: lineKind.default("recurring"),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    date: isoDate.nullable().optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
    sortOrder: z.number().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "one_time") {
      if (!val.date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date"],
          message: "One-time income requires a date",
        });
      }
    }
    if (val.kind === "recurring" && val.startDate && val.endDate) {
      if (val.startDate > val.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "End date must be on or after start date",
        });
      }
    }
  });

export const updatePlanIncomeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120),
    monthlyAmount: decimal.default("0"),
    kind: lineKind.default("recurring"),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    date: isoDate.nullable().optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
    sortOrder: z.number().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "one_time" && !val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "One-time income requires a date",
      });
    }
    if (val.kind === "recurring" && val.startDate && val.endDate && val.startDate > val.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
  });

export const planExpenseSchema = z
  .object({
    name: z.string().min(1).max(120),
    monthlyAmount: decimal.default("0"),
    kind: lineKind.default("recurring"),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    date: isoDate.nullable().optional(),
    sortOrder: z.number().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "one_time" && !val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "One-time expense requires a date",
      });
    }
  });

export const updatePlanExpenseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120),
    monthlyAmount: decimal.default("0"),
    kind: lineKind.default("recurring"),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    date: isoDate.nullable().optional(),
    sortOrder: z.number().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "one_time" && !val.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "One-time expense requires a date",
      });
    }
  });

export const planDebtSchema = z.object({
  name: z.string().min(1).max(120),
  initialBalance: decimal.default("0"),
  monthlyInterestRate: rate.default("0"),
  monthlyPayment: decimal.default("0"),
  paymentType: z.enum(["fixed", "percent_of_balance"]).default("fixed"),
  minPaymentPercent: rate.default("0"),
  minPaymentFloor: decimal.default("0"),
  sortOrder: z.number().optional(),
});

export const updatePlanDebtSchema = planDebtSchema.extend({
  id: z.string().uuid(),
});

export type CreateFinancePlanInput = z.infer<typeof createFinancePlanSchema>;
export type UpdateFinancePlanInput = z.infer<typeof updateFinancePlanSchema>;
export type PlanIncomeInput = z.infer<typeof planIncomeSchema>;
export type UpdatePlanIncomeInput = z.infer<typeof updatePlanIncomeSchema>;
export type PlanExpenseInput = z.infer<typeof planExpenseSchema>;
export type UpdatePlanExpenseInput = z.infer<typeof updatePlanExpenseSchema>;
export type PlanDebtInput = z.infer<typeof planDebtSchema>;
export type UpdatePlanDebtInput = z.infer<typeof updatePlanDebtSchema>;
