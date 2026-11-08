import type Anthropic from "@anthropic-ai/sdk";

import type { TradingChangeSetInput } from "@/schemas/trading-assistant";

/** One change of a proposal, in words for the card. */
export type TradingChangeLine = {
  action: "open" | "close" | "add" | "update" | "remove" | "deposit" | "withdraw";
  /** "Long 10 NVDA @ 138.20", "Deposit $2,000.00". */
  title: string;
  /** A few short facts: when, the P&L, "field: old → new". */
  details: string[];
  /** The P&L a closing change realises; null when it realises none. */
  pnl: number | null;
};

/** The account as the card compares it, by the journal's own maths. */
export type TradingOutlook = {
  balance: number;
  openPositions: number;
  /** Net P&L of the current calendar month. */
  monthPnl: number;
  winRate: number | null;
};

/** A proposal as the chat holds it until the user applies or discards it. */
export type TradingProposal = {
  /** The tool call that made it. */
  id: string;
  set: TradingChangeSetInput;
  lines: TradingChangeLine[];
  before: TradingOutlook;
  after: TradingOutlook;
};

/** A conversation as the API stores it; the browser keeps it and sends it back. */
export type TradingAssistantMessage = Anthropic.Beta.BetaMessageParam;

/** One line of the assistant's NDJSON stream. */
export type TradingAssistantEvent =
  | { type: "text"; text: string }
  | { type: "status"; label: string }
  | { type: "proposal"; proposal: TradingProposal }
  /** Everything this request added to the conversation, to keep for the next one. */
  | { type: "turn"; messages: TradingAssistantMessage[] }
  | { type: "error"; message: string };
