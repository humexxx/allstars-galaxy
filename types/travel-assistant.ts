import type Anthropic from "@anthropic-ai/sdk";

import type { TravelChangeSetInput } from "@/schemas/travel-assistant";
import type {
  TripContribution,
  TripItemCategory,
  TripItemWithStops,
  TripMemberView,
  TripPhoto,
  TripWithRelations,
} from "./travel";

/** Days something occupies, YYYY-MM-DD; `to` equals `from` for one day. */
export type TravelDaySpan = { from: string; to: string };

/** One row of a proposal card, or of the receipt once it is applied. */
export type TravelChangeLine = {
  action: "add" | "change" | "remove";
  subject: "trip" | "item" | "member" | "photo" | "payment";
  /** The trip the line belongs to; for a trip line, the trip itself. */
  tripTitle: string;
  title: string;
  category?: TripItemCategory;
  /** "Jan 16 – 24, 2027", "Price $400 → $450". */
  detail?: string;
  /** Where to open it once it exists. Absent for anything removed. */
  tripId?: string;
  /** The row the line is about, so the trip page can mark it. */
  entityId?: string;
  /** For a change: which of its fields moved. */
  fields?: string[];
  /** The trip's own days, which the card's timeline spans. */
  tripSpan?: TravelDaySpan;
  /** Its days before and after the change, for the card's timeline. */
  before?: TravelDaySpan | null;
  after?: TravelDaySpan | null;
  /** A photo line's picture. */
  imageUrl?: string;
};

export type TravelMark = "add" | "change" | "remove";

/**
 * One trip as the proposal would leave it, for the trip page to draw.
 *
 * The page renders `trip` — the database's own answer, read inside the
 * preview's rolled-back transaction — and uses `marks` to light up what is
 * new, changed or going, with `removed` and `before` holding what the after
 * picture no longer has.
 */
export type TripPreview = {
  tripId: string;
  /** Null when the proposal deletes the trip. */
  trip: TripWithRelations | null;
  /** A trip this proposal creates: it has no page of its own yet. */
  isNew: boolean;
  /** Row id → what happens to it. The trip's own id marks the trip. */
  marks: Record<string, TravelMark>;
  /** Row id → the fields a change touches. */
  fields: Record<string, string[]>;
  /** Changed items as they were, to show what moved. */
  itemsBefore: Record<string, TripItemWithStops>;
  removed: {
    items: TripItemWithStops[];
    members: TripMemberView[];
    photos: TripPhoto[];
    payments: TripContribution[];
  };
  /** The trip as it is today, for "was" figures; null for a new one. */
  before: TripWithRelations | null;
};

/** What the assistant proposed, as the card shows it and as Apply sends it back. */
export type TravelProposal = {
  /** The tool call that made it, so the conversation can refer back to it. */
  id: string;
  set: TravelChangeSetInput;
  lines: TravelChangeLine[];
  previews: TripPreview[];
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
  /** The assistant opened a trip's page for the user. */
  | { type: "navigate"; href: string }
  /** Everything this request added to the conversation, to keep for the next one. */
  | { type: "turn"; messages: TravelAssistantMessage[] }
  | { type: "error"; message: string };
