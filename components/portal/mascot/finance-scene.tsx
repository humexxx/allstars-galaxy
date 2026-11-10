/**
 * Finance: the hero mines a gold-veined boulder. Each strike knocks a nugget
 * loose into the backpack; after `HITS` of them the hero walks the load to the
 * chest, tips it in, and walks back.
 *
 * The pose follows the main plan through `mood` (see `getFinanceMood`), so the
 * figure is a glanceable signal rather than decoration:
 *
 * | mood       | pose                                                        |
 * | ---------- | ----------------------------------------------------------- |
 * | `thriving` | brisk trips, a grin, the boulder twinkling                  |
 * | `steady`   | the baseline trip                                           |
 * | `strained` | slow trips, heavy lids, a flat mouth, a sweat bead          |
 * | `idle`     | no plan yet — standing by the boulder, wondering            |
 */
import type { CSSProperties, ReactElement } from "react";

import type { FinanceMood } from "@/types/finance";

import {
  arc,
  Cast,
  Flower,
  Hero,
  keyframes,
  rot,
  Shadow,
  SPARK,
  Stage,
  stepFrames,
  tr,
  Tree,
  Tuft,
  type Frame,
  type HeroFace,
  type Point,
} from "./kit";

// ---------- the timeline, in percent of one cycle ----------

const HITS = 4;
/** The moment each pickaxe strike lands. */
const STRIKES = Array.from({ length: HITS }, (_, i) => 7 + i * 10);
const WALK_OUT: [number, number] = [46, 60];
const WALK_BACK: [number, number] = [76, 90];
/** The load leaves the backpack and lands in the chest. */
const DROP: [number, number] = [63, 68];

// ---------- the layout, in cast units ----------

const HERO_X = 8;
/** How far the hero walks to reach the chest. */
const WALK = -48;
const ROCK_X = HERO_X + 50;
/** The chest sits this far ahead of the hero once it has walked over. */
const CHEST_REACH = 36;
const CHEST_X = HERO_X + WALK - CHEST_REACH;
/** Where the pick bites the boulder and nuggets leave it. */
const STRIKE_POINT: Point = [HERO_X + 32, -17];
/** Where each nugget settles on top of the backpack, in the hero's space. */
const SLOTS: Point[] = [
  [-15.5, -32.5],
  [-9.8, -32.5],
  [-12.6, -36.6],
  [-12.6, -41],
];

const ARM_REST = -110;
const ARM_UP = -205;
const ARM_HIT = -93;

function swingFrames(): Frame[] {
  return [
    [0, rot(ARM_REST)],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 5, rot(ARM_REST)],
      [s - 2, rot(ARM_UP)],
      [s, rot(ARM_HIT)],
      [s + 1.5, rot(ARM_HIT - 5)],
      [s + 4, rot(ARM_REST)],
    ]),
    [100, rot(ARM_REST)],
  ];
}

function nodFrames(): Frame[] {
  return [
    [0, rot(0)],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 5, rot(0)],
      [s - 2, rot(-7)],
      [s, rot(6)],
      [s + 4, rot(0)],
    ]),
    [100, rot(0)],
  ];
}

/** A small hop on every step, and a happy one once the gold is in. */
function hopFrames(): Frame[] {
  const frames: Frame[] = [[0, tr(0, 0)]];
  for (const [a, b] of [WALK_OUT, WALK_BACK]) {
    const step = (b - a) / 4;
    for (let k = 0; k < 4; k++) {
      frames.push([a + k * step, tr(0, 0)], [a + k * step + step / 2, tr(0, -3)]);
    }
    frames.push([b, tr(0, 0)]);
  }
  frames.push([69, tr(0, 0)], [70.5, tr(0, -6)], [72, tr(0, 0)]);
  frames.push([100, tr(0, 0)]);
  return frames;
}

function walkFrames(): Frame[] {
  return [
    [0, tr(0, 0)],
    [WALK_OUT[0], tr(0, 0)],
    [WALK_OUT[1], tr(WALK, 0)],
    [WALK_BACK[0], tr(WALK, 0)],
    [WALK_BACK[1], tr(0, 0)],
    [100, tr(0, 0)],
  ];
}

