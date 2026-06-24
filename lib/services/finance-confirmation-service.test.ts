import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The service exercises three db shapes:
//   - chainable selects: db.select().from().where()[.orderBy().limit()]
//   - chainable insert (in saveConfirmation's tx) with onConflictDoUpdate +
//     returning
//   - db.transaction(cb) which is invoked with a `tx` that mirrors the same
//     surface as `db` for insert / delete.
// We expose mutable mocks per chain so individual tests can stub responses and
// then assert on the call args.

const selectImpl = vi.fn();
const insertImpl = vi.fn();
const deleteImpl = vi.fn();
const txInsertImpl = vi.fn();
const txDeleteImpl = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => selectImpl(...args),
    insert: (...args: unknown[]) => insertImpl(...args),
    delete: (...args: unknown[]) => deleteImpl(...args),
    transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: (...args: unknown[]) => txInsertImpl(...args),
        delete: (...args: unknown[]) => txDeleteImpl(...args),
      }),
  },
}));

// Dependencies pulled in by the service. We stub them at the import boundary
// so we never execute the real projection / snapshot machinery.
const getPlanWithLinesMock = vi.fn();
vi.mock("./finance-plan-service", () => ({
  getPlanWithLines: (...args: unknown[]) => getPlanWithLinesMock(...args),
}));

const getProjectedStateForMonthMock = vi.fn();
const createConfirmationSnapshotMock = vi.fn();
vi.mock("./finance-snapshot-service", () => ({
  getProjectedStateForMonth: (...args: unknown[]) =>
    getProjectedStateForMonthMock(...args),
  createConfirmationSnapshot: (...args: unknown[]) =>
    createConfirmationSnapshotMock(...args),
}));

import {
  autoConfirmSkippedPeriods,
  getConfirmationStatus,
  getLatestConfirmation,
  getPlanForConfirmation,
  saveConfirmation,
} from "./finance-confirmation-service";
import type {
  FinancePlanConfirmation,
  FinancePlanDebtConfirmation,
  FinancePlanWithLines,
  ProjectionMonth,
} from "@/types/finance";

const PLAN_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";

// ---------- helpers ----------

function buildPlan(
  overrides: Partial<FinancePlanWithLines> = {}
): FinancePlanWithLines {
  const base = {
    id: PLAN_ID,
    userId: USER_ID,
    name: "Test Plan",
    description: null,
    startMonth: new Date(Date.UTC(2026, 0, 1)),
    monthsAhead: 12,
    initialSavings: "0",
    monthlySavingsRate: "0",
    includePortfolio: false,
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche",
    confirmationDayOfMonth: 1,
    autoInvestPercent: "0",
    autoInvestMethodId: null,
    initialInvestments: "0",
    color: "var(--chart-1)",
    createdAt: new Date(),
    updatedAt: new Date(),
    incomes: [],
    expenses: [],
    debts: [],
    overrides: [],
    ...overrides,
  };
  return base as unknown as FinancePlanWithLines;
}

function buildProjectionMonth(): ProjectionMonth {
  return {
    monthOffset: 0,
    date: new Date(Date.UTC(2026, 4, 1)),
    income: 5000,
    expenses: 2000,
    scheduledDebtPayments: 0,
    extraDebtPayments: 0,
    debtPayments: 0,
    totalInterestAccrued: 0,
    cashFlow: 3000,
    savings: 12000,
    savingsInterest: 0,
    investments: 5000,
    investmentsContribution: 0,
    investmentsInterest: 0,
    totalDebt: 0,
    portfolioValue: 0,
    netWorth: 17000,
    debts: [],
  };
}

