import "server-only";

import { revalidatePath } from "next/cache";

import { visibleSections } from "@/components/portal/nav-config";
import { z } from "zod";

import { defineTool, ToolError, toolbox } from "@/lib/ai/assistant/tools";
import { SPORTS } from "@/lib/data/sports/registry";
import { getTennisData } from "@/lib/services/espn-tennis-service";
import { FOOTBALL_COMPETITIONS } from "@/lib/services/football-service";
import { logImpersonatedMutation } from "@/lib/services/impersonation";
import { getF1Data } from "@/lib/services/jolpica-f1-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { listUserSportsFavorites, setSportFavorite } from "@/lib/services/sports-service";
import { loadSport } from "@/lib/sports/load";
import { f1RacePath, SPORTS_PATH, sportPath, tournamentPath } from "@/lib/sports/paths";
import { findTournament } from "@/lib/sports/racquet";
import {
  getSportInputSchema,
  navigateInputSchema,
  setFavoriteInputSchema,
  type SportsDestinationData,
} from "@/schemas/sports-assistant";
import type { SportsAssistantEvent } from "@/types/sports-assistant";
import type { LolRegion, SportId } from "@/types/sports";
import type { UserRole } from "@/types/user";

import { summarizeSport } from "./summary";

/** Who is asking, and on whose behalf: every read and write is the effective user's. */
export type SportsToolContext = {
  userId: string;
  /** The signed-in account's role and session, which decide the pages it may open. */
  role: UserRole | null;
  isImpersonating: boolean;
  /** The reader's zone, for "today" and kickoff times. */
  timeZone: string;
  /** A favourite was added or removed, so the paths the favourites action expires must be. */
  onFavoritesChanged: () => void;
};

type Tab = { id: string; label: string };

const LEAGUE_TABS: Tab[] = [
  { id: "overview", label: "Overview: matches and standings" },
  { id: "bracket", label: "Playoffs bracket" },
  { id: "news", label: "News" },
];

/** The tabs of each sport's page in the hub, as `?tab=` names them. */
const SPORT_TABS: Record<SportId, Tab[]> = {
  football: [
    { id: "overview", label: "Overview: matches and table" },
    { id: "knockout", label: "Knockout bracket (cups)" },
    { id: "news", label: "News" },
  ],
  f1: [
    { id: "overview", label: "Overview: next race, calendar and standings" },
    { id: "drivers", label: "Overview on the drivers' championship" },
    { id: "constructors", label: "Overview on the constructors' championship" },
    { id: "news", label: "News" },
  ],
  nba: LEAGUE_TABS,
  nfl: LEAGUE_TABS,
  mlb: [LEAGUE_TABS[0], { id: "bracket", label: "Postseason bracket" }, LEAGUE_TABS[2]],
  nhl: LEAGUE_TABS,
  padel: [
    { id: "overview", label: "Overview: tournaments and rankings" },
    { id: "news", label: "News" },
  ],
  tennis: [
    { id: "overview", label: "Overview: tournaments and rankings" },
    { id: "news", label: "News" },
  ],
  surf: [
    { id: "overview", label: "Overview: events and rankings" },
    { id: "draw", label: "Draw of the event on" },
    { id: "news", label: "News" },
  ],
  lol: [
    { id: "matches", label: "Matches" },
    { id: "standings", label: "Standings" },
    { id: "play-ins", label: "Play-ins (international events)" },
    { id: "swiss", label: "Swiss stage (Worlds)" },
    { id: "playoffs", label: "Playoffs bracket" },
    { id: "news", label: "News" },
  ],
};

/** The World Cup is laid out as a tournament: groups where a league has its table. */
const WORLD_CUP_TABS: Tab[] = [
  { id: "groups", label: "Groups" },
  { id: "knockout", label: "Knockout bracket" },
  { id: "news", label: "News" },
];

const TOURNAMENT_TABS: Tab[] = [
  { id: "bracket", label: "Bracket (the default)" },
  { id: "overview", label: "Overview" },
];

const RACE_TABS: Tab[] = [
  { id: "overview", label: "Overview (the default)" },
  { id: "results", label: "Results of each session" },
];

const LOL_COMPETITIONS: { id: LolRegion; name: string }[] = [
  { id: "worlds", name: "Worlds (while it runs)" },
  { id: "msi", name: "MSI (while it runs)" },
  { id: "first-stand", name: "First Stand (while it runs)" },
  { id: "lec", name: "LEC" },
  { id: "lcs", name: "LCS" },
  { id: "lck", name: "LCK" },
  { id: "lpl", name: "LPL" },
];

