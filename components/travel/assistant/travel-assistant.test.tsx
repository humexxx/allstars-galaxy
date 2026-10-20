// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "22222222-2222-4222-8222-222222222222";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: TRIP }),
  useRouter: () => router,
  usePathname: () => `/portal/entertainment/travel-planner/${TRIP}`,
}));
vi.mock("@/app/actions/travel-assistant", () => ({
  applyTravelChangesAction: vi.fn(),
  undoTravelChangesAction: vi.fn(),
}));
vi.mock("@/lib/travel/photo-upload", () => ({
  uploadTripPhoto: vi.fn(async (file: File) => ({
    url: `https://cdn.test/${file.name}`,
    storagePath: `11111111-1111-4111-8111-111111111111/assistant/${file.name}`,
  })),
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
  previews: [],
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
    // On the card in the chat, and on the bar that decides it from the page.
    expect(screen.getAllByText("Universal on the 18th")).toHaveLength(2);
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

  it("sends attached pictures for Claude to see, with what it needs to save one", async () => {
    const fetchMock = stream([{ type: "text", text: "Veo la reserva" }]);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "booking.png", { type: "image/png" })] } });
    });
    await say("Agregá esta reserva");

    const [message] = bodyOf(fetchMock, 0).messages;
    expect(message.content).toEqual([
      { type: "image", source: { type: "url", url: "https://cdn.test/booking.png" } },
      {
        type: "text",
        text: "[Attached images: 1. url=https://cdn.test/booking.png storagePath=11111111-1111-4111-8111-111111111111/assistant/booking.png]",
      },
      { type: "text", text: "Agregá esta reserva" },
    ]);
    expect(screen.getByAltText("Attached image")).toBeInTheDocument();
  });
});

describe("TravelAssistant dictation", () => {
  it("writes what is said after what was typed", async () => {
    let instance: { onresult: (e: unknown) => void; onend: () => void } | null = null;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror = null;
      start() {
        instance = this as never;
      }
      stop() {
        this.onend?.();
      }
    }
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    // Typing re-renders the panel, which then finds the browser can listen.
    const box = screen.getByLabelText("Message the travel assistant");
    fireEvent.change(box, { target: { value: "En Orlando" } });

    fireEvent.click(screen.getByRole("button", { name: /Dictate/ }));
    act(() => {
      instance!.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: "agregá un parque" }], { isFinal: true })] });
    });
    expect(box).toHaveValue("En Orlando agregá un parque");
    fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }));
    expect(screen.getByRole("button", { name: /Dictate/ })).toBeInTheDocument();
  });
});

describe("TravelAssistant on the page", () => {
  const OTHER = "33333333-3333-4333-8333-333333333333";
  const ON_PAGE: TravelProposal = {
    ...PROPOSAL,
    previews: [
      {
        tripId: OTHER,
        trip: null,
        isNew: false,
        marks: {},
        fields: {},
        itemsBefore: {},
        removed: { items: [], members: [], photos: [], payments: [] },
        before: null,
      },
    ],
  };

  it("opens the trip the proposal changes and steps the chat aside for it", async () => {
    stream([{ type: "proposal", proposal: ON_PAGE }, { type: "text", text: "Mirá la página" }]);
    await say("Cambiá el otro viaje");

    expect(router.push).toHaveBeenCalledWith(`/portal/entertainment/travel-planner/${OTHER}`);
    // The decision moves to the page: a bar with the summary and the buttons.
    const bar = screen.getByRole("region", { name: "Changes to review" });
    expect(bar).toHaveTextContent("Universal on the 18th");
    expect(bar).toHaveTextContent("1 change waiting for you");
    // The bar carries the way back to the chat; the corner button steps aside.
    expect(screen.getByRole("button", { name: "Open the travel assistant" })).toHaveClass("hidden");
  });

  it("applies from the bar, and offers to undo", async () => {
    stream([{ type: "proposal", proposal: ON_PAGE }]);
    vi.mocked(applyTravelChangesAction).mockResolvedValue({
      success: true,
      data: { lines: PROPOSAL.lines, undoToken: "receipt" },
    });
    await say("Cambiá el otro viaje");
    const bar = screen.getByRole("region", { name: "Changes to review" });
    await act(async () => {
      fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    });
    expect(applyTravelChangesAction).toHaveBeenCalledWith(PROPOSAL.set);
    expect(screen.queryByRole("region", { name: "Changes to review" })).toBeNull();
  });

  it("follows the assistant when it opens a trip", async () => {
    stream([{ type: "navigate", href: `/portal/entertainment/travel-planner/${OTHER}` }, { type: "text", text: "Listo" }]);
    await say("Vamos a Islandia");
    expect(router.push).toHaveBeenCalledWith(`/portal/entertainment/travel-planner/${OTHER}`);
  });
});
