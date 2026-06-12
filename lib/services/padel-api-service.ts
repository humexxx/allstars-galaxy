import "server-only";

import { unstable_cache } from "next/cache";

import { PADEL_DATA } from "@/lib/data/sports/padel";
import type {
  PadelData,
  PlayerRanking,
  RacquetData,
  RacquetTour,
  RacquetTournament,
} from "@/types/sports";

const BASE_URL = "https://padelapi.org/api";
const REVALIDATE_SECONDS = 1800;
const RANKING_LIMIT = 15;

type PadelApiPlayer = {
  id: number;
  name: string;
  category?: "men" | "women";
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
  status?: "pending" | "in_progress" | "completed";
  start_date: string;
  end_date: string;
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

function shortNameFor(name: string): string {
  const tokens = name.trim().split(/\s+/);
  if (tokens.length === 1) return tokens[0];
  const first = tokens[0][0]?.toUpperCase() ?? "";
  const last = tokens[tokens.length - 1];
  return `${first}. ${last}`;
}

function mapStatus(s: PadelApiTournament["status"]): RacquetTournament["status"] {
  if (s === "in_progress") return "live";
  if (s === "completed") return "completed";
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

function mapTournament(t: PadelApiTournament): RacquetTournament {
  return {
    id: `padelapi-${t.id}`,
    name: t.name,
    location: t.location ?? t.country ?? "—",
    startDate: t.start_date,
    endDate: t.end_date,
    status: mapStatus(t.status),
  };
}

async function fetchPadel<T>(path: string): Promise<T> {
  const token = process.env.PADEL_API_KEY;
  if (!token) throw new Error("PADEL_API_KEY not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`padel-api ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

async function fetchPadelFromApi(): Promise<PadelData> {
  const [menRanks, womenRanks, tournamentsRes] = await Promise.all([
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=men&limit=${RANKING_LIMIT}`,
    ).catch((err) => {
      console.warn("padel men rankings failed:", err);
      return { data: [] };
    }),
    fetchPadel<PadelApiList<PadelApiPlayer>>(
      `/rankings?category=women&limit=${RANKING_LIMIT}`,
    ).catch((err) => {
      console.warn("padel women rankings failed:", err);
      return { data: [] };
    }),
    fetchPadel<PadelApiList<PadelApiTournament>>(`/tournaments?limit=20`).catch(
      (err) => {
        console.warn("padel tournaments failed:", err);
        return { data: [] };
      },
    ),
  ]);

  if (menRanks.data.length === 0 && womenRanks.data.length === 0) {
    throw new Error("padel-api returned no rankings (rate limit?)");
  }

  const tournaments = tournamentsRes.data
    .map(mapTournament)
    .sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );

  const buildSection = (
    rankings: PadelApiPlayer[],
    tour: RacquetTour,
  ): RacquetData => ({
    tour,
    season: new Date().getFullYear(),
    rankings: rankings.map(mapRanking),
    tournaments,
  });

  return {
    men: buildSection(menRanks.data, "wpt-men"),
    women: buildSection(womenRanks.data, "wpt-women"),
  };
}

export const getPadelData = unstable_cache(
  async (): Promise<PadelData> => {
    try {
      return await fetchPadelFromApi();
    } catch (err) {
      console.warn("padel-api unavailable, falling back to mock PADEL_DATA:", err);
      return PADEL_DATA;
    }
  },
  ["padel-api:padel-data"],
  { revalidate: REVALIDATE_SECONDS, tags: ["sports:padel"] },
);
