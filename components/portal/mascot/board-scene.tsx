/**
 * Board: the hero walks a card across a kanban board — up onto In progress,
 * busy hands while its bar fills, across to Done for a check and a cheer —
 * then walks back for the next one.
 */
import type { ReactElement } from "react";

import type { MascotCharacter } from "@/types/preferences";

import { arc, Cast, Hero, loop, rot, Shadow, Stage, stepFrames, tr, type Frame, type Point } from "./kit";

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const GREEN = "#3FA65B";

// ---------- the layout, in cast units ----------

const BOARD_Y = -3;
/** The centre of each column, and of each row of cards, in the board's space. */
const COLS = [-41, 0, 41];
const ROWS = [-70, -58.5, -47];
/** Where the hero stands to reach each column. */
const STOPS = [-74, -30, 12];
/** The centre of the card as it leaves a raised hand, in the hero's space. */
const HAND: Point = [1.5, -49];

const slot = (col: number): Point => [COLS[col], ROWS[0] + BOARD_Y];
const hand = (col: number): Point => [STOPS[col] + HAND[0], HAND[1]];

// ---------- the timeline, in percent of one cycle ----------

const WALKS: [number, number][] = [
  [8, 20],
  [44, 56],
  [72, 82],
  [82, 92],
];
/** Each time the card changes hands: hero to board, board to hero, hero to board. */
const TOSSES: { from: Point; to: Point; span: [number, number] }[] = [
  { from: hand(1), to: slot(1), span: [21.5, 24] },
  { from: slot(1), to: hand(1), span: [40.5, 42.5] },
  { from: hand(2), to: slot(2), span: [57.5, 60] },
];
const WORK: [number, number] = [26, 40];
const CHEER = 63;
const CLEAR: [number, number] = [92, 95];
const NEXT: [number, number] = [94, 97];

const ARM_CARRY = -80;
const ARM_UP = -150;
const ARM_REST = -15;

function busyFrames(first: number, second: number): Frame[] {
  return Array.from({ length: 6 }, (_, k): Frame[] => [
    [WORK[0] + 1 + k * 2, rot(first)],
    [WORK[0] + 2 + k * 2, rot(second)],
  ]).flat();
}

function cheerFrames(rest: number): Frame[] {
  return [
    [CHEER - 1, rot(rest)],
    [CHEER + 0.5, rot(-165)],
    [CHEER + 2, rot(-145)],
    [CHEER + 3.5, rot(-165)],
    [CHEER + 5, rot(-145)],
    [CHEER + 6.5, rot(rest)],
  ];
}

function armFrames(): Frame[] {
  return [
    [0, rot(ARM_CARRY)],
    [20, rot(ARM_CARRY)],
    [21.5, rot(ARM_UP)],
    [23.5, rot(ARM_UP)],
    [WORK[0], rot(-60)],
    ...busyFrames(-95, -60),
    [WORK[1], rot(-60)],
    [41, rot(ARM_UP)],
    [42.5, rot(ARM_UP)],
    [44, rot(ARM_CARRY)],
    [56.5, rot(ARM_CARRY)],
    [57.5, rot(ARM_UP)],
    [60, rot(ARM_UP)],
    ...cheerFrames(ARM_REST),
    [NEXT[0] - 1, rot(ARM_REST)],
    [NEXT[0] + 0.5, rot(ARM_CARRY)],
    [100, rot(ARM_CARRY)],
  ];
}

function farFrames(): Frame[] {
  return [
    [0, rot(ARM_REST)],
    [WORK[0], rot(ARM_REST)],
    ...busyFrames(-60, -95),
    [WORK[1], rot(ARM_REST)],
    ...cheerFrames(ARM_REST),
    [100, rot(ARM_REST)],
  ];
}

function walkFrames(): Frame[] {
  const at = (col: number): string => tr(STOPS[col] - STOPS[0], 0);
  return [
    [0, at(0)],
    [WALKS[0][0], at(0)],
    [WALKS[0][1], at(1)],
    [WALKS[1][0], at(1)],
    [WALKS[1][1], at(2)],
    [WALKS[2][0], at(2)],
    [WALKS[3][1], at(0)],
    [100, at(0)],
  ];
}

function faceFrames(): Frame[] {
  const right = "transform: scaleX(1)";
  const left = "transform: scaleX(-1)";
  return [
    [0, right],
    [WALKS[2][0] - 0.4, right],
    [WALKS[2][0] - 0.2, left],
    [WALKS[3][1], left],
    [WALKS[3][1] + 0.2, right],
    [100, right],
  ];
}

