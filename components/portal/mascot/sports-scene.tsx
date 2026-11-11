/**
 * Sports: the hero plays whichever sport the page is showing. One small scene
 * per sport, each a short loop on the scene's clock; only the active scene's
 * keyframes reach the page.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";

import type { SportId } from "@/types/sports";
import type { MascotCharacter } from "@/types/preferences";

import {
  arc,
  Cast,
  CAST_SCALE,
  Hero,
  HeroHead,
  loop,
  rot,
  Shadow,
  SPARK,
  Stage,
  tr,
  type Frame,
  type Point,
  type Tone,
} from "./kit";

type Scene = {
  tone: Tone;
  plain?: boolean;
  /** Seconds one loop takes. */
  cycle: number;
  styles: string;
  /** Markings on the slab, in stage pixels. */
  ground?: ReactNode;
  /** Scenery behind the cast, in stage pixels. */
  backdrop?: ReactNode;
  cast: ReactNode;
};

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const CHALK = { stroke: "var(--ctxa-white)", strokeWidth: 2, fill: "none", opacity: 0.7 } as const;

/** A cast x as a stage x, for markings that must sit under a piece of the cast. */
const sx = (x: number): number => 160 + x * CAST_SCALE;

const lit = (frames: Frame[]): Frame[] => frames.map(([p, css]): Frame => [p, `opacity: 1; ${css}`]);

/** `arc`, shrinking on the way: a ball flying away from the viewer. */
function fly(from: Point, to: Point, apex: number, start: number, end: number, scale: [number, number]): Frame[] {
  const frames = arc(from, to, apex, start, end);
  return frames.map(([p, css], k): Frame => {
    const t = k / (frames.length - 1);
    return [p, `${css} scale(${(scale[0] + (scale[1] - scale[0]) * t).toFixed(2)})`];
  });
}

function popFrames(at: number, length = 9): Frame[] {
  const hidden = "opacity: 0; transform: scale(0.3)";
  const gone = "opacity: 0; transform: scale(1.3)";
  return [
    [0, hidden],
    [at, hidden],
    [at + 1.5, "opacity: 1; transform: scale(1)"],
    [at + length * 0.6, "opacity: 1; transform: scale(1)"],
    [at + length, gone],
    [100, gone],
  ];
}

const POP_BASE = "opacity: 0; transform-box: fill-box; transform-origin: center;";

function Pop({ name, x, y, size = 0.8, delay = 0 }: { name: string; x: number; y: number; size?: number; delay?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path
        className={`ctxa-loop ${name}`}
        style={{ animationDelay: `${delay}s` }}
        d={SPARK}
        fill="var(--ctxa-gold)"
        strokeWidth="1.2"
        {...INK}
      />
    </g>
  );
}

