/**
 * Travel: the hero stands at a crossroads with a suitcase, reading a map and
 * daydreaming about where to go next, then points the way and hops.
 */
import type { ReactElement } from "react";

import type { MascotCharacter } from "@/types/preferences";

import { Cast, Flower, Hero, loop, rot, Shadow, Stage, tr, Tree, Tuft, type Frame } from "./kit";

const INK = { stroke: "var(--ctxa-ink)", strokeLinejoin: "round", strokeLinecap: "round" } as const;

const HERO_X = -20;
const CASE_X = -52;
const SIGN_X = 58;

/** The stretch of the loop spent looking up from the map. */
const LOOK: [number, number] = [52, 72];

const ARM_MAP = -72;

/** The route's stops on the map, in the arm's space. */
const STOPS: [number, number][] = [
  [-5.5, -12],
  [1.5, -8],
  [-3, -3.5],
];

const DREAMS = 3;

function dreamFrames(i: number): Frame[] {
  const slot = 100 / DREAMS;
  const start = i * slot;
  const hidden = "opacity: 0; transform: scale(0.5)";
  const shown = "opacity: 1; transform: scale(1)";
  const frames: Frame[] = [];
  if (start > 0) frames.push([0, hidden], [start, hidden]);
  frames.push([start + 3, shown], [start + slot - 3, shown], [start + slot, hidden]);
  if (start + slot < 100) frames.push([100, hidden]);
  else frames.unshift([0, hidden]);
  return frames.sort((a, b) => a[0] - b[0]);
}

const STYLES = [
  loop(
    "trv-arm",
    [
      [0, rot(ARM_MAP)],
      [LOOK[0], rot(ARM_MAP)],
      [LOOK[0] + 4, rot(ARM_MAP + 14)],
      [LOOK[1], rot(ARM_MAP + 14)],
      [LOOK[1] + 5, rot(ARM_MAP)],
      [100, rot(ARM_MAP)],
    ],
    rot(ARM_MAP),
  ),
  loop(
    "trv-far",
    [
      [0, rot(-58)],
      [LOOK[0], rot(-58)],
      [LOOK[0] + 4, rot(-104)],
      [LOOK[0] + 8, rot(-96)],
      [LOOK[0] + 12, rot(-104)],
      [LOOK[1], rot(-104)],
      [LOOK[1] + 5, rot(-58)],
      [100, rot(-58)],
    ],
    rot(-58),
  ),
  loop(
    "trv-head",
    [
      [0, rot(5)],
      [18, rot(7)],
      [36, rot(5)],
      [LOOK[0], rot(5)],
      [LOOK[0] + 4, rot(-7)],
      [LOOK[1], rot(-7)],
      [LOOK[1] + 5, rot(5)],
      [100, rot(5)],
    ],
    rot(5),
  ),
  loop("trv-hop", [
    [0, tr(0, 0)],
    [LOOK[0] + 5, tr(0, 0)],
    [LOOK[0] + 8, tr(0, -6)],
    [LOOK[0] + 11, tr(0, 0)],
    [LOOK[0] + 14, tr(0, -4)],
    [LOOK[0] + 17, tr(0, 0)],
    [100, tr(0, 0)],
  ]),
  loop(
    "trv-pin",
    [
      [0, tr(...STOPS[0])],
      [12, tr(...STOPS[0])],
      [16, tr((STOPS[0][0] + STOPS[1][0]) / 2, STOPS[1][1] - 5)],
      [20, tr(...STOPS[1])],
      [32, tr(...STOPS[1])],
      [36, tr((STOPS[1][0] + STOPS[2][0]) / 2, STOPS[2][1] - 6)],
      [40, tr(...STOPS[2])],
      [88, tr(...STOPS[2])],
      [94, tr(...STOPS[0])],
      [100, tr(...STOPS[0])],
    ],
    tr(...STOPS[0]),
  ),
  loop("trv-case", [
    [0, tr(0, 0)],
    [LOOK[0] + 9, tr(0, 0)],
    [LOOK[0] + 12, tr(0, -3.5)],
    [LOOK[0] + 15, tr(0, 0)],
    [100, tr(0, 0)],
  ]),
  ...Array.from({ length: DREAMS }, (_, i) =>
    loop(
      `trv-dream-${i}`,
      dreamFrames(i),
      `transform-box: fill-box; transform-origin: center; opacity: ${i === 0 ? 1 : 0}; animation-duration: calc(var(--ctxa-cycle) * 0.75);`,
    ),
  ),
  `.trv-cloud { animation: trv-cloud 9s ease-in-out infinite; }
   @keyframes trv-cloud { 0%, 100% { transform: translateX(0px); } 50% { transform: translateX(10px); } }
   .trv-puff { animation: ctxa-breathe 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }`,
].join("\n");

