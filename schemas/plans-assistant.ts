import { z } from "zod";

import { idSchema, isoDateSchema, moneySchema } from "@/schemas/common";
import { DEBT_PAYMENT_TYPES, DEBT_STRATEGIES, RECURRENCE_TYPES } from "@/types/finance";

/**
 * What the plans assistant may propose, and what Apply re-checks.
 *
 * Fields are patches over the stored rows, never whole rows: the model names
 * only what it changes, and the service merges that over what is stored before
 * validating the result with the same schemas the plan forms use. The
 * descriptions are read by the model — they are the tool's documentation.
 */

/** The model writes 450 as often as "450.00"; both land as the column's string. */
const money = z
  .union([z.number().nonnegative(), moneySchema])
  .transform((v) => (typeof v === "number" ? v.toFixed(2) : v));

/** A decimal rate or share: 0.02 is 2%. A number or its string. */
const decimalRate = (what: string) =>
  z
    .union([z.number().nonnegative().max(1), z.string().regex(/^\d+(\.\d{1,6})?$/)])
    .transform((v) => (typeof v === "number" ? String(Number(v.toFixed(6))) : v))
    .describe(`${what} as a DECIMAL: 0.02 means 2%. Never a percentage like 2 or 24.`);

const ref = z
  .string()
  .regex(/^[a-z0-9-]{1,40}$/)
  .describe("A short name for a plan created in this proposal, e.g. \"aggressive\", that later changes point to with planRef");

/** Exactly one of planId / planRef, checked on the whole set. */
const planTarget = {
  planId: idSchema.optional().describe("An existing plan's id, from list_plans"),
  planRef: ref.optional().describe("The ref of a plan created earlier in this proposal"),
};

const planSettings = {
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  startMonth: isoDateSchema
    .optional()
    .describe("First month of the plan, the 1st of a month: YYYY-MM-01. New plans: the current month"),
  monthsAhead: z.number().int().min(12).max(120).optional().describe("How many months it projects, 12–120"),
  savingsToday: z
    .union([z.number(), z.string().regex(/^-?\d+(\.\d{1,2})?$/)])
    .transform((v) => (typeof v === "number" ? v.toFixed(2) : v))
    .optional()
    .describe("Cash the user holds today. Changing it restates the plan's opening balances as of today"),
  investmentsToday: money.optional().describe("The plan's investments bucket today (not the live portfolio)"),
  monthlySavingsRate: decimalRate("Monthly interest earned on cash").optional(),
  includePortfolio: z
    .boolean()
    .optional()
    .describe("Count the user's live portfolio (and assets they manage for others) in net worth"),
  surplusToDebtsPercent: decimalRate("Share of each period's leftover sent to extra debt payments (1 = all of it)").optional(),
  debtStrategy: z
    .enum(DEBT_STRATEGIES)
    .optional()
    .describe("avalanche: highest interest first (least interest). snowball: smallest balance first. none: no extra payments"),
  autoInvestPercent: decimalRate("Share of what remains after debts that is invested (the rest stays as cash)").optional(),
  autoInvestMethodId: idSchema
    .nullable()
    .optional()
    .describe("The investment method the invested share grows at (its monthly ROI), from get_plan's investmentMethods"),
  autoInvestCustomRate: decimalRate("A monthly return of the user's choosing for the invested share, instead of a method's")
    .nullable()
    .optional(),
  confirmationDayOfMonth: z
    .number()
    .int()
    .min(0)
    .max(28)
    .optional()
    .describe("Day each accounting period starts and the user confirms their actual balances (1–28; 0 turns it off)"),
};

const recurrence = {
  recurrenceType: z
    .enum(RECURRENCE_TYPES)
    .optional()
    .describe("monthly_day: on dayOfMonth. monthly_weekday: the weekOfMonth-th dayOfWeek. every_n_months: every intervalMonths months from recurrenceStart"),
  weekOfMonth: z.number().int().min(1).max(5).nullable().optional().describe("1–5 (5 = the last one)"),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional().describe("0 Sunday … 6 Saturday"),
  intervalMonths: z.number().int().min(1).max(12).nullable().optional(),
  recurrenceStart: isoDateSchema.nullable().optional().describe("First month of an every_n_months line, YYYY-MM-01"),
};

const lineFields = {
  name: z.string().trim().min(1).max(120).optional(),
  monthlyAmount: money.optional().describe("The amount of each occurrence (despite the name, not only monthly lines)"),
  kind: z.enum(["recurring", "one_time"]).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional().describe("Day it lands, for monthly_day lines"),
  date: isoDateSchema.nullable().optional().describe("The day of a one_time line, YYYY-MM-DD"),
  ...recurrence,
};

