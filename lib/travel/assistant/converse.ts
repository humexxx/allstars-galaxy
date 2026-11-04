import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { z } from "zod";

import { converse as converseWith } from "@/lib/ai/assistant/converse";
import { defineTool, ToolError, toolbox } from "@/lib/ai/assistant/tools";
import type { AiModel, AiTokenUsage } from "@/lib/ai/models";
import {
  getAssistantTrip,
  listAssistantTrips,
  previewTravelChanges,
  TravelChangeError,
} from "@/lib/services/travel-assistant-service";
import { travelChangeSetSchema, type TravelChangeSetInput } from "@/schemas/travel-assistant";
import type { TravelAssistantEvent, TravelAssistantMessage } from "@/types/travel-assistant";

import { getTripInputSchema, TRAVEL_ASSISTANT_SYSTEM } from "./prompt";

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
    runTool: (tool) => travelTools.run(tool, { userId }, send),
    history,
    added,
    send,
    record,
    tag: "travel-assistant",
    truncated: "Your output was cut off. Propose fewer changes at a time.",
    signal,
  });
}

type TravelToolContext = { userId: string };

/** The travel assistant's tools: each one's description and input beside what it runs. */
const travelTools = toolbox<TravelToolContext, TravelAssistantEvent>(
  [
    defineTool({
      name: "list_trips",
      description:
        "The user's trips: id, title, destination, first and last day, currency. Use it to find a trip by name or date.",
      input: z.object({}),
      status: "Reading your trips",
      run: (_input, { userId }) => listAssistantTrips(userId),
    }),
    defineTool({
      name: "get_trip",
      description:
        "One trip in full: its fields, its members (id, name, email, fixed share), its photos (id, url, caption), its payments (id, who, amount, day) and every item with its id, dates, route, price and travellers.",
      input: getTripInputSchema,
      status: "Reading the trip",
      run: async ({ tripId }, { userId }) => {
        const trip = await getAssistantTrip(userId, tripId);
        if (!trip) throw new ToolError("No trip of the user's has that id");
        return trip;
      },
    }),
    defineTool({
      name: "open_trip",
      description:
        "Open a trip's page for the user. Do it first whenever the conversation turns to a trip that is not the one they have open, so they see the trip you are talking about.",
      input: getTripInputSchema,
      run: async ({ tripId }, { userId }, { send }) => {
        const trip = (await listAssistantTrips(userId)).find((t) => t.id === tripId);
        if (!trip) throw new ToolError("No trip of the user's has that id");
        send({ type: "navigate", href: `/portal/entertainment/travel-planner/${trip.id}` });
        return `The user now has "${trip.title}" open.`;
      },
    }),
    defineTool({
      name: "propose_changes",
      description:
        "Propose creating, changing or deleting trips, items, members, photos and payments. The user sees the changes on the trip's page and applies or discards them; nothing is written until they apply. Changes run in order, so a create_trip can be followed by add_item, add_member, add_photo or add_payment entries that name its ref.",
      input: travelChangeSetSchema,
      // A whole trip's plan is a large input; stream it as it is written.
      eagerInput: true,
      invalid: "The proposal is not valid.",
      status: "Checking the changes",
      run: async (set, { userId }, { tool, send }) => {
        try {
          const { lines, previews } = await previewTravelChanges(userId, set);
          send({
            type: "proposal",
            proposal: { id: tool.id, set: tool.input as TravelChangeSetInput, lines, previews },
          });
        } catch (err) {
          if (err instanceof TravelChangeError) throw new ToolError(err.message);
          throw err;
        }
        return "The user now sees these changes drawn on the trip's page, with Apply and Discard. Nothing is saved until they apply them; a note will say whether they did.";
      },
    }),
  ],
  "travel-assistant"
);

/** The app's own tools, then the model's web search variant. */
export function travelAssistantTools(model: AiModel): Anthropic.Beta.BetaToolUnion[] {
  return [...travelTools.definitions, { type: model.webSearch, name: "web_search", max_uses: 3 }];
}
