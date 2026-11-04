export type AiSettings = {
  /** A model id from `AI_MODELS`. */
  model: string;
  /** YYYY-MM-DD, or null when nobody has entered it. */
  apiKeyExpiresOn: string | null;
};

export type AiSpend = { costUsd: number; requests: number };

export type AiUsageSummary = {
  today: AiSpend;
  /** Newest first, this month always included even with no spend. */
  months: (AiSpend & { month: string })[];
};
