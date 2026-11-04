import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import {
  converse as converseWith,
  toolFailed as failed,
  toolOk as ok,
  type AssistantToolResult as ToolResult,
  type AssistantToolUse as ToolUse,
} from "@/lib/ai/assistant/converse";
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

/**
 * The travel assistant's turn: the shared loop (`lib/ai/assistant/converse`)
 * with the Travel Planner's prompt and tools, every read and write scoped to
 * `userId`.
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
  record: (usage: AiTokenUsage, answeredBy: string) => Promise<void>;
  signal?: AbortSignal;
}): Promise<void> {
  await converseWith({
    client,
    model,
    system: TRAVEL_ASSISTANT_SYSTEM,
    tools: travelAssistantTools(model),
    runTool: (tool) => runTool(tool, userId, send),
    history,
    added,
    send,
    record,
    tag: "travel-assistant",
    truncated: "Your output was cut off. Propose fewer changes at a time.",
    signal,
  });
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
