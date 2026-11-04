import "server-only";

import { randomUUID } from "node:crypto";

import { describeDebtFree, formatDebtFree } from "@/lib/finance/chart-series";
import { compareDebtStrategies } from "@/lib/finance/projection";
import { formatCurrency } from "@/lib/utils/format";
import {
  createFinancePlanSchema,
  planDebtSchema,
  planExpenseSchema,
  planIncomeSchema,
  updateFinancePlanSchema,
  updatePlanDebtSchema,
  updatePlanExpenseSchema,
  updatePlanIncomeSchema,
} from "@/schemas/finance";
import { planChangeSetSchema, type PlanChangeData, type PlanChangeSetInput } from "@/schemas/plans-assistant";
import type {
  FinancePlan,
  FinancePlanDebt,
  FinancePlanExpense,
  FinancePlanIncome,
  FinancePlanWithLines,
} from "@/types/finance";
import type {
  AppliedPlanChanges,
  PlanChangeLine,
  PlanEffect,
  PlanOutlook,
} from "@/types/plans-assistant";

import { getPlanWithLines, listUserPlansWithLines } from "./finance-plan-service";
import {
  addDebtOperation,
  addExpenseOperation,
  addIncomeOperation,
  copyPlanOperation,
  createPlanOperation,
  deleteDebtOperation,
  deleteExpenseOperation,
  deleteIncomeOperation,
  deletePlanOperation,
  PlanOperationError,
  setMainPlanOperation,
  updateDebtOperation,
  updateExpenseOperation,
  updateIncomeOperation,
  updatePlanOperation,
  type PlanOperationContext,
} from "./finance-plan-operations";
import { loadCalibratedView, openingBalancesToday, restateOpeningBalances } from "./finance-snapshot-service";
import { listInvestmentMethods } from "./investment-method-service";

/**
 * The plans assistant's reads and its one write path. Reads are compact
 * shapes for the model; the write path previews a proposal in memory with
 * the app's own projection, and applies it through the same operations the
 * plan forms use (`finance-plan-operations`).
 */

/** A refused proposal, with a message the model can act on. */
export class PlanChangeError extends Error {}

// ---------- outlook ----------

/** What a plan comes to: today's position and where the projection takes it. */
async function outlookOf(
  plan: FinancePlanWithLines,
  c: PlanOperationContext
): Promise<PlanOutlook> {
  const { projection, today } = await loadCalibratedView(plan, c.userId, c.today, { timeZone: c.timeZone });
  const anchor = plan.confirmationDayOfMonth > 0 ? plan.confirmationDayOfMonth : 1;
  const status = describeDebtFree(projection, anchor, c.today);
  const fromToday = today && today.status !== "before-start" ? today.periodIndex : -1;
  const in12 = projection.months[Math.min(projection.months.length - 1, fromToday + 12)];
  const last = projection.months.at(-1);
  return {
    netWorthToday: round(today?.netWorth ?? 0),
    cashToday: round(today?.savings ?? 0),
    debtToday: round(today?.totalDebt ?? 0),
    owedToUserToday: round(today?.receivables ?? 0),
    debtFree: formatDebtFree(status),
    netWorthIn12Months: round(in12?.netWorth ?? 0),
    netWorthAtEnd: round(last?.netWorth ?? 0),
    endMonth: last ? last.date.toISOString().slice(0, 7) : null,
    interestStillToPay: round(projection.totalInterestPaid),
  };
}

const round = (n: number): number => Math.round(n * 100) / 100;

// ---------- reads ----------

/** Every plan of the user's: what it is and what it comes to. */
export async function listAssistantPlans(c: PlanOperationContext): Promise<unknown[]> {
  const plans = await listUserPlansWithLines(c.userId);
  return Promise.all(
    plans.map(async (p) => ({
      id: p.id,
      name: p.name,
      isMain: p.isMain,
      basedOnPlanId: p.basedOnPlanId,
      lines: { incomes: p.incomes.length, expenses: p.expenses.length, debts: p.debts.length },
      outlook: await outlookOf(p, c),
    }))
  );
}