function Cloud({ x, y, scale = 1, delay = 0 }: { x: number; y: number; scale?: number; delay?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        className="trv-cloud"
        style={{ animationDelay: `${delay}s` }}
        d="M0 0 a6.5 6.5 0 0 1 10 -5 a8.5 8.5 0 0 1 16 2 a5.5 5.5 0 0 1 0 10 h-24 a5 5 0 0 1 -2 -7 z"
        fill="var(--ctxa-white)"
        stroke="var(--ctxa-ink)"
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </g>
  );
}

function TravelMap(): ReactElement {
  return (
    <g strokeWidth="1.5" {...INK}>
      <path d="M-10.5 -17 L8.5 -17 L8.5 1 L-10.5 1 Z" fill="var(--ctxa-white)" />
      <path d="M-10.5 -8 q4 -5 8 -1 q3 3 2 9 h-10 z" fill="var(--ctxa-cap)" stroke="none" opacity="0.55" />
      <path d="M8.5 -17 v7 q-5 0 -6 -7 z" fill="#7CC4F5" stroke="none" opacity="0.7" />
      <path d="M-4.2 -17 V1 M2.2 -17 V1" strokeWidth="0.7" opacity="0.35" fill="none" />
      <path
        d={`M${STOPS[0][0]} ${STOPS[0][1]} L${STOPS[1][0]} ${STOPS[1][1]} L${STOPS[2][0]} ${STOPS[2][1]}`}
        fill="none"
        stroke="var(--ctxa-shoe)"
        strokeWidth="1.1"
        strokeDasharray="1.6 1.8"
      />
      <path d="M-10.5 -17 L8.5 -17 L8.5 1 L-10.5 1 Z" fill="none" />
      <g className="ctxa-loop trv-pin">
        <g transform="rotate(72)">
          <path d="M0 0 L-2.3 -4 a2.6 2.6 0 1 1 4.6 0 Z" fill="var(--ctxa-shoe)" strokeWidth="1" />
          <circle cx="0" cy="-5.2" r="0.9" fill="var(--ctxa-white)" stroke="none" />
        </g>
      </g>
    </g>
  );
}

function Suitcase(): ReactElement {
  return (
    <g strokeWidth="2" {...INK}>
      <path d="M-4 -24 V-33 H5 V-24" fill="none" strokeWidth="2.2" />
      <rect x="-9" y="-25" width="19" height="22" rx="4" fill="var(--ctxa-shoe)" />
      <path d="M-3.5 -25 V-3 M4.5 -25 V-3" strokeWidth="1.3" opacity="0.5" fill="none" />
      <rect x="-9" y="-17" width="19" height="4.5" fill="var(--ctxa-gold)" strokeWidth="1.3" />
      <circle cx="-5" cy="-1.6" r="2" fill="var(--ctxa-pants)" strokeWidth="1.2" />
      <circle cx="6" cy="-1.6" r="2" fill="var(--ctxa-pants)" strokeWidth="1.2" />
    </g>
  );
}

function Signpost(): ReactElement {
  return (
    <g strokeWidth="2" {...INK}>
      <rect x="-2.5" y="-58" width="5" height="58" rx="2" fill="var(--ctxa-wood-2)" />
      <path d="M-4 -54 H16 L23 -48 L16 -42 H-4 Z" fill="var(--ctxa-wood)" />
      <path d="M2 -48 H13" strokeWidth="1.5" opacity="0.5" fill="none" />
      <path d="M4 -38 H-15 L-22 -32 L-15 -26 H4 Z" fill="var(--ctxa-wood)" />
      <path d="M-12 -32 H-1" strokeWidth="1.5" opacity="0.5" fill="none" />
      <circle cx="0" cy="-48" r="1.3" fill="var(--ctxa-steel)" strokeWidth="0.8" />
      <circle cx="0" cy="-32" r="1.3" fill="var(--ctxa-steel)" strokeWidth="0.8" />
    </g>
  );
}

