import Anthropic from "@anthropic-ai/sdk";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import { canUseAssistant } from "@/lib/ai/assistant/access";
import { converse } from "@/lib/ai/assistant/converse";
import { streamAssistantTurn } from "@/lib/ai/assistant/respond";
import { aiModel } from "@/lib/ai/models";
import { getAiSettings, recordAiUsage } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { sportsContextNote } from "@/lib/sports/assistant/context";
import { SPORTS_ASSISTANT_SYSTEM, SPORTS_ASSISTANT_TOOLS } from "@/lib/sports/assistant/prompt";
import { revalidateFavoritePaths, runSportsTool } from "@/lib/sports/assistant/tools";
import { getRequestTimeZone } from "@/lib/utils/request-today";
import { sportsAssistantContextSchema } from "@/schemas/sports-assistant";
import type { SportsAssistantEvent, SportsAssistantMessage } from "@/types/sports-assistant";

/**
 * The sports assistant's conversation, streamed back as NDJSON — one
 * `SportsAssistantEvent` per line: text as it is written, a status while a
 * tool runs, a page to open or to refresh, then the turn to keep.
 *
 * A route rather than a server action because it streams. Admins only, as
 * Travel's: every message spends the owner's API credit. Every read and write
 * underneath is the effective user's, so an admin impersonating someone sees
 * and changes that person's favourites.
 */

export const maxDuration = 120;

const bodySchema = z.object({
  // Shapes are the API's to check; this only bounds what one request carries.
  messages: z
    .array(z.looseObject({ role: z.enum(["user", "assistant", "system"]), content: z.unknown() }))
    .min(1)
    .max(400),
  /** Sent when the page changed since the last message, or on the first one. */
  context: sportsAssistantContextSchema.optional(),
});

export async function POST(request: Request): Promise<Response> {
  const ctx = await getEffectiveContext();
  if (!ctx) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!canUseAssistant(ctx)) {
    return NextResponse.json({ error: "The sports assistant is not available" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const userId = ctx.effectiveUserId;
  const [settings, timeZone] = await Promise.all([getAiSettings(), getRequestTimeZone()]);
  const model = aiModel(settings.model);
  const history = parsed.data.messages as SportsAssistantMessage[];
  const added: SportsAssistantMessage[] = [];
  if (parsed.data.context) {
    added.push({ role: "system", content: await sportsContextNote(userId, timeZone, parsed.data.context.path) });
  }

  // Expired once the answer is out: a revalidatePath made inside the stream
  // runs after the handler has returned, when Next has already settled the
  // request's revalidations, and would be dropped. after() settles its own.
  let favoritesChanged = false;
  after(() => {
    if (favoritesChanged) revalidateFavoritePaths();
  });

  return streamAssistantTurn<SportsAssistantEvent>({
    added,
    signal: request.signal,
    tag: "sports-assistant",
    run: (send) =>
      converse({
        // Reads ANTHROPIC_API_KEY now, per request, never at import.
        client: new Anthropic(),
        model,
        system: SPORTS_ASSISTANT_SYSTEM,
        tools: SPORTS_ASSISTANT_TOOLS,
        runTool: (tool) =>
          runSportsTool(
            tool,
            {
              userId,
              role: ctx.realRole,
              isImpersonating: ctx.isImpersonating,
              timeZone,
              onFavoritesChanged: () => {
                favoritesChanged = true;
              },
            },
            send
          ),
        history,
        added,
        send,
        // The spend is the admin's, even while they act for someone else.
        record: (usage, answeredBy) =>
          recordAiUsage({ userId: ctx.realUser.id, feature: "sports-assistant", model: answeredBy, usage }),
        tag: "sports-assistant",
        signal: request.signal,
      }),
  });
}
