import type { SportId, SportMeta } from "@/types/sports";

export const SPORTS: SportMeta[] = [
  { id: "football", label: "Football", shortLabel: "Football", emoji: "⚽" },
  { id: "padel", label: "Padel", shortLabel: "Padel", emoji: "🎾" },
  { id: "f1", label: "Formula 1", shortLabel: "F1", emoji: "🏎️" },
  { id: "nba", label: "NBA", shortLabel: "NBA", emoji: "🏀" },
  { id: "tennis", label: "Tennis", shortLabel: "Tennis", emoji: "🎾" },
  { id: "nfl", label: "American Football", shortLabel: "NFL", emoji: "🏈" },
  { id: "lol", label: "League of Legends", shortLabel: "LoL", emoji: "🎮" },
];

export const SPORTS_BY_ID = new Map<SportId, SportMeta>(
  SPORTS.map((sport) => [sport.id, sport]),
);

export const DEFAULT_SPORT: SportId = "football";
