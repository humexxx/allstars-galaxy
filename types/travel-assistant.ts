import type Anthropic from "@anthropic-ai/sdk";

import type { TravelChangeSetInput } from "@/schemas/travel-assistant";
import type { TripItemCategory } from "./travel";

/** Days something occupies, YYYY-MM-DD; `to` equals `from` for one day. */
export type TravelDaySpan = { from: string; to: string };

/** One row of a proposal card, or of the receipt once it is applied. */
export type TravelChangeLine = {
  action: "add" | "change" | "remove";
  subject: "trip" | "item" | "member" | "photo";
  /** The trip the line belongs to; for a trip line, the trip itself. */
  tripTitle: string;
  title: string;
  category?: TripItemCategory;
  /** "Jan 16 – 24, 2027", "Price $400 → $450". */
  detail?: string;
  /** Where to open it once it exists. Absent for anything removed. */
  tripId?: string;
  /** The trip's own days, which the card's timeline spans. */
  tripSpan?: TravelDaySpan;
  /** Its days before and after the change, for the card's timeline. */
  before?: TravelDaySpan | null;
  after?: TravelDaySpan | null;
  /** A photo line's picture. */
  imageUrl?: string;
};

/** What the assistant proposed, as the card shows it and as Apply sends it back. */
export type TravelProposal = {
  /** The tool call that made it, so the conversation can refer back to it. */
  id: string;
  set: TravelChangeSetInput;
  lines: TravelChangeLine[];
};

export type AppliedTravelChanges = {
  lines: TravelChangeLine[];
  /** Null when undo is not configured on this server (no signing secret). */
  undoToken: string | null;
};

/** The conversation as the API stores it; the browser keeps it and sends it back. */
export type TravelAssistantMessage = Anthropic.Beta.BetaMessageParam;

/** One line of the assistant's NDJSON stream. */
export type TravelAssistantEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  | { type: "proposal"; proposal: TravelProposal }
  /** Everything this request added to the conversation, to keep for the next one. */
  | { type: "turn"; messages: TravelAssistantMessage[] }
  | { type: "error"; message: string };
