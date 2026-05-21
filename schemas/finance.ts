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

export const planLineSchema = z.object({
  name: z.string().min(1).max(120),
  monthlyAmount: decimal.default("0"),
  sortOrder: z.number().optional(),
});

export const updatePlanLineSchema = planLineSchema.extend({
  id: z.string().uuid(),
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
export type PlanLineInput = z.infer<typeof planLineSchema>;
export type UpdatePlanLineInput = z.infer<typeof updatePlanLineSchema>;
export type PlanDebtInput = z.infer<typeof planDebtSchema>;
export type UpdatePlanDebtInput = z.infer<typeof updatePlanDebtSchema>;
