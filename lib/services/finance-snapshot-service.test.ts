import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// finance-snapshot-service.ts exercises these db shapes:
//   - chainable select: db.select(...).from(...).where(...)[.orderBy(...).limit(...)]
//   - simple insert: db.insert(table).values(payload) (awaited)
//   - chainable delete: db.delete(table).where(...) (awaited)
// We mock @/db at the import boundary and stub each per test so call args can
// be inspected directly. Selects use a thenable chain so the same builder can
// stand in for both `.from().where()` and `.from().where().orderBy().limit()`
// terminations.

const selectImpl = vi.fn();
const insertImpl = vi.fn();
const deleteImpl = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => selectImpl(...args),
    insert: (...args: unknown[]) => insertImpl(...args),
    delete: (...args: unknown[]) => deleteImpl(...args),
  },
}));

// Dependencies pulled in by the service. We stub them at the import boundary
// so we never execute the real projection / portfolio machinery.
const getPlanWithLinesMock = vi.fn();
const getPortfolioValueForUserMock = vi.fn();
const getAutoInvestRateMock = vi.fn();
const projectPlanMock = vi.fn();
vi.mock("./finance-plan-service", () => ({
  getPlanWithLines: (...args: unknown[]) => getPlanWithLinesMock(...args),
  getMainPlan: vi.fn(async () => null),
  // Mirrors the real helper: portfolio lookups only when the plan includes it.
  projectionOptionsFor: async (
    plan: { includePortfolio: boolean; overrides: unknown; asOf?: Date | null },
    userId: string
  ) => ({
    portfolioValue: plan.includePortfolio ? await getPortfolioValueForUserMock(userId) : 0,
    portfolioMonthlyGrowthRate: 0,
    autoInvestRate: await getAutoInvestRateMock(plan),
    overrides: plan.overrides,
    asOf: plan.asOf ?? null,
  }),
}));

// The engine is swapped for a stub so each test controls the months it sees.
vi.mock("@/lib/finance/projection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/finance/projection")>()),
  projectPlan: (...args: unknown[]) => projectPlanMock(...args),
}));

const getLatestConfirmationMock = vi.fn();
const autoConfirmSkippedPeriodsMock = vi.fn();
vi.mock("./finance-confirmation-service", () => ({
  getLatestConfirmation: (...args: unknown[]) =>
    getLatestConfirmationMock(...args),
  autoConfirmSkippedPeriods: (...args: unknown[]) =>
    autoConfirmSkippedPeriodsMock(...args),
}));

import {
  calibratePlan,
  createConfirmationSnapshot,
  createDailyFinanceSnapshots,
  getProjectedStateForMonth,
  getRecentMonthlySnapshots,
} from "./finance-snapshot-service";
import type {
  ConfirmationWithDebts,
  FinancePlanWithLines,
  ProjectionMonth,
} from "@/types/finance";

const PLAN_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PLAN_ID = "33333333-3333-3333-3333-333333333333";
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
    initialSavings: "1000",
    monthlySavingsRate: "0",
    includePortfolio: false,
    surplusToDebtsPercent: "0",
    debtStrategy: "avalanche",
    confirmationDayOfMonth: 1,
    autoInvestPercent: "0",
    autoInvestMethodId: null,
    initialInvestments: "500",
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

function buildProjectionMonth(
  overrides: Partial<ProjectionMonth> = {}
): ProjectionMonth {
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
    preAsOfCashFlow: 0,
    debts: [],
    ...overrides,
  };
}

// Build a Drizzle-style select chain that is also a thenable. Every builder
// method returns the same object; awaiting at ANY point resolves with `rows`.
// This covers `.from().where()`, `.from().where().orderBy()`, and
// `.from().where().orderBy().limit()` shapes with one helper.
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

function makeInsertChain(snapshotId = "snap-id") {
  // Two shapes are exercised:
  //   - snapshot parent: db.insert(t).values(payload).returning({ id })
  //   - debt children:   await db.insert(t).values(payload)
  // So `values()` returns an object that is BOTH awaitable (thenable resolving
  // undefined) AND carries `.returning()` (resolving the inserted id rows).
  const valuesResult = {
    returning: vi.fn().mockResolvedValue([{ id: snapshotId }]),
    then: (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ): Promise<unknown> => Promise.resolve(undefined).then(resolve, reject),
  };
  const chain = {
    values: vi.fn().mockReturnValue(valuesResult),
  };
  return chain;
}

