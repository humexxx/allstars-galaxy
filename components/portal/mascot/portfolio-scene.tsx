/**
 * Portfolio: the hero waters a money tree. Each pour grows a coin on it; then
 * the tree shakes the harvest loose into the basket.
 */
import type { ReactElement } from "react";

import { arc, Cast, Flower, Hero, loop, rot, Shadow, SPARK, Stage, tr, Tree, Tuft, type Frame, type Point } from "./kit";

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const GREEN = "#3FA65B";
const WATER = "#7CC4F5";

// ---------- the layout, in cast units ----------

const HERO_X = -34;
const TREE_X = 12;
const BASKET_X = 50;
const SIGN_X = 78;

/** Where each coin grows, in the tree's space. */
const BUDS: Point[] = [
  [-10, -43],
  [10, -44],
  [0, -58],
];
/** Where each coin comes to rest, in the basket's space. */
const PILE: Point[] = [
  [-5, -15.5],
  [4.5, -16.5],
  [0, -20.5],
];
/** The spout's mouth while pouring, in the hero's space. */
const SPOUT: Point = [29, -18.5];

// ---------- the timeline, in percent of one cycle ----------

const POURS: [number, number][] = [
  [6, 14],
  [22, 30],
  [38, 46],
];
const SHAKE = 55;
const FALL = 4.5;
const FALLS = POURS.map((_, i) => 60.5 + i * 2);
const CHEER: [number, number] = [70, 82];
const CLEAR: [number, number] = [92, 96];

const ARM = -95;
const ARM_POUR = -115;
/** The can's own turn while pouring, on top of the arm's. */
const TILT = 55;

function pourFrames(rest: number, pour: number): Frame[] {
  return [
    [0, rot(rest)],
    ...POURS.flatMap(([a, b]): Frame[] => [
      [a - 3, rot(rest)],
      [a, rot(pour)],
      [b, rot(pour)],
      [b + 3, rot(rest)],
    ]),
    [100, rot(rest)],
  ];
}

function waterFrames(): Frame[] {
  return [
    [0, "opacity: 0"],
    ...POURS.flatMap(([a, b]): Frame[] => [
      [a - 0.5, "opacity: 0"],
      [a + 0.5, "opacity: 1"],
      [b - 0.5, "opacity: 1"],
      [b + 0.5, "opacity: 0"],
    ]),
    [100, "opacity: 0"],
  ];
}

/** Coin `i` swells on the tree at the end of its pour, hangs there, then drops into the basket. */
function coinFrames(i: number): Frame[] {
  const bud = BUDS[i];
  const rest: Point = [BASKET_X - TREE_X + PILE[i][0], PILE[i][1]];
  const pop = POURS[i][1] - 1;
  const at = (p: Point, opacity: number, scale: number): string => `opacity: ${opacity}; ${tr(...p)} scale(${scale})`;
  return [
    [0, at(bud, 0, 0)],
    [pop - 1.5, at(bud, 0, 0)],
    [pop, at(bud, 1, 1.35)],
    [pop + 1.5, at(bud, 1, 1)],
    ...arc(bud, rest, 9, FALLS[i], FALLS[i] + FALL).map(([p, css]): Frame => [p, `opacity: 1; ${css} scale(1)`]),
    [FALLS[i] + FALL + 0.1, at(rest, 0, 1)],
    [100, at(rest, 0, 1)],
  ];
}

function pileFrames(i: number): Frame[] {
  const landed = FALLS[i] + FALL;
  return [
    [0, "opacity: 0"],
    [landed - 0.1, "opacity: 0"],
    [landed, "opacity: 1"],
    [CLEAR[0], "opacity: 1"],
    [CLEAR[1], "opacity: 0"],
    [100, "opacity: 0"],
  ];
}

function basketFrames(): Frame[] {
  const still = "transform: scale(1, 1)";
  return [
    [0, still],
    ...FALLS.flatMap((start): Frame[] => [
      [start + FALL - 0.2, still],
      [start + FALL + 0.7, "transform: scale(1.08, 0.88)"],
      [start + FALL + 1.9, still],
    ]),
    [100, still],
  ];
}