/** Turn to face the chest just before setting off, and back once the gold is in. */
function faceFrames(): Frame[] {
  const right = "transform: scaleX(1)";
  const left = "transform: scaleX(-1)";
  return [
    [0, right],
    [WALK_OUT[0] - 0.6, right],
    [WALK_OUT[0] - 0.4, left],
    [WALK_BACK[0] - 0.2, left],
    [WALK_BACK[0], right],
    [100, right],
  ];
}

function rockFrames(): Frame[] {
  const still = "transform: translate(0px, 0px) scale(1, 1)";
  return [
    [0, still],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 0.2, still],
      [s + 0.6, "transform: translate(1.5px, 0px) scale(1.05, 0.92)"],
      [s + 2.5, still],
    ]),
    [100, still],
  ];
}

function sparkFrames(): Frame[] {
  const hidden = "opacity: 0; transform: translate(0px, 0px) scale(0.4)";
  return [
    [0, hidden],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 0.2, hidden],
      [s + 0.6, "opacity: 1; transform: translate(var(--dx), var(--dy)) scale(1)"],
      [s + 3, "opacity: 0; transform: translate(calc(var(--dx) * 1.9), calc(var(--dy) * 1.9)) scale(0.4)"],
      [s + 3.1, hidden],
    ]),
    [100, hidden],
  ];
}

/** Nugget `i` arcs from the boulder to its slot on the backpack. */
function flightFrames(i: number): Frame[] {
  const s = STRIKES[i];
  const to: Point = [HERO_X + SLOTS[i][0], SLOTS[i][1]];
  const start = `opacity: 0; ${tr(...STRIKE_POINT)}`;
  const end = `opacity: 0; ${tr(...to)}`;
  return [
    [0, start],
    [s, start],
    ...arc(STRIKE_POINT, to, 20, s + 0.3, s + 3.8).map(([p, css]): Frame => [p, `opacity: 1; ${css}`]),
    [s + 4, end],
    [100, end],
  ];
}

/** Nugget `i` rides the backpack from the moment it lands until the drop. */
function loadFrames(i: number): Frame[] {
  const landed = STRIKES[i] + 4;
  return [
    [0, "opacity: 0"],
    [landed - 0.05, "opacity: 0"],
    [landed, "opacity: 1"],
    [DROP[1], "opacity: 1"],
    [DROP[1] + 0.2, "opacity: 0"],
    [100, "opacity: 0"],
  ];
}

/**
 * The whole load is tossed over the head into the chest. The hero is mirrored
 * by then, so the chest is at +x in its own space.
 */
function dropFrames(): Frame[] {
  const inChest: Point = [CHEST_REACH + 12.5, 19];
  return [
    [0, tr(0, 0)],
    ...arc([0, 0], inChest, 42, DROP[0], DROP[1]),
    [DROP[1] + 0.3, tr(...inChest)],
    [DROP[1] + 0.5, tr(0, 0)],
    [100, tr(0, 0)],
  ];
}

function lidFrames(): Frame[] {
  return [
    [0, rot(0)],
    [WALK_OUT[1], rot(0)],
    [WALK_OUT[1] + 2.5, rot(-58)],
    [72, rot(-58)],
    [75, rot(0)],
    [100, rot(0)],
  ];
}

function coinFrames(): Frame[] {
  const hidden = "opacity: 0; transform: translate(0px, 0px)";
  return [
    [0, hidden],
    [DROP[1], hidden],
    [DROP[1] + 1, "opacity: 1; transform: translate(0px, 0px)"],
    [DROP[1] + 3.5, "opacity: 1; transform: translate(var(--dx), -14px)"],
    [DROP[1] + 6, "opacity: 0; transform: translate(calc(var(--dx) * 1.5), -3px)"],
    [100, hidden],
  ];
}

function shineFrames(): Frame[] {
  return [
    [0, "opacity: 0"],
    [DROP[1] - 0.5, "opacity: 0"],
    [DROP[1] + 1, "opacity: 1"],
    [75, "opacity: 0"],
    [100, "opacity: 0"],
  ];
}

const WALKS: [number, number][] = [WALK_OUT, WALK_BACK];