function competitionsOf(sport: SportId): { id: string; name: string }[] | undefined {
  if (sport === "football") return FOOTBALL_COMPETITIONS.map((c) => ({ id: c.id, name: c.name }));
  if (sport === "lol") return LOL_COMPETITIONS;
  return undefined;
}

/**
 * Read fresh every time, never through the request-cached list: one answer
 * can change a favourite and then read the favourites again.
 */
async function favoriteIds(userId: string): Promise<string[]> {
  return (await listUserSportsFavorites(userId)).map((row) => row.sportId);
}

const tabIds = (tabs: Tab[]): string => tabs.map((t) => t.id).join(", ");

/** Every sport, the user's favourites marked, with its competitions and tabs. */
export async function listSports(userId: string): Promise<unknown> {
  const favorites = new Set(await favoriteIds(userId));
  return {
    sports: SPORTS.map((s) => {
      const competitions = competitionsOf(s.id);
      return {
        id: s.id,
        label: s.label,
        favorite: favorites.has(s.id),
        ...(competitions ? { competitions } : {}),
        tabs: SPORT_TABS[s.id].map((t) => `${t.id}: ${t.label}`),
      };
    }),
    worldCupTabs: tabIds(WORLD_CUP_TABS),
    tournamentPageTabs: `Padel and tennis tournament pages: ${tabIds(TOURNAMENT_TABS)}`,
    racePageTabs: `F1 race pages: ${tabIds(RACE_TABS)}`,
  };
}

type Page = { id: string; label: string; section?: string; url: string };

/** The portal's pages the user's sidebar shows them, and Settings from the user menu. */
export function listPages(ctx: Pick<SportsToolContext, "role" | "isImpersonating">): Page[] {
  const pages = visibleSections(ctx.role ?? "user", ctx.isImpersonating)
    .filter((section) => !section.disabled)
    .flatMap((section) =>
      section.items
        .filter((item) => !item.disabled)
        .map((item) => ({
          id: item.title.toLowerCase().replace(/\s+/g, "-"),
          label: item.title,
          ...(section.label ? { section: section.label } : {}),
          url: item.url,
        }))
    );
  return [...pages, { id: "settings", label: "Settings", url: "/portal/settings" }];
}

export class DestinationError extends Error {}

/**
 * Where a destination leads, built with the same path helpers the pages link
 * with; anything the app has no page for is a `DestinationError` the model
 * can correct.
 */
export async function resolveDestination(
  destination: SportsDestinationData,
  ctx: Pick<SportsToolContext, "role" | "isImpersonating">
): Promise<{ href: string; label: string }> {
  if (destination.kind === "page") {
    const pages = listPages(ctx);
    const page = pages.find((p) => p.id === destination.page);
    if (!page) {
      throw new DestinationError(`There is no page "${destination.page}". Pages: ${pages.map((p) => p.id).join(", ")}.`);
    }
    return { href: page.url, label: page.label };
  }

  const { sportId, competition, tab, tournamentId, round } = destination;
  const sport = SPORTS.find((s) => s.id === sportId)!;

  if (tournamentId !== undefined) {
    if (sportId !== "padel" && sportId !== "tennis") {
      throw new DestinationError("Only padel and tennis have tournament pages.");
    }
    checkTab(tab, TOURNAMENT_TABS, "a tournament page");
    const data = sportId === "padel" ? (await getPadelData()).men : (await getTennisData()).atp;
    const found = findTournament(data, tournamentId);
    if (!found) throw new DestinationError(`No ${sport.label} tournament has the id "${tournamentId}". Ids come from get_sport.`);
    return { href: tournamentPath(sportId, found.id, tab), label: found.name };
  }

  if (round !== undefined) {
    if (sportId !== "f1") throw new DestinationError("Only F1 has race pages.");
    checkTab(tab, RACE_TABS, "a race page");
    const race = (await getF1Data()).races.find((r) => r.round === round);
    if (!race) throw new DestinationError(`This F1 season has no round ${round}.`);
    return { href: f1RacePath(round, tab), label: race.name };
  }

  const competitions = competitionsOf(sportId);
  if (competition !== undefined && !competitions?.some((c) => c.id === competition)) {
    throw new DestinationError(
      competitions
        ? `${sport.label} has no competition "${competition}". Competitions: ${competitions.map((c) => c.id).join(", ")}.`
        : `${sport.label} has no competitions to pick.`
    );
  }
  checkTab(tab, competition === "world-cup" ? WORLD_CUP_TABS : SPORT_TABS[sportId], sport.label);
  const named = competitions?.find((c) => c.id === competition)?.name.replace(/ \(while it runs\)$/, "");
  return {
    href: sportPath(sportId, { league: competition, tab }),
    label: [named ?? sport.label, tab && `${tab} tab`].filter(Boolean).join(", "),
  };
}