function hopFrames(): Frame[] {
  const frames: Frame[] = [[0, tr(0, 0)]];
  for (const [a, b] of WALKS) {
    const step = (b - a) / 4;
    for (let k = 0; k < 4; k++) {
      frames.push([a + k * step, tr(0, 0)], [a + k * step + step / 2, tr(0, -3)]);
    }
    frames.push([b, tr(0, 0)]);
  }
  for (const start of [20.5, 40.2, 56.8]) {
    frames.push([start, tr(0, 0)], [start + 1.4, tr(0, -7)], [start + 2.8, tr(0, 0)]);
  }
  for (const start of [CHEER, CHEER + 3]) {
    frames.push([start, tr(0, 0)], [start + 1.5, tr(0, -6)], [start + 3, tr(0, 0)]);
  }
  frames.push([100, tr(0, 0)]);
  return frames;
}

function headFrames(): Frame[] {
  return [
    [0, rot(0)],
    [20, rot(0)],
    [21.5, rot(-10)],
    [41.5, rot(-10)],
    [44, rot(0)],
    [56.5, rot(0)],
    [58, rot(-10)],
    [CHEER, rot(-10)],
    [CHEER + 2, rot(0)],
    [100, rot(0)],
  ];
}

/** The card in the hero's hand: there until tossed, back once caught, and new again at the end. */
function heldFrames(): Frame[] {
  const shown = "opacity: 1; transform: scale(1)";
  const gone = "opacity: 0; transform: scale(1)";
  return [
    [0, shown],
    [TOSSES[0].span[0] - 0.1, shown],
    [TOSSES[0].span[0], gone],
    [TOSSES[1].span[1] - 0.1, gone],
    [TOSSES[1].span[1], shown],
    [TOSSES[2].span[0] - 0.1, shown],
    [TOSSES[2].span[0], gone],
    [NEXT[0], "opacity: 0; transform: scale(0.2)"],
    [NEXT[0] + 1.5, "opacity: 1; transform: scale(1.3)"],
    [NEXT[1], shown],
    [100, shown],
  ];
}

function flyFrames(): Frame[] {
  const hiddenAt = (p: Point): string => `opacity: 0; ${tr(...p)}`;
  return [
    [0, hiddenAt(TOSSES[0].from)],
    ...TOSSES.flatMap(({ from, to, span }): Frame[] => [
      [span[0] - 0.1, hiddenAt(from)],
      ...arc(from, to, 5, span[0], span[1]).map(([p, css]): Frame => [p, `opacity: 1; ${css}`]),
      [span[1] + 0.1, hiddenAt(to)],
    ]),
    [100, hiddenAt(TOSSES[2].to)],
  ];
}

/** A card on the board between the moment it lands and the moment it leaves. */
function stuckFrames(lands: number, leaves: [number, number]): Frame[] {
  const hidden = "opacity: 0; transform: scale(1)";
  const shown = "opacity: 1; transform: scale(1)";
  return [
    [0, hidden],
    [lands - 0.1, hidden],
    [lands, "opacity: 1; transform: scale(1.25)"],
    [lands + 1.5, shown],
    [leaves[0], shown],
    [leaves[1], hidden],
    [100, hidden],
  ];
}

const POP = "transform-box: fill-box; transform-origin: center;";

const STYLES = [
  loop("brd-walk", walkFrames()),
  loop("brd-face", faceFrames()),
  loop("brd-hop", hopFrames()),
  loop("brd-arm", armFrames(), rot(ARM_CARRY)),
  loop("brd-far", farFrames(), rot(ARM_REST)),
  loop("brd-head", headFrames()),
  loop("brd-leg-near", stepFrames(WALKS, 1), "animation-timing-function: steps(1, end);"),
  loop("brd-leg-far", stepFrames(WALKS, -1), "animation-timing-function: steps(1, end);"),
  loop("brd-held", heldFrames()),
  loop("brd-fly", flyFrames(), "opacity: 0;"),
  loop("brd-wip", stuckFrames(TOSSES[0].span[1], [TOSSES[1].span[0], TOSSES[1].span[0] + 0.1]), `${POP} opacity: 0;`),
  loop("brd-done", stuckFrames(TOSSES[2].span[1], CLEAR), `${POP} opacity: 0;`),
  loop(
    "brd-bar",
    [
      [0, "transform: scaleX(0)"],
      [WORK[0], "transform: scaleX(0)"],
      [WORK[1] - 1, "transform: scaleX(1)"],
      [100, "transform: scaleX(1)"],
    ],
    "transform-box: fill-box; transform-origin: 0% 50%;",
  ),
  loop(
    "brd-check",
    [
      [0, "opacity: 0; transform: scale(0)"],
      [TOSSES[2].span[1] + 0.5, "opacity: 0; transform: scale(0)"],
      [TOSSES[2].span[1] + 2, "opacity: 1; transform: scale(1.6)"],
      [TOSSES[2].span[1] + 3.5, "opacity: 1; transform: scale(1)"],
      [100, "opacity: 1; transform: scale(1)"],
    ],
    POP,
  ),
].join("\n");

