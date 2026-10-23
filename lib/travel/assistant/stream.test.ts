import { describe, expect, it } from "vitest";

import type { TravelAssistantEvent } from "@/types/travel-assistant";

import { readEvents } from "./stream";

function body(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe("readEvents", () => {
  it("reassembles events split across chunks", async () => {
    const events: TravelAssistantEvent[] = [];
    await readEvents(
      body(['{"type":"text","te', 'xt":"Hola"}\n{"type":"status",', '"label":"Reading"}\n']),
      (e) => events.push(e)
    );
    expect(events).toEqual([
      { type: "text", text: "Hola" },
      { type: "status", label: "Reading" },
    ]);
  });

  it("keeps a last line that has no newline", async () => {
    const events: TravelAssistantEvent[] = [];
    await readEvents(body(['{"type":"text","text":"a"}']), (e) => events.push(e));
    expect(events).toEqual([{ type: "text", text: "a" }]);
  });
});
