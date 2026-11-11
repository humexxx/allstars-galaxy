/**
 * Road paths: the hero walks a path that never ends. Each day is a signpost
 * that comes along the road; a tick on its leaf as it passes, and the streak
 * flame overhead flares up.
 */
import type { ReactElement, ReactNode } from "react";

import type { MascotCharacter } from "@/types/preferences";

import { Cast, Flower, Hero, keyframes, loop, rot, Shadow, Stage, tr, Tuft, type Frame, type Point } from "./kit";

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const GREEN = "#3FA65B";

// ---------- the layout, in cast units ----------

const HERO_X = -6;
/** Where a signpost stands when the pencil reaches it. */
const TAP_X = 22;
const POST_Y = -9;
/** The middle of a signpost's leaf, above its foot. */
const LEAF_Y = -37;

/** The road wraps around: what leaves on the left comes back on the right. */
const EDGE = 96;
const SPAN = EDGE * 2;
/** Cast units the road moves per percent of the cycle. */
const SPEED = SPAN / 100;
/** Things come and go a little inside the edge, so nothing hangs off the slab. */
const INSET = 10;
const FADE = 8;

// ---------- the timeline, in percent of one cycle ----------

/** The moment each of the three signposts gets its tick. */
const TAPS = [11, 44.33, 77.67];

const ARM_REST = -35;

const wrap = (x: number): number => ((((x + EDGE) % SPAN) + SPAN) % SPAN) - EDGE;
/** Where something has to start for the road to bring it to `x` at moment `t`. */
const startFor = (x: number, t: number): number => wrap(x + SPEED * t);
/** The moment something that started at `x0` goes off the left edge. */
const leaves = (x0: number): number => (x0 + EDGE) / SPEED;

const POSTS = TAPS.map((t) => startFor(TAP_X, t));

/** One trip along the road, right edge to left; everything on it rides this at its own offset. */
const ROAD = keyframes("rp-scroll", [
  [0, `opacity: 0; ${tr(EDGE, 0)}`],
  [INSET / SPEED, `opacity: 0; ${tr(EDGE - INSET, 0)}`],
  [(INSET + FADE) / SPEED, `opacity: 1; ${tr(EDGE - INSET - FADE, 0)}`],
  [100 - (INSET + FADE) / SPEED, `opacity: 1; ${tr(-EDGE + INSET + FADE, 0)}`],
  [100 - INSET / SPEED, `opacity: 0; ${tr(-EDGE + INSET, 0)}`],
  [100, `opacity: 0; ${tr(-EDGE, 0)}`],
]);

function scroll(name: string, x0: number): string {
  const travelled = ((EDGE - x0) / SPAN).toFixed(4);
  return `.${name} { animation-name: rp-scroll; animation-delay: calc(var(--ctxa-cycle) * -${travelled}); ${tr(x0, 0)}; }`;
}

/** A tick stays on its leaf from the tap until the signpost goes round the edge. */
function tickFrames(tap: number, out: number): Frame[] {
  const hidden = "opacity: 0; transform: scale(0)";
  const shown = "opacity: 1; transform: scale(1)";
  const pop: Frame[] = [
    [tap - 0.1, hidden],
    [tap + 1.5, "opacity: 1; transform: scale(1.5)"],
    [tap + 3, shown],
  ];
  return out > tap
    ? [[0, hidden], ...pop, [out, shown], [out + 0.1, hidden], [100, hidden]]
    : [[0, shown], [out, shown], [out + 0.1, hidden], ...pop, [100, shown]];
}

/** The arm's angle when the pencil touches the leaf. */
const ARM_TAP = Math.round((Math.atan2(-(TAP_X - (HERO_X - 0.8)), POST_Y + LEAF_Y + 27) * 180) / Math.PI);

function armFrames(): Frame[] {
  return [
    [0, rot(ARM_REST)],
    ...TAPS.flatMap((t): Frame[] => [
      [t - 5, rot(ARM_REST)],
      [t - 1.5, rot(ARM_TAP - 16)],
      [t, rot(ARM_TAP)],
      [t + 1, rot(ARM_TAP + 6)],
      [t + 2, rot(ARM_TAP)],
      [t + 6, rot(ARM_REST)],
    ]),
    [100, rot(ARM_REST)],
  ];
}