/** One plan in full: its settings, every line with its id, and its outlook. */
export async function getAssistantPlan(c: PlanOperationContext, planId: string): Promise<unknown | null> {
  const plan = (await listUserPlansWithLines(c.userId)).find((p) => p.id === planId);
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    isMain: plan.isMain,
    settings: settingsOf(plan),
    incomes: plan.incomes.map(lineOf),
    expenses: plan.expenses.map(lineOf),
    debts: plan.debts.map((d) => ({
      id: d.id,
      name: d.name,
      initialBalance: d.initialBalance,
      monthlyInterestRate: d.monthlyInterestRate,
      monthlyPayment: d.monthlyPayment,
      paymentType: d.paymentType,
      minPaymentPercent: d.minPaymentPercent,
      minPaymentFloor: d.minPaymentFloor,
      dayOfMonth: d.dayOfMonth,
      ...recurrenceOf(d),
    })),
    investmentMethods: (await listInvestmentMethods({ includeDisabled: true })).map((m) => ({
      id: m.id,
      name: m.name,
      monthlyRoiPercent: m.monthlyRoi,
      enabled: m.enabled,
    })),
    outlook: await outlookOf(plan, c),
  };
}

/** Avalanche, snowball and no extra payments side by side, at the plan's own surplus share. */
export async function compareAssistantStrategies(c: PlanOperationContext, planId: string): Promise<unknown | null> {
  const plan = (await listUserPlansWithLines(c.userId)).find((p) => p.id === planId);
  if (!plan) return null;
  const { baseline, options } = await loadCalibratedView(plan, c.userId, c.today, { timeZone: c.timeZone });
  const cmp = compareDebtStrategies(baseline, baseline.incomes, baseline.expenses, baseline.debts, options);
  const row = (o: typeof cmp.avalanche) => ({
    interestPaid: round(o.totalInterestPaid),
    debtFreeMonth: o.debtFreeDate ? o.debtFreeDate.toISOString().slice(0, 7) : null,
    netWorthAtEnd: round(o.endingNetWorth),
  });
  return {
    current: plan.debtStrategy,
    surplusToDebtsPercent: plan.surplusToDebtsPercent,
    avalanche: row(cmp.avalanche),
    snowball: row(cmp.snowball),
    none: row(cmp.none),
    recommended: cmp.recommended,
  };
}

function settingsOf(p: FinancePlan): Record<string, unknown> {
  return {
    startMonth: p.startMonth.toISOString().slice(0, 10),
    monthsAhead: p.monthsAhead,
    savingsAtOpening: p.initialSavings,
    investmentsAtOpening: p.initialInvestments,
    balancesAsOf: p.balancesAsOf,
    monthlySavingsRate: p.monthlySavingsRate,
    includePortfolio: p.includePortfolio,
    surplusToDebtsPercent: p.surplusToDebtsPercent,
    debtStrategy: p.debtStrategy,
    autoInvestPercent: p.autoInvestPercent,
    autoInvestMethodId: p.autoInvestMethodId,
    autoInvestCustomRate: p.autoInvestCustomRate,
    confirmationDayOfMonth: p.confirmationDayOfMonth,
  };
}

function recurrenceOf(l: {
  recurrenceType: string;
  weekOfMonth: number | null;
  dayOfWeek: number | null;
  intervalMonths: number | null;
  recurrenceStart: string | null;
}): Record<string, unknown> {
  return {
    recurrenceType: l.recurrenceType,
    weekOfMonth: l.weekOfMonth,
    dayOfWeek: l.dayOfWeek,
    intervalMonths: l.intervalMonths,
    recurrenceStart: l.recurrenceStart,
  };
}

function lineOf(l: FinancePlanIncome | FinancePlanExpense): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    amount: l.monthlyAmount,
    kind: l.kind,
    dayOfMonth: l.dayOfMonth,
    date: l.date,
    ...("owedToMe" in l
      ? { owedToMe: l.owedToMe, startDate: l.startDate, endDate: l.endDate }
      : {}),
    ...recurrenceOf(l),
  };
}

// ---------- the proposal, in memory ----------

type Working = {
  plans: Map<string, FinancePlanWithLines>;
  /** Plans created or copied by this proposal: ref → in-memory id. */
  refs: Map<string, string>;
  created: Set<string>;
  /**
   * Copies made by this proposal. In memory a copy keeps its source's line
   * ids, so a change to one of its lines names the source's id — the same id
   * Apply maps onto the stored copy.
   */
  copied: Set<string>;
  deleted: Set<string>;
  touched: Set<string>;
  lines: PlanChangeLine[];
};