const STYLES = [
  loop("pf-arm", pourFrames(ARM, ARM_POUR), rot(ARM)),
  loop("pf-can", pourFrames(0, TILT)),
  loop(
    "pf-far",
    [
      [0, rot(-70)],
      [CHEER[0], rot(-70)],
      [CHEER[0] + 2.5, rot(-165)],
      [CHEER[0] + 5, rot(-145)],
      [CHEER[0] + 7.5, rot(-165)],
      [CHEER[1] - 3, rot(-165)],
      [CHEER[1], rot(-70)],
      [100, rot(-70)],
    ],
    rot(-70),
  ),
  loop("pf-head", [
    [0, rot(4)],
    [SHAKE - 5, rot(4)],
    [SHAKE - 2, rot(-10)],
    [CHEER[0], rot(-10)],
    [CHEER[0] + 3, rot(0)],
    [CHEER[1], rot(0)],
    [CHEER[1] + 4, rot(4)],
    [100, rot(4)],
  ]),
  loop("pf-hop", [
    [0, tr(0, 0)],
    [CHEER[0] + 1, tr(0, 0)],
    [CHEER[0] + 2.5, tr(0, -6)],
    [CHEER[0] + 4, tr(0, 0)],
    [CHEER[0] + 5.5, tr(0, -5)],
    [CHEER[0] + 7, tr(0, 0)],
    [100, tr(0, 0)],
  ]),
  loop("pf-water", waterFrames(), "opacity: 0;"),
  loop("pf-shake", [
    [0, rot(0)],
    [SHAKE, rot(0)],
    [SHAKE + 1, rot(-5)],
    [SHAKE + 2, rot(5)],
    [SHAKE + 3, rot(-4)],
    [SHAKE + 4, rot(3)],
    [SHAKE + 5, rot(0)],
    [100, rot(0)],
  ]),
  loop("pf-basket", basketFrames()),
  ...BUDS.map((bud, i) => loop(`pf-coin-${i}`, coinFrames(i), `opacity: 1; ${tr(...bud)} scale(1);`)),
  ...PILE.map((_, i) => loop(`pf-pile-${i}`, pileFrames(i), "opacity: 0;")),
  `.pf-drop { animation: pf-drop 0.5s linear infinite; }
   @keyframes pf-drop {
     0% { opacity: 1; transform: translate(0px, 0px); }
     80% { opacity: 1; transform: translate(2.4px, 12px); }
     100% { opacity: 0; transform: translate(3px, 15px); }
   }`,
].join("\n");

const CROWN: [number, number, number][] = [
  [-9, -45, 11.5],
  [10, -46, 12.5],
  [0, -58, 13.5],
];

function MoneyTree(): ReactElement {
  return (
    <g>
      <path d="M-4.5 0 Q-2.5 -14 -3 -36 H3 Q2.5 -14 4.5 0 Z" fill="var(--ctxa-wood-2)" strokeWidth="2" {...INK} />
      {CROWN.map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill="var(--ctxa-g3)" stroke="var(--ctxa-ink)" strokeWidth="4" />
      ))}
      {CROWN.map(([cx, cy, r]) => (
        <circle key={cx} cx={cx} cy={cy} r={r} fill="var(--ctxa-g3)" />
      ))}
      <path d="M-8 -64 a10 7 0 0 1 11 -5" fill="none" stroke="var(--ctxa-g)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M-15 -47 a6 5 0 0 1 4 -6" fill="none" stroke="var(--ctxa-g)" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

function Coin(): ReactElement {
  return (
    <g strokeWidth="1.1" {...INK}>
      <circle r="3.5" fill="var(--ctxa-gold)" />
      <path d="M0 -1.5 v3" stroke="var(--ctxa-gold-2)" strokeWidth="1.3" fill="none" />
    </g>
  );
}

function Basket(): ReactElement {
  return (
    <g strokeWidth="1.8" {...INK}>
      <path d="M-12 -13 L-9.5 0 H9.5 L12 -13 Z" fill="var(--ctxa-wood)" />
      <path d="M-10.8 -6.5 H10.8 M-5 -13 L-4 0 M5 -13 L4 0" strokeWidth="1.1" opacity="0.45" fill="none" />
      <rect x="-13.5" y="-16" width="27" height="4.5" rx="2.2" fill="var(--ctxa-wood-2)" />
    </g>
  );
}