function Player({ x, y = 0, hop, children }: { x: number; y?: number; hop?: string; children: ReactNode }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`}>
      <Shadow />
      <g className={hop ? `ctxa-loop ${hop}` : undefined}>{children}</g>
    </g>
  );
}

function hopFrames(at: number, height = 7): Frame[] {
  return [
    [0, tr(0, 0)],
    [at, tr(0, 0)],
    [at + 3, tr(0, -height)],
    [at + 6, tr(0, 0)],
    [at + 9, tr(0, -height * 0.7)],
    [at + 12, tr(0, 0)],
    [100, tr(0, 0)],
  ];
}

// ---------- football and the NFL: a kick ----------

/** The limbs of a place kick landing at `k`, then both arms up from `cheer`. */
function kickStyles(p: string, k: number, cheer: number): string {
  return [
    loop(`${p}-leg`, [
      [0, rot(0)],
      [k - 9, rot(0)],
      [k - 3, rot(32)],
      [k, rot(-58)],
      [k + 4, rot(-58)],
      [k + 9, rot(0)],
      [100, rot(0)],
    ]),
    loop(
      `${p}-arm`,
      [
        [0, rot(-20)],
        [k - 9, rot(-20)],
        [k - 3, rot(-70)],
        [k, rot(30)],
        [k + 9, rot(-20)],
        [cheer, rot(-20)],
        [cheer + 3, rot(-125)],
        [cheer + 6, rot(-95)],
        [cheer + 9, rot(-125)],
        [cheer + 13, rot(-125)],
        [cheer + 17, rot(-20)],
        [100, rot(-20)],
      ],
      rot(-20),
    ),
    loop(
      `${p}-far`,
      [
        [0, rot(20)],
        [k - 9, rot(20)],
        [k - 3, rot(40)],
        [k, rot(-30)],
        [k + 9, rot(20)],
        [cheer, rot(20)],
        [cheer + 3, rot(75)],
        [cheer + 13, rot(75)],
        [cheer + 17, rot(20)],
        [100, rot(20)],
      ],
      rot(20),
    ),
    loop(`${p}-hop`, hopFrames(cheer)),
  ].join("\n");
}

function Kicker({ p, x, character }: { p: string; x: number; character?: MascotCharacter }): ReactElement {
  return (
    <Player x={x} hop={`${p}-hop`}>
      <Hero character={character} face="happy" arm={`ctxa-loop ${p}-arm`} farArm={`ctxa-loop ${p}-far`} nearLeg={`ctxa-loop ${p}-leg`} />
    </Player>
  );
}

function football(character?: MascotCharacter): Scene {
  const X = -46;
  const K = 22;
  const GOAL_X = 56;
  const rest: Point = [X + 15, -4.6];
  const goal: Point = [GOAL_X + 10, -16];
  const grounded: Point = [GOAL_X + 8, -4.6];

  const styles = [
    kickStyles("fb", K, K + 13),
    loop(
      "fb-ball",
      [
        [0, tr(...rest)],
        [K, tr(...rest)],
        ...arc(rest, goal, 13, K + 0.1, K + 12),
        [K + 14, tr(GOAL_X + 14, -14)],
        [K + 20, tr(...grounded)],
        [K + 27, tr(...grounded)],
        [92, tr(...rest)],
        [100, tr(...rest)],
      ],
      tr(...rest),
    ),
    loop("fb-net", [
      [0, "transform: scaleX(1)"],
      [K + 12, "transform: scaleX(1)"],
      [K + 14, "transform: scaleX(1.16)"],
      [K + 19, "transform: scaleX(1)"],
      [100, "transform: scaleX(1)"],
    ]),
    loop("fb-pop", popFrames(K + 12), POP_BASE),
  ].join("\n");

  return {
    tone: "turf",
    cycle: 6,
    styles,
    ground: (
      <g {...CHALK}>
        <path d={`M${sx(GOAL_X)} 100 V160`} />
        <rect x={sx(GOAL_X) - 52} y="116" width="52" height="34" />
        <circle cx="62" cy="132" r="19" />
        <path d="M62 100 V160" />
      </g>
    ),
    cast: (
      <>
        <Kicker p="fb" x={X} character={character} />
        <g className="ctxa-loop ctxa-linear fb-ball" strokeWidth="1.3" {...INK}>
          <circle r="4.6" fill="var(--ctxa-white)" />
          <path d="M0 -2 L1.9 -0.6 L1.2 1.7 L-1.2 1.7 L-1.9 -0.6 Z" fill="var(--ctxa-ink)" strokeWidth="0.6" />
          <path d="M0 -2 V-4.4 M1.9 -0.6 L4.3 -1.4 M1.2 1.7 L2.7 3.6 M-1.2 1.7 L-2.7 3.6 M-1.9 -0.6 L-4.3 -1.4" strokeWidth="0.8" fill="none" />
        </g>
        <g transform={`translate(${GOAL_X} 0)`}>
          <g className="ctxa-loop fb-net">
            <path d="M0 -40 H20 L30 0 H0 Z" fill="var(--ctxa-white)" opacity="0.3" />
            <path
              d="M6 -40 V0 M12 -40 V0 M18 -40 L21 0 M0 -30 H22.5 M0 -20 H25 M0 -10 H27.5"
              stroke="var(--ctxa-white)"
              strokeWidth="0.9"
              fill="none"
              opacity="0.8"
            />
          </g>
          <path d="M0 0 V-40 H20 L30 0" fill="none" strokeWidth="5" {...INK} />
          <path d="M0 0 V-40 H20 L30 0" fill="none" stroke="var(--ctxa-white)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <Pop name="fb-pop" x={GOAL_X + 4} y={-50} />
        <Pop name="fb-pop" x={GOAL_X + 24} y={-44} size={0.6} delay={0.1} />
      </>
    ),
  };
}

function nfl(character?: MascotCharacter): Scene {
  const X = -52;
  const K = 22;
  const POSTS_X = 58;
  const tee: Point = [X + 15, -7];
  const through: Point = [POSTS_X, -54];
  const hidden = `opacity: 0; ${tr(...tee)} scale(0.6)`;
  const teed = `opacity: 1; ${tr(...tee)} scale(1)`;

  const styles = [
    kickStyles("nfl", K, K + 16),
    loop(
      "nfl-ball",
      [
        [0, teed],
        [K, teed],
        ...lit(fly(tee, through, 26, K + 0.1, K + 16, [1, 0.5])),
        [K + 20, `opacity: 0; ${tr(POSTS_X + 4, -44)} scale(0.45)`],
        [K + 21, hidden],
        [80, hidden],
        [86, teed],
        [100, teed],
      ],
      `${tr(...tee)};`,
    ),
    loop("nfl-pop", popFrames(K + 16), POP_BASE),
  ].join("\n");

  return {
    tone: "turf",
    cycle: 6,
    styles,
    ground: (
      <>
        <rect x="236" y="100" width="90" height="70" fill="var(--ctxa-g3)" opacity="0.55" />
        <g {...CHALK}>
          <path d="M76 100 V160 M156 100 V160 M236 100 V160" />
          <path d="M96 118 v5 M116 118 v5 M136 118 v5 M176 118 v5 M196 118 v5 M216 118 v5" strokeWidth="1.5" />
          <path d="M96 143 v5 M116 143 v5 M136 143 v5 M176 143 v5 M196 143 v5 M216 143 v5" strokeWidth="1.5" />
        </g>
      </>
    ),
    cast: (
      <>
        <g transform={`translate(${POSTS_X} 0)`}>
          <Shadow rx={8} />
          <path d="M0 0 V-26 M-15 -26 H15 M-15 -26 V-68 M15 -26 V-68" fill="none" strokeWidth="5.4" {...INK} />
          <path
            d="M0 0 V-26 M-15 -26 H15 M-15 -26 V-68 M15 -26 V-68"
            fill="none"
            stroke="var(--ctxa-gold)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g transform="translate(-15 -68)">
            <path className="ctxa-sway" d="M0 0 l7 2.5 l-7 2.5 z" fill="var(--ctxa-shoe)" strokeWidth="1" {...INK} />
          </g>
          <g transform="translate(15 -68)">
            <path className="ctxa-sway" style={{ animationDelay: "0.4s" }} d="M0 0 l7 2.5 l-7 2.5 z" fill="var(--ctxa-shoe)" strokeWidth="1" {...INK} />
          </g>
        </g>
        <path transform={`translate(${tee[0]} 0)`} d="M-3 0 L0 -4 L3 0 Z" fill="var(--ctxa-pack)" strokeWidth="1.1" {...INK} />
        <Kicker p="nfl" x={X} character={character} />
        <g className="ctxa-loop ctxa-linear nfl-ball">
          <g transform="rotate(-35)" strokeWidth="1.3" {...INK}>
            <ellipse rx="5.6" ry="3.5" fill="var(--ctxa-wood-2)" />
            <path d="M-2.2 0 H2.2 M-1.2 -1.1 v2.2 M0 -1.1 v2.2 M1.2 -1.1 v2.2" stroke="var(--ctxa-white)" strokeWidth="0.8" fill="none" />
          </g>
        </g>
        <Pop name="nfl-pop" x={POSTS_X - 8} y={-58} />
        <Pop name="nfl-pop" x={POSTS_X + 9} y={-48} size={0.6} delay={0.1} />
      </>
    ),
  };
}

// ---------- NBA: dribble, then a jump shot ----------

function nba(character?: MascotCharacter): Scene {
  const X = -50;
  const HOOP_X = 58;
  const RIM_Y = -68;
  const top: Point = [X + 12, -18];
  const floor: Point = [X + 12, -5];
  const hold: Point = [X + 15, -38];
  const release: Point = [X + 15, -48];
  const rim: Point = [HOOP_X, RIM_Y - 2];

  const styles = [
    loop(
      "nba-ball",
      [
        [0, tr(...top)],
        [4.5, tr(...floor)],
        [9, tr(...top)],
        [13.5, tr(...floor)],
        [18, tr(...top)],
        [22.5, tr(...floor)],
        [27, tr(...top)],
        [32, tr(...hold)],
        [36, tr(...release)],
        ...arc(release, rim, 15, 36.1, 52),
        [56, tr(HOOP_X, RIM_Y + 16)],
        [62, tr(HOOP_X, -5)],
        [68, tr(HOOP_X - 11, -19)],
        [74, tr(HOOP_X - 21, -5)],
        [92, tr(...floor)],
        [100, tr(...top)],
      ],
      tr(...top),
    ),
    loop(
      "nba-arm",
      [
        [0, rot(-75)],
        [4.5, rot(-52)],
        [9, rot(-75)],
        [13.5, rot(-52)],
        [18, rot(-75)],
        [22.5, rot(-52)],
        [27, rot(-75)],
        [32, rot(-125)],
        [36, rot(-155)],
        [46, rot(-155)],
        [54, rot(-40)],
        [88, rot(-40)],
        [93, rot(-52)],
        [100, rot(-75)],
      ],
      rot(-75),
    ),
    loop(
      "nba-far",
      [
        [0, rot(15)],
        [27, rot(15)],
        [32, rot(-120)],
        [36, rot(-145)],
        [46, rot(-145)],
        [54, rot(15)],
        [100, rot(15)],
      ],
      rot(15),
    ),
    loop("nba-hop", [
      [0, tr(0, 0)],
      [32, tr(0, 0)],
      [36, tr(0, -10)],
      [41, tr(0, 0)],
      [100, tr(0, 0)],
    ]),
    loop(
      "nba-net",
      [
        [0, "transform: scale(1, 1)"],
        [52, "transform: scale(1, 1)"],
        [54.5, "transform: scale(0.86, 1.3)"],
        [58, "transform: scale(1.06, 0.92)"],
        [61, "transform: scale(1, 1)"],
        [100, "transform: scale(1, 1)"],
      ],
      `transform-origin: ${HOOP_X}px ${RIM_Y}px;`,
    ),
    loop("nba-pop", popFrames(53), POP_BASE),
  ].join("\n");

  return {
    tone: "wood",
    cycle: 6,
    styles,
    ground: (
      <>
        <rect x={sx(HOOP_X) - 50} y="118" width="90" height="30" fill="var(--ctxa-shoe)" opacity="0.3" />
        <g {...CHALK}>
          <rect x={sx(HOOP_X) - 50} y="118" width="90" height="30" />
          <path d={`M${sx(HOOP_X) - 50} 120 a14 13 0 0 0 0 26`} />
          <path d="M300 100 H170 A84 34 0 0 0 170 166 H300" />
        </g>
      </>
    ),
    cast: (
      <>
        <g strokeWidth="2" {...INK}>
          <Shadow rx={9} x={HOOP_X + 20} />
          <rect x={HOOP_X + 18} y="-60" width="4.5" height="60" rx="1.5" fill="var(--ctxa-steel-2)" />
          <path d={`M${HOOP_X + 20} -60 L${HOOP_X + 12} ${RIM_Y - 4}`} fill="none" strokeWidth="3.4" />
          <rect x={HOOP_X + 9} y={RIM_Y - 20} width="4" height="26" rx="1" fill="var(--ctxa-white)" />
        </g>
        <Player x={X} hop="nba-hop">
          <Hero character={character} face="happy" arm="ctxa-loop nba-arm" farArm="ctxa-loop nba-far" />
        </Player>
        <g className="ctxa-loop ctxa-linear nba-ball" strokeWidth="1.3" {...INK}>
          <circle r="5.2" fill="var(--ctxa-pack)" />
          <path d="M-5.2 0 H5.2 M0 -5.2 V5.2 M-3.6 -3.7 Q0 0 -3.6 3.7 M3.6 -3.7 Q0 0 3.6 3.7" strokeWidth="0.8" fill="none" />
        </g>
        <g className="ctxa-loop nba-net">
          <path
            d={`M${HOOP_X - 7} ${RIM_Y} L${HOOP_X - 4.5} ${RIM_Y + 13} H${HOOP_X + 4.5} L${HOOP_X + 7} ${RIM_Y} Z`}
            fill="var(--ctxa-white)"
            opacity="0.6"
          />
          <path
            d={`M${HOOP_X - 7} ${RIM_Y} L${HOOP_X - 4.5} ${RIM_Y + 13} H${HOOP_X + 4.5} L${HOOP_X + 7} ${RIM_Y} M${HOOP_X - 2.5} ${RIM_Y} L${HOOP_X - 1.5} ${RIM_Y + 13} M${HOOP_X + 2.5} ${RIM_Y} L${HOOP_X + 1.5} ${RIM_Y + 13} M${HOOP_X - 6} ${RIM_Y + 6} H${HOOP_X + 6}`}
            fill="none"
            strokeWidth="0.9"
            {...INK}
          />
        </g>
        <path d={`M${HOOP_X - 8} ${RIM_Y} H${HOOP_X + 9}`} fill="none" strokeWidth="4.4" {...INK} />
        <path d={`M${HOOP_X - 8} ${RIM_Y} H${HOOP_X + 9}`} fill="none" stroke="var(--ctxa-shoe)" strokeWidth="2" strokeLinecap="round" />
        <Pop name="nba-pop" x={HOOP_X - 14} y={RIM_Y - 10} />
        <Pop name="nba-pop" x={HOOP_X + 2} y={RIM_Y - 22} size={0.6} delay={0.1} />
      </>
    ),
  };
}

// ---------- MLB: batting practice ----------

function mlb(character?: MascotCharacter): Scene {
  const X = -44;
  const MACHINE_X = 66;
  const mouth: Point = [MACHINE_X - 12, -27];
  const contact: Point = [X + 30, -27];
  const waiting = `opacity: 0; ${tr(...mouth)} scale(1)`;

  const styles = [
    loop(
      "mlb-ball",
      [
        [0, waiting],
        [12, waiting],
        ...lit(fly(mouth, contact, 3, 13, 26, [1, 1])),
        ...lit(fly(contact, [86, -86], 12, 26.1, 42, [1, 0.6])),
        [46, `opacity: 0; ${tr(92, -90)} scale(0.5)`],
        [100, `opacity: 0; ${tr(92, -90)} scale(0.5)`],
      ],
      "opacity: 0;",
    ),
    loop(
      "mlb-arm",
      [
        [0, rot(-200)],
        [18, rot(-200)],
        [23, rot(-212)],
        [26, rot(-90)],
        [29, rot(-58)],
        [38, rot(-58)],
        [50, rot(-200)],
        [100, rot(-200)],
      ],
      rot(-200),
    ),
    loop("mlb-hop", hopFrames(42)),
    loop("mlb-pop", popFrames(26, 7), POP_BASE),
    loop("mlb-kick", [
      [0, tr(0, 0)],
      [12, tr(0, 0)],
      [13.5, tr(2.5, 0)],
      [18, tr(0, 0)],
      [100, tr(0, 0)],
    ]),
    `.mlb-wheel { animation: mlb-wheel 0.7s linear infinite; transform-box: fill-box; transform-origin: center; }
     @keyframes mlb-wheel { to { transform: rotate(360deg); } }`,
    ".mlb-far { transform: rotate(-70deg); }",
  ].join("\n");

  return {
    tone: "grass",
    cycle: 5,
    styles,
    ground: (
      <>
        <ellipse cx={sx(X) + 14} cy="134" rx="62" ry="19" fill="var(--ctxa-dirt)" />
        <ellipse cx={sx(MACHINE_X)} cy="138" rx="34" ry="11" fill="var(--ctxa-dirt)" />
        <path
          d={`M${sx(X) + 24} 139 h12 v5 l-6 5 l-6 -5 z`}
          fill="var(--ctxa-white)"
          stroke="var(--ctxa-ink)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </>
    ),
    cast: (
      <>
        <g transform={`translate(${MACHINE_X} 0)`}>
          <Shadow rx={15} />
          <g className="ctxa-loop mlb-kick" strokeWidth="2" {...INK}>
            <path d="M-8 0 L-2 -18 M8 0 L2 -18 M0 -18 V-3" fill="none" strokeWidth="2.6" />
            <rect x="-13" y="-31" width="7" height="8" rx="1.5" fill="var(--ctxa-pants)" />
            <rect x="-9" y="-36" width="20" height="19" rx="4" fill="var(--ctxa-cap)" />
            <path d="M-4 -36 l2 -7 h10 l2 7" fill="var(--ctxa-steel)" />
            <circle cx="0" cy="-45" r="2.6" fill="var(--ctxa-white)" strokeWidth="1.1" />
            <circle cx="5" cy="-44.5" r="2.6" fill="var(--ctxa-white)" strokeWidth="1.1" />
            <g className="mlb-wheel">
              <circle cx="1" cy="-26.5" r="6" fill="var(--ctxa-steel)" />
              <path d="M1 -32.5 v12 M-5 -26.5 h12" strokeWidth="1.2" fill="none" />
            </g>
          </g>
        </g>
        <Player x={X} hop="mlb-hop">
          <Hero character={character}
            face="happy"
            arm="ctxa-loop mlb-arm"
            farArm="mlb-far"
            tool={<path d="M-2 -19 h2.4 l1.6 24 a2.8 2.8 0 0 1 -5.6 0 z" fill="var(--ctxa-wood)" strokeWidth="1.5" {...INK} />}
          />
        </Player>
        <g className="ctxa-loop ctxa-linear mlb-ball" strokeWidth="1.1" {...INK}>
          <circle r="3.1" fill="var(--ctxa-white)" />
          <path d="M-1.6 -2.4 q1.6 2.4 0 4.8 M1.6 -2.4 q-1.6 2.4 0 4.8" stroke="var(--ctxa-shoe)" strokeWidth="0.7" fill="none" />
        </g>
        <Pop name="mlb-pop" x={contact[0] + 3} y={contact[1] - 6} />
        <Pop name="mlb-pop" x={contact[0] + 10} y={contact[1] + 5} size={0.5} delay={0.06} />
      </>
    ),
  };
}

// ---------- NHL: a slap shot ----------

function nhl(character?: MascotCharacter): Scene {
  const X = -46;
  const NET_X = 58;
  const S = 26;
  const rest: Point = [X + 19, -1.6];
  const inNet: Point = [NET_X + 9, -1.6];
  const waiting = `opacity: 0; ${tr(...rest)}`;

  const styles = [
    loop(
      "nhl-puck",
      [
        [0, `opacity: 1; ${tr(...rest)}`],
        [S, `opacity: 1; ${tr(...rest)}`],
        [S + 9, `opacity: 1; ${tr(...inNet)}`],
        [S + 18, `opacity: 1; ${tr(...inNet)}`],
        [S + 22, `opacity: 0; ${tr(...inNet)}`],
        [S + 23, waiting],
        [80, waiting],
        [86, `opacity: 1; ${tr(...rest)}`],
        [100, `opacity: 1; ${tr(...rest)}`],
      ],
      `${tr(...rest)}; animation-timing-function: ease-out;`,
    ),
    loop(
      "nhl-arm",
      [
        [0, rot(-35)],
        [S - 10, rot(-35)],
        [S - 2, rot(58)],
        [S + 1, rot(-70)],
        [S + 8, rot(-70)],
        [S + 16, rot(-35)],
        [100, rot(-35)],
      ],
      rot(-35),
    ),
    loop("nhl-lean", [
      [0, rot(0)],
      [S - 10, rot(0)],
      [S - 2, rot(-6)],
      [S + 1, rot(7)],
      [S + 12, rot(0)],
      [100, rot(0)],
    ]),
    loop("nhl-hop", hopFrames(S + 10, 5)),
    loop(
      "nhl-lamp",
      [
        [0, "opacity: 0"],
        [S + 9, "opacity: 0"],
        [S + 10, "opacity: 1"],
        [S + 14, "opacity: 0.2"],
        [S + 18, "opacity: 1"],
        [S + 22, "opacity: 0.2"],
        [S + 26, "opacity: 1"],
        [S + 32, "opacity: 0"],
        [100, "opacity: 0"],
      ],
      "opacity: 0;",
    ),
    loop("nhl-net", [
      [0, "transform: scaleX(1)"],
      [S + 9, "transform: scaleX(1)"],
      [S + 11, "transform: scaleX(1.18)"],
      [S + 16, "transform: scaleX(1)"],
      [100, "transform: scaleX(1)"],
    ]),
    ".nhl-far { transform: rotate(-40deg); }",
  ].join("\n");

  return {
    tone: "ice",
    plain: true,
    cycle: 5,
    styles,
    ground: (
      <>
        <rect x="92" y="100" width="6" height="70" fill="#4F7FE0" opacity="0.6" />
        <rect x={sx(NET_X) - 1} y="100" width="2.5" height="70" fill="var(--ctxa-shoe)" opacity="0.7" />
        <path d={`M${sx(NET_X)} 118 a17 14 0 0 0 0 28 z`} fill="#8FC7EE" opacity="0.6" stroke="var(--ctxa-shoe)" strokeWidth="1.5" />
        <circle cx="150" cy="124" r="3.5" fill="var(--ctxa-shoe)" opacity="0.6" />
        <path d="M30 122 q14 4 30 1 M118 150 q16 -4 34 -1 M196 116 q10 3 22 0 M40 146 q8 2 18 0" {...CHALK} strokeWidth="1.2" />
      </>
    ),
    cast: (
      <>
        <g transform={`translate(${NET_X} 0)`}>
          <g className="ctxa-loop nhl-net">
            <path d="M0 -22 H10 L18 0 H0 Z" fill="var(--ctxa-white)" opacity="0.75" />
            <path d="M5 -22 V0 M10 -22 L12 0 M0 -15 H12.5 M0 -8 H15" stroke="var(--ctxa-steel-2)" strokeWidth="0.8" fill="none" />
          </g>
          <path d="M0 0 V-22 H10 L18 0" fill="none" strokeWidth="4.8" {...INK} />
          <path d="M0 0 V-22 H10 L18 0" fill="none" stroke="var(--ctxa-shoe)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <g strokeWidth="1.4" {...INK}>
            <rect x="1" y="-27" width="8" height="3" rx="1" fill="var(--ctxa-steel-2)" />
            <path d="M2 -27 a3 3.4 0 0 1 6 0 z" fill="var(--ctxa-shoe)" />
          </g>
          <g className="ctxa-loop nhl-lamp" stroke="var(--ctxa-shoe)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 -34 v-5 M-2 -32 l-4 -4 M12 -32 l4 -4" />
          </g>
        </g>
        <g className="ctxa-loop nhl-puck">
          <rect x="-3.4" y="-1.5" width="6.8" height="3" rx="1.2" fill="var(--ctxa-ink)" />
        </g>
        <Player x={X} y={-1.5} hop="nhl-hop">
          <g className="ctxa-loop nhl-lean" style={{ transformOrigin: "0px 0px" }}>
            <path d="M-9 1.2 h13 M-3 1.2 h13" fill="none" strokeWidth="2.6" {...INK} />
            <path d="M-9 1.2 h13 M-3 1.2 h13" fill="none" stroke="var(--ctxa-steel)" strokeWidth="1.1" strokeLinecap="round" />
            <Hero character={character}
              face="happy"
              arm="ctxa-loop nhl-arm"
              farArm="nhl-far"
              tool={
                <>
                  <path d="M-0.8 -19 V-1 l6.5 4.2" fill="none" strokeWidth="4.4" {...INK} />
                  <path d="M-0.8 -19 V-1 l6.5 4.2" fill="none" stroke="var(--ctxa-wood)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </>
              }
            />
          </g>
        </Player>
      </>
    ),
  };
}

// ---------- tennis and padel: a rally against the back of the court ----------

type Rally = {
  p: string;
  /** The ball's way out and back, as legs of [to, apex, arrives at]. */
  legs: [to: Point, apex: number, at: number][];
  hit: Point;
  /** The moments the ball touches something and throws up dust. */
  puffs: [at: number, where: Point][];
};

function rallyStyles({ p, legs, hit, puffs }: Rally): string {
  let from = hit;
  let start = 0;
  const ball: Frame[] = [];
  for (const [to, apex, at] of legs) {
    ball.push(...arc(from, to, apex, start + (start ? 0.1 : 0), at));
    from = to;
    start = at;
  }
  const bounce = legs[legs.length - 2][2];
  return [
    loop(`${p}-ball`, ball, tr(...hit)),
    loop(
      `${p}-arm`,
      [
        [0, rot(-90)],
        [7, rot(-158)],
        [26, rot(-55)],
        [bounce + 8, rot(-55)],
        [bounce + 24, rot(18)],
        [100, rot(-90)],
      ],
      rot(-90),
    ),
    loop(`${p}-hop`, [
      [0, tr(0, 0)],
      [bounce - 6, tr(0, 0)],
      [bounce - 2, tr(0, -3.5)],
      [bounce + 2, tr(0, 0)],
      [100, tr(0, 0)],
    ]),
    ...puffs.map(([at], i) =>
      loop(
        `${p}-puff-${i}`,
        [
          [0, "opacity: 0; transform: scale(0.3)"],
          [at, "opacity: 0; transform: scale(0.3)"],
          [at + 1, "opacity: 0.9; transform: scale(0.7)"],
          [at + 9, "opacity: 0; transform: scale(1.5)"],
          [100, "opacity: 0; transform: scale(1.5)"],
        ],
        POP_BASE,
      ),
    ),
    `.${p}-far { transform: rotate(35deg); }
     .${p}-leg-near { transform: rotate(14deg); }
     .${p}-leg-far { transform: rotate(-14deg); }`,
  ].join("\n");
}

function RallyCast({
  rally,
  x,
  racket,
  character,
  children,
}: {
  rally: Rally;
  x: number;
  racket: ReactNode;
  character?: MascotCharacter;
  children: ReactNode;
}): ReactElement {
  const { p, puffs } = rally;
  return (
    <>
      {children}
      <Player x={x} hop={`${p}-hop`}>
        <Hero character={character}
          face="happy"
          arm={`ctxa-loop ${p}-arm`}
          farArm={`${p}-far`}
          nearLeg={`${p}-leg-near`}
          farLeg={`${p}-leg-far`}
          tool={racket}
        />
      </Player>
      {puffs.map(([, [px, py]], i) => (
        <g key={i} transform={`translate(${px} ${py})`}>
          <circle className={`ctxa-loop ${p}-puff-${i}`} r="5" fill="none" stroke="var(--ctxa-white)" strokeWidth="1.6" />
        </g>
      ))}
      <g className={`ctxa-loop ctxa-linear ${p}-ball`} strokeWidth="1.1" {...INK}>
        <circle r="3.2" fill="var(--ctxa-lime)" />
        <path d="M-2.6 -1.6 q2.6 1.8 5.2 0" stroke="var(--ctxa-white)" strokeWidth="0.8" fill="none" />
      </g>
    </>
  );
}

/** A net running away from the viewer across the court, at cast x `x`. */
function CourtNet({ x }: { x: number }): ReactElement {
  return (
    <g transform={`translate(${x} 0)`} strokeWidth="1.6" {...INK}>
      <path d="M-4 -18 L4 8 V-6 L-4 -32 Z" fill="var(--ctxa-white)" fillOpacity="0.45" />
      <path d="M-4 -25 L4 1 M-1.5 -24 V-10 M1.5 -14.5 V-0.5" strokeWidth="0.7" fill="none" opacity="0.6" />
      <path d="M-4 -32 L4 -6" fill="none" stroke="var(--ctxa-white)" strokeWidth="2.4" />
      <path d="M-4 -18 V-33 M4 8 V-7" fill="none" strokeWidth="2.6" />
    </g>
  );
}

const LIME = `.ctxa { --ctxa-lime:#D9F03D; } .dark .ctxa { --ctxa-lime:#C6DC30; }`;

function tennis(character?: MascotCharacter): Scene {
  const X = -56;
  const NET_X = 14;
  const WALL_X = 76;
  const hit: Point = [X + 29, -27];
  const wall: Point = [WALL_X - 2, -32];
  const bounce: Point = [-12, -3.2];
  const rally: Rally = {
    p: "ten",
    hit,
    legs: [
      [wall, 12, 28],
      [bounce, 14, 62],
      [hit, 5, 100],
    ],
    puffs: [
      [28, wall],
      [62, [bounce[0], 0]],
    ],
  };

  return {
    tone: "clay",
    cycle: 3.6,
    styles: `${LIME}\n${rallyStyles(rally)}`,
    ground: (
      <g {...CHALK} opacity="0.85">
        <path d={`M34 114 H${sx(WALL_X)} M34 150 H${sx(WALL_X)} M34 114 V150`} />
        <path d={`M110 114 V150 M110 132 H${sx(NET_X)}`} />
      </g>
    ),
    cast: (
      <RallyCast
        character={character}
        rally={rally}
        x={X}
        racket={
          <g strokeWidth="1.4" {...INK}>
            <rect x="-2.1" y="-18" width="2.6" height="13" rx="1.3" fill="var(--ctxa-pants)" />
            <ellipse cx="-0.8" cy="2.5" rx="5.6" ry="7.6" fill="var(--ctxa-white)" fillOpacity="0.55" strokeWidth="3.6" />
            <ellipse cx="-0.8" cy="2.5" rx="5.6" ry="7.6" fill="none" stroke="var(--ctxa-shoe)" strokeWidth="1.6" />
            <path d="M-0.8 -4 v13 M-3.6 -3 v11 M2 -3 v11 M-5.6 2.5 h9.6 M-4.8 -1 h8 M-4.8 6 h8" strokeWidth="0.5" opacity="0.45" fill="none" />
          </g>
        }
      >
        <g strokeWidth="2" {...INK}>
          <Shadow rx={12} x={WALL_X + 6} />
          <rect x={WALL_X} y="-58" width="12" height="60" rx="2" fill="var(--ctxa-cap-2)" />
          <rect x={WALL_X} y="-58" width="3.5" height="60" fill="var(--ctxa-cap)" stroke="none" />
          <path d={`M${WALL_X} -15 h12`} stroke="var(--ctxa-white)" strokeWidth="2" />
          <rect x={WALL_X} y="-58" width="12" height="60" rx="2" fill="none" />
        </g>
        <CourtNet x={NET_X} />
      </RallyCast>
    ),
  };
}

function padel(character?: MascotCharacter): Scene {
  const X = -52;
  const NET_X = 20;
  const GLASS_X = 76;
  const hit: Point = [X + 27, -27];
  const floor: Point = [52, -3.2];
  const glass: Point = [GLASS_X - 2, -22];
  const bounce: Point = [-10, -3.2];
  const rally: Rally = {
    p: "pad",
    hit,
    legs: [
      [floor, 12, 26],
      [glass, 3, 38],
      [bounce, 16, 68],
      [hit, 5, 100],
    ],
    puffs: [
      [38, glass],
      [68, [bounce[0], 0]],
    ],
  };

  return {
    tone: "padel",
    cycle: 3.8,
    styles: `${LIME}\n${rallyStyles(rally)}`,
    ground: (
      <g {...CHALK} opacity="0.85">
        <path d={`M96 100 V160 M96 132 H${sx(NET_X)}`} />
        <path d={`M${sx(GLASS_X) - 44} 100 V160 M${sx(NET_X)} 132 H${sx(GLASS_X) - 44}`} />
      </g>
    ),
    cast: (
      <RallyCast
        character={character}
        rally={rally}
        x={X}
        racket={
          <g strokeWidth="1.4" {...INK}>
            <rect x="-2.1" y="-18" width="2.6" height="11" rx="1.3" fill="var(--ctxa-pants)" />
            <path d="M-0.8 -8 C-9 -6 -8 8 -0.8 8 C6.4 8 7.4 -6 -0.8 -8 Z" fill="var(--ctxa-scarf)" strokeWidth="1.6" />
            <g fill="var(--ctxa-ink)" stroke="none" opacity="0.7">
              <circle cx="-0.8" cy="-2" r="0.8" />
              <circle cx="-3.6" cy="1.5" r="0.8" />
              <circle cx="2" cy="1.5" r="0.8" />
              <circle cx="-0.8" cy="4.6" r="0.8" />
            </g>
          </g>
        }
      >
        <g strokeWidth="2" {...INK}>
          <Shadow rx={10} x={GLASS_X + 4} />
          <rect x={GLASS_X} y="-74" width="7" height="26" fill="var(--ctxa-steel)" fillOpacity="0.35" />
          <path
            d={`M${GLASS_X} -68 l7 4 M${GLASS_X} -60 l7 4 M${GLASS_X} -52 l7 4 M${GLASS_X + 7} -68 l-7 4 M${GLASS_X + 7} -60 l-7 4 M${GLASS_X + 7} -52 l-7 4`}
            strokeWidth="0.7"
            opacity="0.6"
            fill="none"
          />
          <rect x={GLASS_X} y="-48" width="7" height="49" fill="var(--ctxa-white)" fillOpacity="0.45" />
          <path d={`M${GLASS_X + 2} -40 l3 -4 M${GLASS_X + 2} -26 l3 -4`} stroke="var(--ctxa-white)" strokeWidth="1.2" fill="none" />
          <path d={`M${GLASS_X} 1 V-75 M${GLASS_X + 7} 1 V-75`} fill="none" strokeWidth="5" />
          <path
            d={`M${GLASS_X} 1 V-75 M${GLASS_X + 7} 1 V-75`}
            fill="none"
            stroke="var(--ctxa-steel)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        <CourtNet x={NET_X} />
      </RallyCast>
    ),
  };
}

// ---------- F1: a lap, the track scrolling under the car ----------

function f1(character?: MascotCharacter): Scene {
  const styles = `
    .f1-road { animation: f1-road 0.4s linear infinite; }
    @keyframes f1-road { to { transform: translateX(-32px); } }
    .f1-wheel { animation: f1-wheel 0.45s linear infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes f1-wheel { to { transform: rotate(360deg); } }
    .f1-bob { animation: f1-bob 0.32s steps(1) infinite; }
    @keyframes f1-bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-0.9px); } }
    .f1-puff { animation: f1-puff 0.9s ease-out infinite; opacity: 0; transform-box: fill-box; transform-origin: center; }
    @keyframes f1-puff {
      0% { opacity: 0.85; transform: translate(0px, 0px) scale(0.5); }
      100% { opacity: 0; transform: translate(-24px, -7px) scale(1.5); }
    }
    .f1-streak { animation: f1-streak 0.8s linear infinite; opacity: 0; }
    @keyframes f1-streak {
      0% { opacity: 0; transform: translateX(30px); }
      30% { opacity: 0.85; }
      100% { opacity: 0; transform: translateX(-46px); }
    }
    ${loop(
      "f1-flag",
      [
        [0, "opacity: 0; transform: translateX(330px)"],
        [10, "opacity: 1; transform: translateX(293px)"],
        [90, "opacity: 1; transform: translateX(-3px)"],
        [100, "opacity: 0; transform: translateX(-40px)"],
      ],
      "opacity: 0;",
    )}
  `;
  const tiles = Array.from({ length: 12 }, (_, i) => i * 32 - 16);

  return {
    tone: "asphalt",
    plain: true,
    cycle: 5,
    styles,
    ground: (
      <>
        <rect x="0" y="108" width="320" height="6" fill="var(--ctxa-white)" />
        <g className="f1-road">
          {tiles.map((x) => (
            <g key={x}>
              <rect x={x} y="108" width="16" height="6" fill="var(--ctxa-shoe)" />
              <rect x={x} y="146" width="18" height="3" rx="1.5" fill="var(--ctxa-white)" opacity="0.8" />
            </g>
          ))}
        </g>
      </>
    ),
    backdrop: (
      <g className="ctxa-loop ctxa-linear f1-flag">
        <g strokeWidth="1.6" {...INK}>
          <path d="M0 112 V66" fill="none" strokeWidth="2.6" />
          <g transform="translate(0 66)">
            <g className="ctxa-sway" style={{ transformOrigin: "0% 50%" }}>
              <rect x="0" y="0" width="24" height="16" fill="var(--ctxa-white)" />
              <path d="M0 0 h6 v4 h-6 z M12 0 h6 v4 h-6 z M6 4 h6 v4 h-6 z M18 4 h6 v4 h-6 z M0 8 h6 v4 h-6 z M12 8 h6 v4 h-6 z M6 12 h6 v4 h-6 z M18 12 h6 v4 h-6 z" fill="var(--ctxa-ink)" stroke="none" />
              <rect x="0" y="0" width="24" height="16" fill="none" />
            </g>
          </g>
        </g>
      </g>
    ),
    cast: (
      <>
        {(
          [
            [-44, -40, 0],
            [-56, -26, 0.3],
            [-40, -12, 0.55],
            [58, -34, 0.15],
          ] as const
        ).map(([x, y, delay]) => (
          <path
            key={delay}
            className="f1-streak"
            style={{ animationDelay: `${delay}s` }}
            d={`M${x} ${y} h18`}
            stroke="var(--ctxa-white)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ))}
        {[0, 0.3, 0.6].map((delay) => (
          <g key={delay} transform="translate(-44 -9)">
            <circle className="f1-puff" style={{ animationDelay: `${delay}s` }} r="4" fill="var(--ctxa-white)" stroke="var(--ctxa-steel-2)" strokeWidth="0.8" />
          </g>
        ))}
        <Shadow rx={46} x={2} y={1} />
        <g className="f1-bob" strokeWidth="2" {...INK}>
          <g transform="translate(-3 12) scale(0.85)">
            <HeroHead face="happy" character={character} />
          </g>
          <rect x="-43" y="-30" width="13" height="4.5" rx="1.5" fill="var(--ctxa-pants)" />
          <rect x="-40" y="-27" width="4.5" height="14" fill="var(--ctxa-pants)" />
          <path
            d="M-35 -4 L-35 -15 Q-31 -23 -19 -23 L-9 -23 L-7 -16.5 L7 -16.5 Q24 -14.5 44 -8 L47 -4 Z"
            fill="var(--ctxa-shoe)"
          />
          <path d="M-33 -10.5 H38" stroke="var(--ctxa-gold)" strokeWidth="2.4" fill="none" />
          <circle cx="-17" cy="-16" r="4.2" fill="var(--ctxa-white)" strokeWidth="1.2" />
          <rect x="40" y="-6" width="13" height="4" rx="1.5" fill="var(--ctxa-pants)" />
          {[-24, 27].map((x) => (
            <g key={x} transform={`translate(${x} -7.5)`}>
              <circle r="7.5" fill="var(--ctxa-ink)" />
              <g className="f1-wheel">
                <circle r="3.4" fill="var(--ctxa-steel)" strokeWidth="1" />
                <path d="M0 -6 V6 M-6 0 H6" stroke="var(--ctxa-steel-2)" strokeWidth="1.2" fill="none" />
              </g>
            </g>
          ))}
        </g>
      </>
    ),
  };
}

// ---------- surf: riding a wave ----------

function surf(character?: MascotCharacter): Scene {
  const styles = `
    .surf-ride { animation: surf-ride 2.6s ease-in-out infinite; transform-origin: 0px 0px; }
    @keyframes surf-ride {
      0%, 100% { transform: translate(0px, 0px) rotate(-5deg); }
      50% { transform: translate(0px, -3px) rotate(4deg); }
    }
    .surf-drift { animation: surf-drift 2.4s linear infinite; }
    @keyframes surf-drift { to { transform: translateX(-48px); } }
    .surf-wave { animation: surf-wave 2.6s ease-in-out infinite; }
    @keyframes surf-wave { 0%, 100% { transform: translate(0px, 0px); } 50% { transform: translate(3px, -3px); } }
    .surf-spray { animation: surf-spray 1.1s ease-out infinite; opacity: 0; }
    @keyframes surf-spray {
      0% { opacity: 0.95; transform: translate(0px, 0px) scale(0.6); }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.1); }
    }
    .surf-arm { transform: rotate(-78deg); }
    .surf-far { transform: rotate(70deg); }
    .surf-leg-near { transform: rotate(18deg); }
    .surf-leg-far { transform: rotate(-18deg); }
  `;
  const crests = Array.from({ length: 9 }, (_, i) => i * 48 - 24);

  return {
    tone: "sea",
    plain: true,
    cycle: 5,
    styles,
    ground: (
      <g className="surf-drift" stroke="var(--ctxa-white)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7">
        {crests.map((x) => (
          <path key={x} d={`M${x} 120 q5 -4 10 0 q5 4 10 0 M${x + 22} 136 q5 -4 10 0 q5 4 10 0 M${x + 6} 150 q5 -4 10 0 q5 4 10 0`} />
        ))}
      </g>
    ),
    backdrop: (
      <>
        <g strokeWidth="1.6" {...INK}>
          <circle cx="268" cy="34" r="13" fill="var(--ctxa-gold)" />
          <path d="M268 12 v-6 M268 62 v-6 M246 34 h-6 M296 34 h-6 M252 18 l-4 -4 M284 18 l4 -4" stroke="var(--ctxa-gold-2)" fill="none" strokeWidth="2" />
        </g>
        <g className="surf-wave" strokeWidth="2" {...INK}>
          <path
            d="M14 116 C30 74 74 44 122 50 C146 53 160 68 156 86 C150 74 136 70 124 76 C108 84 112 106 146 116 Z"
            fill="var(--ctxa-g3)"
          />
          <path d="M40 104 C52 82 78 66 108 66" fill="none" stroke="var(--ctxa-g)" strokeWidth="3" />
          <path d="M26 96 C44 62 82 44 122 50 C146 53 160 68 156 86" fill="none" stroke="var(--ctxa-white)" strokeWidth="4.5" />
          <circle cx="158" cy="92" r="3" fill="var(--ctxa-white)" strokeWidth="1.2" />
          <circle cx="150" cy="99" r="2.2" fill="var(--ctxa-white)" strokeWidth="1.2" />
        </g>
      </>
    ),
    cast: (
      <g transform="translate(14 -1)">
        <ellipse cx="0" cy="2" rx="36" ry="5" fill="var(--ctxa-white)" opacity="0.6" />
        {(
          [
            [-14, -16, 0],
            [-20, -8, 0.35],
            [-8, -20, 0.7],
          ] as const
        ).map(([dx, dy, delay]) => (
          <g key={delay} transform="translate(-30 -2)">
            <circle
              className="surf-spray"
              style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, animationDelay: `${delay}s` } as CSSProperties}
              r="2.6"
              fill="var(--ctxa-white)"
              stroke="var(--ctxa-ink)"
              strokeWidth="0.9"
            />
          </g>
        ))}
        <g className="surf-ride">
          <g strokeWidth="2" {...INK}>
            <path d="M-32 -3 Q0 -9 36 -4 Q38 -2 34 0 Q0 5 -32 -3 Z" fill="var(--ctxa-white)" />
            <path d="M-20 -3.6 Q4 -6.5 28 -3.6" fill="none" stroke="var(--ctxa-shoe)" strokeWidth="1.8" />
          </g>
          <g transform="translate(0 -5)">
            <Hero character={character} face="happy" arm="surf-arm" farArm="surf-far" nearLeg="surf-leg-near" farLeg="surf-leg-far" />
          </g>
        </g>
      </g>
    ),
  };
}

// ---------- LoL: a match at the desk ----------

function lol(character?: MascotCharacter): Scene {
  const X = -12;
  const styles = `
    .lol-arm { transform: rotate(-78deg); animation: lol-tap 0.26s steps(1) infinite; }
    .lol-far { transform: rotate(-66deg); animation: lol-tap-far 0.34s steps(1) infinite; }
    @keyframes lol-tap { 0%, 100% { transform: rotate(-78deg); } 50% { transform: rotate(-70deg); } }
    @keyframes lol-tap-far { 0%, 100% { transform: rotate(-66deg); } 50% { transform: rotate(-74deg); } }
    .lol-blip { animation: lol-blip 1.3s steps(1) infinite; }
    @keyframes lol-blip { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
    .lol-glow { animation: lol-glow 2.1s ease-in-out infinite; }
    @keyframes lol-glow { 0%, 100% { opacity: 0.22; } 50% { opacity: 0.4; } }
    ${loop("lol-win", popFrames(62, 26), POP_BASE)}
    ${loop("lol-nod", [
      [0, rot(0)],
      [62, rot(0)],
      [66, rot(-9)],
      [72, rot(0)],
      [78, rot(-7)],
      [84, rot(0)],
      [100, rot(0)],
    ])}
    ${loop("lol-hop", hopFrames(62, 5))}
  `;

  return {
    tone: "room",
    cycle: 6,
    styles,
    ground: <ellipse cx="170" cy="134" rx="104" ry="17" fill="var(--ctxa-g3)" opacity="0.45" />,
    cast: (
      <>
        <path d="M2 -62 L62 -52 L62 -6 L2 -6 Z" className="lol-glow" fill="#7CD6FF" opacity="0.3" />
        <g strokeWidth="2" {...INK}>
          <Shadow rx={32} x={32} />
          <rect x="6" y="-20" width="4.5" height="20" fill="var(--ctxa-wood-2)" />
          <rect x="54" y="-20" width="4.5" height="20" fill="var(--ctxa-wood-2)" />
          <rect x="1" y="-24.5" width="62" height="5" rx="2" fill="var(--ctxa-wood)" />
        </g>
        <Player x={X} hop="lol-hop">
          <Hero character={character} face="happy" arm="lol-arm" farArm="lol-far" head="ctxa-loop lol-nod" />
          <g className="ctxa-head ctxa-loop lol-nod" strokeWidth="1.6" {...INK}>
            <path d="M-12 -47 C-13 -68 15 -68 13.5 -52" fill="none" strokeWidth="4.4" />
            <path d="M-12 -47 C-13 -68 15 -68 13.5 -52" fill="none" stroke="var(--ctxa-pants)" strokeWidth="2" />
            <ellipse cx="-9.5" cy="-45" rx="4.2" ry="5.4" fill="var(--ctxa-shoe)" />
            <path d="M-8 -40 Q-2 -32 8 -34" fill="none" strokeWidth="1.4" />
            <circle cx="8.6" cy="-34" r="1.6" fill="var(--ctxa-pants)" strokeWidth="1" />
          </g>
        </Player>
        <g strokeWidth="2" {...INK}>
          <rect x="6" y="-28" width="17" height="3.5" rx="1.2" fill="var(--ctxa-white)" strokeWidth="1.3" />
          <path d="M9 -26.2 h11" strokeWidth="0.9" opacity="0.5" fill="none" />
          <rect x="41" y="-30" width="4" height="6" fill="var(--ctxa-steel-2)" strokeWidth="1.4" />
          <rect x="35" y="-26" width="16" height="2.4" rx="1" fill="var(--ctxa-steel-2)" strokeWidth="1.4" />
          <path d="M28 -64 L56 -58 L56 -32 L28 -28 Z" fill="var(--ctxa-pants-2)" />
          <path d="M31 -60 L53 -55.4 L53 -34.5 L31 -31.6 Z" fill="#17233F" strokeWidth="1" />
          <path d="M33 -36 L51 -52" stroke="#3E5C99" strokeWidth="1.6" fill="none" />
          <g stroke="none">
            <circle className="lol-blip" cx="36" cy="-39.5" r="1.9" fill="#5BB8FF" />
            <circle className="lol-blip" style={{ animationDelay: "0.4s" }} cx="40.5" cy="-45" r="1.9" fill="#5BB8FF" />
            <circle className="lol-blip" style={{ animationDelay: "0.7s" }} cx="46" cy="-47" r="1.9" fill="#FF6B6B" />
            <circle className="lol-blip" style={{ animationDelay: "0.2s" }} cx="49" cy="-52" r="1.9" fill="#FF6B6B" />
            <rect x="33" y="-57" width="9" height="1.8" rx="0.9" fill="#58D68D" />
          </g>
        </g>
        <Pop name="lol-win" x={42} y={-76} size={1.1} />
        <Pop name="lol-win" x={56} y={-70} size={0.6} delay={0.15} />
        <Pop name="lol-win" x={29} y={-71} size={0.6} delay={0.25} />
      </>
    ),
  };
}

const SCENES: Record<SportId, (character?: MascotCharacter) => Scene> = { football, padel, f1, nba, tennis, nfl, mlb, nhl, surf, lol };

export function SportsScene({
  sport,
  character,
  className,
}: {
  sport: SportId;
  character?: MascotCharacter;
  className?: string;
}): ReactElement {
  const scene = SCENES[sport](character);
  return (
    <Stage styles={scene.styles} tone={scene.tone} plain={scene.plain} cycle={scene.cycle} ground={scene.ground} className={className}>
      {scene.backdrop}
      <Cast>{scene.cast}</Cast>
    </Stage>
  );
}