/** The settings a change names, in the plan forms' field names. */
function formSettings(s: Record<string, unknown>): Record<string, unknown> {
  const { savingsToday, investmentsToday, ...rest } = s;
  return {
    ...rest,
    ...(savingsToday !== undefined ? { initialSavings: savingsToday } : {}),
    ...(investmentsToday !== undefined ? { initialInvestments: investmentsToday } : {}),
  };
}

/** A stored plan's settings as the update form sends them (balances left out: not edits). */
function planForm(p: FinancePlan): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startMonth: p.startMonth,
    monthsAhead: p.monthsAhead,
    monthlySavingsRate: p.monthlySavingsRate,
    includePortfolio: p.includePortfolio,
    surplusToDebtsPercent: p.surplusToDebtsPercent,
    debtStrategy: p.debtStrategy,
    autoInvestPercent: p.autoInvestPercent,
    autoInvestMethodId: p.autoInvestMethodId,
    autoInvestCustomRate: p.autoInvestCustomRate,
    confirmationDayOfMonth: p.confirmationDayOfMonth,
    color: p.color,
  };
}

function checked<T>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  value: unknown,
  where: string
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const path = issue.path.map(String).join(".");
  throw new PlanChangeError(`${where}: ${path ? `${path}: ` : ""}${issue.message}`);
}

function targetId(w: Working, change: { planId?: string; planRef?: string }): string {
  const id = change.planRef !== undefined ? w.refs.get(change.planRef) : change.planId;
  if (!id || !w.plans.has(id) || w.deleted.has(id)) {
    throw new PlanChangeError(
      change.planRef !== undefined
        ? `No plan with ref "${change.planRef}" is created before this change`
        : "No plan of the user's has that id"
    );
  }
  return id;
}

const money = (v: string | number | null | undefined): string => formatCurrency(Number(v ?? 0));

/** What a line is, in a few words for the card. */
function describeLine(l: { monthlyAmount: string; kind: string; dayOfMonth?: number | null; date?: string | null }): string {
  if (l.kind === "one_time") return `${money(l.monthlyAmount)} on ${l.date}`;
  return `${money(l.monthlyAmount)} a month${l.dayOfMonth ? ` on day ${l.dayOfMonth}` : ""}`;
}

/** Old → new for the fields a patch changes. */
function diff(before: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  return Object.entries(patch)
    .filter(([key, value]) => value !== undefined && String(before[key] ?? "") !== String(value ?? ""))
    .map(([key, value]) => `${key}: ${String(before[key] ?? "—")} → ${String(value ?? "—")}`);
}

/**
 * Plays a proposal on a copy of the user's plans: every patch merged over the
 * stored row and checked by the form schemas, opening balances restated the
 * way a save would restate them. Throws `PlanChangeError` on the first change
 * that would be refused.
 */
async function playProposal(c: PlanOperationContext, input: unknown): Promise<{ w: Working; set: { summary: string; changes: PlanChangeData[] } }> {
  const set = checked(planChangeSetSchema, input, "The proposal is not valid");
  const stored = await listUserPlansWithLines(c.userId);
  const w: Working = {
    plans: new Map(stored.map((p) => [p.id, structuredClone(p)])),
    refs: new Map(),
    created: new Set(),
    copied: new Set(),
    deleted: new Set(),
    touched: new Set(),
    lines: [],
  };

  for (const [i, change] of set.changes.entries()) {
    const where = `changes.${i} (${change.op})`;
    await playChange(c, w, change, where);
  }
  return { w, set };
}