// Convenience: stub ownership lookup with a row whose userId matches.
function mockOwnershipOk() {
  const chain = makeSelectChain([{ userId: USER_ID }]);
  selectImpl.mockReturnValueOnce(chain);
  return chain;
}

function mockOwnershipMissing() {
  const chain = makeSelectChain([]);
  selectImpl.mockReturnValueOnce(chain);
  return chain;
}

afterEach(() => {
  selectImpl.mockReset();
  insertImpl.mockReset();
  deleteImpl.mockReset();
  getPlanWithLinesMock.mockReset();
  getPortfolioValueForUserMock.mockReset();
  getAutoInvestRateMock.mockReset();
  projectPlanMock.mockReset();
  getLatestConfirmationMock.mockReset();
  autoConfirmSkippedPeriodsMock.mockReset();
  vi.useRealTimers();
});

// ---------- createConfirmationSnapshot ----------

describe("createConfirmationSnapshot", () => {
  beforeEach(() => {
    getLatestConfirmationMock.mockResolvedValue(null);
    getPortfolioValueForUserMock.mockResolvedValue(0);
    getAutoInvestRateMock.mockResolvedValue(0);
  });

  it("inserts a snapshot row tagged as 'confirmation' with the OPENING state", async () => {
    getPlanWithLinesMock.mockResolvedValueOnce(
      buildPlan({ startMonth: new Date(Date.UTC(2026, 0, 1)) })
    );
    // Snapshots record the period OPENING (= previous period's close), not the
    // projected period close. Date in period 1 → opening = month[0].
    projectPlanMock.mockReturnValueOnce({
      months: [
        buildProjectionMonth({
          monthOffset: 0,
          savings: 100,
          investments: 200,
          totalDebt: 50,
          netWorth: 250,
        }),
        buildProjectionMonth({
          monthOffset: 1,
          savings: 999,
          investments: 888,
          totalDebt: 0,
          netWorth: 1887,
        }),
      ],
    });

    const insertChain = makeInsertChain();
    insertImpl.mockReturnValueOnce(insertChain);

    const date = new Date(Date.UTC(2026, 1, 15));
    const result = await createConfirmationSnapshot(PLAN_ID, USER_ID, date);

    expect(result).toEqual({ created: true });
    // No debts on month[0] → only the parent snapshot insert, no child rows.
    expect(insertImpl).toHaveBeenCalledOnce();
    expect(insertChain.values).toHaveBeenCalledOnce();
    const payload = insertChain.values.mock.calls[0][0];
    expect(payload).toMatchObject({
      planId: PLAN_ID,
      date,
      savings: "100.00",
      investments: "200.00",
      totalDebt: "50.00",
      netWorth: "250.00",
      source: "confirmation",
    });
    // Confirmation snapshots NEVER consult the idempotency lookup — there
    // should be no select calls (no ownership check either, by design).
    expect(selectImpl).not.toHaveBeenCalled();
  });

  it("writes a per-debt breakdown child row for each debt in the state", async () => {
    getPlanWithLinesMock.mockResolvedValueOnce(
      buildPlan({ startMonth: new Date(Date.UTC(2026, 0, 1)) })
    );
    projectPlanMock.mockReturnValueOnce({
      months: [
        buildProjectionMonth({
          monthOffset: 0,
          savings: 100,
          totalDebt: 1500,
          debts: [
            {
              debtId: "d1",
              name: "Card",
              balance: 1000,
              scheduledPayment: 0,
              extraPayment: 0,
              interestAccrued: 0,
              payments: [],
            },
            {
              debtId: "d2",
              name: "Loan",
              balance: 500,
              scheduledPayment: 0,
              extraPayment: 0,
              interestAccrued: 0,
              payments: [],
            },
          ],
        }),
        buildProjectionMonth({ monthOffset: 1 }),
      ],
    });

    const parentChain = makeInsertChain("snap-xyz");
    const childChain = makeInsertChain();
    insertImpl
      .mockReturnValueOnce(parentChain)
      .mockReturnValueOnce(childChain);

    await createConfirmationSnapshot(
      PLAN_ID,
      USER_ID,
      new Date(Date.UTC(2026, 1, 15))
    );

    expect(insertImpl).toHaveBeenCalledTimes(2);
    expect(childChain.values).toHaveBeenCalledOnce();
    const debtRows = childChain.values.mock.calls[0][0];
    expect(debtRows).toEqual([
      { snapshotId: "snap-xyz", debtId: "d1", balance: "1000.00" },
      { snapshotId: "snap-xyz", debtId: "d2", balance: "500.00" },
    ]);
  });

  it("returns { created: false } when the plan cannot be loaded", async () => {
    getPlanWithLinesMock.mockResolvedValueOnce(null);

    const result = await createConfirmationSnapshot(
      PLAN_ID,
      USER_ID,
      new Date(Date.UTC(2026, 0, 15))
    );

    expect(result).toEqual({ created: false });
    expect(insertImpl).not.toHaveBeenCalled();
  });

  it("returns { created: false } when projection has no months", async () => {
    getPlanWithLinesMock.mockResolvedValueOnce(buildPlan());
    projectPlanMock.mockReturnValueOnce({ months: [] });

    const result = await createConfirmationSnapshot(
      PLAN_ID,
      USER_ID,
      new Date(Date.UTC(2026, 0, 15))
    );

    expect(result).toEqual({ created: false });
    expect(insertImpl).not.toHaveBeenCalled();
  });
});