const STYLES = `
  .ctxa {
    --ctxa-rock:#B4B1C6; --ctxa-rock-2:#8A879E; --ctxa-rock-0:#D8D6E4;
  }
  .dark .ctxa {
    --ctxa-rock:#8F8CA6; --ctxa-rock-2:#65627C; --ctxa-rock-0:#B2AFC6;
  }
  /* Mood only retimes the one clock — no forked timeline. */
  .ctxa[data-mood="thriving"] { --ctxa-cycle:7.5s; }
  .ctxa[data-mood="strained"] { --ctxa-cycle:13s; }

  .fin-walk { animation-name: fin-walk; }
  .fin-face { animation-name: fin-face; }
  .fin-hop { animation-name: fin-hop; }
  .fin-arm { transform: rotate(${ARM_REST}deg); animation-name: fin-swing; }
  .fin-far-arm { transform: rotate(-38deg); }
  .fin-nod { animation-name: fin-nod; }
  .fin-leg-near { animation-name: fin-leg-near; animation-timing-function: steps(1, end); }
  .fin-leg-far { animation-name: fin-leg-far; animation-timing-function: steps(1, end); }
  .fin-rock { animation-name: fin-rock; transform-origin: 0px 0px; }
  .fin-spark { animation-name: fin-spark; animation-timing-function: ease-out; opacity: 0; }
  .fin-fly, .fin-load { opacity: 0; }
  .fin-drop { animation-name: fin-drop; }
  .fin-lid { animation-name: fin-lid; transform-origin: -15px -15px; }
  .fin-coin { animation-name: fin-coin; animation-timing-function: ease-out; opacity: 0; }
  .fin-shine { animation-name: fin-shine; opacity: 0; }
  ${SLOTS.map((_, i) => `.fin-fly-${i} { animation-name: fin-fly-${i}; } .fin-load-${i} { animation-name: fin-load-${i}; }`).join("\n  ")}

  ${keyframes("fin-swing", swingFrames())}
  ${keyframes("fin-nod", nodFrames())}
  ${keyframes("fin-hop", hopFrames())}
  ${keyframes("fin-walk", walkFrames())}
  ${keyframes("fin-face", faceFrames())}
  ${keyframes("fin-leg-near", stepFrames(WALKS, 1))}
  ${keyframes("fin-leg-far", stepFrames(WALKS, -1))}
  ${keyframes("fin-rock", rockFrames())}
  ${keyframes("fin-spark", sparkFrames())}
  ${SLOTS.map((_, i) => keyframes(`fin-fly-${i}`, flightFrames(i))).join("\n  ")}
  ${SLOTS.map((_, i) => keyframes(`fin-load-${i}`, loadFrames(i))).join("\n  ")}
  ${keyframes("fin-drop", dropFrames())}
  ${keyframes("fin-lid", lidFrames())}
  ${keyframes("fin-coin", coinFrames())}
  ${keyframes("fin-shine", shineFrames())}

  .fin-sweat { animation: fin-sweat 2.9s ease-in infinite; opacity: 0; }
  @keyframes fin-sweat {
    0%, 55%  { opacity: 0; transform: translateY(0px) scale(0.6); }
    70%      { opacity: 1; transform: translateY(2px) scale(1); }
    92%      { opacity: 0; transform: translateY(10px) scale(0.8); }
    100%     { opacity: 0; }
  }

  /* Idle: no plan to mine for, so no trips — the hero stands there wondering. */
  .ctxa[data-mood="idle"] .ctxa-loop { animation: none; }
  .ctxa[data-mood="idle"] .fin-rest { animation: ctxa-breathe 3.4s ease-in-out infinite; }
  .fin-dot { animation: fin-dot 1.8s ease-in-out infinite; }
  @keyframes fin-dot { 0%, 60%, 100% { opacity: 0.25; } 30% { opacity: 1; } }
`;

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const NUGGET = "M-3 1 L-2 -2.6 L1.5 -3 L3.2 0 L1 2.8 L-2 2.6 Z";

function Nugget({ className, x = 0, y = 0 }: { className?: string; x?: number; y?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className={className} d={NUGGET} fill="var(--ctxa-gold)" strokeWidth="1.1" {...INK} />
    </g>
  );
}

/** Drawn in the arm's space, along it: the hand grips the handle at (-0.8, -15). */
function Pickaxe(): ReactElement {
  return (
    <g strokeWidth="1.6" {...INK}>
      <rect x="-2.7" y="-20" width="3.8" height="30" rx="1.9" fill="var(--ctxa-wood)" />
      <path d="M-14.5 3.5 Q-0.8 14 13 3.5 L11.5 0 Q-0.8 8 -13 0 Z" fill="var(--ctxa-steel)" />
    </g>
  );
}

