import type { TravelAssistantEvent } from "@/types/travel-assistant";

/**
 * Reads the assistant's NDJSON stream, one event per line, as lines arrive.
 * A chunk can end mid-line, so what follows the last newline waits for the
 * next one.
 */
export async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: TravelAssistantEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as TravelAssistantEvent);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as TravelAssistantEvent);
}