// ---------- createManualFinanceSnapshot ----------

// ---------- createDailyFinanceSnapshots ----------

describe("createDailyFinanceSnapshots", () => {
  beforeEach(() => {
    getLatestConfirmationMock.mockResolvedValue(null);
    getPortfolioValueForUserMock.mockResolvedValue(0);
    getAutoInvestRateMock.mockResolvedValue(0);
  });

  it("returns zeroed counters when there are no plans", async () => {
    // First select: list plans → empty.
    selectImpl.mockReturnValueOnce(makeSelectChain([]));

    const today = new Date(Date.UTC(2026, 0, 5));
    const result = await createDailyFinanceSnapshots(today);

    expect(result).toEqual({
      date: today,
      snapshotsCreated: 0,
      totalPlans: 0,
      errors: [],
    });
  });

  it("creates one snapshot per plan when no cron snapshot exists for the day", async () => {
    // First select: list plans → two rows.
    selectImpl.mockReturnValueOnce(
      makeSelectChain([
        { id: PLAN_ID, userId: USER_ID },
        { id: OTHER_PLAN_ID, userId: USER_ID },
      ])
    );

    // For each plan, createSnapshotForPlan runs idempotency check (select → []).
    selectImpl.mockReturnValueOnce(makeSelectChain([]));
    selectImpl.mockReturnValueOnce(makeSelectChain([]));

    getPlanWithLinesMock
      .mockResolvedValueOnce(buildPlan({ id: PLAN_ID }))
      .mockResolvedValueOnce(buildPlan({ id: OTHER_PLAN_ID }));
    projectPlanMock
      .mockReturnValueOnce({ months: [buildProjectionMonth()] })
      .mockReturnValueOnce({ months: [buildProjectionMonth()] });

    const insertA = makeInsertChain();
    const insertB = makeInsertChain();
    insertImpl.mockReturnValueOnce(insertA).mockReturnValueOnce(insertB);

    const today = new Date(Date.UTC(2026, 0, 5));
    const result = await createDailyFinanceSnapshots(today);

    expect(result.snapshotsCreated).toBe(2);
    expect(result.totalPlans).toBe(2);
    expect(result.errors).toEqual([]);
    expect(insertA.values.mock.calls[0][0].source).toBe("system_cron");
    expect(insertB.values.mock.calls[0][0].source).toBe("system_cron");
  });

  it("skips plans that already have a system_cron snapshot for the same calendar day", async () => {
    selectImpl.mockReturnValueOnce(
      makeSelectChain([{ id: PLAN_ID, userId: USER_ID }])
    );
    // Idempotency check returns an existing row → no insert.
    selectImpl.mockReturnValueOnce(makeSelectChain([{ id: "existing-snap" }]));

    getPlanWithLinesMock.mockResolvedValueOnce(buildPlan());

    const today = new Date(Date.UTC(2026, 0, 5));
    const result = await createDailyFinanceSnapshots(today);

    expect(result.snapshotsCreated).toBe(0);
    expect(result.totalPlans).toBe(1);
    expect(insertImpl).not.toHaveBeenCalled();
    expect(projectPlanMock).not.toHaveBeenCalled();
  });

  it("collects per-plan errors and continues with the rest", async () => {
    selectImpl.mockReturnValueOnce(
      makeSelectChain([
        { id: PLAN_ID, userId: USER_ID },
        { id: OTHER_PLAN_ID, userId: USER_ID },
      ])
    );

    // Plan 1 blows up inside getPlanWithLines. Plan 2 proceeds normally.
    getPlanWithLinesMock
      .mockRejectedValueOnce(new Error("kaboom"))
      .mockResolvedValueOnce(buildPlan({ id: OTHER_PLAN_ID }));

    // Only plan 2 reaches the idempotency check + insert.
    selectImpl.mockReturnValueOnce(makeSelectChain([]));
    projectPlanMock.mockReturnValueOnce({ months: [buildProjectionMonth()] });
    insertImpl.mockReturnValueOnce(makeInsertChain());

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const today = new Date(Date.UTC(2026, 0, 5));
    const result = await createDailyFinanceSnapshots(today);

    expect(result.snapshotsCreated).toBe(1);
    expect(result.totalPlans).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(PLAN_ID);
    expect(result.errors[0]).toContain("kaboom");

    errSpy.mockRestore();
  });

  it("defaults `today` to current time when omitted", async () => {
    vi.useFakeTimers();
    const now = new Date(Date.UTC(2026, 7, 22, 8, 30));
    vi.setSystemTime(now);

    selectImpl.mockReturnValueOnce(makeSelectChain([]));

    const result = await createDailyFinanceSnapshots();

    expect(result.date).toEqual(now);
  });
});

