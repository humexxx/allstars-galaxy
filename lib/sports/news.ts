import type { F1Data, F1NewsArticle, F1Race, NewsStory, Team } from "@/types/sports";

import { leadRace } from "./f1-weekend";

/** What a race weekend's news is made of: its sessions and their results. */
const RACE_WORDS =
  /\b(practice|qualifying|sprint|pole|wins?|won|victory|podium|crash|penalty|disqualified|result|championship|title)\b/i;

/** A wire's betting lines and fantasy advice: on the tab, never leading it. */
const NOT_THE_NEWS = /\b(betting|odds|fantasy|props|parlays?|best bets)\b/i;

/** Stories this close to the newest are its batch: F1's wire refreshes daily. */
const SAME_DAY_MS = 24 * 3_600_000;

/** What a sport's reader cares about, for the lead story. */
export type NewsInterest = {
  /** Teams or players: a point each a story names (three at most). */
  names: string[];
  /** The event on now or next, or just played: a point for naming it. */
  places?: string[];
  /** What the event's news is made of: a point for a match. */
  words?: RegExp;
};

/** Lower case, without accents: "Atlético" is filed as "Atletico" as often as not. */
const lower = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * The story to lead a News tab with, and the rest in the wire's order.
 *
 * Only the latest day's stories compete — for F1's wire, which has no time
 * of its own, the day its refresh saw them — and a video, a game recap or a
 * betting or fantasy piece leads nothing. Among the rest, four points for a picture to lead with, one
 * for each name the reader follows (three at most), one for the event on
 * now and one for what its news is made of; ties go to the earlier in the
 * wire, which comes in its own order of importance.
 */
export function leadStory(
  stories: NewsStory[],
  interest: NewsInterest
): { lead: NewsStory | null; rest: NewsStory[] } {
  if (stories.length === 0) return { lead: null, rest: [] };
  const newest = Math.max(...stories.map((s) => Date.parse(s.at)));
  const names = interest.names.map(lower).filter((n) => n.length > 1);
  const places = (interest.places ?? []).map(lower).filter((p) => p.length > 2);

  const score = (story: NewsStory): number => {
    const text = lower([story.headline, story.description ?? "", ...story.about].join(" "));
    return (
      (story.image ? 4 : 0) +
      Math.min(3, names.filter((n) => text.includes(n)).length) +
      (places.some((p) => text.includes(p)) ? 1 : 0) +
      (interest.words?.test(text) ? 1 : 0)
    );
  };

  let lead: NewsStory | null = null;
  let best = -1;
  for (const story of stories) {
    if (story.kind !== "story" || NOT_THE_NEWS.test(story.headline)) continue;
    if (newest - Date.parse(story.at) > SAME_DAY_MS) continue;
    const s = score(story);
    if (s > best) {
      best = s;
      lead = story;
    }
  }
  return { lead, rest: stories.filter((s) => s !== lead) };
}

/**
 * What a team goes by in a headline: its short name, and its name without a
 * club's letters — "FC Barcelona" is "Barcelona" at ESPN, "SSC Napoli" is
 * "Napoli".
 */
function teamNames(team: Team): string[] {
  const bare = team.name.replace(/\b(FC|CF|AFC|SSC|AC|SC|CD|UD|RC|SD|FK|BC)\b\.?/g, "").replace(/\s+/g, " ").trim();
  return [...new Set([team.shortName, bare].filter((n) => n.length > 2))];
}

/**
 * A team sport's reader: the teams they picked in its match list first, then
 * the top of its table — who the news is most likely to be worth reading
 * about.
 */
export function teamInterest(
  teams: ReadonlyMap<string, Team>,
  picked: readonly string[],
  leaders: readonly string[]
): NewsInterest {
  const ids = [...new Set([...picked, ...leaders])];
  return {
    names: ids.flatMap((id) => {
      const team = teams.get(id);
      return team ? teamNames(team) : [];
    }),
  };
}

/** The widest picture the provider sent: its list runs from small crops to full-bleed. */
function widest(images: F1NewsArticle["images"]): NewsStory["image"] {
  const best = images.reduce<F1NewsArticle["images"][number] | null>(
    (a, b) => (b.url && (!a || (b.width ?? 0) > (a.width ?? 0)) ? b : a),
    null
  );
  return best?.url ? { url: best.url, ...(best.alt ? { alt: best.alt } : {}) } : null;
}

/** F1's stored wire as stories, each opened on our own article page. */
export function fromF1Wire(items: F1NewsArticle[]): NewsStory[] {
  return items.map((item) => ({
    id: item.id,
    headline: item.headline,
    description: item.description,
    href: `/news/f1/${item.id}`,
    external: false,
    image: widest(item.images),
    at: new Date(item.firstSeenAt).toISOString(),
    kind: "story",
    about: [],
  }));
}

/** "United States" of "United States Grand Prix", the town, the country. */
function raceWords(race: F1Race | undefined): string[] {
  if (!race) return [];
  return [race.name.replace(/\s*Grand Prix$/i, ""), race.location, race.country ?? ""];
}

/** An F1 reader: the race weekend on now or next, or just run, and the title's top three. */
export function f1Interest(data: Pick<F1Data, "races" | "drivers">): NewsInterest {
  return {
    names: [...data.drivers]
      .sort((a, b) => a.position - b.position)
      .slice(0, 3)
      .map((d) => d.shortName.split(" ").slice(-1)[0] ?? ""),
    places: [
      ...raceWords(leadRace(data.races)),
      ...raceWords(data.races.findLast((r) => r.status === "completed")),
    ],
    words: RACE_WORDS,
  };
}