// Build a Drizzle-style select chain that is also a thenable. Every builder
// method returns the same object; awaiting at ANY point resolves with `rows`.
// This lets one helper cover both `.from().where()` and
// `.from().where().orderBy().limit()` shapes.
function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    then: (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ): Promise<unknown> => Promise.resolve(rows).then(resolve, reject),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function buildConfirmation(
  overrides: Partial<FinancePlanConfirmation> = {}
): FinancePlanConfirmation {
  const base = {
    id: "conf-1",
    planId: PLAN_ID,
    confirmationMonth: "2026-05-01",
    confirmedSavings: "12345.67",
    confirmedInvestments: "9876.54",
    notes: null,
    confirmedAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlanConfirmation;
}

function buildDebtConfirmation(
  overrides: Partial<FinancePlanDebtConfirmation> = {}
): FinancePlanDebtConfirmation {
  const base = {
    id: "debt-conf-1",
    confirmationId: "conf-1",
    debtId: "debt-1",
    confirmedBalance: "1000.00",
    createdAt: new Date(),
    ...overrides,
  };
  return base as unknown as FinancePlanDebtConfirmation;
}

afterEach(() => {
  // Reset both call history AND any queued mockReturnValueOnce / mockResolvedValueOnce
  // values so leftover queue entries from one test don't bleed into the next.
  selectImpl.mockReset();
  insertImpl.mockReset();
  deleteImpl.mockReset();
  txInsertImpl.mockReset();
  txDeleteImpl.mockReset();
  getPlanWithLinesMock.mockReset();
  getProjectedStateForMonthMock.mockReset();
  createConfirmationSnapshotMock.mockReset();
  vi.useRealTimers();
});

// ---------- getLatestConfirmation ----------

describe("getLatestConfirmation", () => {
  it("returns null when there is no prior confirmation", async () => {
    // First select (latest confirmation): chain ends in .limit() → []
    const first = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(first);

    const result = await getLatestConfirmation(PLAN_ID);

    expect(result).toBeNull();
    expect(selectImpl).toHaveBeenCalledTimes(1);
    expect(first.from).toHaveBeenCalledOnce();
    expect(first.where).toHaveBeenCalledOnce();
    expect(first.orderBy).toHaveBeenCalledOnce();
    expect(first.limit).toHaveBeenCalledWith(1);
  });

  it("returns the latest row merged with its per-debt confirmations", async () => {
    const latest = buildConfirmation();
    const debtRows = [
      buildDebtConfirmation({ debtId: "debt-A" }),
      buildDebtConfirmation({ debtId: "debt-B", id: "debt-conf-2" }),
    ];

    // First call: ends on .limit() returning [latest].
    const first = makeSelectChain([latest]);
    // Second call: ends on .where() returning the debt rows.
    const second = makeSelectChain(debtRows);

    selectImpl.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const result = await getLatestConfirmation(PLAN_ID);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(latest.id);
    expect(result?.debtConfirmations).toHaveLength(2);
    expect(result?.debtConfirmations[0].debtId).toBe("debt-A");
    expect(selectImpl).toHaveBeenCalledTimes(2);
  });
});

// ---------- getConfirmationStatus ----------

describe("getConfirmationStatus", () => {
  beforeEach(() => {
    getProjectedStateForMonthMock.mockResolvedValue(buildProjectionMonth());
  });

  it("returns isDue=false immediately when confirmationDayOfMonth=0 (disabled)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 15)));
    const plan = buildPlan({ confirmationDayOfMonth: 0 });

    const status = await getConfirmationStatus(plan, USER_ID);

    expect(status.isDue).toBe(false);
    expect(status.projectedState).toBeNull();
    expect(status.existingConfirmation).toBeNull();
    expect(status.monthAnchor).toBe("2026-05-01");
    // No DB or projection call when the feature is off.
    expect(selectImpl).not.toHaveBeenCalled();
    expect(getProjectedStateForMonthMock).not.toHaveBeenCalled();
  });

  it("flags isDue=true on the configured day when no confirmation exists yet", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 1)));
    const plan = buildPlan({ confirmationDayOfMonth: 1 });

    const chain = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(chain);

    const status = await getConfirmationStatus(plan, USER_ID);

    expect(status.isDue).toBe(true);
    expect(status.existingConfirmation).toBeNull();
    expect(status.monthAnchor).toBe("2026-05-01");
    expect(status.projectedState).not.toBeNull();
    expect(getProjectedStateForMonthMock).toHaveBeenCalledOnce();
  });

  it("keeps firing on days AFTER the configured day until a confirmation exists", async () => {
    // The `>=` semantics: from the configured day through month-end, the
    // prompt keeps asking until the user actually fills it in. The per-day
    // localStorage dismiss key in confirmation-prompt.tsx is what suppresses
    // re-shows within a single calendar day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 5))); // May 5, day 4 past anchor
    const plan = buildPlan({ confirmationDayOfMonth: 1 });

    const chain = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(chain);

    const status = await getConfirmationStatus(plan, USER_ID);

    expect(status.isDue).toBe(true);
  });

  it("clamps to the last day of the month when the configured day exceeds it", async () => {
    // confirmationDayOfMonth=31, February only has 28/29 days. The strict
    // check would never fire — but the clamp treats day-of-month >
    // lastDayOfMonth as "the last day".
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 28))); // Feb 28 2026 (last day, non-leap)
    const plan = buildPlan({ confirmationDayOfMonth: 31 });

    const chain = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(chain);

    const status = await getConfirmationStatus(plan, USER_ID);

    expect(status.isDue).toBe(true);
  });

  it("returns isDue=false when the user already confirmed this month", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 20)));
    const plan = buildPlan({ confirmationDayOfMonth: 1 });

    const existing = buildConfirmation({ confirmationMonth: "2026-05-01" });
    const chain = makeSelectChain([existing]);
    selectImpl.mockReturnValueOnce(chain);

    const status = await getConfirmationStatus(plan, USER_ID);

    expect(status.isDue).toBe(false);
    expect(status.existingConfirmation).not.toBeNull();
    expect(status.existingConfirmation?.id).toBe(existing.id);
    expect(status.monthAnchor).toBe("2026-05-01");
  });

  it("buckets May 10 (day=25 anchor) into the PREVIOUS period anchor", async () => {
    // Period semantics: with anchor day 25, May 10 belongs to the period
    // Apr 25 → May 24. The dialog should still prompt (period reached),
    // and the bucket key is the period's anchor (Apr 25).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 10))); // May 10
    const plan = buildPlan({ confirmationDayOfMonth: 25 });

    const chain = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(chain);

    const status = await getConfirmationStatus(plan, USER_ID);

    expect(status.monthAnchor).toBe("2026-04-25");
    expect(status.isDue).toBe(true);
  });

  it("respects the explicit `today` parameter over the system clock", async () => {
    // System clock is far in the future; the explicit `today` must win.
    // With anchor day 15 and today=Mar 15 2026, the period anchor is Mar 15
    // (today is exactly on the anchor — current period starts today).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2099, 0, 1)));
    const plan = buildPlan({ confirmationDayOfMonth: 15 });

    const chain = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(chain);

    const status = await getConfirmationStatus(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 2, 15))
    );

    expect(status.monthAnchor).toBe("2026-03-15");
    expect(status.isDue).toBe(true);
  });
});

