import "server-only";

import { PADEL_DATA } from "@/lib/data/sports/padel";
import type {
  PadelData,
  PlayerRanking,
  RacquetData,
  RacquetTour,
  RacquetTournament,
} from "@/types/sports";
import { cachedFeed, upstreamSignal } from "./upstream";

const BASE_URL = "https://padelapi.org/api";
const REVALIDATE_SECONDS = 300;
const RANKING_LIMIT = 15;
/** Premier Padel's own tiers; FIP events run alongside every week and drowned them. */
const PREMIER_LEVELS = "major,p1,p2,finals";
/** Far enough back to show the last few results next to what is coming. */
const CALENDAR_LOOKBACK_DAYS = 45;

type PadelCategory = "men" | "women";

type PadelApiPlayer = {
  id: number;
  name: string;
  category?: PadelCategory;
  nationality?: string;
  ranking: number;
  ranking_diff: number;
  points: number;
};

type PadelApiTournament = {
  id: number;
  name: string;
  location?: string;
  country?: string;
  level?: string;
  /** `pending | live | finished` today; the first two names are the old ones. */
  status?: "pending" | "live" | "finished" | "in_progress" | "completed";
  start_date: string;
  end_date: string;
  winners?: Partial<Record<PadelCategory, Array<{ name: string }>>> | null;
};

type PadelApiList<T> = { data: T[] };

function flagFromIso2(code: string | undefined): string {
  if (!code || code.length !== 2) return "🏁";
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏁";
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** Words that belong to the surname after them: "Martin Di Nenno". */
const SURNAME_PARTICLES = new Set(["de", "del", "di", "da", "dos", "la", "van", "von"]);

/**
 * "A. Tapia" from "Agustin Tapia", and "G. Triay" from "Gemma Triay Pons".
 *
 * The provider sends Spanish players with both surnames, and they go by the
 * first: taking the last word named every woman in the top fifteen after her
 * mother's family — Gemma Triay was "G. Pons".
 */
function shortNameFor(name: string): string {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  const initial = tokens[0][0]?.toUpperCase() ?? "";
  const surname = [tokens[1]];
  for (let i = 1; SURNAME_PARTICLES.has(tokens[i].toLowerCase()) && tokens[i + 1]; i++) {
    surname.push(tokens[i + 1]);
  }
  return `${initial}. ${surname.join(" ")}`;
}

/**
 * The provider renamed its states to `live` / `finished`; read as the old
 * `in_progress` / `completed`, every tournament came out "upcoming" and the
 * dashboard billed last week's final as next.
 */
function mapStatus(s: PadelApiTournament["status"]): RacquetTournament["status"] {
  if (s === "live" || s === "in_progress") return "live";
  if (s === "finished" || s === "completed") return "completed";
  return "upcoming";
}

function mapRanking(player: PadelApiPlayer): PlayerRanking {
  return {
    position: player.ranking,
    name: player.name,
    shortName: shortNameFor(player.name),
    countryCode: player.nationality ?? "",
    flagEmoji: flagFromIso2(player.nationality),
    points: player.points,
    movement: -(player.ranking_diff ?? 0),
  };
}

/** The pair that won this category, as "A. Coello / A. Tapia". */
function championOf(t: PadelApiTournament, category: PadelCategory): string | undefined {
  const pair = t.winners?.[category];
  if (!pair?.length) return undefined;
  return pair.map((p) => shortNameFor(p.name)).join(" / ");
}

function mapTournament(t: PadelApiTournament, category: PadelCategory): RacquetTournament {
  return {
    id: `padelapi-${t.id}`,
    name: t.name,
    location: t.location ?? t.country ?? "—",
    startDate: t.start_date,
    endDate: t.end_date,
    status: mapStatus(t.status),
    champion: championOf(t, category),
  };
}

async function fetchPadel<T>(path: string): Promise<T> {
  const token = process.env.PADEL_API_KEY;
  if (!token) throw new Error("PADEL_API_KEY not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: upstreamSignal(),
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`padel-api ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

function tournamentsPath(now: Date): string {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - CALENDAR_LOOKBACK_DAYS);
  const params = new URLSearchParams({
    level: PREMIER_LEVELS,
    after_date: from.toISOString().slice(0, 10),
    sort_by: "start_date",
    order_by: "asc",
    per_page: "20",
  });
  return `/tournaments?${params.toString()}`;
}

async function fetchPadelFromApi(): Promise<PadelData> {
  // `per_page`, not `limit`: the API ignores `limit`, so the tournaments call
  // had been returning its default 15.
  const [menRanks, womenRanks, tournamentsRes] = await Promise.all([
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=men&per_page=${RANKING_LIMIT}`,
    ),
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=women&per_page=${RANKING_LIMIT}`,
    ),
    fetchPadel<PadelApiList<PadelApiTournament>>(tournamentsPath(new Date())),
  ]);

  if (menRanks.data.length === 0 && womenRanks.data.length === 0) {
    throw new Error("padel-api returned no rankings");
  }

  const buildSection = (
    rankings: PadelApiPlayer[],
    tour: RacquetTour,
    category: PadelCategory,
  ): RacquetData => ({
    tour,
    season: new Date().getFullYear(),
    rankings: rankings.map(mapRanking),
    tournaments: tournamentsRes.data
      .map((t) => mapTournament(t, category))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  });

  return {
    men: buildSection(menRanks.data, "wpt-men", "men"),
    women: buildSection(womenRanks.data, "wpt-women", "women"),
  };
}

export const getPadelData = cachedFeed(
  "padel-api",
  fetchPadelFromApi,
  () => PADEL_DATA,
  ["padel-api:padel-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:padel"] },
);

/** Pure mappers, exported for their tests — nothing here touches the network. */
export const __testing = { mapStatus, mapTournament, mapRanking, shortNameFor, tournamentsPath };