const DREAM_ICONS: ReactElement[] = [
  <g key="plane" strokeWidth="1.2">
    <path d="M-6.8 -1.4 L-8.4 -5.6 H-5.6 L-3.6 -1.6 Z" fill="var(--ctxa-cap)" />
    <path d="M-7.5 0.4 Q-7.5 -1.8 -4 -1.8 H4 Q8 -1.8 8 0.4 Q8 2.2 4 2.2 H-4 Q-7.5 2.2 -7.5 0.4 Z" fill="var(--ctxa-white)" />
    <path d="M-1 0.6 L-4.4 6 H-1.6 L3.4 0.6 Z" fill="var(--ctxa-cap)" />
    <path d="M3.6 -0.4 h2.4" strokeWidth="1" fill="none" />
  </g>,
  <g key="island" strokeWidth="1.2">
    <path d="M-8 6 Q0 0.5 8 6 Z" fill="var(--ctxa-gold)" />
    <path d="M-0.5 3.4 Q-1.6 -1 0.8 -4" fill="none" stroke="var(--ctxa-wood-2)" strokeWidth="2" />
    <path d="M0.8 -4 q-5 -3.4 -7.4 0.8 M0.8 -4 q5 -3.4 7.4 0.8 M0.8 -4 q-1.6 -4 -5.4 -3.6 M0.8 -4 q2 -4 5.6 -3" fill="none" stroke="#3FA65B" strokeWidth="2.2" />
  </g>,
  <g key="mountain" strokeWidth="1.2">
    <path d="M-8.5 5.5 L-2 -5.5 L2 1 L4.2 -2 L8.5 5.5 Z" fill="var(--ctxa-steel-2)" />
    <path d="M-2 -5.5 L-4.2 -1.8 L-2.2 -2.8 L-0.6 -1.4 L0.4 -1.6 Z" fill="var(--ctxa-white)" />
  </g>,
];

export function TravelScene({ character, className }: { character?: MascotCharacter; className?: string }): ReactElement {
  return (
    <Stage
      styles={STYLES}
      tone="grass"
      cycle={8}
      className={className}
      ground={
        <>
          <rect x="-10" y="128" width="340" height="18" fill="var(--ctxa-dirt)" />
          <rect x={160 + SIGN_X * 1.6 - 12} y="96" width="24" height="80" fill="var(--ctxa-dirt)" />
        </>
      }
    >
      <Cloud x={34} y={30} />
      <Cloud x={236} y={22} scale={0.8} delay={-4} />
      <Tree x={22} y={120} scale={0.75} />
      <Tree x={304} y={122} scale={0.7} />
      <Tuft x={92} y={123} />
      <Tuft x={206} y={158} />
      <Flower x={186} y={124} color="var(--ctxa-shoe)" />
      <Flower x={60} y={157} color="var(--ctxa-white)" delay={0.5} />
      <Flower x={284} y={156} color="var(--ctxa-scarf)" delay={0.9} />
      <Cast>
        <g transform={`translate(${SIGN_X} -3)`}>
          <Shadow rx={9} />
          <Signpost />
        </g>
        <g transform={`translate(${CASE_X} 0)`}>
          <Shadow rx={12} />
          <g className="ctxa-loop trv-case">
            <Suitcase />
          </g>
        </g>
        <g transform={`translate(${HERO_X} 0)`}>
          <Shadow />
          <g className="ctxa-loop trv-hop">
            <Hero character={character} face="happy" arm="ctxa-loop trv-arm" farArm="ctxa-loop trv-far" head="ctxa-loop trv-head" tool={<TravelMap />} />
            <g strokeWidth="1.4" {...INK}>
              <circle cx="17" cy="-65" r="1.5" fill="var(--ctxa-white)" />
              <circle cx="21.5" cy="-69.5" r="2.3" fill="var(--ctxa-white)" />
              <g className="trv-puff">
                <rect x="19" y="-92" width="31" height="20" rx="10" fill="var(--ctxa-white)" />
              </g>
              <g transform="translate(34.5 -82)">
                {DREAM_ICONS.map((icon, i) => (
                  <g key={i} className={`ctxa-loop trv-dream-${i}`}>
                    {icon}
                  </g>
                ))}
              </g>
            </g>
          </g>
        </g>
      </Cast>
    </Stage>
  );
}
