import type Anthropic from "@anthropic-ai/sdk";

/** The conversation as the API stores it; the browser keeps it and sends it back. */
export type SportsAssistantMessage = Anthropic.Beta.BetaMessageParam;

/** One line of the sports assistant's NDJSON stream. */
export type SportsAssistantEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  /** The assistant opened a page for the user. */
  | { type: "navigate"; href: string }
  /** Something the page shows changed (a favourite): re-render it. */
  | { type: "refresh" }
  /** Everything this request added to the conversation, to keep for the next one. */
  | { type: "turn"; messages: SportsAssistantMessage[] }
  | { type: "error"; message: string };