function GrowthSign(): ReactElement {
  return (
    <g strokeWidth="1.8" {...INK}>
      <rect x="-2" y="-22" width="4" height="22" rx="1.5" fill="var(--ctxa-wood-2)" />
      <rect x="-11" y="-38" width="22" height="17" rx="2.5" fill="var(--ctxa-white)" />
      <path d="M-7 -25.5 L-2.5 -30 L0.5 -27.5 L6 -33.5 M2.4 -34 H6.2 V-30.2" fill="none" stroke={GREEN} strokeWidth="2" />
    </g>
  );
}

/** Drawn upright with the hand, at the origin, on the back of its handle. */
function WateringCan(): ReactElement {
  return (
    <g strokeWidth="1.6" {...INK}>
      <path d="M2 1 Q-5 5 1 11" fill="none" strokeWidth="2.4" />
      <path d="M12 8 L21.5 -1 L24 1.5 L13 12 Z" fill="var(--ctxa-cap-2)" />
      <path d="M20 -4 L26.5 2.5 L24 4 L18.5 -1.5 Z" fill="var(--ctxa-steel)" strokeWidth="1.3" />
      <rect x="0" y="0" width="13.5" height="12.5" rx="2.5" fill="var(--ctxa-cap)" />
      <path d="M0 4.5 h13.5" strokeWidth="1.1" opacity="0.45" fill="none" />
    </g>
  );
}

export function PortfolioScene({ className }: { className?: string }): ReactElement {
  return (
    <Stage styles={STYLES} tone="grass" className={className}>
      <Tree x={30} y={121} scale={0.75} />
      <Tuft x={66} y={124} />
      <Tuft x={214} y={158} />
      <Flower x={140} y={157} color="var(--ctxa-shoe)" />
      <Flower x={292} y={156} color="var(--ctxa-white)" delay={0.5} />
      <Flower x={44} y={156} color="var(--ctxa-scarf)" delay={0.9} />
      <Cast>
        <g transform={`translate(${SIGN_X} -6)`}>
          <Shadow rx={8} />
          <GrowthSign />
        </g>

        <g transform={`translate(${TREE_X} 0)`}>
          <ellipse cx="0" cy="0.5" rx="17" ry="5" fill="var(--ctxa-dirt)" strokeWidth="1.5" {...INK} />
          <g className="ctxa-loop pf-shake">
            <MoneyTree />
            {[
              [-17, -62, 0],
              [17, -66, 1.3],
            ].map(([x, y, delay]) => (
              <g key={delay} transform={`translate(${x} ${y}) scale(0.6)`}>
                <path className="ctxa-twinkle" style={{ animationDelay: `${delay}s` }} d={SPARK} fill="var(--ctxa-gold)" />
              </g>
            ))}
          </g>
        </g>

        <g transform={`translate(${BASKET_X} 1)`}>
          <Shadow rx={15} />
          <g className="ctxa-loop pf-basket">
            {PILE.map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`}>
                <g className={`ctxa-loop pf-pile-${i}`}>
                  <Coin />
                </g>
              </g>
            ))}
            <Basket />
          </g>
        </g>

        <g transform={`translate(${HERO_X} 0)`}>
          <Shadow />
          <g className="ctxa-loop pf-hop">
            <Hero
              face="happy"
              arm="ctxa-loop pf-arm"
              farArm="ctxa-loop pf-far"
              head="ctxa-loop pf-head"
              tool={
                <g transform={`translate(-0.8 -15) rotate(${-ARM})`}>
                  <g className="ctxa-loop pf-can">
                    <WateringCan />
                  </g>
                </g>
              }
            />
          </g>
          <g transform={`translate(${SPOUT[0]} ${SPOUT[1]})`}>
            <g className="ctxa-loop pf-water">
              {[0, -0.17, -0.33].map((delay) => (
                <path
                  key={delay}
                  className="pf-drop"
                  style={{ animationDelay: `${delay}s` }}
                  d="M0 -2.4 q2.6 3.6 0 5 q-2.6 -1.4 0 -5 z"
                  fill={WATER}
                  stroke="var(--ctxa-ink)"
                  strokeWidth="0.7"
                />
              ))}
            </g>
          </g>
        </g>

        <g transform={`translate(${TREE_X} 0)`}>
          <g className="ctxa-loop pf-shake">
            {BUDS.map((_, i) => (
              <g key={i} className={`ctxa-loop ctxa-linear pf-coin-${i}`}>
                <Coin />
              </g>
            ))}
          </g>
        </g>
      </Cast>
    </Stage>
  );
}
