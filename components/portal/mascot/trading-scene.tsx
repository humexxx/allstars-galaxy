/**
 * Trading: the hero calls a chart candle by candle with a pointer. A red one
 * drops its head, a green one earns a hop, and the big close gets a cheer.
 * The journal waits on the crate behind.
 */
import type { ReactElement } from "react";

import type { MascotCharacter } from "@/types/preferences";

import { Cast, Hero, loop, rot, Shadow, SPARK, Stage, tr, type Frame, type Point } from "./kit";

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const GREEN = "#3FA65B";

// ---------- the layout, in cast units ----------

const HERO_X = -22;
const BOARD_X = 40;
const BOARD_Y = -5;
const CRATE_X = -70;

type Candle = { x: number; open: number; close: number; high: number; low: number };

/** In the board's space; y grows downward, so a rising candle closes above its open. */
const CANDLES: Candle[] = [
  { x: -22, open: -34, close: -44, high: -47, low: -31 },
  { x: -11, open: -42, close: -36, high: -45, low: -33 },
  { x: 0, open: -37, close: -52, high: -55, low: -34 },
  { x: 11, open: -50, close: -44, high: -54, low: -41 },
  { x: 22, open: -45, close: -68, high: -71, low: -42 },
];

const rises = (candle: Candle): boolean => candle.close < candle.open;

// ---------- the timeline, in percent of one cycle ----------

/** The moment the pointer calls each candle. */
const TAPS = [8, 21, 34, 47, 60];
const GROW = 4;
const WIN: [number, number] = [65, 82];
const WIPE: [number, number] = [88, 92];

const ARM_REST = -75;
const ARM_CHEER = -170;

/** The arm's angle when the pointer aims at the top of candle `i`. */
function aim(i: number): number {
  const candle = CANDLES[i];
  const dx = BOARD_X + candle.x - (HERO_X - 0.8);
  const dy = Math.min(candle.open, candle.close) + BOARD_Y + 27;
  return Math.round((Math.atan2(-dx, dy) * 180) / Math.PI);
}

function armFrames(): Frame[] {
  return [
    [0, rot(ARM_REST)],
    ...TAPS.flatMap((t, i): Frame[] => [
      [t - 4, rot(ARM_REST)],
      [t - 1.5, rot(aim(i) - 14)],
      [t, rot(aim(i))],
      [t + 1, rot(aim(i) + 5)],
      [t + 2, rot(aim(i))],
      [t + 5, rot(ARM_REST)],
    ]),
    [WIN[0] + 2, rot(ARM_CHEER)],
    [WIN[0] + 5, rot(ARM_CHEER + 22)],
    [WIN[0] + 8, rot(ARM_CHEER)],
    [WIN[0] + 11, rot(ARM_CHEER + 22)],
    [WIN[0] + 14, rot(ARM_CHEER)],
    [WIN[1], rot(ARM_REST)],
    [100, rot(ARM_REST)],
  ];
}

function headFrames(): Frame[] {
  return [
    [0, rot(0)],
    ...TAPS.flatMap((t, i): Frame[] =>
      rises(CANDLES[i])
        ? []
        : [
            [t + 4, rot(0)],
            [t + 6, rot(10)],
            [t + 10, rot(10)],
            [t + 12, rot(0)],
          ],
    ),
    [WIN[0], rot(0)],
    [WIN[0] + 2, rot(-8)],
    [WIN[1] - 2, rot(-8)],
    [WIN[1], rot(0)],
    [100, rot(0)],
  ];
}

function hopFrames(): Frame[] {
  return [
    [0, tr(0, 0)],
    ...TAPS.slice(0, -1).flatMap((t, i): Frame[] =>
      rises(CANDLES[i])
        ? [
            [t + 4, tr(0, 0)],
            [t + 5.5, tr(0, -4)],
            [t + 7, tr(0, 0)],
          ]
        : [],
    ),
    ...[1, 5, 9].flatMap((d): Frame[] => [
      [WIN[0] + d, tr(0, 0)],
      [WIN[0] + d + 1.5, tr(0, -7)],
      [WIN[0] + d + 3, tr(0, 0)],
    ]),
    [100, tr(0, 0)],
  ];
}

function candleFrames(i: number): Frame[] {
  const unborn = "opacity: 0; transform: scale(1, 0)";
  const grown = "opacity: 1; transform: scale(1, 1)";
  const wiped = "opacity: 0; transform: scale(1, 1)";
  return [
    [0, unborn],
    [TAPS[i] - 0.1, unborn],
    [TAPS[i], "opacity: 1; transform: scale(1, 0)"],
    [TAPS[i] + GROW, grown],
    [WIPE[0], grown],
    [WIPE[1], wiped],
    [100, wiped],
  ];
}

function sparkFrames(k: number): Frame[] {
  const hidden = "opacity: 0; transform: scale(0.3)";
  const start = WIN[0] + 1 + k * 2;
  return [
    [0, hidden],
    ...[0, 6].flatMap((d): Frame[] => [
      [start + d, hidden],
      [start + d + 1.5, "opacity: 1; transform: scale(1)"],
      [start + d + 4.5, hidden],
    ]),
    [100, hidden],
  ];
}

const SPARKS: Point[] = [
  [-38, -70],
  [37, -76],
  [10, -80],
];

