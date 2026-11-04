import "server-only";

import { getTennisDraw } from "@/lib/services/espn-tennis-service";
import { getPadelDraw } from "@/lib/services/padel-api-service";
import type { RacquetDraw, RacquetSport } from "@/types/sports";

/**
 * One tournament's draw from its sport's provider, through that provider's
 * cache. Null when the provider does not list it or did not answer.
 */
export function getRacquetDraw(sport: RacquetSport, tournamentId: string): Promise<RacquetDraw | null> {
  return sport === "padel" ? getPadelDraw(tournamentId) : getTennisDraw(tournamentId);
}
