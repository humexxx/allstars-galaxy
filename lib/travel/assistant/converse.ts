import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AiModel, AiTokenUsage } from "@/lib/ai/models";
import {
  getAssistantTrip,
  listAssistantTrips,
  previewTravelChanges,
  TravelChangeError,
} from "@/lib/services/travel-assistant-service";
import { travelChangeSetSchema, type TravelChangeSetInput } from "@/schemas/travel-assistant";
import type { TravelAssistantEvent, TravelAssistantMessage } from "@/types/travel-assistant";

import { getTripInputSchema, TRAVEL_ASSISTANT_SYSTEM, travelAssistantTools } from "./prompt";

/** Model calls one message may make: reads, a proposal, a retry and an answer fit easily. */
const MAX_CALLS = 8;

type Block = Anthropic.Beta.BetaContentBlock;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

/**
 * One user message's worth of conversation: model calls and tool runs until
 * the model answers in words.
 *
 * Append-only by design. Everything the turn adds goes onto `added` exactly
 * as the API returned it, the browser stores it, and the next request sends
 * it back unchanged — the model's reasoning stays valid only on a history
 * nobody has edited.
 */
export async function converse({
  client,
  model,
  userId,
  history,
  added,
  send,
  record,
  signal,
}: {
  client: Pick<Anthropic, "beta">;
  /** The model the admins picked in Settings. */
  model: AiModel;
  userId: string;
  history: TravelAssistantMessage[];
  added: TravelAssistantMessage[];
  send: (event: TravelAssistantEvent) => void;
  /**
   * Books each call's tokens against the month's credit, under the model
   * that answered: after a safety fallback that is not the one asked for.
   */
  record: (usage: AiTokenUsage, answeredBy: string) => Promise<void>;
  signal?: AbortSignal;
}): Promise<void> {
  let parseRetries = 0;

  for (let call = 0; call < MAX_CALLS; call++) {
    const stream = client.beta.messages.stream(
      {
        model: model.id,
        max_tokens: 16000,
        // A safety decline is retried on the model Anthropic picks for it,
        // inside the same call, instead of ending the conversation.
        ...(model.fallbacks
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {}),
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: TRAVEL_ASSISTANT_SYSTEM,
        tools: travelAssistantTools(model),
        messages: [...history, ...added],
      },
      { signal }
    );
    stream.on("text", (text) => send({ type: "text", text }));
    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const query = (block.input as { query?: unknown }).query;
        send({ type: "status", label: typeof query === "string" ? `Searching the web: ${query}` : "Searching the web" });
      }
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      parseRetries = 0;
    } catch (err) {
      // Only a tool input too broken to parse is worth asking again; the
      // turn was never appended, so the retry starts from the same history.
      if (err instanceof Anthropic.APIError || signal?.aborted || parseRetries++ >= 2) throw err;
      continue;
    }

    // Billed whatever happens next, so counted before anything can return.
    await record(message.usage, message.model).catch((err: unknown) =>
      console.error("[travel-assistant] usage not recorded:", err)
    );

    const content = echoable(message.content);
    added.push({ role: "assistant", content });

    // A long web search hands the turn back unfinished; sending it back as
    // it is lets the model carry on where it stopped.
    if (message.stop_reason === "pause_turn") continue;

    // A decline can cut a tool call off mid-input: never run that turn's tools.
    if (message.stop_reason === "refusal") {
      send({ type: "text", text: "I can't help with that one." });
      return;
    }

    const toolUses = content.filter((b): b is ToolUse => b.type === "tool_use");
    if (toolUses.length === 0) return;

    const results: ToolResult[] =
      message.stop_reason === "max_tokens"
        ? // A truncated input can still parse; answer every call so the
          // history stays valid, and let the model try a smaller one.
          toolUses.map((tool) => failed(tool, "Your output was cut off. Propose fewer changes at a time."))
        : await Promise.all(toolUses.map((tool) => runTool(tool, userId, send)));
    added.push({ role: "user", content: results });
  }

  send({ type: "text", text: "\n\nI stopped there. Ask me to carry on." });
}

/**
 * The response as it may be sent back.
 *
 * After a mid-answer fallback, what the declining model wrote before the
 * `fallback` block is not part of the conversation the fallback model
 * continued: its reasoning and its tool calls are dropped (text stays). Its
 * tool calls are therefore never run either.
 */
export function echoable(content: Block[]): Block[] {
  const boundary = content.map((b) => b.type).lastIndexOf("fallback");
  if (boundary === -1) return content;
  return content.filter(
    (b, i) =>
      i >= boundary || !(b.type === "thinking" || b.type === "redacted_thinking" || b.type === "tool_use")
  );
}

function failed(tool: ToolUse, message: string): ToolResult {
  return { type: "tool_result", tool_use_id: tool.id, is_error: true, content: message };
}

function ok(tool: ToolUse, content: unknown): ToolResult {
  return {
    type: "tool_result",
    tool_use_id: tool.id,
    content: typeof content === "string" ? content : JSON.stringify(content),
  };
}

async function runTool(
  tool: ToolUse,
  userId: string,
  send: (event: TravelAssistantEvent) => void
): Promise<ToolResult> {
  try {
    switch (tool.name) {
      case "list_trips":
        send({ type: "status", label: "Reading your trips" });
        return ok(tool, await listAssistantTrips(userId));

      case "get_trip": {
        const input = getTripInputSchema.safeParse(tool.input);
        if (!input.success) return failed(tool, "tripId must be a trip id from list_trips");
        send({ type: "status", label: "Reading the trip" });
        const trip = await getAssistantTrip(userId, input.data.tripId);
        return trip ? ok(tool, trip) : failed(tool, "No trip of the user's has that id");
      }

      case "propose_changes": {
        const parsed = travelChangeSetSchema.safeParse(tool.input);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
          return failed(tool, `The proposal is not valid. ${issues.join("; ")}`);
        }
        send({ type: "status", label: "Checking the changes" });
        const { lines, previews } = await previewTravelChanges(userId, parsed.data);
        send({
          type: "proposal",
          proposal: { id: tool.id, set: tool.input as TravelChangeSetInput, lines, previews },
        });
        return ok(
          tool,
          "The user now sees these changes drawn on the trip's page, with Apply and Discard. Nothing is saved until they apply them; a note will say whether they did."
        );
      }

      case "open_trip": {
        const input = getTripInputSchema.safeParse(tool.input);
        if (!input.success) return failed(tool, "tripId must be a trip id from list_trips");
        const trips = await listAssistantTrips(userId);
        const trip = trips.find((t) => t.id === input.data.tripId);
        if (!trip) return failed(tool, "No trip of the user's has that id");
        send({ type: "navigate", href: `/portal/entertainment/travel-planner/${trip.id}` });
        return ok(tool, `The user now has "${trip.title}" open.`);
      }

      default:
        return failed(tool, `There is no tool called ${tool.name}`);
    }
  } catch (err) {
    if (err instanceof TravelChangeError) return failed(tool, err.message);
    console.error("[travel-assistant] tool failed:", err);
    return failed(tool, "That failed on the server. Try again, or tell the user.");
  }
}