async function playChange(c: PlanOperationContext, w: Working, change: PlanChangeData, where: string): Promise<void> {
  switch (change.op) {
    case "create_plan": {
      const data = checked(
        createFinancePlanSchema,
        {
          startMonth: new Date(Date.UTC(c.today.getUTCFullYear(), c.today.getUTCMonth(), 1)),
          monthsAhead: 120,
          ...formSettings(change.settings),
        },
        where
      );
      const id = randomUUID();
      const now = new Date();
      const plan: FinancePlanWithLines = {
        id,
        userId: c.userId,
        name: data.name,
        description: data.description ?? null,
        startMonth: data.startMonth,
        monthsAhead: data.monthsAhead,
        initialSavings: data.initialSavings,
        monthlySavingsRate: data.monthlySavingsRate,
        includePortfolio: data.includePortfolio,
        surplusToDebtsPercent: data.surplusToDebtsPercent,
        debtStrategy: data.debtStrategy,
        autoInvestPercent: data.autoInvestPercent,
        autoInvestMethodId: data.autoInvestMethodId ?? null,
        autoInvestCustomRate: data.autoInvestCustomRate ?? null,
        initialInvestments: data.initialInvestments,
        confirmationDayOfMonth: data.confirmationDayOfMonth,
        color: data.color,
        isMain: w.plans.size === 0,
        basedOnPlanId: null,
        balancesAsOf: c.today.toISOString().slice(0, 10),
        createdAt: now,
        updatedAt: now,
        incomes: [],
        expenses: [],
        debts: [],
        overrides: [],
      };
      w.plans.set(id, plan);
      w.refs.set(change.ref, id);
      w.created.add(id);
      w.touched.add(id);
      w.lines.push({ action: "create", subject: "plan", planName: plan.name, title: plan.name, details: [] });
      return;
    }

    case "copy_plan": {
      const source = w.plans.get(targetId(w, { planId: change.fromPlanId }))!;
      const name = checked(createFinancePlanSchema.shape.name, change.name, where);
      const id = randomUUID();
      const now = new Date();
      // It opens where the source stands today, as Apply's copy will.
      const opening = await openingBalancesToday(source, c.userId, c.today, c.timeZone);
      const copy = structuredClone(source);
      Object.assign(copy, {
        id,
        name,
        isMain: false,
        basedOnPlanId: change.asScenario ? source.id : null,
        initialSavings: opening.initialSavings,
        initialInvestments: opening.initialInvestments,
        balancesAsOf: opening.balancesAsOf,
        createdAt: now,
        updatedAt: now,
      });
      for (const d of copy.debts) d.initialBalance = opening.debtBalances[d.id] ?? d.initialBalance;
      for (const l of [...copy.incomes, ...copy.expenses, ...copy.debts, ...copy.overrides]) l.planId = id;
      w.plans.set(id, copy);
      w.refs.set(change.ref, id);
      w.copied.add(id);
      w.touched.add(id);
      w.lines.push({ action: "create", subject: "plan", planName: name, title: name, details: [`Copy of ${source.name}`] });
      return;
    }

    case "update_plan": {
      const id = targetId(w, change);
      const plan = w.plans.get(id)!;
      const patch = formSettings(change.settings);
      const data = checked(updateFinancePlanSchema, { ...planForm(plan), ...patch }, where);
      const edits = {
        ...(data.initialSavings !== undefined ? { savings: data.initialSavings } : {}),
        ...(data.initialInvestments !== undefined ? { investments: data.initialInvestments } : {}),
      };
      await restate(c, w, id, edits);
      Object.assign(plan, {
        name: data.name,
        description: data.description ?? null,
        startMonth: data.startMonth,
        monthsAhead: data.monthsAhead,
        monthlySavingsRate: data.monthlySavingsRate,
        includePortfolio: data.includePortfolio,
        surplusToDebtsPercent: data.surplusToDebtsPercent,
        debtStrategy: data.debtStrategy,
        autoInvestPercent: data.autoInvestPercent,
        autoInvestMethodId: data.autoInvestMethodId ?? null,
        autoInvestCustomRate: data.autoInvestCustomRate ?? null,
        confirmationDayOfMonth: data.confirmationDayOfMonth,
      });
      w.touched.add(id);
      w.lines.push({
        action: "update",
        subject: "plan",
        planName: plan.name,
        title: "Settings",
        details: diff({ ...settingsOf(plan), name: plan.name }, change.settings as Record<string, unknown>),
      });
      return;
    }

    case "set_main_plan": {
      const id = targetId(w, change);
      for (const p of w.plans.values()) p.isMain = p.id === id;
      w.lines.push({ action: "update", subject: "plan", planName: w.plans.get(id)!.name, title: "Main plan", details: [] });
      return;
    }

    case "delete_plan": {
      const id = targetId(w, change);
      w.deleted.add(id);
      w.lines.push({ action: "remove", subject: "plan", planName: w.plans.get(id)!.name, title: w.plans.get(id)!.name, details: [] });
      return;
    }

    case "add_income": {
      const id = targetId(w, change);
      const data = checked(planIncomeSchema, change.income, where);
      const plan = w.plans.get(id)!;
      plan.incomes.push(row<FinancePlanIncome>(id, data));
      w.touched.add(id);
      w.lines.push({ action: "add", subject: "income", planName: plan.name, title: data.name, details: [describeLine(data)] });
      return;
    }
    case "update_income": {
      const plan = w.plans.get(targetId(w, change))!;
      const at = plan.incomes.findIndex((l) => l.id === change.incomeId);
      if (at === -1) throw new PlanChangeError(`${where}: no income of this plan has that id`);
      const data = checked(updatePlanIncomeSchema, { ...plan.incomes[at], ...change.changes, id: change.incomeId }, where);
      w.lines.push({ action: "update", subject: "income", planName: plan.name, title: plan.incomes[at].name, details: diff(plan.incomes[at], change.changes) });
      plan.incomes[at] = { ...plan.incomes[at], ...data } as FinancePlanIncome;
      w.touched.add(plan.id);
      return;
    }
    case "remove_income": {
      const plan = w.plans.get(targetId(w, change))!;
      const line = plan.incomes.find((l) => l.id === change.incomeId);
      if (!line) throw new PlanChangeError(`${where}: no income of this plan has that id`);
      plan.incomes = plan.incomes.filter((l) => l.id !== line.id);
      plan.overrides = plan.overrides.filter((o) => o.parentId !== line.id);
      w.touched.add(plan.id);
      w.lines.push({ action: "remove", subject: "income", planName: plan.name, title: line.name, details: [describeLine(line)] });
      return;
    }

    case "add_expense": {
      const id = targetId(w, change);
      const data = checked(planExpenseSchema, change.expense, where);
      const plan = w.plans.get(id)!;
      plan.expenses.push(row<FinancePlanExpense>(id, data));
      w.touched.add(id);
      w.lines.push({ action: "add", subject: "expense", planName: plan.name, title: data.name, details: [describeLine(data)] });
      return;
    }
    case "update_expense": {
      const plan = w.plans.get(targetId(w, change))!;
      const at = plan.expenses.findIndex((l) => l.id === change.expenseId);
      if (at === -1) throw new PlanChangeError(`${where}: no expense of this plan has that id`);
      const data = checked(updatePlanExpenseSchema, { ...plan.expenses[at], ...change.changes, id: change.expenseId }, where);
      w.lines.push({ action: "update", subject: "expense", planName: plan.name, title: plan.expenses[at].name, details: diff(plan.expenses[at], change.changes) });
      plan.expenses[at] = { ...plan.expenses[at], ...data } as FinancePlanExpense;
      w.touched.add(plan.id);
      return;
    }
    case "remove_expense": {
      const plan = w.plans.get(targetId(w, change))!;
      const line = plan.expenses.find((l) => l.id === change.expenseId);
      if (!line) throw new PlanChangeError(`${where}: no expense of this plan has that id`);
      plan.expenses = plan.expenses.filter((l) => l.id !== line.id);
      plan.overrides = plan.overrides.filter((o) => o.parentId !== line.id);
      w.touched.add(plan.id);
      w.lines.push({ action: "remove", subject: "expense", planName: plan.name, title: line.name, details: [describeLine(line)] });
      return;
    }

    case "add_debt": {
      const id = targetId(w, change);
      const data = checked(planDebtSchema, change.debt, where);
      await restate(c, w, id, { addedDebtBalance: data.initialBalance });
      const plan = w.plans.get(id)!;
      plan.debts.push(row<FinancePlanDebt>(id, data));
      w.touched.add(id);
      w.lines.push({
        action: "add",
        subject: "debt",
        planName: plan.name,
        title: data.name,
        details: [`${money(data.initialBalance)} owed`, `${money(data.monthlyPayment)} a month`],
      });
      return;
    }
    case "update_debt": {
      const plan = w.plans.get(targetId(w, change))!;
      const at = plan.debts.findIndex((d) => d.id === change.debtId);
      if (at === -1) throw new PlanChangeError(`${where}: no debt of this plan has that id`);
      const data = checked(updatePlanDebtSchema, { ...plan.debts[at], ...change.changes, id: change.debtId }, where);
      await restate(c, w, plan.id, { debts: { [data.id]: data.initialBalance } });
      w.lines.push({ action: "update", subject: "debt", planName: plan.name, title: plan.debts[at].name, details: diff(plan.debts[at], change.changes) });
      plan.debts[at] = { ...plan.debts[at], ...data } as FinancePlanDebt;
      w.touched.add(plan.id);
      return;
    }
    case "remove_debt": {
      const plan = w.plans.get(targetId(w, change))!;
      const debt = plan.debts.find((d) => d.id === change.debtId);
      if (!debt) throw new PlanChangeError(`${where}: no debt of this plan has that id`);
      plan.debts = plan.debts.filter((d) => d.id !== debt.id);
      plan.overrides = plan.overrides.filter((o) => o.parentId !== debt.id);
      w.touched.add(plan.id);
      w.lines.push({ action: "remove", subject: "debt", planName: plan.name, title: debt.name, details: [`${money(debt.initialBalance)} owed`] });
      return;
    }
  }
}

