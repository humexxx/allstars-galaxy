// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManagedCapitalCard } from "./managed-capital";
import type { ManagedContribution } from "@/lib/finance/managed-capital";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const CONTRIBUTIONS: ManagedContribution[] = [
  {
    date: "2025-08-31",
    methodId: "m1",
    methodName: "Safe Investment",
    investorId: "yalena",
    investorName: "Yalena",
    isOwn: false,
    contributed: 6700,
    holding: 7277.87,
  },
  {
    date: "2026-01-21",
    methodId: "m1",
    methodName: "Safe Investment",
    investorId: "jason",
    investorName: "Jason",
    isOwn: true,
    contributed: 1000,
    holding: 1050.05,
  },
];

/** The owner's chart is passed in and lives inside this card. */
const PERF = <div data-testid="perf">chart</div>;

function renderCard(hideValues: boolean) {
  return render(
    <ManagedCapitalCard
      contributions={CONTRIBUTIONS}
      performance={PERF}
      hideValues={hideValues}
    />
  );
}

describe("ManagedCapitalCard", () => {
  it("shows the amounts normally", () => {
    const { container } = renderCard(false);

    expect(container.textContent).toMatch(/\$[\d,]/);
  });

  it("leaves NO amount on screen when values are hidden", () => {
    // The regression this locks: the card was never given `hideValues`, so the
    // owner's figures stayed on screen while the KPI grid above them masked —
    // and the performance chart sits inside this card, which made it look like
    // the chart was leaking.
    const { container } = renderCard(true);

    expect(container.textContent).not.toMatch(/\$[\d,]/);
  });

  it("keeps the composition percentage visible while hidden", () => {
    // A share is not a balance. Hiding it would remove the one thing that
    // still says something useful in masked mode.
    renderCard(true);

    expect(screen.getByText(/% of what you manage is your own/)).toBeInTheDocument();
  });

  it("still renders the chart it wraps", () => {
    renderCard(true);

    expect(screen.getByTestId("perf")).toBeInTheDocument();
  });
});
