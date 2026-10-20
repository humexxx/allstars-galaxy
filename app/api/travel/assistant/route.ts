import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { aiModel } from "@/lib/ai/models";
import { getAiSettings, recordAiUsage } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { listAssistantTrips } from "@/lib/services/travel-assistant-service";
import { canUseTravelAssistant } from "@/lib/travel/assistant/access";
import { converse } from "@/lib/travel/assistant/converse";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import { idSchema } from "@/schemas/common";
import type { TravelAssistantEvent, TravelAssistantMessage } from "@/types/travel-assistant";

/**
 * The travel assistant's conversation, streamed back as NDJSON — one
 * `TravelAssistantEvent` per line: text as it is written, a status while a
 * tool runs, a proposal card, then the turn to keep.
 *
 * A route rather than a server action because it streams. Auth is the same
 * gate the actions use, and every read and write underneath is scoped to the
 * effective user, so an admin impersonating someone plans that person's trips.
 */

// A reply that reads two trips and proposes a whole holiday takes a while.
export const maxDuration = 120;

const bodySchema = z.object({
  // Shapes are the API's to check; this only bounds what one request carries.
  messages: z
    .array(z.looseObject({ role: z.enum(["user", "assistant", "system"]), content: z.unknown() }))
    .min(1)
    .max(400),
  /** Sent when the page changed since the last message, or on the first one. */
  context: z.object({ tripId: idSchema.nullable() }).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const ctx = await getEffectiveContext();
  if (!ctx) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!canUseTravelAssistant(ctx)) {
    return NextResponse.json({ error: "The travel assistant is not available" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const userId = ctx.effectiveUserId;
  const model = aiModel((await getAiSettings()).model);
  const history = parsed.data.messages as TravelAssistantMessage[];
  const added: TravelAssistantMessage[] = [];
  if (parsed.data.context) {
    added.push({ role: "system", content: await contextNote(userId, parsed.data.context.tripId) });
  }

  const encoder = new TextEncoder();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The browser can close the panel mid-answer; nothing is listening then.
      const send = (event: TravelAssistantEvent): void => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      try {
        await converse({
          // Reads ANTHROPIC_API_KEY now, per request, never at import.
          client: new Anthropic(),
          model,
          userId,
          history,
          added,
          send,
          // The spend is the admin's, even while they plan someone else's trip.
          record: (usage, answeredBy) =>
            recordAiUsage({ userId: ctx.realUser.id, feature: "travel-assistant", model: answeredBy, usage }),
          signal: request.signal,
        });
      } catch (err) {
        if (!request.signal.aborted) send({ type: "error", message: describe(err) });
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

/** Today on the reader's calendar, and what they are looking at. */
async function contextNote(userId: string, tripId: string | null): Promise<string> {
  const today = await getRequestTodayIso();
  const trip = tripId ? (await listAssistantTrips(userId)).find((t) => t.id === tripId) : undefined;
  const page = trip
    ? `The user has the trip "${trip.title}" (id ${trip.id}) open.`
    : "The user is on the list of their trips.";
  return `Today is ${today}. ${page}`;
}

/** What the owner can act on, without the API's raw body. */
function describe(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Claude API key was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "Claude is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.APIError) {
    const detail = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    return `The Claude API answered ${err.status ?? "with an error"}${detail ? `: ${detail}` : ""}`;
  }
  console.error("[travel-assistant] request failed:", err);
  return "Something went wrong. Try again.";
}
