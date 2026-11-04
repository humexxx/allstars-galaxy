import { describe, expect, it } from "vitest";

import { readEvents } from "./stream";

type Event = { type: "text"; text: string } | { type: "status"; label: string };

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
    const events: Event[] = [];
    await readEvents<Event>(
      body(['{"type":"text","te', 'xt":"Hola"}\n{"type":"status",', '"label":"Reading"}\n']),
      (e) => events.push(e)
    );
    expect(events).toEqual([
      { type: "text", text: "Hola" },
      { type: "status", label: "Reading" },
    ]);
  });

  it("keeps a last line that has no newline", async () => {
    const events: Event[] = [];
    await readEvents<Event>(body(['{"type":"text","text":"a"}']), (e) => events.push(e));
    expect(events).toEqual([{ type: "text", text: "a" }]);
  });
});
