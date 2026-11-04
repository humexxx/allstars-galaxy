// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), refresh: vi.fn() };
const PLAN = "22222222-2222-4222-8222-222222222222";
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useParams: () => ({ id: PLAN }),
  usePathname: () => `/portal/plans/${PLAN}`,
}));
vi.mock("@/app/actions/plans-assistant", () => ({ applyPlanChangesAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { applyPlanChangesAction } from "@/app/actions/plans-assistant";
import type { PlanProposal, PlansAssistantEvent } from "@/types/plans-assistant";

import { PlansAssistant } from "./plans-assistant";

function stream(...replies: PlansAssistantEvent[][]) {
  const fetchMock = vi.fn(async () => {
    const events = replies.shift() ?? [];
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const e of events) controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        controller.close();
      },
    });
    return new Response(body, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof stream>, call: number) =>
  JSON.parse((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].body as string);

async function say(text: string): Promise<void> {
  fireEvent.change(screen.getByLabelText("Message the plans assistant"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
}

const outlook = (debtFree: string, in12: number) => ({
  netWorthToday: 1000,
  cashToday: 0,
  debtToday: 5000,
  owedToUserToday: 0,
  debtFree,
  netWorthIn12Months: in12,
  netWorthAtEnd: 50000,
  endMonth: "2028-10",
  interestStillToPay: 400,
});

const PROPOSAL: PlanProposal = {
  id: "toolu_1",
  set: { summary: "Pay the card faster", changes: [{ op: "update_debt", planId: PLAN, debtId: PLAN, changes: { monthlyPayment: 900 } }] },
  lines: [{ action: "update", subject: "debt", planName: "Main", title: "Card", details: ["monthlyPayment: 300.00 → 900.00"] }],
  effects: [
    {
      planId: PLAN,
      planName: "Main",
      isNew: false,
      before: outlook("Debt-free in 9 mo · Aug 2027", 4000),
      after: outlook("Debt-free in 4 mo · Mar 2027", 6000),
    },
  ],
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  render(<PlansAssistant />);
  fireEvent.click(screen.getByRole("button", { name: "Open the plans assistant" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PlansAssistant", () => {
  it("sends the plan open, shows the proposal with its effect, and applies it", async () => {
    const fetchMock = stream(
      [
        { type: "proposal", proposal: PROPOSAL },
        { type: "text", text: "Así terminas antes." },
        { type: "turn", messages: [] },
      ],
      [{ type: "text", text: "Listo" }]
    );

    await say("Paga la tarjeta más rápido");

    expect(bodyOf(fetchMock, 0).context).toEqual({ planId: PLAN });
    expect(screen.getByText("Pay the card faster")).toBeInTheDocument();
    expect(screen.getByText("Debt-free in 4 mo · Mar 2027")).toBeInTheDocument();
    expect(screen.getByText("Debt-free in 9 mo · Aug 2027")).toBeInTheDocument();

    vi.mocked(applyPlanChangesAction).mockResolvedValueOnce({
      success: true,
      data: { lines: PROPOSAL.lines, createdPlans: [] },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });
    expect(applyPlanChangesAction).toHaveBeenCalledWith(PROPOSAL.set);
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();

    // The model hears what the user did, and is not told about the page again.
    await say("Gracias");
    const second = bodyOf(fetchMock, 1);
    expect(second.context).toBeUndefined();
    expect(second.messages.at(-1).content[0].text).toMatch(/the user applied "Pay the card faster"; it is saved/);
  });

  it("keeps the card open with the reason when Apply fails", async () => {
    stream([{ type: "proposal", proposal: PROPOSAL }]);
    await say("Paga la tarjeta");
    vi.mocked(applyPlanChangesAction).mockResolvedValueOnce({ success: false, error: "Nothing was saved: Invalid input" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    });
    expect(screen.getByText("Nothing was saved: Invalid input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });
});