function headFrames(): Frame[] {
  return [
    [0, rot(0)],
    ...TAPS.flatMap((t): Frame[] => [
      [t - 5, rot(0)],
      [t - 1.5, rot(-9)],
      [t + 3, rot(-9)],
      [t + 6, rot(0)],
    ]),
    [100, rot(0)],
  ];
}

function flareFrames(): Frame[] {
  return [
    [0, "transform: scale(1)"],
    ...TAPS.flatMap((t): Frame[] => [
      [t, "transform: scale(1)"],
      [t + 2, "transform: scale(1.5)"],
      [t + 6, "transform: scale(1)"],
    ]),
    [100, "transform: scale(1)"],
  ];
}

type Detail = { x: number; y: number; draw: ReactNode };

/** What grows beside the road, behind the hero and in front. */
const BEHIND: Detail[] = [
  { x: -72, y: -13, draw: <Tuft x={0} y={0} /> },
  { x: -8, y: -13, draw: <Flower x={0} y={0} color="var(--ctxa-shoe)" /> },
  { x: 58, y: -14, draw: <Tuft x={0} y={0} /> },
];
const FRONT: Detail[] = [
  { x: -40, y: 8, draw: <Flower x={0} y={0} color="var(--ctxa-white)" delay={0.5} /> },
  { x: 24, y: 8, draw: <Tuft x={0} y={0} /> },
  { x: 82, y: 8, draw: <Flower x={0} y={0} color="var(--ctxa-scarf)" delay={0.9} /> },
];
/** Pebbles on the road itself: the surest sign that it is moving. */
const PEBBLES: Point[] = [
  [-80, -4],
  [-34, 1.5],
  [10, -5],
  [50, 2],
  [84, -3.5],
];

/** The legs, the bob and the far arm keep their own short beat: a walk is not tied to the cycle. */
const WALK = `
  .rp-leg-near, .rp-leg-far { animation: rp-step 0.64s steps(1) infinite; }
  .rp-leg-far { animation-delay: -0.32s; }
  @keyframes rp-step { 0%, 100% { transform: rotate(24deg); } 25%, 75% { transform: rotate(0deg); } 50% { transform: rotate(-24deg); } }
  .rp-bob { animation: rp-bob 0.32s ease-in-out infinite; }
  @keyframes rp-bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-1.6px); } }
  .rp-far { animation: rp-swing 0.64s ease-in-out infinite; }
  @keyframes rp-swing { 0%, 100% { transform: rotate(-24deg); } 50% { transform: rotate(24deg); } }
  .rp-flicker { animation: rp-flicker 0.44s steps(1) infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes rp-flicker { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(-1); } }
`;

const STYLES = [
  WALK,
  ROAD,
  loop("rp-arm", armFrames(), rot(ARM_REST)),
  loop("rp-head", headFrames()),
  loop("rp-flare", flareFrames(), "transform-box: fill-box; transform-origin: 50% 100%;"),
  ...POSTS.map((x0, i) => scroll(`rp-post-${i}`, x0)),
  ...POSTS.map((x0, i) =>
    loop(
      `rp-tick-${i}`,
      tickFrames(TAPS[i], leaves(x0)),
      `transform-box: fill-box; transform-origin: center; opacity: ${leaves(x0) > TAPS[i] ? 0 : 1};`,
    ),
  ),
  ...BEHIND.map((d, i) => scroll(`rp-behind-${i}`, d.x)),
  ...FRONT.map((d, i) => scroll(`rp-front-${i}`, d.x)),
  ...PEBBLES.map(([x], i) => scroll(`rp-pebble-${i}`, x)),
].join("\n");

const TICK = "M-5 -33.5 l3.6 4 l7 -8.5";

/** A day on the road: a calendar leaf on a pole, foot at the origin. */
function Signpost({ tick }: { tick: string }): ReactElement {
  return (
    <g strokeWidth="1.8" {...INK}>
      <Shadow rx={6} />
      <path d="M0 0 V-28" strokeWidth="5" fill="none" />
      <path d="M0 0 V-28" stroke="var(--ctxa-wood)" strokeWidth="2.2" fill="none" />
      <rect x="-9" y="-47" width="18" height="20" rx="2.2" fill="var(--ctxa-white)" />
      <path d="M-9 -41.5 v-3.3 a2.2 2.2 0 0 1 2.2 -2.2 h13.6 a2.2 2.2 0 0 1 2.2 2.2 v3.3 z" fill="var(--ctxa-shoe)" />
      <path d="M-4 -49.5 v4 M4 -49.5 v4" strokeWidth="1.7" fill="none" />
      <g className={`ctxa-loop ${tick}`}>
        <path d={TICK} strokeWidth="4.6" fill="none" />
        <path d={TICK} stroke={GREEN} strokeWidth="2.4" fill="none" />
      </g>
    </g>
  );
}

