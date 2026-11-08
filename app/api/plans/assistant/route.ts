import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { canUseAssistant } from "@/lib/ai/assistant/access";
import { streamAssistantTurn } from "@/lib/ai/assistant/respond";
import { aiModel } from "@/lib/ai/models";
import { converse } from "@/lib/plans/assistant/converse";
import { getAiSettings, recordAiUsage } from "@/lib/services/ai-service";
import { listUserPlans } from "@/lib/services/finance-plan-service";
import { planOperationContext } from "@/lib/services/finance-plan-operations";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { isModuleEnabled } from "@/lib/services/module-access-service";
import { idSchema } from "@/schemas/common";
import type { PlansAssistantEvent, PlansAssistantMessage } from "@/types/plans-assistant";

/**
 * The plans assistant's conversation, streamed back as NDJSON — one
 * `PlansAssistantEvent` per line: text as it is written, a status while a
 * tool runs, a proposal card, then the turn to keep.
 *
 * A route rather than a server action because it streams. Auth is the same
 * gate the actions use, and every read and write underneath is scoped to the
 * effective user, so an admin impersonating someone plans that person's money.
 */

// A reply that reads two plans and proposes a whole new one takes a while.
export const maxDuration = 120;

const bodySchema = z.object({
  // Shapes are the API's to check; this only bounds what one request carries.
  messages: z
    .array(z.looseObject({ role: z.enum(["user", "assistant", "system"]), content: z.unknown() }))
    .min(1)
    .max(400),
  /** Sent when the page changed since the last message, or on the first one. */
  context: z.object({ planId: idSchema.nullable() }).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const ctx = await getEffectiveContext();
  if (!ctx) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!(await isModuleEnabled(ctx.effectiveUserId, "plans"))) {
    return NextResponse.json({ error: "This module is not enabled for your account" }, { status: 403 });
  }
  if (!canUseAssistant(ctx)) {
    return NextResponse.json({ error: "The plans assistant is not available" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const context = await planOperationContext(ctx.effectiveUserId);
  const model = aiModel((await getAiSettings()).model);
  const history = parsed.data.messages as PlansAssistantMessage[];
  const added: PlansAssistantMessage[] = [];
  if (parsed.data.context) {
    added.push({ role: "system", content: await contextNote(context.userId, context.today, parsed.data.context.planId) });
  }

  return streamAssistantTurn<PlansAssistantEvent>({
    added,
    signal: request.signal,
    tag: "plans-assistant",
    run: (send) =>
      converse({
        // Reads ANTHROPIC_API_KEY now, per request, never at import.
        client: new Anthropic(),
        model,
        context,
        history,
        added,
        send,
        // The spend is the admin's, even while they plan someone else's money.
        record: (usage, answeredBy) =>
          recordAiUsage({ userId: ctx.realUser.id, feature: "plans-assistant", model: answeredBy, usage }),
        signal: request.signal,
      }),
  });
}

/** Today on the reader's calendar, and the plan they are looking at. */
async function contextNote(userId: string, today: Date, planId: string | null): Promise<string> {
  const plan = planId ? (await listUserPlans(userId)).find((p) => p.id === planId) : undefined;
  const page = plan
    ? `The user has the plan "${plan.name}" (id ${plan.id}) open.`
    : "The user is on the list of their plans.";
  return `Today is ${today.toISOString().slice(0, 10)}. ${page}`;
}