function checkTab(tab: string | undefined, tabs: Tab[], where: string): void {
  if (tab !== undefined && !tabs.some((t) => t.id === tab)) {
    throw new DestinationError(`${where} has no "${tab}" tab. Tabs: ${tabIds(tabs)}.`);
  }
}

/**
 * Adds or removes a favourite for the effective user, as the favourites
 * sheet's action does: the same service, the same impersonation log, and the
 * same paths expired (by the route, once the answer is out — see
 * `revalidateFavoritePaths`).
 */
export async function setFavorite(
  ctx: Pick<SportsToolContext, "userId" | "onFavoritesChanged">,
  sportId: SportId,
  favorite: boolean
): Promise<{ changed: boolean }> {
  const was = (await favoriteIds(ctx.userId)).includes(sportId);
  if (was === favorite) return { changed: false };
  await setSportFavorite(ctx.userId, sportId, favorite);
  await logImpersonatedMutation({
    action: favorite ? "sportFavorite.add" : "sportFavorite.remove",
    entityTable: "user_sports_preferences",
    metadata: { sportId },
  });
  ctx.onFavoritesChanged();
  return { changed: true };
}

/** What `setSportFavoriteAction` expires: the sports pages and the dashboard. */
export function revalidateFavoritePaths(): void {
  revalidatePath(SPORTS_PATH);
  revalidatePath("/portal");
}

const sportLabel = (sportId: SportId): string => SPORTS.find((s) => s.id === sportId)?.label ?? sportId;

/** The sports assistant's tools: each one's description and input beside what it runs. */
const sportsTools = toolbox<SportsToolContext, SportsAssistantEvent>(
  [
    defineTool({
      name: "list_sports",
      description:
        "Every sport: id, label, whether it is one of the user's favourites, its competitions (football leagues, LoL leagues and events) with ids, and the tabs of its page.",
      input: z.object({}),
      status: "Reading the sports",
      run: (_input, ctx) => listSports(ctx.userId),
    }),
    defineTool({
      name: "get_sport",
      description:
        "One sport as its page shows it: yesterday's and today's results, live games and the next ones (kickoff on the user's clock), the standings, a bracket being played, the tournaments or races with their ids, rankings, and the latest headlines with links.",
      input: getSportInputSchema,
      status: (input) => `Reading ${sportLabel(input.sportId)}`,
      run: async ({ sportId, competition, team, tournament }, ctx) => {
        const payload = await loadSport(sportId, { league: sportId === "football" ? competition : undefined });
        return summarizeSport(payload, { timeZone: ctx.timeZone, now: Date.now(), competition, team, tournament });
      },
    }),
    defineTool({
      name: "list_pages",
      description: "The other parts of the app the user can open, with ids for navigate.",
      input: z.object({}),
      run: async (_input, ctx) => listPages(ctx),
    }),
    defineTool({
      name: "navigate",
      description:
        "Open a page for the user: a sport (optionally a competition and a tab), a padel or tennis tournament, an F1 race, or another part of the app.",
      input: navigateInputSchema,
      run: async ({ destination }, ctx, { send }) => {
        try {
          const { href, label } = await resolveDestination(destination, ctx);
          send({ type: "navigate", href });
          return `The user now has ${label} open.`;
        } catch (err) {
          if (err instanceof DestinationError) throw new ToolError(err.message);
          throw err;
        }
      },
    }),
    defineTool({
      name: "set_favorite",
      description: "Add a sport to the user's favourites, or remove it.",
      input: setFavoriteInputSchema,
      status: ({ sportId, favorite }) =>
        favorite ? `Adding ${sportLabel(sportId)} to your favourites` : `Removing ${sportLabel(sportId)}`,
      run: async ({ sportId, favorite }, ctx, { send }) => {
        const label = sportLabel(sportId);
        const { changed } = await setFavorite(ctx, sportId, favorite);
        if (!changed) {
          return `${label} was already ${favorite ? "one of" : "not among"} the user's favourites; nothing changed.`;
        }
        send({ type: "refresh" });
        return `${label} is now ${favorite ? "one of" : "no longer among"} the user's favourites.`;
      },
    }),
  ],
  "sports-assistant"
);

/** What the API is told the sports assistant can call. */
export const SPORTS_ASSISTANT_TOOLS = sportsTools.definitions;

/** Runs one of the sports assistant's tools for the effective user. */
export const runSportsTool = sportsTools.run;