/** A new line as the table would hold it. */
function row<T>(planId: string, data: object): T {
  const now = new Date();
  return {
    id: randomUUID(),
    planId,
    sortOrder: 0,
    dayOfMonth: null,
    date: null,
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: null,
    recurrenceStart: null,
    createdAt: now,
    updatedAt: now,
    ...data,
  } as T;
}

/**
 * Restates the working plan's opening balances as a save would: edits to
 * savings, investments or a debt re-date the whole set to today, rolling the
 * untouched figures forward. A plan this proposal created is already as of
 * today.
 */
async function restate(
  c: PlanOperationContext,
  w: Working,
  planId: string,
  edits: Parameters<typeof restateOpeningBalances>[3]
): Promise<void> {
  const plan = w.plans.get(planId)!;
  if (w.created.has(planId)) {
    if (edits.savings !== undefined) plan.initialSavings = edits.savings;
    if (edits.investments !== undefined) plan.initialInvestments = edits.investments;
    return;
  }
  const r = await restateOpeningBalances(plan, c.userId, c.today, edits, c.timeZone);
  if (!r) return;
  plan.initialSavings = edits.savings ?? r.initialSavings;
  plan.initialInvestments = edits.investments ?? r.initialInvestments;
  plan.balancesAsOf = r.balancesAsOf;
  for (const d of plan.debts) {
    const balance = edits.debts?.[d.id] ?? r.debtBalances[d.id];
    if (balance !== undefined) d.initialBalance = balance;
  }
}