// ---------- deleteManualFinanceSnapshots ----------

// ---------- listSnapshots ----------

// ---------- getRecentMonthlySnapshots ----------

describe("getRecentMonthlySnapshots", () => {
  it("throws when the plan isn't owned by the user", async () => {
    mockOwnershipMissing();

    await expect(
      getRecentMonthlySnapshots(PLAN_ID, USER_ID)
    ).rejects.toThrow("Plan not found");
  });

  it("returns an empty array when there are no rows", async () => {
    mockOwnershipOk();
    selectImpl.mockReturnValueOnce(makeSelectChain([]));

    const result = await getRecentMonthlySnapshots(
      PLAN_ID,
      USER_ID,
      3,
      new Date(Date.UTC(2026, 5, 15))
    );

    expect(result).toEqual([]);
  });

  it("keeps only the most recent snapshot per calendar month and sorts ascending", async () => {
    mockOwnershipOk();
    // Rows come back desc by date (per the orderBy). Three are in May 2026 —
    // only the newest should survive the per-month dedupe.
    const may15 = new Date(Date.UTC(2026, 4, 15));
    const may10 = new Date(Date.UTC(2026, 4, 10));
    const may1 = new Date(Date.UTC(2026, 4, 1));
    const apr20 = new Date(Date.UTC(2026, 3, 20));
    selectImpl.mockReturnValueOnce(
      makeSelectChain([
        {
          date: may15,
          savings: "300.00",
          investments: "400.00",
          totalDebt: "50.00",
          netWorth: "650.00",
        },
        {
          date: may10,
          savings: "290.00",
          investments: "390.00",
          totalDebt: "55.00",
          netWorth: "625.00",
        },
        {
          date: may1,
          savings: "280.00",
          investments: "380.00",
          totalDebt: "60.00",
          netWorth: "600.00",
        },
        {
          date: apr20,
          savings: "200.00",
          investments: "300.00",
          totalDebt: "70.00",
          netWorth: "430.00",
        },
      ])
    );

    const result = await getRecentMonthlySnapshots(
      PLAN_ID,
      USER_ID,
      3,
      new Date(Date.UTC(2026, 5, 15))
    );

    // Expect two months total (April + May), sorted ascending by date,
    // with only May 15 representing May.
    expect(result).toHaveLength(2);
    expect(result[0].date).toEqual(apr20);
    expect(result[1].date).toEqual(may15);
    expect(result[1].savings).toBe(300);
    expect(result[1].investments).toBe(400);
    expect(result[1].totalDebt).toBe(50);
    expect(result[1].netWorth).toBe(650);
  });

  it("buckets by accounting PERIOD (anchorDay) so straddling snapshots collapse per period", async () => {
    mockOwnershipOk();
    // anchorDay=15 → periods are e.g. Feb 15–Mar 14, Mar 15–Apr 14. Feb 28 and
    // Mar 5 BOTH belong to the Feb-15 period and must collapse to one point
    // (the latest, Mar 5). A calendar-month dedup would wrongly keep both.
    const mar5 = new Date(Date.UTC(2026, 2, 5));
    const feb28 = new Date(Date.UTC(2026, 1, 28));
    const apr20 = new Date(Date.UTC(2026, 3, 20)); // Apr 15 period
    selectImpl.mockReturnValueOnce(
      makeSelectChain([
        { date: mar5, savings: "30", investments: "40", totalDebt: "5", netWorth: "65" },
        { date: feb28, savings: "29", investments: "39", totalDebt: "6", netWorth: "62" },
        { date: apr20, savings: "20", investments: "30", totalDebt: "7", netWorth: "43" },
      ])
    );

    const result = await getRecentMonthlySnapshots(
      PLAN_ID,
      USER_ID,
      6,
      new Date(Date.UTC(2026, 4, 1)),
      15
    );

    // Two periods: Feb15 (represented by mar5) + Apr15 (apr20), ascending.
    expect(result).toHaveLength(2);
    expect(result[0].date).toEqual(mar5);
    expect(result[1].date).toEqual(apr20);
  });

  it("uses default monthsBack=3 and current date when omitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15)));
    mockOwnershipOk();
    selectImpl.mockReturnValueOnce(makeSelectChain([]));

    const result = await getRecentMonthlySnapshots(PLAN_ID, USER_ID);

    expect(result).toEqual([]);
    // Sanity: select for ownership + select for rows = 2 calls.
    expect(selectImpl).toHaveBeenCalledTimes(2);
  });
});

