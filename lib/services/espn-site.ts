import "server-only";

import type { Team } from "@/types/sports";

import { upstreamSignal } from "./upstream";

/**
 * ESPN's site API — the teams list and the standings — as the US leagues read
 * it. Each sport keeps its own `teamFrom`, divisions and table order; what is
 * here is the raw shape and the reads they share.
 */

export type EspnTeam = {
  abbreviation?: string;
  displayName?: string;
  shortDisplayName?: string;
  color?: string;
  /** The scoreboard's logo. */
  logo?: string;
  /** The default logo first; `rel` names its variant ("scoreboard", "dark"). */
  logos?: Array<{ href?: string; rel?: string[] }>;
};

export type EspnTeams = {
  sports?: Array<{ leagues?: Array<{ teams?: Array<{ team?: EspnTeam }> }> }>;
};

export type EspnStandingEntry = {
  team?: EspnTeam;
  stats?: Array<{ name?: string; displayValue?: string; value?: number | null }>;
};

export type EspnStandingsGroup = {
  abbreviation?: string;
  standings?: { season?: number; entries?: EspnStandingEntry[] };
  children?: EspnStandingsGroup[];
};

export type EspnStandings = { children?: EspnStandingsGroup[] };

export async function fetchEspnJson<T>(label: string, url: string): Promise<T> {
  const res = await fetch(url, { signal: upstreamSignal() });
  if (!res.ok) throw new Error(`${label} ${res.status} on ${url}`);
  return (await res.json()) as T;
}

/** A team's colour, or white for a club whose logo is drawn in that very colour and would vanish on it. */
export function teamColour(
  code: string,
  color: string | undefined,
  logoOnWhite: ReadonlySet<string>
): string | undefined {
  if (logoOnWhite.has(code)) return "#FFFFFF";
  return color ? `#${color.replace(/^#/, "")}` : undefined;
}

export function teamsListFrom(json: EspnTeams, teamFrom: (t: EspnTeam | undefined) => Team | null): Team[] {
  return (json.sports ?? [])
    .flatMap((s) => s.leagues ?? [])
    .flatMap((l) => l.teams ?? [])
    .map((t) => teamFrom(t.team))
    .filter((t): t is Team => t !== null);
}

/** A standings stat by name, null when the entry has none. */
export function standingStat(entry: EspnStandingEntry, name: string): { value: number; display: string } | null {
  const found = entry.stats?.find((s) => s.name === name);
  if (!found) return null;
  const display = found.displayValue ?? "";
  // The leader's games behind reads "-": its value is the number.
  const value = typeof found.value === "number" ? found.value : Number(display);
  return { value: Number.isFinite(value) ? value : 0, display };
}

export function standingValue(entry: EspnStandingEntry, name: string): number {
  return standingStat(entry, name)?.value ?? 0;
}
