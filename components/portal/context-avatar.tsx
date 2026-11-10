/**
 * Decorative module mascot: a small overworld hero doing whatever the module
 * on screen is about. Rendered after the page content, purely presentational
 * (aria-hidden) and toggleable from /portal/settings via the
 * `showContextAvatar` user preference.
 *
 * | variant   | scene                                                         |
 * | --------- | ------------------------------------------------------------- |
 * | `finance` | mines gold and carries it to the chest; posed by `mood`       |
 * | `sports`  | plays the sport on screen, one short loop per `SportId`       |
 * | `travel`  | reads a map at a crossroads, suitcase packed                  |
 *
 * Pure SVG + CSS keyframes: no client JS. The shared figure, stage, palette
 * and keyframe helpers live in `./mascot/kit`; each scene is a file beside it.
 * Every colour is a CSS custom property so the figure re-tints under `.dark`
 * (next-themes sets a class, not a media query), and animations stop under
 * prefers-reduced-motion.
 *
 * A client component that needs one scene imports that scene directly, so the
 * others stay out of its bundle. Server pages mount `ModuleMascot`, which reads
 * the preference.
 */
import type { ReactElement } from "react";

import type { FinanceMood } from "@/types/finance";
import type { SportId } from "@/types/sports";

import { FinanceScene } from "./mascot/finance-scene";
import { SportsScene } from "./mascot/sports-scene";
import { TravelScene } from "./mascot/travel-scene";

export type ContextAvatarProps = { className?: string } & (
  | { variant?: "finance"; mood?: FinanceMood }
  | { variant: "sports"; sport: SportId }
  | { variant: "travel" }
);

export type ContextAvatarVariant = NonNullable<ContextAvatarProps["variant"]>;

export function ContextAvatar(props: ContextAvatarProps): ReactElement {
  if (props.variant === "sports") return <SportsScene sport={props.sport} className={props.className} />;
  if (props.variant === "travel") return <TravelScene className={props.className} />;
  return <FinanceScene mood={props.mood ?? "steady"} className={props.className} />;
}
