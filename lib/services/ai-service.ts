import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiSettings, aiUsage } from "@/db/schema";
import { aiCost, aiModel, type AiTokenUsage } from "@/lib/ai/models";
import type { UpdateAiSettingsData } from "@/schemas/ai-settings";
import type { AiSettings, AiUsageSummary } from "@/types/ai";

/** The app's AI settings, with the defaults filled in when nothing is saved. */
export async function getAiSettings(): Promise<AiSettings> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1));
  return {
    // A model since retired from the list falls back to the default.
    model: aiModel(row?.model).id,
    apiKeyExpiresOn: row?.apiKeyExpiresOn ?? null,
  };
}

export async function updateAiSettings(
  userId: string,
  data: UpdateAiSettingsData
): Promise<AiSettings> {
  const values = { ...data, updatedBy: userId, updatedAt: new Date() };
  await db
    .insert(aiSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: aiSettings.id, set: values });
  return getAiSettings();
}

/** One Claude call's spend, priced at the model's list rates. */
export async function recordAiUsage(entry: {
  userId: string;
  feature: string;
  model: string;
  usage: AiTokenUsage;
}): Promise<void> {
  const model = aiModel(entry.model);
  await db.insert(aiUsage).values({
    userId: entry.userId,
    feature: entry.feature,
    model: model.id,
    inputTokens: entry.usage.input_tokens,
    outputTokens: entry.usage.output_tokens,
    cacheCreationInputTokens: entry.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: entry.usage.cache_read_input_tokens ?? 0,
    costUsd: aiCost(model, entry.usage).toFixed(6),
  });
}

/**
 * Today's spend and the last six months', on the reader's calendar.
 *
 * Months are calendar months: the plan's credit renews on its own billing
 * day, which no API exposes to an individual account.
 */
export async function getAiUsageSummary(timeZone: string, today: string): Promise<AiUsageSummary> {
  const local = sql`(${aiUsage.createdAt} at time zone ${timeZone})`;
  const thisMonth = today.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const since = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);

  const [months, [day]] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${local}), 'YYYY-MM')`,
        costUsd: sql<string>`sum(${aiUsage.costUsd})`,
        requests: sql<number>`count(*)::int`,
      })
      .from(aiUsage)
      .where(sql`${local} >= ${since}::date`)
      // By position: the time zone is a parameter, and Postgres will not
      // match a GROUP BY expression to a SELECT one across two parameters.
      .groupBy(sql`1`)
      .orderBy(sql`1 desc`),
    db
      .select({
        costUsd: sql<string | null>`sum(${aiUsage.costUsd})`,
        requests: sql<number>`count(*)::int`,
      })
      .from(aiUsage)
      .where(sql`${local}::date = ${today}::date`),
  ]);

  const byMonth = months.map((r) => ({
    month: r.month,
    costUsd: Number(r.costUsd),
    requests: r.requests,
  }));
  if (byMonth[0]?.month !== thisMonth) byMonth.unshift({ month: thisMonth, costUsd: 0, requests: 0 });

  return {
    today: { costUsd: Number(day?.costUsd ?? 0), requests: day?.requests ?? 0 },
    months: byMonth,
  };
}
