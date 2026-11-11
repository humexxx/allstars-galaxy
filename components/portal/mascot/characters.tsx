/**
 * The hero's body: one rig, drawn as whichever character the reader picked.
 *
 * Every character keeps the joints the scenes animate — the near hand at
 * (-0.8, -15), the feet at (0, 0), the head's centre at (1, -46) — so a scene
 * never knows who is playing it. Each part is rasterised into sprite squares
 * once per character and reused.
 */
import type { ReactElement, ReactNode } from "react";

import { DEFAULT_MASCOT_CHARACTER, type MascotCharacter } from "@/types/preferences";

import { LOOKS, type HeroFace, type Look } from "./looks";
import { add, all, any, box, circle, on, rasterise, type Bounds, type Layer, type Shape, type SpritePath } from "./sprite";

const OUTLINE = {
  stroke: "var(--ctxa-ink, #2A2840)",
  strokeWidth: 2,
  strokeLinejoin: "round",
  strokeLinecap: "round",
} as const;

const SHOE: Shape = any(box(-8, -5, -1, 0), all(circle(-1, 0, 5), box(-1, -5, 4, 0)));

const BOUNDS = {
  arm: [-8, -33, 12, -9],
  leg: [-11, -17, 13, 3],
  torso: [-13, -37, 12, -9],
  back: [-36, -52, 0, -6],
  head: [-34, -82, 30, -28],
} as const satisfies Record<string, Bounds>;

/** The far side of the body: the near limb moved across, in each colour's shade. */
function far(layers: Layer[], dx: number, palette: Look["palette"]): Layer[] {
  return layers.map(({ color, shape, over }) => ({
    color: `${color}2` in palette ? `${color}2` : color,
    shape: (x, y) => shape(x - dx, y),
    over,
  }));
}

function armLayers(look: Look): Layer[] {
  return [add("top", box(-4, -29, 2.5, -16, 3.2)), ...(look.arm ?? []), add(look.hand ?? "skin", circle(-0.8, -15, 3.3))];
}

function legLayers(look: Look): Layer[] {
  return [add("pants", box(-7, -14, 0, -3, 3)), add("shoe", SHOE), ...(look.leg ?? [])];
}

function torsoLayers(look: Look): Layer[] {
  return [
    add("top", box(-10, -31, 9, -12, 6)),
    on("top2", any(box(-10, -27, -6.5, -12), box(-10, -16, 9, -12))),
    ...(look.torso ?? []),
  ];
}

type Part = "arm" | "farArm" | "leg" | "farLeg" | "torso" | "back" | `head-${HeroFace}`;

const cache = new Map<string, SpritePath[]>();

function sprite(character: MascotCharacter, part: Part): SpritePath[] {
  const key = `${character}/${part}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const look = LOOKS[character];
  let paths: SpritePath[];
  switch (part) {
    case "arm":
      paths = rasterise(armLayers(look), BOUNDS.arm);
      break;
    case "farArm":
      paths = rasterise(far(armLayers(look), 5, look.palette), BOUNDS.arm);
      break;
    case "leg":
      paths = rasterise(legLayers(look), BOUNDS.leg);
      break;
    case "farLeg":
      paths = rasterise(far(legLayers(look), 6, look.palette), BOUNDS.leg);
      break;
    case "torso":
      paths = rasterise(torsoLayers(look), BOUNDS.torso);
      break;
    case "back":
      paths = look.back ? rasterise(look.back, BOUNDS.back) : [];
      break;
    default:
      paths = rasterise(look.head(part.slice(5) as HeroFace), BOUNDS.head);
  }
  cache.set(key, paths);
  return paths;
}

/**
 * A colour of the sprite. It carries its own hex rather than a `--ctxa-*`
 * variable — those belong to the scenery, which nine casts would fight over —
 * and dims by the one factor the dark theme sets.
 */
function fill(palette: Look["palette"], color: string): string {
  if (color === "ink") return "var(--ctxa-ink, #2A2840)";
  return `color-mix(in oklab, ${palette[color]} var(--ctxa-lit, 100%), #000)`;
}

function Sprite({ character, part }: { character: MascotCharacter; part: Part }): ReactElement {
  const { palette } = LOOKS[character];
  return (
    <g shapeRendering="crispEdges" stroke="none">
      {sprite(character, part).map(({ color, d }) => (
        <path key={color} d={d} fill={fill(palette, color)} />
      ))}
    </g>
  );
}

/** The head alone, so a scene can seat it in a car. Centre (1, -46), facing right. */
export function HeroHead({
  face = "calm",
  character = DEFAULT_MASCOT_CHARACTER,
}: {
  face?: HeroFace;
  character?: MascotCharacter;
}): ReactElement {
  return <Sprite character={character} part={`head-${face}`} />;
}

export type HeroProps = {
  character?: MascotCharacter;
  face?: HeroFace;
  /** Painted in the near arm's space, so it swings with it. The hand is at (-0.8, -15). */
  tool?: ReactNode;
  /** Painted over whatever rides on the back, in the hero's space. */
  load?: ReactNode;
  /** Extra classes for the parts a scene animates. */
  arm?: string;
  farArm?: string;
  nearLeg?: string;
  farLeg?: string;
  head?: string;
};

/** The hero, facing right, feet at (0, 0), in the proportions of a handheld overworld sprite. */
export function Hero({
  character = DEFAULT_MASCOT_CHARACTER,
  face = "calm",
  tool,
  load,
  arm = "",
  farArm = "",
  nearLeg = "",
  farLeg = "",
  head = "",
}: HeroProps): ReactElement {
  return (
    <g {...OUTLINE}>
      <g className={`ctxa-arm-far ${farArm}`}>
        <Sprite character={character} part="farArm" />
      </g>
      <g className={`ctxa-leg-far ${farLeg}`}>
        <Sprite character={character} part="farLeg" />
      </g>
      <Sprite character={character} part="back" />
      {load}
      <g className={`ctxa-leg-near ${nearLeg}`}>
        <Sprite character={character} part="leg" />
      </g>
      <Sprite character={character} part="torso" />
      <g className={`ctxa-head ${head}`}>
        <HeroHead face={face} character={character} />
      </g>
      <g className={`ctxa-arm ${arm}`}>
        {tool}
        <Sprite character={character} part="arm" />
      </g>
    </g>
  );
}

/** The character standing still on nothing: what the settings picker shows. */
export function HeroPortrait({ character, className }: { character: MascotCharacter; className?: string }): ReactElement {
  return (
    <svg viewBox="-36 -82 68 86" className={className} aria-hidden="true" focusable="false">
      <Hero character={character} />
    </svg>
  );
}