// ---------- getProjectedStateForMonth ----------

describe("getProjectedStateForMonth", () => {
  beforeEach(() => {
    getPortfolioValueForUserMock.mockResolvedValue(0);
    getAutoInvestRateMock.mockResolvedValue(0);
  });

  it("returns the OPENING of the resolved period (previous period's close)", async () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
    });
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    const months = [
      buildProjectionMonth({ monthOffset: 0, savings: 100 }),
      buildProjectionMonth({ monthOffset: 1, savings: 200 }),
      buildProjectionMonth({ monthOffset: 2, savings: 300 }),
    ];
    projectPlanMock.mockReturnValueOnce({ months });

    // Target = March 2026 = offset 2 → its OPENING = the Feb close (idx 1).
    const result = await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 2, 15))
    );

    expect(result).not.toBeNull();
    expect(result?.savings).toBe(200);
  });

  it("F20: past the horizon it returns the LAST close, not the second to last", async () => {
    const plan = buildPlan({ startMonth: new Date(Date.UTC(2026, 0, 1)) });
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    projectPlanMock.mockReturnValueOnce({
      months: [
        buildProjectionMonth({ monthOffset: 0, savings: 100 }),
        buildProjectionMonth({ monthOffset: 1, savings: 200 }),
        buildProjectionMonth({ monthOffset: 2, savings: 300 }),
      ],
    });
    // April = offset 3, one past the 3-period horizon: it used to return 200
    // (the second-to-last close) and stay frozen there forever.
    const result = await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 3, 15))
    );
    expect(result?.savings).toBe(300);
  });

  it("returns null when projection yields no months", async () => {
    const plan = buildPlan();
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    projectPlanMock.mockReturnValueOnce({ months: [] });

    const result = await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 4, 1))
    );

    expect(result).toBeNull();
  });

  it("synthesises a pre-baseline state when target precedes startMonth", async () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 5, 1)),
      initialSavings: "100",
      initialInvestments: "200",
      debts: [
        {
          id: "d1",
          initialBalance: "500",
        } as unknown as FinancePlanWithLines["debts"][number],
        {
          id: "d2",
          initialBalance: "300",
        } as unknown as FinancePlanWithLines["debts"][number],
      ],
    });
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    projectPlanMock.mockReturnValueOnce({
      months: [buildProjectionMonth()],
    });

    // Target Jan 2026 sits BEFORE startMonth Jun 2026 → synthesised state.
    const result = await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 0, 15))
    );

    expect(result).not.toBeNull();
    expect(result?.monthOffset).toBe(-1);
    expect(result?.savings).toBe(100);
    expect(result?.investments).toBe(200);
    expect(result?.totalDebt).toBe(800);
    expect(result?.netWorth).toBe(100 + 200 - 800);
  });

  it("calibrates the plan with the latest confirmation (startMonth + balances)", async () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
      initialSavings: "100",
      initialInvestments: "200",
      debts: [
        {
          id: "d1",
          initialBalance: "1000",
        } as unknown as FinancePlanWithLines["debts"][number],
      ],
    });

    // Confirmation rewrites baseline to Mar 2026 with new balances.
    const confirmation: ConfirmationWithDebts = {
      id: "conf-1",
      planId: PLAN_ID,
      confirmationMonth: "2026-03-01",
      confirmedSavings: "999.99",
      confirmedInvestments: "555.55",
      notes: null,
      confirmedAt: new Date(),
      debtConfirmations: [
        {
          id: "dc-1",
          confirmationId: "conf-1",
          debtId: "d1",
          confirmedBalance: "750.00",
          createdAt: new Date(),
        } as unknown as ConfirmationWithDebts["debtConfirmations"][number],
      ],
    } as unknown as ConfirmationWithDebts;
    getLatestConfirmationMock.mockResolvedValueOnce(confirmation);

    projectPlanMock.mockReturnValueOnce({
      months: [buildProjectionMonth({ monthOffset: 0 })],
    });

    await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 2, 15))
    );

    // The calibrated plan passed into projectPlan should reflect the
    // confirmation's month + balances.
    expect(projectPlanMock).toHaveBeenCalledOnce();
    const calibrated = projectPlanMock.mock.calls[0][0];
    expect(calibrated.startMonth).toEqual(new Date("2026-03-01"));
    expect(calibrated.initialSavings).toBe("999.99");
    expect(calibrated.initialInvestments).toBe("555.55");
    expect(calibrated.debts[0].initialBalance).toBe("750.00");
  });

  it("includes portfolio value when plan.includePortfolio=true", async () => {
    const plan = buildPlan({ includePortfolio: true });
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    getPortfolioValueForUserMock.mockResolvedValueOnce(4321);
    projectPlanMock.mockReturnValueOnce({
      months: [buildProjectionMonth()],
    });

    await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 0, 1))
    );

    expect(getPortfolioValueForUserMock).toHaveBeenCalledWith(USER_ID);
    const opts = projectPlanMock.mock.calls[0][4];
    expect(opts.portfolioValue).toBe(4321);
  });

  it("skips portfolio lookup when plan.includePortfolio=false", async () => {
    const plan = buildPlan({ includePortfolio: false });
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    projectPlanMock.mockReturnValueOnce({
      months: [buildProjectionMonth()],
    });

    await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 0, 1))
    );

    expect(getPortfolioValueForUserMock).not.toHaveBeenCalled();
    const opts = projectPlanMock.mock.calls[0][4];
    expect(opts.portfolioValue).toBe(0);
  });

  it("snaps the target date to the period anchor before resolving", async () => {
    const plan = buildPlan({
      startMonth: new Date(Date.UTC(2026, 0, 1)),
    });
    getLatestConfirmationMock.mockResolvedValueOnce(null);
    const months = [
      buildProjectionMonth({ monthOffset: 0, savings: 100 }),
      buildProjectionMonth({ monthOffset: 1, savings: 200 }),
    ];
    projectPlanMock.mockReturnValueOnce({ months });

    // Mid-month February 2026 → period anchor Feb 1 → offset 1. The pre-fill
    // returns the OPENING of period 1 = period 0's close (idx 0 → 100).
    const result = await getProjectedStateForMonth(
      plan,
      USER_ID,
      new Date(Date.UTC(2026, 1, 27))
    );

    expect(result?.savings).toBe(100);
  });
});

