import "server-only";

import { cache } from "react";

import { getTennisData } from "@/lib/services/espn-tennis-service";
import { getF1Data, getF1RaceClassification } from "@/lib/services/jolpica-f1-service";
import { getF1WeekendResults } from "@/lib/services/openf1-service";
import { getPadelData } from "@/lib/services/padel-api-service";
import { getRacquetDraw } from "@/lib/services/racquet-draw-service";
import { racesTabGroups, weekendWindow } from "@/lib/sports/f1-weekend";
import { drawIsOut, findTournament, shippedDraw } from "@/lib/sports/racquet";
import { getRequestTodayIso } from "@/lib/utils/request-today";
import { racquetDrawSchema } from "@/schemas/racquet";
import type {
  DrawState,
  F1ClassificationRow,
  F1Data,
  F1Race,
  F1SessionResult,
  RacquetSport,
  RacquetTournament,
} from "@/types/sports";

type RacquetTournamentDetail = {
  tournament: RacquetTournament;
  draw: DrawState;
  today: string;
  /** The tour's season, for the line under the sport's name. */
  season: number;
};

/**
 * A padel or tennis tournament's page: the tournament, from the feed or the
 * season's calendar, and its draw — the one the feed shipped, else read
 * through the provider's cache. Null for a tournament the tour does not list.
 *
 * `cache`d for the request, so the page and its metadata read it once.
 */
export const loadRacquetTournament = cache(
  async (sport: RacquetSport, tournamentId: string): Promise<RacquetTournamentDetail | null> => {
    const [data, today] = await Promise.all([
      sport === "padel" ? getPadelData().then((d) => d.men) : getTennisData().then((d) => d.atp),
      getRequestTodayIso(),
    ]);
    const tournament = findTournament(data, tournamentId);
    if (!tournament) return null;

    const shipped = shippedDraw(tournament, data.drawPlayers ?? []);
    const season = data.season;
    if (shipped) return { tournament, draw: { status: "ready", draw: shipped }, today, season };
    // A fixture tournament ("wpt-m-rome", while the feed is down) is on no
    // provider's books.
    if (!racquetDrawSchema.safeParse({ sport, tournamentId }).success) {
      return { tournament, draw: { status: "unavailable" }, today, season };
    }
    if (!drawIsOut(tournament.status, tournament.startDate, today)) {
      return { tournament, draw: { status: "pending" }, today, season };
    }
    const draw = await getRacquetDraw(sport, tournamentId);
    return { tournament, draw: draw ? { status: "ready", draw } : { status: "error" }, today, season };
  }
);

type F1RaceDetail = {
  data: F1Data;
  race: F1Race;
  /** The race on now or next. */
  current: boolean;
  sessions: F1SessionResult[];
  /** Undefined for a race not run yet; null when Jolpica has none in yet. */
  classification?: F1ClassificationRow[] | null;
};

/**
 * A race's page: the race, its sessions so far (OpenF1, once one has run)
 * and, run, its whole field (Jolpica). Null for a round the season does not
 * have.
 */
export const loadF1Race = cache(async (round: number): Promise<F1RaceDetail | null> => {
  const data = await getF1Data();
  const race = data.races.find((r) => r.round === round);
  if (!race) return null;
  const window = weekendWindow(race, Date.now());
  const [weekend, classification] = await Promise.all([
    window ? getF1WeekendResults(data.season, race.round, window.from, window.to) : null,
    race.status === "completed" ? getF1RaceClassification(data.season, race.round) : undefined,
  ]);
  return {
    data,
    race,
    current: racesTabGroups(data.races).featured?.id === race.id,
    sessions: weekend?.sessions ?? [],
    classification: classification === undefined ? undefined : (classification?.rows ?? null),
  };
});
