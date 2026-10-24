import type { F1Data, F1NewsArticle, F1Race } from "@/types/sports";

import { leadRace } from "./f1-weekend";

/** What a weekend's news is made of: its sessions and their results. */
const RACE_WORDS =
  /\b(practice|qualifying|sprint|pole|wins?|won|victory|podium|crash|penalty|disqualified|result|championship|title)\b/i;

/** Stories seen this close to the newest one are its batch: the refresh runs daily. */
const SAME_REFRESH_MS = 24 * 3_600_000;

const lower = (s: string): string => s.toLowerCase();

/** "United States" of "United States Grand Prix", the town, the country. */
function raceWords(race: F1Race | undefined): string[] {
  if (!race) return [];
  return [race.name.replace(/\s*Grand Prix$/i, ""), race.location, race.country ?? ""]
    .map((w) => lower(w.trim()))
    .filter((w) => w.length > 2);
}

/**
 * The story to lead the news with, and the rest in the wire's order.
 *
 * The wire carries no time of its own — `firstSeenAt` is when the daily
 * refresh saw a story — so only the latest refresh's stories compete. Among
 * them, a point each for being about the race weekend on now or next, or
 * the one just run (its name, town or country), for a session or a result,
 * for each of the championship's top three it names, and four for a
 * picture to lead with; ties go to the earlier in the wire, which comes in
 * its own order of importance.
 */
export function leadStory(
  items: F1NewsArticle[],
  data: Pick<F1Data, "races" | "drivers">
): { lead: F1NewsArticle | null; rest: F1NewsArticle[] } {
  if (items.length === 0) return { lead: null, rest: [] };
  const newest = Math.max(...items.map((i) => new Date(i.firstSeenAt).getTime()));
  const weekend = [
    ...raceWords(leadRace(data.races)),
    ...raceWords(data.races.findLast((r) => r.status === "completed")),
  ];
  const leaders = [...data.drivers]
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map((d) => lower(d.shortName.split(" ").slice(-1)[0] ?? ""))
    .filter(Boolean);

  const score = (item: F1NewsArticle): number => {
    const text = lower(`${item.headline} ${item.description ?? ""}`);
    return (
      (item.images.some((i) => i.url) ? 4 : 0) +
      (weekend.some((w) => text.includes(w)) ? 1 : 0) +
      (RACE_WORDS.test(text) ? 1 : 0) +
      leaders.filter((name) => text.includes(name)).length
    );
  };

  let lead: F1NewsArticle | null = null;
  let best = -1;
  for (const item of items) {
    if (newest - new Date(item.firstSeenAt).getTime() > SAME_REFRESH_MS) continue;
    const s = score(item);
    if (s > best) {
      best = s;
      lead = item;
    }
  }
  return { lead, rest: items.filter((i) => i !== lead) };
}