/** Every touched plan's outlook before and after. */
async function effectsOf(c: PlanOperationContext, w: Working): Promise<PlanEffect[]> {
  const stored = new Map((await listUserPlansWithLines(c.userId)).map((p) => [p.id, p]));
  return Promise.all(
    [...w.touched]
      .filter((id) => !w.deleted.has(id))
      .map(async (id) => {
        const after = w.plans.get(id)!;
        const before = stored.get(id);
        const isNew = w.created.has(id) || w.copied.has(id);
        return {
          planId: isNew ? null : id,
          planName: after.name,
          isNew,
          before: before ? await outlookOf(before, c) : null,
          after: await outlookOf(after, c),
        };
      })
  );
}

/** What the card shows: each change in words, and each plan's outlook before and after. */
export async function previewPlanChanges(
  c: PlanOperationContext,
  input: PlanChangeSetInput
): Promise<{ lines: PlanChangeLine[]; effects: PlanEffect[] }> {
  const { w } = await playProposal(c, input);
  return { lines: w.lines, effects: await effectsOf(c, w) };
}

// ---------- apply ----------

/**
 * Writes a proposal the user approved. The whole proposal is played and
 * checked first (nothing is written if any change would be refused); then
 * each change runs through its plan operation, in order. Should one still
 * fail, the ones before it stay applied and the error says where it stopped.
 */
export async function applyPlanChanges(
  c: PlanOperationContext,
  input: PlanChangeSetInput
): Promise<AppliedPlanChanges> {
  const { w, set } = await playProposal(c, input);
  const stored = new Map((await listUserPlansWithLines(c.userId)).map((p) => [p.id, p]));
  const created = new Map<string, string>();
  const real = (change: { planId?: string; planRef?: string }): string =>
    change.planRef !== undefined ? created.get(change.planRef)! : change.planId!;
  const createdPlans: { ref: string; id: string; name: string }[] = [];
  const copies = new Map<string, ReadonlyMap<string, string>>();
  // A copy's lines are named by the source's ids (see `Working.copied`).
  const line = (planId: string, side: "income" | "expense" | "debt", id: string): string =>
    copies.get(planId)?.get(`${side}:${id}`) ?? id;
  const at: Applying = { c, real, line, stored, created, createdPlans, copies };

  for (const [i, change] of set.changes.entries()) {
    try {
      await applyChange(at, change);
    } catch (err) {
      if (err instanceof PlanOperationError) {
        throw new PlanChangeError(
          i === 0
            ? `Nothing was saved: ${err.message}`
            : `Saved the first ${i} change${i === 1 ? "" : "s"}, then stopped at changes.${i} (${change.op}): ${err.message}`
        );
      }
      throw err;
    }
  }
  return { lines: w.lines, createdPlans };
}

