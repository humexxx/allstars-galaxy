import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { F1Race } from "@/types/sports";

import type { MatchTimeFormat } from "./shared/match-time";

// Shared by the server-rendered dashboard card and the client Races tab, so
// nothing here may be a client module.

/**
 * When the race starts, in the reader's zone. Only a race with no start time
 * falls back to its date, as the calendar day it names: the UTC day put
 * Melbourne's 04:00Z start on the Sunday, when in the Americas it ran on the
 * Saturday evening.
 */
export function raceWhen(race: F1Race, format: MatchTimeFormat): string {
  return race.startsAt ? format.dayTime(race.startsAt) : format.day(race.date);
}

/** "Circuit of the Americas · Austin, USA" */
export function racePlace(race: F1Race): string {
  const town = race.country ? `${race.location}, ${race.country}` : race.location;
  return `${race.circuit} · ${town}`;
}

export function SprintBadge(): JSX.Element {
  return <Badge variant="outline">Sprint</Badge>;
}
