import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

vi.mock("@/lib/services/travel-assistant-service", () => {
  class TravelChangeError extends Error {}
  return {
    TravelChangeError,
    listAssistantTrips: vi.fn(async () => [{ id: "t1", title: "Orlando" }]),
    getAssistantTrip: vi.fn(async () => ({ id: TRIP, title: "Orlando", items: [] })),
    previewTravelChanges: vi.fn(async () => [
      { action: "add", subject: "item", tripTitle: "Orlando", title: "Universal Studios" },
    ]),
  };
});

import {
  getAssistantTrip,
  previewTravelChanges,
} from "@/lib/services/travel-assistant-service";
import type { TravelAssistantEvent, TravelAssistantMessage } from "@/types/travel-assistant";

import { converse, echoable } from "./converse";

const TRIP = "22222222-2222-4222-8222-222222222222";
const USER = "user-1";

type Block = Anthropic.Beta.BetaContentBlock;
type Turn = { text?: string; content: Block[]; stop_reason: string } | Error;

const text = (t: string) => ({ type: "text", text: t, citations: null }) as Block;
const toolUse = (name: string, input: unknown, id = "toolu_1") =>
  ({ type: "tool_use", id, name, input }) as Block;

/** A client whose every stream plays the next scripted turn. */
function fakeClient(turns: Turn[]) {
  const sent: TravelAssistantMessage[][] = [];
  const stream = vi.fn((params: { messages: TravelAssistantMessage[] }) => {
    sent.push(structuredClone(params.messages));
    const turn = turns.shift()!;
    let onText: ((t: string) => void) | undefined;
    return {
      on: (event: string, cb: (t: string) => void) => {
        if (event === "text") onText = cb;
      },
      finalMessage: async () => {
        if (turn instanceof Error) throw turn;
        if (turn.text) onText?.(turn.text);
        return { content: turn.content, stop_reason: turn.stop_reason };
      },
    };
  });
  return { client: { beta: { messages: { stream } } } as unknown as Pick<Anthropic, "beta">, stream, sent };
}

async function run(turns: Turn[]) {
  const { client, stream, sent } = fakeClient(turns);
  const added: TravelAssistantMessage[] = [];
  const events: TravelAssistantEvent[] = [];
  await converse({
    client,
    userId: USER,
    history: [{ role: "user", content: "Plan Orlando" }],
    added,
    send: (e) => events.push(e),
  });
  return { added, events, stream, sent };
}

beforeEach(() => vi.clearAllMocks());

describe("converse", () => {
  it("streams a plain answer and keeps it for the next message", async () => {
    const { added, events } = await run([{ text: "¿Qué fechas?", content: [text("¿Qué fechas?")], stop_reason: "end_turn" }]);
    expect(events).toEqual([{ type: "text", text: "¿Qué fechas?" }]);
    expect(added).toEqual([{ role: "assistant", content: [text("¿Qué fechas?")] }]);
  });

  it("reads a trip, then answers with what it read", async () => {
    const { added, events, sent } = await run([
      { content: [toolUse("get_trip", { tripId: TRIP })], stop_reason: "tool_use" },
      { text: "Listo", content: [text("Listo")], stop_reason: "end_turn" },
    ]);
    expect(getAssistantTrip).toHaveBeenCalledWith(USER, TRIP);
    expect(events[0]).toEqual({ type: "status", label: "Reading the trip" });
    expect(added.map((m) => m.role)).toEqual(["assistant", "user", "assistant"]);
    // The second call carries the first exchange, unchanged.
    expect(sent[1].slice(1, 3)).toEqual(added.slice(0, 2));
  });

  it("shows a proposal as a card and tells the model nothing is saved yet", async () => {
    const set = {
      summary: "Tickets",
      changes: [{ op: "add_item", tripId: TRIP, item: { title: "Universal Studios", category: "activity" } }],
    };
    const { added, events } = await run([
      { content: [toolUse("propose_changes", set, "toolu_9")], stop_reason: "tool_use" },
      { content: [text("Revisá la tarjeta")], stop_reason: "end_turn" },
    ]);
    expect(previewTravelChanges).toHaveBeenCalledOnce();
    expect(events).toContainEqual({
      type: "proposal",
      proposal: { id: "toolu_9", set, lines: [expect.objectContaining({ title: "Universal Studios" })] },
    });
    const result = (added[1].content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(result).toMatchObject({ tool_use_id: "toolu_9" });
    expect(result.is_error).toBeUndefined();
    expect(result.content).toMatch(/Nothing is saved until they apply it/);
  });

  it("hands an invalid proposal back to the model to fix", async () => {
    const { added } = await run([
      { content: [toolUse("propose_changes", { summary: "x", changes: [] })], stop_reason: "tool_use" },
      { content: [text("Perdón")], stop_reason: "end_turn" },
    ]);
    expect(previewTravelChanges).not.toHaveBeenCalled();
    expect((added[1].content as Anthropic.Beta.BetaToolResultBlockParam[])[0]).toMatchObject({
      is_error: true,
      content: expect.stringMatching(/^The proposal is not valid\. changes:/),
    });
  });

  it("runs no tools from a declined turn", async () => {
    const { added, events } = await run([
      { content: [toolUse("get_trip", { tripId: TRIP })], stop_reason: "refusal" },
    ]);
    expect(getAssistantTrip).not.toHaveBeenCalled();
    expect(added).toHaveLength(1);
    expect(events).toContainEqual({ type: "text", text: "I can't help with that one." });
  });

  it("asks again when a tool input could not be parsed at all", async () => {
    const { added, stream } = await run([
      new SyntaxError("Unexpected end of JSON input"),
      { content: [text("Hola")], stop_reason: "end_turn" },
    ]);
    expect(stream).toHaveBeenCalledTimes(2);
    expect(added).toHaveLength(1);
  });
});

describe("echoable", () => {
  it("drops what the declining model began before a fallback, text aside", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "s" },
      text("Partial"),
      toolUse("get_trip", { tripId: TRIP }),
      { type: "fallback", from: {}, to: {}, trigger: {} },
      text("Done"),
    ] as unknown as Block[];
    expect(echoable(content).map((b) => b.type)).toEqual(["text", "fallback", "text"]);
  });

  it("leaves an ordinary answer alone", () => {
    const content = [text("a"), toolUse("list_trips", {})];
    expect(echoable(content)).toBe(content);
  });
});