function Rock({ twinkling }: { twinkling: boolean }): ReactElement {
  return (
    <g transform={`translate(${ROCK_X} 1)`}>
      <Shadow rx={24} />
      <g className="ctxa-loop fin-rock" strokeWidth="2" {...INK}>
        <path d="M-20 0 L-22 -10 L-14 -22 L-2 -27 L12 -24 L21 -13 L22 0 Z" fill="var(--ctxa-rock)" />
        <path d="M12 -24 L21 -13 L22 0 L8 0 L6 -13 Z" fill="var(--ctxa-rock-2)" stroke="none" />
        <path d="M-14 -22 L-2 -27 L2 -20 L-9 -16 Z" fill="var(--ctxa-rock-0)" stroke="none" />
        <path d="M-20 0 L-22 -10 L-14 -22 L-2 -27 L12 -24 L21 -13 L22 0 Z" fill="none" />
        <g strokeWidth="1.1">
          <path d="M-15 -8 l5 -4 l4.5 3 l-3 5.5 l-5 -0.5 z" fill="var(--ctxa-gold)" />
          <path d="M-1 -17 l6 -1.5 l3 4 l-5 3 z" fill="var(--ctxa-gold)" />
          <path d="M1 -6 l4.5 -2 l3 3 l-4 2.5 z" fill="var(--ctxa-gold-2)" />
          <path d="M12 -12 l4 -1 l1 4 l-4 1 z" fill="var(--ctxa-gold-2)" />
        </g>
      </g>
      {twinkling &&
        (
          [
            [-18, -28, 0],
            [17, -32, 1.1],
            [2, -38, 2.1],
          ] as const
        ).map(([x, y, delay]) => (
          <g key={delay} transform={`translate(${x} ${y}) scale(0.7)`}>
            <path className="ctxa-twinkle" style={{ animationDelay: `${delay}s` }} d={SPARK} fill="var(--ctxa-gold)" />
          </g>
        ))}
    </g>
  );
}

function Chest(): ReactElement {
  return (
    <g transform={`translate(${CHEST_X} 1)`}>
      <Shadow rx={19} />
      <g className="ctxa-loop fin-shine" stroke="var(--ctxa-gold)" strokeWidth="2" strokeLinecap="round">
        <path d="M0 -30 v-8 M-11 -27 l-5 -6 M11 -27 l5 -6" />
      </g>
      <g strokeWidth="2" {...INK}>
        <rect x="-15" y="-15" width="30" height="15" rx="2" fill="var(--ctxa-wood)" />
        <path d="M-15 -6 h30" strokeWidth="1.2" opacity="0.5" />
        <rect x="-15" y="-15" width="5" height="15" fill="var(--ctxa-steel-2)" strokeWidth="1.2" />
        <rect x="10" y="-15" width="5" height="15" fill="var(--ctxa-steel-2)" strokeWidth="1.2" />
        <rect x="-15" y="-15" width="30" height="15" rx="2" fill="none" />
      </g>
      {[-9, 0, 9].map((dx, i) => (
        <g key={dx} transform="translate(0 -17)">
          <circle
            className="ctxa-loop fin-coin"
            style={{ "--dx": `${dx}px`, animationDelay: `${i * 0.08}s` } as CSSProperties}
            r="2.6"
            fill="var(--ctxa-gold)"
            stroke="var(--ctxa-ink)"
            strokeWidth="1"
          />
        </g>
      ))}
      <g className="ctxa-loop fin-lid" strokeWidth="2" {...INK}>
        <path d="M-15 -15 v-4 a6 6 0 0 1 6 -6 h18 a6 6 0 0 1 6 6 v4 z" fill="var(--ctxa-wood-2)" />
        <rect x="-3" y="-18" width="6" height="6" rx="1.5" fill="var(--ctxa-gold)" strokeWidth="1.2" />
      </g>
    </g>
  );
}

type Spark = { dx: number; dy: number; size: number; fill: string; delay?: number };
const SPARKS: Spark[] = [
  { dx: -7, dy: -11, size: 0.8, fill: "var(--ctxa-gold)" },
  { dx: 8, dy: -9, size: 0.6, fill: "var(--ctxa-gold-0)", delay: 0.05 },
  { dx: 1, dy: -15, size: 0.5, fill: "var(--ctxa-gold)", delay: 0.02 },
];
const THRIVING_SPARKS: Spark[] = [
  { dx: -14, dy: -4, size: 0.5, fill: "var(--ctxa-gold-0)", delay: 0.08 },
  { dx: 15, dy: -3, size: 0.5, fill: "var(--ctxa-gold)", delay: 0.11 },
];