type Applying = {
  c: PlanOperationContext;
  /** The stored id of the plan a change names. */
  real: (change: { planId?: string; planRef?: string }) => string;
  /** The stored id of the line a change names on that plan. */
  line: (planId: string, side: "income" | "expense" | "debt", id: string) => string;
  stored: Map<string, FinancePlanWithLines>;
  created: Map<string, string>;
  createdPlans: { ref: string; id: string; name: string }[];
  copies: Map<string, ReadonlyMap<string, string>>;
};

async function applyChange(
  { c, real, line, stored, created, createdPlans, copies }: Applying,
  change: PlanChangeData
): Promise<void> {
  const current = (id: string): FinancePlanWithLines => {
    const plan = stored.get(id);
    if (!plan) throw new PlanOperationError("That plan is gone");
    return plan;
  };
  switch (change.op) {
    case "create_plan": {
      const plan = await createPlanOperation(c, {
        startMonth: new Date(Date.UTC(c.today.getUTCFullYear(), c.today.getUTCMonth(), 1)),
        monthsAhead: 120,
        ...formSettings(change.settings),
      });
      created.set(change.ref, plan.id);
      stored.set(plan.id, { ...plan, incomes: [], expenses: [], debts: [], overrides: [] });
      createdPlans.push({ ref: change.ref, id: plan.id, name: plan.name });
      return;
    }
    case "copy_plan": {
      const { plan, lineIds } = await copyPlanOperation(c, {
        planId: change.fromPlanId,
        name: change.name,
        asScenario: change.asScenario,
      });
      created.set(change.ref, plan.id);
      copies.set(plan.id, lineIds);
      const copy = await getPlanWithLines(plan.id, c.userId);
      if (copy) stored.set(plan.id, copy);
      createdPlans.push({ ref: change.ref, id: plan.id, name: plan.name });
      return;
    }
    case "update_plan": {
      const id = real(change);
      const plan = await updatePlanOperation(c, { ...planForm(current(id)), ...formSettings(change.settings) });
      stored.set(id, { ...current(id), ...plan });
      return;
    }
    case "set_main_plan":
      return setMainPlanOperation(c, real(change));
    case "delete_plan":
      return deletePlanOperation(c, change.planId);

    case "add_income":
      await addIncomeOperation(c, real(change), change.income);
      return;
    case "update_income": {
      const planId = real(change);
      const id = line(planId, "income", change.incomeId);
      const row = current(planId).incomes.find((l) => l.id === id);
      await updateIncomeOperation(c, planId, { ...row, ...change.changes, id });
      return;
    }
    case "remove_income": {
      const planId = real(change);
      return deleteIncomeOperation(c, planId, line(planId, "income", change.incomeId));
    }

    case "add_expense":
      await addExpenseOperation(c, real(change), change.expense);
      return;
    case "update_expense": {
      const planId = real(change);
      const id = line(planId, "expense", change.expenseId);
      const row = current(planId).expenses.find((l) => l.id === id);
      await updateExpenseOperation(c, planId, { ...row, ...change.changes, id });
      return;
    }
    case "remove_expense": {
      const planId = real(change);
      return deleteExpenseOperation(c, planId, line(planId, "expense", change.expenseId));
    }

    case "add_debt":
      await addDebtOperation(c, real(change), change.debt);
      return;
    case "update_debt": {
      const planId = real(change);
      const id = line(planId, "debt", change.debtId);
      const debt = current(planId).debts.find((d) => d.id === id);
      await updateDebtOperation(c, planId, { ...debt, ...change.changes, id });
      return;
    }
    case "remove_debt": {
      const planId = real(change);
      return deleteDebtOperation(c, planId, line(planId, "debt", change.debtId));
    }
  }
}
