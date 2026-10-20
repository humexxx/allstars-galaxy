// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "22222222-2222-4222-8222-222222222222";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: TRIP }) }));
vi.mock("@/app/actions/travel-assistant", () => ({
  applyTravelChangesAction: vi.fn(),
  undoTravelChangesAction: vi.fn(),
}));

import {
  applyTravelChangesAction,
  undoTravelChangesAction,
} from "@/app/actions/travel-assistant";
import type { TravelAssistantEvent, TravelProposal } from "@/types/travel-assistant";

import { TravelAssistant } from "./travel-assistant";

const PROPOSAL: TravelProposal = {
  id: "toolu_1",
  set: {
    summary: "Universal on the 18th",
    changes: [{ op: "add_item", tripId: TRIP, item: { title: "Universal Studios", category: "activity" } }],
  },
  lines: [
    { action: "add", subject: "item", tripTitle: "Orlando", title: "Universal Studios", category: "activity", detail: "Jan 18, 2027" },
  ],
};

/** A fetch whose every call streams the next scripted list of events. */
function stream(...replies: TravelAssistantEvent[][]) {
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
  fireEvent.change(screen.getByLabelText("Message the travel assistant"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
  });
}

beforeEach(() => {
  render(<TravelAssistant />);
  fireEvent.click(screen.getByRole("button", { name: "Open the travel assistant" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TravelAssistant", () => {
  it("sends the message with the open trip, then streams the answer and the card", async () => {
    const fetchMock = stream([
      { type: "text", text: "Te propongo " },
      { type: "text", text: "esto:" },
      { type: "proposal", proposal: PROPOSAL },
      { type: "turn", messages: [{ role: "assistant", content: "…" }] },
    ]);

    await say("Agregá Universal el 18");

    expect(bodyOf(fetchMock, 0)).toEqual({
      messages: [{ role: "user", content: [{ type: "text", text: "Agregá Universal el 18" }] }],
      context: { tripId: TRIP },
    });
    expect(await screen.findByText("Te propongo esto:")).toBeInTheDocument();
    expect(screen.getByText("Universal on the 18th")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("applies a card, then tells the model so on the next message", async () => {
    const fetchMock = stream(
      [{ type: "proposal", proposal: PROPOSAL }, { type: "turn", messages: [{ role: "assistant", content: "a" }] }],
      [{ type: "text", text: "Listo" }]
    );
    vi.mocked(applyTravelChangesAction).mockResolvedValue({
      success: true,
      data: { lines: PROPOSAL.lines, undoToken: "receipt" },
    });

    await say("Agregá Universal");
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    });

    expect(applyTravelChangesAction).toHaveBeenCalledWith(PROPOSAL.set);
    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

    await say("Gracias");
    const second = bodyOf(fetchMock, 1);
    // The whole conversation goes back, the model's turn included…
    expect(second.messages[1]).toEqual({ role: "assistant", content: "a" });
    // …and the new message opens with what the user did with the card.
    expect(second.messages[2].content[0].text).toMatch(/^\[Note: the user applied "Universal on the 18th"; it is saved\./);
    expect(second.messages[2].content[1].text).toBe("Gracias");
    // Still on the same trip: no need to say so again.
    expect(second.context).toBeUndefined();
  });

  it("cancels without writing anything", async () => {
    stream([{ type: "proposal", proposal: PROPOSAL }]);
    await say("Agregá Universal");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(applyTravelChangesAction).not.toHaveBeenCalled();
  });

  it("undoes the newest applied card", async () => {
    stream([{ type: "proposal", proposal: PROPOSAL }]);
    vi.mocked(applyTravelChangesAction).mockResolvedValue({
      success: true,
      data: { lines: PROPOSAL.lines, undoToken: "receipt" },
    });
    vi.mocked(undoTravelChangesAction).mockResolvedValue({ success: true });

    await say("Agregá Universal");
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Apply" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });

    expect(undoTravelChangesAction).toHaveBeenCalledWith("receipt");
    await waitFor(() => expect(screen.getByText("Undone")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("shows the server's error instead of an answer", async () => {
    stream([{ type: "error", message: "The Claude API key was rejected." }]);
    await say("Hola");
    expect(await screen.findByText("The Claude API key was rejected.")).toBeInTheDocument();
  });
});
