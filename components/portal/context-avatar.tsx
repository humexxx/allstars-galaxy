/**
 * Decorative module mascot: a small overworld hero doing whatever the module
 * on screen is about. Rendered after the page content, purely presentational
 * (aria-hidden) and toggleable from /portal/settings via the
 * `showContextAvatar` user preference.
 *
 * | variant      | scene                                                      |
 * | ------------ | ---------------------------------------------------------- |
 * | `finance`    | mines gold and carries it to the chest; posed by `mood`    |
 * | `sports`     | plays the sport on screen, one short loop per `SportId`    |
 * | `travel`     | reads a map at a crossroads, suitcase packed               |
 * | `portfolio`  | waters a money tree and shakes its coins into a basket     |
 * | `trading`    | calls a chart candle by candle, the journal on a crate     |
 * | `board`      | moves a card across a kanban board to Done                 |
 * | `road-paths` | walks an endless road, ticking each day's signpost         |
 *
 * Who the hero is — the app's own explorer, or one of the famous faces in
 * `MASCOT_CHARACTERS` — is the reader's `mascotCharacter` preference, passed as
 * `character`. Every character stands on one rig (`./mascot/characters`), so a
 * scene plays the same whoever is in it.
 *
 * Pure SVG + CSS keyframes: no client JS. The stage, palette and keyframe
 * helpers live in `./mascot/kit`; each scene is a file beside it. The scenery's
 * colours are CSS custom properties so it re-tints under `.dark` (next-themes
 * sets a class, not a media query), and animations stop under
 * prefers-reduced-motion.
 *
 * A client component that needs one scene imports that scene directly, so the
 * others stay out of its bundle. Server pages mount `ModuleMascot`, which reads
 * the preference.
 */
import type { ReactElement } from "react";

import type { FinanceMood } from "@/types/finance";
import type { MascotCharacter } from "@/types/preferences";
import type { SportId } from "@/types/sports";

import { BoardScene } from "./mascot/board-scene";
import { FinanceScene } from "./mascot/finance-scene";
import { PortfolioScene } from "./mascot/portfolio-scene";
import { RoadPathsScene } from "./mascot/road-paths-scene";
import { SportsScene } from "./mascot/sports-scene";
import { TradingScene } from "./mascot/trading-scene";
import { TravelScene } from "./mascot/travel-scene";

export type ContextAvatarProps = { character?: MascotCharacter; className?: string } & (
  | { variant?: "finance"; mood?: FinanceMood }
  | { variant: "sports"; sport: SportId }
  | { variant: "travel" | "portfolio" | "trading" | "board" | "road-paths" }
);

export type ContextAvatarVariant = NonNullable<ContextAvatarProps["variant"]>;

export function ContextAvatar(props: ContextAvatarProps): ReactElement {
  const { character, className } = props;
  switch (props.variant) {
    case "sports":
      return <SportsScene sport={props.sport} character={character} className={className} />;
    case "travel":
      return <TravelScene character={character} className={className} />;
    case "portfolio":
      return <PortfolioScene character={character} className={className} />;
    case "trading":
      return <TradingScene character={character} className={className} />;
    case "board":
      return <BoardScene character={character} className={className} />;
    case "road-paths":
      return <RoadPathsScene character={character} className={className} />;
    default:
      return <FinanceScene mood={props.mood ?? "steady"} character={character} className={className} />;
  }
}