// ---------- saveConfirmation ----------

describe("saveConfirmation", () => {
  beforeEach(() => {
    createConfirmationSnapshotMock.mockResolvedValue(undefined);
  });

  function mockOwnershipOk() {
    // ensurePlanOwnership runs db.select().from().where() and expects the
    // row's userId to match.
    const ownership = makeSelectChain([{ userId: USER_ID }]);
    selectImpl.mockReturnValueOnce(ownership);
    return ownership;
  }

  function mockOwnershipMissing() {
    const ownership = makeSelectChain([]);
    selectImpl.mockReturnValueOnce(ownership);
    return ownership;
  }

  function mockTxInsertConfirmation(row: FinancePlanConfirmation) {
    // tx.insert(financePlanConfirmations).values(...).onConflictDoUpdate(...).returning()
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.values = vi.fn().mockReturnValue(chain);
    chain.onConflictDoUpdate = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue([row]);
    return chain;
  }

  function mockTxDelete() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.where = vi.fn().mockResolvedValue(undefined);
    return chain;
  }

  function mockTxInsertDebts() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.values = vi.fn().mockResolvedValue(undefined);
    return chain;
  }

  it("inserts a new confirmation and any per-debt rows inside the transaction", async () => {
    mockOwnershipOk();
    const row = buildConfirmation({ id: "new-conf" });

    const insertConfChain = mockTxInsertConfirmation(row);
    const deleteDebtsChain = mockTxDelete();
    const insertDebtsChain = mockTxInsertDebts();

    txInsertImpl
      .mockReturnValueOnce(insertConfChain) // confirmations insert
      .mockReturnValueOnce(insertDebtsChain); // debt confirmations insert
    txDeleteImpl.mockReturnValueOnce(deleteDebtsChain);

    const today = new Date(Date.UTC(2026, 4, 12));
    const result = await saveConfirmation(
      USER_ID,
      {
        planId: PLAN_ID,
        confirmedSavings: "5000.00",
        confirmedInvestments: "2500.00",
        notes: "May check-in",
        debtBalances: [
          { debtId: "debt-A", confirmedBalance: "1234.56" },
          { debtId: "debt-B", confirmedBalance: "0.00" },
        ],
      },
      today
    );

    expect(result).toEqual(row);

    // Confirmation upsert called with normalised payload + month anchor.
    expect(txInsertImpl).toHaveBeenCalledTimes(2);
    const valuesArg = insertConfChain.values.mock.calls[0][0];
    expect(valuesArg).toMatchObject({
      planId: PLAN_ID,
      confirmationMonth: "2026-05-01",
      confirmedSavings: "5000.00",
      confirmedInvestments: "2500.00",
      notes: "May check-in",
    });
    expect(insertConfChain.onConflictDoUpdate).toHaveBeenCalledOnce();
    expect(insertConfChain.returning).toHaveBeenCalledOnce();

    // Prior debt confirmations cleared for this confirmation.
    expect(txDeleteImpl).toHaveBeenCalledTimes(1);
    expect(deleteDebtsChain.where).toHaveBeenCalledOnce();

    // Debt rows written with the parent confirmationId.
    const debtPayload = insertDebtsChain.values.mock.calls[0][0];
    expect(debtPayload).toHaveLength(2);
    expect(debtPayload[0]).toMatchObject({
      confirmationId: row.id,
      debtId: "debt-A",
      confirmedBalance: "1234.56",
    });

    // Snapshot side-effect ran after the txn (and didn't throw).
    expect(createConfirmationSnapshotMock).toHaveBeenCalledWith(
      PLAN_ID,
      USER_ID,
      today
    );
  });

  it("updates the existing confirmation via onConflictDoUpdate", async () => {
    mockOwnershipOk();
    const row = buildConfirmation({ id: "existing-conf" });

    const insertConfChain = mockTxInsertConfirmation(row);
    const deleteDebtsChain = mockTxDelete();
    txInsertImpl.mockReturnValueOnce(insertConfChain);
    txDeleteImpl.mockReturnValueOnce(deleteDebtsChain);

    await saveConfirmation(
      USER_ID,
      {
        planId: PLAN_ID,
        confirmedSavings: "9000.00",
        confirmedInvestments: "100.00",
        notes: null,
        debtBalances: [], // No debts → no second insert call.
      },
      new Date(Date.UTC(2026, 4, 20))
    );

    // No debt-insert call because debtBalances was empty.
    expect(txInsertImpl).toHaveBeenCalledTimes(1);

    // The update branch is encoded in `onConflictDoUpdate`'s argument:
    // .set should mirror the latest values + a fresh confirmedAt.
    const conflictArg = insertConfChain.onConflictDoUpdate.mock.calls[0][0];
    expect(conflictArg.set).toMatchObject({
      confirmedSavings: "9000.00",
      confirmedInvestments: "100.00",
      notes: null,
    });
    expect(conflictArg.set.confirmedAt).toBeInstanceOf(Date);
    expect(conflictArg.target).toBeTruthy();
  });

  it("throws when the plan is not owned by the user", async () => {
    mockOwnershipMissing();

    await expect(
      saveConfirmation(
        USER_ID,
        {
          planId: PLAN_ID,
          confirmedSavings: "1",
          confirmedInvestments: "1",
          debtBalances: [],
        },
        new Date(Date.UTC(2026, 4, 1))
      )
    ).rejects.toThrow("Plan not found");

    // Nothing past ownership should have run.
    expect(txInsertImpl).not.toHaveBeenCalled();
    expect(createConfirmationSnapshotMock).not.toHaveBeenCalled();
  });

  it("still returns the confirmation even when the snapshot side-effect throws", async () => {
    mockOwnershipOk();
    const row = buildConfirmation({ id: "conf-snap-fail" });

    const insertConfChain = mockTxInsertConfirmation(row);
    const deleteDebtsChain = mockTxDelete();
    txInsertImpl.mockReturnValueOnce(insertConfChain);
    txDeleteImpl.mockReturnValueOnce(deleteDebtsChain);

    createConfirmationSnapshotMock.mockRejectedValueOnce(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await saveConfirmation(
      USER_ID,
      {
        planId: PLAN_ID,
        confirmedSavings: "1",
        confirmedInvestments: "1",
        debtBalances: [],
      },
      new Date(Date.UTC(2026, 4, 1))
    );

    expect(result).toEqual(row);
    expect(errSpy).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});

// ---------- autoConfirmSkippedPeriods ----------

describe("autoConfirmSkippedPeriods", () => {
  // tx.insert(confirmations).values(...).onConflictDoNothing(...).returning()
  function mockTxInsertAuto(row: FinancePlanConfirmation | null) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.values = vi.fn().mockReturnValue(chain);
    chain.onConflictDoNothing = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue(row ? [row] : []);
    return chain;
  }
  function mockTxInsertDebts() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.values = vi.fn().mockResolvedValue(undefined);
    return chain;
  }

  it("is a no-op when confirmationDayOfMonth=0 (feature disabled)", async () => {
    const plan = buildPlan({ confirmationDayOfMonth: 0 });

    const result = await autoConfirmSkippedPeriods(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 5, 15))
    );

    expect(result).toEqual({ confirmationsCreated: 0 });
    expect(selectImpl).not.toHaveBeenCalled();
    expect(txInsertImpl).not.toHaveBeenCalled();
  });

  it("does nothing when the latest confirmation IS the current period", async () => {
    const plan = buildPlan({ confirmationDayOfMonth: 1 });

    // #1 existing months, #2 latest confirmation, #3 its debt rows.
    selectImpl
      .mockReturnValueOnce(makeSelectChain([{ month: "2026-05-01" }]))
      .mockReturnValueOnce(
        makeSelectChain([buildConfirmation({ confirmationMonth: "2026-05-01" })])
      )
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await autoConfirmSkippedPeriods(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 4, 15)) // May 15 → current period May 1
    );

    expect(result).toEqual({ confirmationsCreated: 0 });
    expect(txInsertImpl).not.toHaveBeenCalled();
    expect(createConfirmationSnapshotMock).not.toHaveBeenCalled();
  });

  it("auto-confirms a skipped closed period with source 'auto' + per-debt rows", async () => {
    const plan = buildPlan({ confirmationDayOfMonth: 1 });

    // Latest confirmation is April; May was skipped; today is in June.
    selectImpl
      .mockReturnValueOnce(makeSelectChain([{ month: "2026-04-01" }])) // existing months
      .mockReturnValueOnce(
        makeSelectChain([buildConfirmation({ confirmationMonth: "2026-04-01" })])
      ) // latest
      .mockReturnValueOnce(makeSelectChain([])); // latest's debt rows

    // Projected opening of the skipped May period.
    getProjectedStateForMonthMock.mockResolvedValueOnce({
      ...buildProjectionMonth(),
      savings: 4321,
      investments: 1000,
      debts: [
        {
          debtId: "d1",
          name: "Card",
          balance: 600,
          scheduledPayment: 0,
          extraPayment: 0,
          interestAccrued: 0,
        },
      ],
    });

    const autoRow = buildConfirmation({
      id: "auto-conf",
      confirmationMonth: "2026-05-01",
    });
    const insertAuto = mockTxInsertAuto(autoRow);
    const insertDebts = mockTxInsertDebts();
    txInsertImpl
      .mockReturnValueOnce(insertAuto)
      .mockReturnValueOnce(insertDebts);
    createConfirmationSnapshotMock.mockResolvedValue(undefined);

    const result = await autoConfirmSkippedPeriods(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 5, 15)) // June 15 → current period June 1
    );

    expect(result).toEqual({ confirmationsCreated: 1 });

    // Confirmation row written for May with source 'auto'.
    const confPayload = insertAuto.values.mock.calls[0][0];
    expect(confPayload).toMatchObject({
      planId: PLAN_ID,
      confirmationMonth: "2026-05-01",
      confirmedSavings: "4321.00",
      confirmedInvestments: "1000.00",
      source: "auto",
    });
    expect(insertAuto.onConflictDoNothing).toHaveBeenCalledOnce();

    // Per-debt breakdown written.
    const debtPayload = insertDebts.values.mock.calls[0][0];
    expect(debtPayload).toEqual([
      { confirmationId: "auto-conf", debtId: "d1", confirmedBalance: "600.00" },
    ]);

    // Audit snapshot dated at the skipped period's anchor.
    expect(createConfirmationSnapshotMock).toHaveBeenCalledWith(
      PLAN_ID,
      USER_ID,
      new Date(Date.UTC(2026, 4, 1))
    );
  });
});

// ---------- getPlanForConfirmation ----------

describe("getPlanForConfirmation", () => {
  it("delegates to getPlanWithLines with the same args", async () => {
    const plan = buildPlan();
    getPlanWithLinesMock.mockResolvedValueOnce(plan);

    const result = await getPlanForConfirmation(PLAN_ID, USER_ID);

    expect(result).toBe(plan);
    expect(getPlanWithLinesMock).toHaveBeenCalledWith(PLAN_ID, USER_ID);
  });

  it("returns null when the underlying lookup misses", async () => {
    getPlanWithLinesMock.mockResolvedValueOnce(null);

    const result = await getPlanForConfirmation(PLAN_ID, USER_ID);

    expect(result).toBeNull();
  });
});
