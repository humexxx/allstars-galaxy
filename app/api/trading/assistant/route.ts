import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canUseAssistant } from "@/lib/ai/assistant/access";
import { streamAssistantTurn } from "@/lib/ai/assistant/respond";
import { aiModel } from "@/lib/ai/models";
import { converse } from "@/lib/trading/assistant/converse";
import { tradingContextNote } from "@/lib/trading/assistant/prompt";
import { getAiSettings, recordAiUsage } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import type { TradingAssistantEvent, TradingAssistantMessage } from "@/types/trading-assistant";

/**
 * The trading assistant's conversation, streamed back as NDJSON — one
 * `TradingAssistantEvent` per line: text as it is written, a status while a
 * tool runs, a proposal card, then the turn to keep.
 *
 * A route rather than a server action because it streams. Auth is the same
 * gate the actions use, and every read and write underneath is scoped to the
 * effective user, so an admin impersonating someone keeps that person's journal.
 */

export const maxDuration = 120;

const bodySchema = z.object({
  // Shapes are the API's to check; this only bounds what one request carries.
  messages: z
    .array(z.looseObject({ role: z.enum(["user", "assistant", "system"]), content: z.unknown() }))
    .min(1)
    .max(400),
  /** Sent on the first message: the model is told the date, time and zone. */
  context: z.object({}).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const ctx = await getEffectiveContext();
  if (!ctx) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!canUseAssistant(ctx)) {
    return NextResponse.json({ error: "The trading assistant is not available" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const timeZone = await getRequestTimeZone();
  const model = aiModel((await getAiSettings()).model);
  const history = parsed.data.messages as TradingAssistantMessage[];
  const added: TradingAssistantMessage[] = [];
  if (parsed.data.context) added.push({ role: "system", content: tradingContextNote(timeZone, new Date()) });

  return streamAssistantTurn<TradingAssistantEvent>({
    added,
    signal: request.signal,
    tag: "trading-assistant",
    run: (send) =>
      converse({
        // Reads ANTHROPIC_API_KEY now, per request, never at import.
        client: new Anthropic(),
        model,
        context: { userId: ctx.effectiveUserId, timeZone },
        history,
        added,
        send,
        // The spend is the admin's, even while they keep someone else's journal.
        record: (usage, answeredBy) =>
          recordAiUsage({ userId: ctx.realUser.id, feature: "trading-assistant", model: answeredBy, usage }),
        signal: request.signal,
      }),
  });
}
