import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AssistantMessage } from "./converse";

/** What every assistant's stream ends on: an error, then the turn to keep. */
export type AssistantEndEvent =
  | { type: "turn"; messages: AssistantMessage[] }
  | { type: "error"; message: string };

/**
 * One message's answer, streamed back as NDJSON — one event per line — and
 * closed on the turn the browser keeps for the next message.
 *
 * `added` starts with whatever the route put in front of the conversation (a
 * system note) and `run` appends the model's turn to it.
 */
export function streamAssistantTurn<E extends { type: string }>({
  added,
  signal,
  tag,
  run,
}: {
  added: AssistantMessage[];
  signal: AbortSignal;
  /** Names the assistant in the server's log. */
  tag: string;
  run: (send: (event: E) => void) => Promise<void>;
}): Response {
  const encoder = new TextEncoder();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The browser can close the panel mid-answer; nothing is listening then.
      const send = (event: E | AssistantEndEvent): void => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await run(send);
      } catch (err) {
        if (!signal.aborted) send({ type: "error", message: describe(err, tag) });
        // A system note must be followed by a reply; one left without its
        // reply would make the next message's history invalid.
        while (added.at(-1)?.role === "system") added.pop();
      }
      // Whatever reached the history ends on a complete exchange (a reply,
      // or tool results), which is a valid place to pick up from.
      send({ type: "turn", messages: added });
      if (open) controller.close();
    },
    cancel() {
      open = false;
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** What the owner can act on, without the API's raw body. */
function describe(err: unknown, tag: string): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Claude API key was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "Claude is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.APIError) {
    const detail = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return `The Claude API answered ${err.status ?? "with an error"}${detail ? `: ${detail}` : ""}`;
  }
  console.error(`[${tag}] request failed:`, err);
  return "Something went wrong. Try again.";
}
