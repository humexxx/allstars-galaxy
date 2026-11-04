/**
 * When to warn admins that the Claude API key is running out.
 *
 * A month out, at twenty days, at ten — then every day until it expires, and
 * every day after, since the assistant has stopped working by then. Each
 * warning is a "stage"; a stage is shown once and remembered, so the daily
 * ones carry the day in their name — and every stage carries the expiry date,
 * so a new key starts its reminders from scratch.
 */
export type KeyExpiryWarning = {
  stage: string;
  /** Negative once the key has expired. */
  daysLeft: number;
};

const DAY = 86_400_000;

export function daysUntil(today: string, day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

export function keyExpiryWarning(expiresOn: string | null, today: string): KeyExpiryWarning | null {
  if (!expiresOn) return null;
  const daysLeft = daysUntil(today, expiresOn);
  if (daysLeft > 30) return null;
  const stage = (name: string): KeyExpiryWarning => ({ stage: `${expiresOn}/${name}`, daysLeft });
  if (daysLeft > 20) return stage("30");
  if (daysLeft > 10) return stage("20");
  if (daysLeft >= 0) return stage(`day:${today}`);
  return stage(`expired:${today}`);
}
