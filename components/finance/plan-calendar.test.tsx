// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDayMap, PlanCalendar } from "./plan-calendar";
import { projectedDebtPayments } from "@/lib/finance/debt-payments";
import type {
  FinancePlanExpense,
  FinancePlanLineOverride,
  FinancePlanWithLines,
} from "@/types/finance";

const rent = {
  id: "rent",
  planId: "p",
  name: "Rent",
  monthlyAmount: "1200",
  kind: "recurring",
  dayOfMonth: 30,
  date: null,
  recurrenceType: "monthly_day",
  weekOfMonth: null,
  dayOfWeek: null,
  intervalMonths: null,
  recurrenceStart: null,
} as unknown as FinancePlanExpense;

const moved = (date: string): FinancePlanLineOverride =>
  ({
    id: "ov-1",
    planId: "p",
    parentSide: "expense",
    parentId: "rent",
    monthYear: "2026-03-01",
    action: "reschedule",
    date,
    monthlyAmount: null,
  }) as unknown as FinancePlanLineOverride;

function plan(overrides: FinancePlanLineOverride[] = []): FinancePlanWithLines {
  return {
    id: "p",
    userId: "u",
    name: "Plan",
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
    incomes: [],
    expenses: [rent],
    debts: [],
    overrides,
  } as unknown as FinancePlanWithLines;
}

describe("buildDayMap: a moved chip keeps its cadence month", () => {
  it("March's rent moved to Apr 2 sits on Apr 2, keyed by March; April's stays April's", () => {
    const days = [new Date(2026, 3, 1), new Date(2026, 3, 2), new Date(2026, 3, 30)];
    const map = buildDayMap(days, plan([moved("2026-04-02")]), projectedDebtPayments([]));
    expect(map.get("2026-04-02")?.map((e) => [e.id, e.cadenceMonth])).toEqual([
      ["rent", "2026-03-01"],
    ]);
    expect(map.get("2026-04-30")?.map((e) => [e.id, e.cadenceMonth])).toEqual([
      ["rent", "2026-04-01"],
    ]);
  });
});

describe("PlanCalendar: 'Just this month' across months", () => {
  beforeEach(() => {
    // March 2026: the anchored view shows Mar 1 – Mar 31 on a grid that runs
    // to Saturday Apr 4, so April's first days are visible drop targets.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 20, 12));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function dataTransfer(): DataTransfer {
    const store = new Map<string, string>();
    return {
      setData: (type: string, value: string) => void store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
      get types() {
        return [...store.keys()];
      },
      effectAllowed: "all",
      dropEffect: "none",
    } as unknown as DataTransfer;
  }

  function cell(iso: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(`[data-date="${iso}"]`);
    if (!el) throw new Error(`no cell for ${iso}`);
    return el;
  }

  function drag(fromIso: string, toIso: string): void {
    const grip = cell(fromIso).querySelector<HTMLElement>("[draggable='true']");
    if (!grip) throw new Error(`no chip on ${fromIso}`);
    const dt = dataTransfer();
    fireEvent.dragStart(grip, { dataTransfer: dt });
    fireEvent.dragOver(cell(toIso), { dataTransfer: dt });
    fireEvent.drop(cell(toIso), { dataTransfer: dt });
  }

  function renderCalendar(p: FinancePlanWithLines): ReturnType<typeof vi.fn> {
    const onUpsertOverride = vi.fn(async () => {});
    const noop = vi.fn(async () => {});
    render(
      <PlanCalendar
        plan={p}
        onAddIncome={noop}
        onAddExpense={noop}
        onUpdateIncome={noop}
        onUpdateExpense={noop}
        onUpdateDebt={noop}
        onUpsertOverride={onUpsertOverride}
        onDeleteOverride={noop}
      />
    );
    return onUpsertOverride;
  }

  it("moves March's occurrence to Apr 2 as a March override", async () => {
    const onUpsertOverride = renderCalendar(plan());
    drag("2026-03-30", "2026-04-02");
    const button = screen.getByRole("button", { name: "Just this month" });
    expect(button).toBeEnabled();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(onUpsertOverride).toHaveBeenCalledWith({
      parentSide: "expense",
      parentId: "rent",
      monthYear: "2026-03-01",
      action: "reschedule",
      date: "2026-04-02",
    });
  });

  it("moving an already-moved chip again rewrites ITS month's override, not the one it sits in", async () => {
    const onUpsertOverride = renderCalendar(plan([moved("2026-04-02")]));
    drag("2026-04-02", "2026-04-03");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Just this month" }));
    });
    expect(onUpsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({ monthYear: "2026-03-01", date: "2026-04-03" })
    );
  });
});
