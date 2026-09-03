import "server-only";

import { unstable_cache } from "next/cache";
import { upstreamSignal } from "./upstream";

const URL = "https://site.api.espn.com/apis/v2/sports/racing/f1/standings";
const REVALIDATE_SECONDS = 300;
/** ESPN's own headshot path for racing. */
const HEADSHOT = (id: string) =>
  `https://a.espncdn.com/i/headshots/rpm/players/full/${id}.png`;

/**
 * Team logos, vendored under `public/f1/teams/`.
 *
 * ESPN serves no constructor logo — every `teamlogos` path 404s for racing —
 * so these come from F1's own media CDN. They are copied into the repo rather
 * than hotlinked because that CDN is versioned by season and moves: the 2026
 * paths already 404 while the 2025 ones serve. 36 KB buys a badge that cannot
 * break mid-season.
 *
 * They are also not the files F1 serves. Each ships pre-plated on an opaque
 * white rounded square — only the four corners are transparent — which on a
 * dark card renders as a row of bright discs. The plate is flood-filled away
 * from the border inwards (so white *inside* a mark survives: Mercedes' star,
 * Haas' box) and the result trimmed to its bounding box, so a wide mark like
 * Red Bull's fills the badge instead of floating in it. Every mark then reads
 * on both surfaces with no plate at all.
 *
 * Keyed by the team name ESPN reports, lower-cased. Two teams joined the grid
 * for 2026 and have no logo published yet; they fall through to the livery
 * badge, which is why that fallback stays.
 */
const TEAM_LOGOS: Record<string, string> = {
  mercedes: "mercedes",
  ferrari: "ferrari",
  mclaren: "mclaren",
  "red bull": "red-bull-racing",
  "racing bulls": "racing-bulls",
  alpine: "alpine",
  haas: "haas",
  williams: "williams",
  "aston martin": "aston-martin",
};

function teamLogo(name: string | undefined): string | undefined {
  const slug = name ? TEAM_LOGOS[name.trim().toLowerCase()] : undefined;
  return slug ? `/f1/teams/${slug}.png` : undefined;
}

type EspnStat = { name?: string; displayValue?: string; value?: number };

type EspnEntry = {
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    abbreviation?: string;
    flag?: { href?: string; alt?: string };
  };
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    color?: string;
  };
  stats?: EspnStat[];
};

type EspnStandings = {
  children?: Array<{ name?: string; standings?: { entries?: EspnEntry[] } }>;
};

export type F1StandingRow = {
  position: number;
  name: string;
  points: number;
  /** A driver's headshot, or nothing for a constructor. */
  imageUrl?: string;
  /** A driver's country flag. */
  flagUrl?: string;
  /** A constructor's team logo, when one is published for it. */
  logoUrl?: string;
  /** A constructor's livery colour, for its badge. */
  color?: string;
  /** A constructor's short code, shown when there is no logo. */
  code?: string;
};

export type F1DashboardStandings = {
  drivers: F1StandingRow[];
  constructors: F1StandingRow[];
};

/**
 * A stat by any of the names it goes under.
 *
 * The two tables disagree: a driver's total is `championshipPts` and a
 * constructor's is `points`. Reading one name gave the constructors a column
 * of zeroes.
 */
/** Three letters off the team's name, since ESPN has no usable team code. */
function teamCode(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

function stat(entry: EspnEntry, ...names: string[]): number {
  for (const name of names) {
    const found = entry.stats?.find((s) => s.name === name);
    const raw = found?.displayValue ?? found?.value;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function rank(entry: EspnEntry, index: number): number {
  const r = stat(entry, "rank");
  return r > 0 ? r : index + 1;
}

/**
 * The championship's top few, with faces.
 *
 * ESPN rather than Jolpica, which is what the F1 view itself reads: Jolpica
 * serves the standings but no imagery, and a leaderboard of three names is
 * mostly white space without it. ESPN's public standings carry a stable
 * athlete id — which is the headshot's filename — and the constructors'
 * livery colours. No key, same endpoint espn.com uses.
 *
 * ESPN publishes no constructor logo, so those come from `TEAM_LOGOS`; a team
 * with none yet falls back to its livery colour and code.
 */
async function fetchStandings(top: number): Promise<F1DashboardStandings> {
  const res = await fetch(URL, {
    signal: upstreamSignal(),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`espn f1 standings ${res.status}`);
  const json = (await res.json()) as EspnStandings;

  const table = (needle: string) =>
    json.children?.find((c) => c.name?.toLowerCase().includes(needle))?.standings
      ?.entries ?? [];

  const drivers = table("driver")
    .slice(0, top)
    .map((e, i) => ({
      position: rank(e, i),
      name: e.athlete?.shortName ?? e.athlete?.displayName ?? "—",
      points: stat(e, "championshipPts", "points"),
      imageUrl: e.athlete?.id ? HEADSHOT(e.athlete.id) : undefined,
      flagUrl: e.athlete?.flag?.href,
    }));

  const constructors = table("constructor")
    .slice(0, top)
    .map((e, i) => ({
      position: rank(e, i),
      name: e.team?.shortDisplayName ?? e.team?.displayName ?? "—",
      points: stat(e, "points", "championshipPts"),
      logoUrl: teamLogo(e.team?.displayName),
      color: e.team?.color ? `#${e.team.color}` : undefined,
      // Not `abbreviation`: ESPN returns driver initials there for a
      // constructor — Mercedes came back as "LP". The name is the only field
      // that describes the team.
      code: teamCode(e.team?.shortDisplayName ?? e.team?.displayName),
    }));

  return { drivers, constructors };
}

/** Top of both championships, or null when ESPN is unreachable. */
export const getF1DashboardStandings = unstable_cache(
  async (top = 3): Promise<F1DashboardStandings | null> => {
    try {
      return await fetchStandings(top);
    } catch (error) {
      console.warn("espn f1 standings unavailable:", error);
      return null;
    }
  },
  ["espn-f1-standings"],
  { revalidate: REVALIDATE_SECONDS }
);

/** Pure helpers, exported for their tests — nothing here touches the network. */
export const __testing = { stat, teamCode, teamLogo };