const STYLES = [
  loop("trd-arm", armFrames(), rot(ARM_REST)),
  loop(
    "trd-far",
    [
      [0, rot(-20)],
      [WIN[0], rot(-20)],
      [WIN[0] + 2, rot(-160)],
      [WIN[0] + 5, rot(-140)],
      [WIN[0] + 8, rot(-160)],
      [WIN[0] + 11, rot(-140)],
      [WIN[0] + 14, rot(-160)],
      [WIN[1], rot(-20)],
      [100, rot(-20)],
    ],
    rot(-20),
  ),
  loop("trd-head", headFrames()),
  loop("trd-hop", hopFrames()),
  ...CANDLES.map((candle, i) =>
    loop(
      `trd-candle-${i}`,
      candleFrames(i),
      `transform-box: fill-box; transform-origin: 50% ${rises(candle) ? "100%" : "0%"}; opacity: 1;`,
    ),
  ),
  ...SPARKS.map((_, k) => loop(`trd-spark-${k}`, sparkFrames(k), "transform-box: fill-box; transform-origin: center; opacity: 0;")),
].join("\n");

const LEGS = "M-22 0 L-12 -26 M22 0 L12 -26";

function ChartBoard(): ReactElement {
  return (
    <g strokeWidth="2" {...INK}>
      <path d="M0 -4 V-26" stroke="var(--ctxa-ink)" strokeWidth="5" fill="none" opacity="0.5" />
      <path d={LEGS} strokeWidth="5.5" fill="none" />
      <path d={LEGS} stroke="var(--ctxa-wood-2)" strokeWidth="2.4" fill="none" />
      <rect x="-34" y="-78" width="68" height="55" rx="3.5" fill="var(--ctxa-wood)" />
      <rect x="-30.5" y="-74.5" width="61" height="48" rx="1.5" fill="var(--ctxa-white)" strokeWidth="1.4" />
      <path d="M-27 -38 H27 M-27 -50 H27 M-27 -62 H27" strokeWidth="0.8" opacity="0.14" fill="none" />
      <rect x="-37" y="-25" width="74" height="4.5" rx="2.2" fill="var(--ctxa-wood-2)" />
      {CANDLES.map((candle, i) => {
        const top = Math.min(candle.open, candle.close);
        return (
          <g key={candle.x} className={`ctxa-loop trd-candle-${i}`}>
            <path d={`M${candle.x} ${candle.high} V${candle.low}`} strokeWidth="1.4" fill="none" />
            <rect
              x={candle.x - 3.2}
              y={top}
              width="6.4"
              height={Math.abs(candle.open - candle.close)}
              rx="1"
              fill={rises(candle) ? GREEN : "var(--ctxa-shoe)"}
              strokeWidth="1.1"
            />
          </g>
        );
      })}
    </g>
  );
}

/** Drawn along the arm, running on past the hand. */
function Pointer(): ReactElement {
  return (
    <g strokeWidth="1.3" {...INK}>
      <rect x="-1.9" y="-17" width="2.2" height="31" rx="1.1" fill="var(--ctxa-wood)" />
      <circle cx="-0.8" cy="15" r="2.3" fill="var(--ctxa-shoe)" />
    </g>
  );
}

function JournalCrate(): ReactElement {
  return (
    <g strokeWidth="1.8" {...INK}>
      <rect x="-12" y="-15" width="24" height="15" rx="2" fill="var(--ctxa-wood)" />
      <path d="M-12 -7.5 h24 M-4 -15 v15 M4 -15 v15" strokeWidth="1.1" opacity="0.45" fill="none" />
      <rect x="-9.5" y="-20.5" width="17" height="5.5" rx="1.4" fill="var(--ctxa-jacket)" strokeWidth="1.4" />
      <path d="M-8 -17.2 h14" stroke="var(--ctxa-white)" strokeWidth="1.5" fill="none" />
      <path d="M3.5 -20.5 v5.5" stroke="var(--ctxa-scarf)" strokeWidth="1.6" fill="none" />
      <path d="M-6 -22.5 L8 -24.5" stroke="var(--ctxa-ink)" strokeWidth="3" fill="none" />
      <path d="M-6 -22.5 L6.5 -24.3" stroke="var(--ctxa-gold)" strokeWidth="1.4" fill="none" />
    </g>
  );
}

export function TradingScene({ character, className }: { character?: MascotCharacter; className?: string }): ReactElement {
  return (
    <Stage
      styles={STYLES}
      tone="room"
      className={className}
      ground={<rect x="84" y="124" width="170" height="26" rx="9" fill="var(--ctxa-g3)" opacity="0.4" />}
    >
      <Cast>
        <g transform={`translate(${CRATE_X} -2)`}>
          <Shadow rx={15} />
          <JournalCrate />
        </g>

        <g transform={`translate(${BOARD_X} ${BOARD_Y})`}>
          <Shadow rx={27} y={1} />
          <ChartBoard />
          {SPARKS.map(([x, y], k) => (
            <g key={k} transform={`translate(${x} ${y}) scale(0.75)`}>
              <path
                className={`ctxa-loop trd-spark-${k}`}
                d={SPARK}
                fill="var(--ctxa-gold)"
                stroke="var(--ctxa-ink)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>

        <g transform={`translate(${HERO_X} 0)`}>
          <Shadow />
          <g className="ctxa-loop trd-hop">
            <Hero character={character} face="happy" arm="ctxa-loop trd-arm" farArm="ctxa-loop trd-far" head="ctxa-loop trd-head" tool={<Pointer />} />
          </g>
        </g>
      </Cast>
    </Stage>
  );
}