// ---------- calibratePlan (pure) ----------

describe("calibratePlan", () => {
  const actualEngine = () =>
    vi.importActual<typeof import("@/lib/finance/projection")>("@/lib/finance/projection");
  const conf = (o: Partial<ConfirmationWithDebts>): ConfirmationWithDebts =>
    ({
      id: "c",
      planId: PLAN_ID,
      confirmationMonth: "2026-09-12",
      confirmedSavings: "8000",
      confirmedInvestments: "0",
      notes: null,
      source: "user",
      confirmedAt: new Date(),
      debtConfirmations: [],
      ...o,
    }) as unknown as ConfirmationWithDebts;
  const quarterly = {
    id: "ins",
    name: "Insurance",
    monthlyAmount: "600",
    kind: "recurring",
    dayOfMonth: 10,
    date: null,
    recurrenceType: "every_n_months",
    weekOfMonth: null,
    dayOfWeek: null,
    intervalMonths: 3,
    recurrenceStart: null,
  } as unknown as FinancePlanWithLines["expenses"][number];

  it("F3: pins an every-N-months line to the ORIGINAL start month", async () => {
    const { projectPlan } = await actualEngine();
    const plan = buildPlan({ monthsAhead: 24, expenses: [quarterly] });
    const cal = calibratePlan(plan, conf({}));
    expect(cal.expenses[0].recurrenceStart).toBe("2026-01-01");
    const pr = projectPlan(cal, cal.incomes, cal.expenses, cal.debts, { asOf: cal.asOf });
    const hits = pr.months.filter((m) => m.expenses > 0).map((m) => m.date.toISOString().slice(0, 7));
    // Jan / Apr / Jul / Oct cadence, exactly what the calendar shows — not
    // Sep / Dec / Mar as when it followed the confirmation month.
    expect(hits.slice(0, 3)).toEqual(["2026-10", "2027-01", "2027-04"]);
  });

  it("F9: keeps the plan's own end date instead of sliding a horizon forward", () => {
    // 24 periods from Jan 2026 end with Dec 2027; confirmed in Sep 2026.
    const cal = calibratePlan(buildPlan({ monthsAhead: 24 }), conf({}));
    expect(cal.startMonth).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(cal.monthsAhead).toBe(16); // Sep 2026 … Dec 2027
  });

  it("F2: a user confirmation is as of its day; an auto row is an opening", () => {
    const user = calibratePlan(buildPlan(), conf({}));
    expect(user.asOf).toEqual(new Date(Date.UTC(2026, 8, 12)));
    expect(user.initialSavings).toBe("8000");
    const auto = calibratePlan(buildPlan(), conf({ confirmationMonth: "2026-09-01", source: "auto" }));
    expect(auto.asOf).toEqual(new Date(Date.UTC(2026, 7, 31))); // nothing in Sep applied yet
  });

  it("F26: a row keyed under an OLD anchor still calibrates the period containing it", () => {
    const cal = calibratePlan(
      buildPlan({ confirmationDayOfMonth: 15 }),
      conf({ confirmationMonth: "2026-05-01" })
    );
    expect(cal.startMonth).toEqual(new Date(Date.UTC(2026, 3, 15)));
    expect(cal.asOf).toEqual(new Date(Date.UTC(2026, 4, 1)));
  });

  it("with no confirmation: as of the creation day in the reader's zone, or a base plan's", () => {
    // Created 2026-09-29 23:30 UTC = Sep 30 in Madrid.
    const plan = buildPlan({ createdAt: new Date(Date.UTC(2026, 8, 29, 23, 30)) } as never);
    expect(calibratePlan(plan, null, { timeZone: "Europe/Madrid" }).asOf).toEqual(
      new Date(Date.UTC(2026, 8, 30))
    );
    expect(calibratePlan(plan, null).asOf).toEqual(new Date(Date.UTC(2026, 8, 29)));
    const fallback = new Date(Date.UTC(2026, 0, 3));
    expect(calibratePlan(plan, null, { asOfFallback: fallback }).asOf).toEqual(fallback);
  });
});

describe("F20: no forecast recorded as history", () => {
  it("the cron writes no snapshot for a plan with confirmations off", async () => {
    selectImpl.mockReturnValueOnce(makeSelectChain([{ id: PLAN_ID, userId: USER_ID }]));
    getPlanWithLinesMock.mockResolvedValueOnce(buildPlan({ confirmationDayOfMonth: 0 }));
    const result = await createDailyFinanceSnapshots(new Date(Date.UTC(2026, 4, 10)));
    expect(result.snapshotsCreated).toBe(0);
    expect(insertImpl).not.toHaveBeenCalled();
    expect(projectPlanMock).not.toHaveBeenCalled();
  });
});
