// @vitest-environment jsdom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/finance-plans", () => ({
  createPlanAction: vi.fn(),
  updatePlanAction: vi.fn(async () => ({ success: true, data: { id: "plan-1" } })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { updatePlanAction } from "@/app/actions/finance-plans";
import type { FinancePlan } from "@/types/finance";

import { PlanForm } from "./plan-form";

// Stated 1000 / 0 on Aug 1; a confirmation since puts savings at 5000 today.
const plan = {
  id: "plan-1",
  userId: "user-1",
  name: "Base",
  description: null,
  startMonth: new Date(Date.UTC(2026, 0, 1)),
  monthsAhead: 24,
  initialSavings: "1000",
  monthlySavingsRate: "0",
  includePortfolio: false,
  surplusToDebtsPercent: "0",
  debtStrategy: "avalanche",
  autoInvestPercent: "0",
  autoInvestMethodId: null,
  initialInvestments: "0",
  confirmationDayOfMonth: 1,
  color: "var(--chart-1)",
  balancesAsOf: "2026-08-01",
  createdAt: new Date(Date.UTC(2026, 7, 1)),
  updatedAt: new Date(Date.UTC(2026, 7, 1)),
} as unknown as FinancePlan;

function renderForm(): HTMLElement {
  const { container } = render(
    <PlanForm
      plan={plan}
      investmentMethods={[]}
      current={{ savings: 5000, investments: 0 }}
    />
  );
  return container;
}

const input = (container: HTMLElement, id: string): HTMLInputElement =>
  container.querySelector(`#${id}`) as HTMLInputElement;

async function submitted(container: HTMLElement): Promise<Record<string, unknown>> {
  fireEvent.submit(container.querySelector("#plan-form") as HTMLFormElement);
  await waitFor(() => expect(updatePlanAction).toHaveBeenCalledTimes(1));
  return vi.mocked(updatePlanAction).mock.calls[0][0] as Record<string, unknown>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("PlanForm (Settings): opening balances", () => {
  it("shows where the plan stands today, not the superseded stored figure", () => {
    const container = renderForm();
    expect(input(container, "plan-savings").value).toBe("5000.00");
    expect(input(container, "plan-init-investments").value).toBe("0.00");
  });

  it("sends only the balance the user changed, so the other one rolls forward", async () => {
    const container = renderForm();
    fireEvent.change(input(container, "plan-init-investments"), { target: { value: "200" } });

    const payload = await submitted(container);

    expect(payload.initialInvestments).toBe("200");
    expect(payload).not.toHaveProperty("initialSavings");
  });

  it("an untouched field is not sent even when today's position moves while the form is open", async () => {
    const { container, rerender } = render(
      <PlanForm plan={plan} investmentMethods={[]} current={{ savings: 5000, investments: 0 }} />
    );
    // A revalidation (or midnight) moves the plan's position under the form.
    rerender(
      <PlanForm plan={plan} investmentMethods={[]} current={{ savings: 5100, investments: 10 }} />
    );
    fireEvent.change(input(container, "plan-name"), { target: { value: "Renamed" } });

    const payload = await submitted(container);

    expect(payload).not.toHaveProperty("initialSavings");
    expect(payload).not.toHaveProperty("initialInvestments");
  });

  it("a save that leaves both balances alone sends neither", async () => {
    const container = renderForm();
    fireEvent.change(input(container, "plan-name"), { target: { value: "Renamed" } });

    const payload = await submitted(container);

    expect(payload.name).toBe("Renamed");
    expect(payload).not.toHaveProperty("initialSavings");
    expect(payload).not.toHaveProperty("initialInvestments");
  });
});