const FACES: Record<FinanceMood, HeroFace> = {
  thriving: "happy",
  steady: "calm",
  strained: "tired",
  idle: "calm",
};

export function FinanceScene({ mood, className }: { mood: FinanceMood; className?: string }): ReactElement {
  const thriving = mood === "thriving";
  const sparks = thriving ? [...SPARKS, ...THRIVING_SPARKS] : SPARKS;

  return (
    <Stage
      styles={STYLES}
      tone="grass"
      mood={mood}
      className={className}
      ground={<rect x="18" y="130" width="284" height="20" rx="10" fill="var(--ctxa-dirt)" />}
    >
      <Tree x={296} y={121} scale={0.8} />
      <Tree x={112} y={119} scale={0.7} />
      <Tuft x={62} y={124} />
      <Tuft x={196} y={122} />
      <Tuft x={258} y={155} />
      <Flower x={150} y={126} color="var(--ctxa-shoe)" />
      <Flower x={226} y={124} color="var(--ctxa-white)" delay={0.5} />
      <Flower x={84} y={155} color="var(--ctxa-scarf)" delay={0.9} />

      <Cast>
        <Chest />
        <Rock twinkling={thriving} />

        {sparks.map((spark) => (
          <g key={`${spark.dx}-${spark.dy}`} transform={`translate(${STRIKE_POINT[0]} ${STRIKE_POINT[1]}) scale(${spark.size})`}>
            <path
              className="ctxa-loop fin-spark"
              style={
                {
                  "--dx": `${spark.dx / spark.size}px`,
                  "--dy": `${spark.dy / spark.size}px`,
                  animationDelay: `${spark.delay ?? 0}s`,
                } as CSSProperties
              }
              d={SPARK}
              fill={spark.fill}
              stroke="var(--ctxa-ink)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>
        ))}

        <g className="ctxa-loop ctxa-linear fin-walk">
          <g transform={`translate(${HERO_X} 0)`}>
            <g className="ctxa-loop fin-face">
              <Shadow />
              <g className="ctxa-loop fin-hop">
                <g className="fin-rest">
                  <Hero
                    face={FACES[mood]}
                    tool={<Pickaxe />}
                    arm="ctxa-loop fin-arm"
                    farArm="fin-far-arm"
                    head="ctxa-loop fin-nod"
                    nearLeg="ctxa-loop fin-leg-near"
                    farLeg="ctxa-loop fin-leg-far"
                    load={
                      <g className="ctxa-loop ctxa-linear fin-drop">
                        {SLOTS.map(([x, y], i) => (
                          <Nugget key={i} x={x} y={y} className={`ctxa-loop fin-load fin-load-${i}`} />
                        ))}
                      </g>
                    }
                  />
                  {mood === "idle" && (
                    <g strokeWidth="1.4" {...INK}>
                      <circle cx="17" cy="-66" r="1.6" fill="var(--ctxa-white)" />
                      <rect x="16" y="-86" width="24" height="15" rx="7.5" fill="var(--ctxa-white)" />
                      {[22, 28, 34].map((x, i) => (
                        <circle
                          key={x}
                          className="fin-dot"
                          style={{ animationDelay: `${i * 0.25}s` }}
                          cx={x}
                          cy="-78.5"
                          r="1.7"
                          fill="var(--ctxa-ink)"
                          stroke="none"
                        />
                      ))}
                    </g>
                  )}
                  {mood === "strained" && (
                    <path
                      className="fin-sweat"
                      d="M19 -63 q3.2 4.6 0 6.4 q-3.2 -1.8 0 -6.4 z"
                      fill="#7CC4F5"
                      stroke="var(--ctxa-ink)"
                      strokeWidth="0.9"
                    />
                  )}
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* nuggets in flight, boulder → backpack */}
        {SLOTS.map((_, i) => (
          <path
            key={i}
            className={`ctxa-loop ctxa-linear fin-fly fin-fly-${i}`}
            d={NUGGET}
            fill="var(--ctxa-gold)"
            strokeWidth="1.1"
            {...INK}
          />
        ))}
      </Cast>
    </Stage>
  );
}