/** Drawn along the arm, its point past the hand. */
function Pencil(): ReactElement {
  return (
    <g strokeWidth="1.1" {...INK}>
      <rect x="-2.3" y="-20.5" width="3" height="3" rx="0.8" fill="var(--ctxa-blush)" />
      <rect x="-2.3" y="-18" width="3" height="11" fill="var(--ctxa-gold)" />
      <path d="M-2.3 -7 L-0.8 -2.6 L0.7 -7 Z" fill="var(--ctxa-skin)" />
      <path d="M-1.3 -4 L-0.8 -2.6 L-0.3 -4 Z" fill="var(--ctxa-ink)" strokeWidth="0.6" />
    </g>
  );
}

/** The streak: it burns for as long as the days keep getting ticked. */
function Flame(): ReactElement {
  return (
    <g strokeWidth="1.6" {...INK}>
      <path d="M0 0 C-7 0 -8.5 -6.5 -5 -11 C-4.5 -8.5 -3 -7.5 -1.8 -8 C-3.5 -13 0 -16 1.5 -18.5 C2.5 -13.5 8 -10.5 7.2 -4.5 C6.8 -1.5 4 0 0 0 Z" fill="var(--ctxa-pack)" />
      <path d="M0.4 -1.2 C-3 -1.2 -3.6 -4.8 -1.4 -6.8 C-0.4 -5 1.6 -5.6 1.8 -8.6 C4 -6 4.6 -1.2 0.4 -1.2 Z" fill="var(--ctxa-gold)" stroke="none" />
    </g>
  );
}

function scrolling(prefix: string, details: Detail[]): ReactElement[] {
  return details.map((d, i) => (
    <g key={i} className={`ctxa-loop ctxa-linear ${prefix}-${i}`}>
      <g transform={`translate(0 ${d.y}) scale(0.625)`}>{d.draw}</g>
    </g>
  ));
}

export function RoadPathsScene({ character, className }: { character?: MascotCharacter; className?: string }): ReactElement {
  return (
    <Stage
      styles={STYLES}
      tone="grass"
      plain
      className={className}
      ground={
        <g>
          <rect x="0" y="127" width="320" height="19" fill="var(--ctxa-dirt)" />
          <path d="M0 127 H320 M0 146 H320" stroke="var(--ctxa-ink)" strokeWidth="1.2" opacity="0.25" fill="none" />
        </g>
      }
    >
      <Cast>
        {PEBBLES.map(([, y], i) => (
          <g key={i} className={`ctxa-loop ctxa-linear rp-pebble-${i}`}>
            <ellipse cx="0" cy={y} rx="2.6" ry="1" fill="var(--ctxa-gs)" opacity="0.7" />
          </g>
        ))}
        {scrolling("rp-behind", BEHIND)}
        {POSTS.map((_, i) => (
          <g key={i} className={`ctxa-loop ctxa-linear rp-post-${i}`}>
            <g transform={`translate(0 ${POST_Y})`}>
              <Signpost tick={`rp-tick-${i}`} />
            </g>
          </g>
        ))}

        <g transform={`translate(${HERO_X} 0)`}>
          <Shadow />
          <g className="rp-bob">
            <Hero character={character}
              face="happy"
              arm="ctxa-loop rp-arm"
              farArm="rp-far"
              head="ctxa-loop rp-head"
              nearLeg="rp-leg-near"
              farLeg="rp-leg-far"
              tool={<Pencil />}
            />
            <g transform="translate(1 -67)">
              <g className="ctxa-loop rp-flare">
                <g className="rp-flicker">
                  <Flame />
                </g>
              </g>
            </g>
          </g>
        </g>

        {scrolling("rp-front", FRONT)}
      </Cast>
    </Stage>
  );
}