const incomeFields = {
  ...lineFields,
  owedToMe: z
    .boolean()
    .optional()
    .describe("Someone paying back money they owe the user: counts in net worth before it lands. Recurring ones need an endDate"),
  startDate: isoDateSchema.nullable().optional().describe("First day a recurring income applies"),
  endDate: isoDateSchema.nullable().optional().describe("Last day a recurring income applies"),
};

const debtFields = {
  name: z.string().trim().min(1).max(120).optional(),
  initialBalance: money.optional().describe("What is owed today. Changing it restates the opening balances as of today"),
  monthlyInterestRate: decimalRate("Monthly interest: an annual 24% is 0.02").optional(),
  monthlyPayment: money.optional().describe("The fixed monthly payment"),
  paymentType: z
    .enum(DEBT_PAYMENT_TYPES)
    .optional()
    .describe("fixed: monthlyPayment. Otherwise a minimum of minPaymentPercent of the balance, at least minPaymentFloor"),
  minPaymentPercent: decimalRate("Minimum payment as a share of the balance").optional(),
  minPaymentFloor: money.optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional().describe("Day the payment is due"),
  ...recurrence,
};

const lineId = (side: string) =>
  idSchema.describe(
    `The ${side}'s id, from get_plan. On a plan copied in this proposal (planRef), the id of the same line in the plan it was copied from`
  );

export const planChangeSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create_plan"),
    ref,
    settings: z.object(planSettings).extend({ name: z.string().trim().min(1).max(120) }),
  }),
  z.object({
    op: z.literal("copy_plan"),
    ref,
    fromPlanId: idSchema.describe("The plan to copy, from list_plans: its settings, balances and every line"),
    name: z.string().trim().min(1).max(120),
    asScenario: z
      .boolean()
      .optional()
      .describe("A what-if of the plan it copies: the copy's chart overlays the source's line. Usually true"),
  }),
  z.object({ op: z.literal("update_plan"), ...planTarget, settings: z.object(planSettings) }),
  z.object({ op: z.literal("set_main_plan"), ...planTarget }),
  z.object({ op: z.literal("delete_plan"), planId: idSchema }),

  z.object({
    op: z.literal("add_income"),
    ...planTarget,
    income: z.object(incomeFields).extend({ name: z.string().trim().min(1).max(120), monthlyAmount: money }),
  }),
  z.object({ op: z.literal("update_income"), ...planTarget, incomeId: lineId("income"), changes: z.object(incomeFields) }),
  z.object({ op: z.literal("remove_income"), ...planTarget, incomeId: lineId("income") }),

  z.object({
    op: z.literal("add_expense"),
    ...planTarget,
    expense: z.object(lineFields).extend({ name: z.string().trim().min(1).max(120), monthlyAmount: money }),
  }),
  z.object({ op: z.literal("update_expense"), ...planTarget, expenseId: lineId("expense"), changes: z.object(lineFields) }),
  z.object({ op: z.literal("remove_expense"), ...planTarget, expenseId: lineId("expense") }),

  z.object({
    op: z.literal("add_debt"),
    ...planTarget,
    debt: z.object(debtFields).extend({ name: z.string().trim().min(1).max(120), initialBalance: money }),
  }),
  z.object({ op: z.literal("update_debt"), ...planTarget, debtId: lineId("debt"), changes: z.object(debtFields) }),
  z.object({ op: z.literal("remove_debt"), ...planTarget, debtId: lineId("debt") }),
]);

export type PlanChangeData = z.output<typeof planChangeSchema>;
export type PlanChangeInput = z.input<typeof planChangeSchema>;

export const planChangeSetSchema = z
  .object({
    summary: z.string().trim().min(1).max(200).describe("One line naming the proposal, in the user's language"),
    changes: z.array(planChangeSchema).min(1).max(40).describe("Applied in order"),
  })
  .superRefine((set, ctx) => {
    const refs = new Set<string>();
    set.changes.forEach((change, i) => {
      if (change.op === "create_plan" || change.op === "copy_plan") {
        if (refs.has(change.ref)) {
          ctx.addIssue({ code: "custom", path: ["changes", i, "ref"], message: "Each new plan needs its own ref" });
        }
        refs.add(change.ref);
        return;
      }
      const target = change as { planId?: string; planRef?: string };
      const named = Number(target.planId !== undefined) + Number(target.planRef !== undefined);
      if (named !== 1) {
        ctx.addIssue({ code: "custom", path: ["changes", i], message: "Name the plan with planId or planRef: exactly one of them" });
      } else if (target.planRef !== undefined && !refs.has(target.planRef)) {
        ctx.addIssue({
          code: "custom",
          path: ["changes", i, "planRef"],
          message: `No plan with ref "${target.planRef}" is created before this change`,
        });
      }
    });
  });

export type PlanChangeSetData = z.output<typeof planChangeSetSchema>;
export type PlanChangeSetInput = z.input<typeof planChangeSetSchema>;

export const planIdInputSchema = z.object({ planId: idSchema.describe("A plan's id, from list_plans") });