const CHECK = "M3.5 0 l1.8 2 l3.4 -4";

type CardKind = "waiting" | "active" | "done";

/** A card, centred on the origin. */
function Card({ kind }: { kind: CardKind }): ReactElement {
  return (
    <g strokeWidth="1.1" {...INK}>
      <rect x="-11" y="-4.5" width="22" height="9" rx="1.6" fill={kind === "active" ? "var(--ctxa-gold)" : "var(--ctxa-gold-0)"} />
      <path d={kind === "waiting" ? "M-8 -1.3 h11 M-8 1.5 h6" : "M-8 0 h8"} strokeWidth="1" opacity="0.4" fill="none" />
      {kind === "done" && <path d={CHECK} fill="none" stroke={GREEN} strokeWidth="1.6" />}
    </g>
  );
}

const HEADERS = ["var(--ctxa-steel-2)", "var(--ctxa-jacket)", GREEN];

/** The cards that never move: [column, row, kind]. */
const PINNED: [number, number, CardKind][] = [
  [0, 0, "waiting"],
  [0, 1, "waiting"],
  [0, 2, "waiting"],
  [1, 1, "waiting"],
  [2, 1, "done"],
  [2, 2, "done"],
];

const POSTS = "M-50 -30 V-1 M50 -30 V-1";

function Kanban(): ReactElement {
  return (
    <g strokeWidth="2" {...INK}>
      <path d={POSTS} strokeWidth="6" fill="none" />
      <path d={POSTS} stroke="var(--ctxa-steel)" strokeWidth="2.6" fill="none" />
      <rect x="-66" y="-84" width="132" height="56" rx="3.5" fill="var(--ctxa-steel-2)" />
      <rect x="-62.5" y="-80.5" width="125" height="49" rx="1.5" fill="var(--ctxa-white)" strokeWidth="1.4" />
      <path d="M-20.5 -79 V-33 M20.5 -79 V-33" strokeWidth="0.9" opacity="0.18" fill="none" />
      {COLS.map((x, i) => (
        <rect key={x} x={x - 16} y="-79" width="32" height="3.6" rx="1.8" fill={HEADERS[i]} strokeWidth="0.9" />
      ))}
      {PINNED.map(([col, row, kind]) => (
        <g key={`${col}-${row}`} transform={`translate(${COLS[col]} ${ROWS[row]})`}>
          <Card kind={kind} />
        </g>
      ))}
      <g transform={`translate(${COLS[1]} ${ROWS[0]})`}>
        <g className="ctxa-loop brd-wip">
          <Card kind="active" />
          <rect x="-8" y="1.2" width="16" height="2" rx="1" fill="var(--ctxa-ink)" opacity="0.2" stroke="none" />
          <rect className="ctxa-loop ctxa-linear brd-bar" x="-8" y="1.2" width="16" height="2" rx="1" fill="var(--ctxa-jacket)" stroke="none" />
        </g>
      </g>
      <g transform={`translate(${COLS[2]} ${ROWS[0]})`}>
        <g className="ctxa-loop brd-done">
          <Card kind="active" />
          <path className="ctxa-loop brd-check" d={CHECK} fill="none" stroke={GREEN} strokeWidth="1.8" />
        </g>
      </g>
    </g>
  );
}

export function BoardScene({ character, className }: { character?: MascotCharacter; className?: string }): ReactElement {
  return (
    <Stage styles={STYLES} tone="wood" cycle={11} className={className}>
      <Cast>
        <g transform={`translate(0 ${BOARD_Y})`}>
          <Shadow rx={9} x={-50} />
          <Shadow rx={9} x={50} />
          <Kanban />
        </g>

        <g className="ctxa-loop ctxa-linear brd-walk">
          <g transform={`translate(${STOPS[0]} 0)`}>
            <g className="ctxa-loop brd-face">
              <Shadow />
              <g className="ctxa-loop brd-hop">
                <Hero character={character}
                  face="happy"
                  arm="ctxa-loop brd-arm"
                  farArm="ctxa-loop brd-far"
                  head="ctxa-loop brd-head"
                  nearLeg="ctxa-loop brd-leg-near"
                  farLeg="ctxa-loop brd-leg-far"
                  tool={
                    <g transform={`translate(-0.8 -15) rotate(${-ARM_CARRY}) translate(5 -6)`}>
                      <g className="ctxa-loop brd-held">
                        <Card kind="active" />
                      </g>
                    </g>
                  }
                />
              </g>
            </g>
          </g>
        </g>

        <g className="ctxa-loop ctxa-linear brd-fly">
          <Card kind="active" />
        </g>
      </Cast>
    </Stage>
  );
}
