/**
 * The Claude models an admin can pick for the app, with their list prices.
 *
 * Prices are US dollars per million tokens, as published when this list was
 * written: they turn the token counts each response reports into the spend
 * Settings shows. A cache write costs 1.25× the input price (the 5-minute
 * cache); a cache read has its own price.
 */
export type AiModel = {
  id: string;
  label: string;
  /** One line for the picker. */
  blurb: string;
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  /**
   * Whether a safety decline can be retried server-side on another model.
   * Claude Haiku 5.5 has no fallback: sending the parameter does nothing for
   * it but keep a declined request declined.
   */
  fallbacks: boolean;
  /** The web search tool this model takes: the filtered variant needs a 4.6+ Opus or Sonnet. */
  webSearch: "web_search_20260209" | "web_search_20250305";
};

export const AI_MODELS: readonly AiModel[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    blurb: "The most careful planner. $4 in / $20 out per million tokens.",
    inputPerMTok: 4,
    outputPerMTok: 20,
    cacheReadPerMTok: 0.2,
    fallbacks: true,
    webSearch: "web_search_20260209",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    blurb: "Fast and capable, at half Opus's price. $2 in / $10 out.",
    inputPerMTok: 2,
    outputPerMTok: 10,
    cacheReadPerMTok: 0.2,
    fallbacks: true,
    webSearch: "web_search_20260209",
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    blurb: "The cheapest, for simple edits. $0.10 in / $0.50 out.",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    cacheReadPerMTok: 0.01,
    fallbacks: false,
    webSearch: "web_search_20250305",
  },
];

/** Web search is billed per search on top of the tokens its results add. */
export const WEB_SEARCH_USD = 0.01;

export const DEFAULT_AI_MODEL = AI_MODELS[0].id;

export const AI_MODEL_IDS = AI_MODELS.map((m) => m.id) as [string, ...string[]];

/** What the plan's API credit gives each month (Max 5x). */
export const MONTHLY_AI_CREDIT_USD = 100;

export function aiModel(id: string | null | undefined): AiModel {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}

export type AiTokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** A response's cost in dollars, from the usage it reports. */
export function aiCost(model: AiModel, usage: AiTokenUsage): number {
  const written = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  return (
    (usage.input_tokens * model.inputPerMTok +
      written * model.inputPerMTok * 1.25 +
      read * model.cacheReadPerMTok +
      usage.output_tokens * model.outputPerMTok) /
      1_000_000 +
    (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD
  );
}
