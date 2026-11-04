import type Anthropic from "@anthropic-ai/sdk";

import type { PlanChangeSetInput } from "@/schemas/plans-assistant";

/** One change of a proposal, in words for the card. */
export type PlanChangeLine = {
  action: "create" | "add" | "update" | "remove";
  subject: "plan" | "income" | "expense" | "debt";
  /** The plan it belongs to. */
  planName: string;
  /** What changes: the line's name, "Settings", "Main plan". */
  title: string;
  /** A few short facts: amounts, or "field: old → new". */
  details: string[];
};

/** What a plan comes to, by the app's own projection. */
export type PlanOutlook = {
  netWorthToday: number;
  cashToday: number;
  debtToday: number;
  owedToUserToday: number;
  /** "Debt-free in 5 mo · Feb 2027", "No debt", "Beyond horizon". */
  debtFree: string;
  netWorthIn12Months: number;
  netWorthAtEnd: number;
  /** The projection's last month, YYYY-MM. */
  endMonth: string | null;
  interestStillToPay: number;
};

/** One touched plan's outlook before and after the proposal. */
export type PlanEffect = {
  /** Null for a plan the proposal creates. */
  planId: string | null;
  planName: string;
  isNew: boolean;
  before: PlanOutlook | null;
  after: PlanOutlook;
};

/** A proposal as the chat holds it until the user applies or discards it. */
export type PlanProposal = {
  /** The tool call that made it. */
  id: string;
  set: PlanChangeSetInput;
  lines: PlanChangeLine[];
  effects: PlanEffect[];
};

/** What Apply wrote: the lines, and the ids of the plans it created. */
export type AppliedPlanChanges = {
  lines: PlanChangeLine[];
  createdPlans: { ref: string; id: string; name: string }[];
};

/** A conversation as the API stores it; the browser keeps it and sends it back. */
export type PlansAssistantMessage = Anthropic.Beta.BetaMessageParam;

/** One line of the assistant's NDJSON stream. */
export type PlansAssistantEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  | { type: "proposal"; proposal: PlanProposal }
  /** The assistant opened a plan's page for the user. */
  | { type: "navigate"; href: string }
  /** Everything this request added to the conversation, to keep for the next one. */
  | { type: "turn"; messages: PlansAssistantMessage[] }
  | { type: "error"; message: string };
