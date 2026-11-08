/**
 * Decorative module mascot — a soft clay bean doing an activity themed to the
 * current module. Rendered after the page content, purely presentational
 * (aria-hidden) and toggleable from /portal/settings via the
 * `showContextAvatar` user preference.
 *
 * Finance: a pink bean, lit and shaded to read as 3D, hits a gold cube with a pickaxe. Each hit knocks loose a
 * nugget that lands on its head. After `HITS` of them it walks the load to the
 * chest, drops it in, and walks back — a villager's trip to the storehouse.
 *
 * Pure SVG + CSS keyframes: no client JS, no 3D runtime. The 3D look is
 * painted: one light from the top left, so every object carries a lit side, a
 * core shadow, highlights and a soft contact shadow, and the gold throws a warm
 * bounce onto the bean. No filters, only gradients, so it stays cheap to animate. Every moving part runs on one clock
 * (`--ctxa-cycle`), and its keyframes are generated below from a single
 * timeline, so the strike, the sparks, the flying nugget and the chest never
 * drift apart. Animations stop under prefers-reduced-motion.
 *
 * The bean reads the user's main plan through the `mood` prop (see
 * `getFinanceMood`), so it is a glanceable signal rather than pure decor:
 *
 * | mood       | pose                                                        |
 * | ---------- | ----------------------------------------------------------- |
 * | `thriving` | brisk trips, wide eyes, a big grin, the cube glowing        |
 * | `steady`   | the baseline trip                                           |
 * | `strained` | slow trips, heavy lids, a flat mouth, a sweat bead          |
 * | `idle`     | no plan yet — pickaxe shouldered beside the cube, no trips  |
 *
 * Every colour is a CSS custom property so the whole figure re-tints under
 * `.dark` (next-themes sets a class, not a media query) instead of staying a
 * hardcoded light-mode SVG on a dark page.
 */

import type { CSSProperties, ReactElement } from "react";

import type { FinanceMood } from "@/types/finance";

export type ContextAvatarVariant = "finance";

type ContextAvatarProps = {
  variant?: ContextAvatarVariant;
  mood?: FinanceMood;
  className?: string;
};

// ---------- the timeline, in percent of one cycle ----------

const HITS = 4;
/** The moment each pickaxe strike lands. */
const STRIKES = Array.from({ length: HITS }, (_, i) => 7 + i * 10);
const WALK_OUT: [number, number] = [46, 60];
const WALK_BACK: [number, number] = [76, 90];
/** The load leaves the bean's head and lands in the chest. */
const DROP: [number, number] = [63, 68];

/** Bean-space x of the mining spot, and how far left the chest is from it. */
const CHEST_OFFSET = -88;

/** Where each nugget lands on the bean's head: a row of three, one on top. */
const SLOTS: [number, number][] = [
  [91, 34],
  [119, 34],
  [105, 30],
  [105, 21],
];
/** Where nuggets leave the cube, in the same space. */
const STRIKE_POINT: [number, number] = [164, 100];

type Frame = [percent: number, css: string];

function keyframes(name: string, frames: Frame[]): string {
  const body = [...frames]
    .sort((a, b) => a[0] - b[0])
    .map(([p, css]) => `${Number(p.toFixed(2))}% { ${css} }`)
    .join(" ");
  return `@keyframes ${name} { ${body} }`;
}

const tr = (x: number, y: number): string => `transform: translate(${x}px, ${y}px)`;

function swingFrames(): Frame[] {
  const rest = "transform: rotate(-6deg)";
  return [
    [0, rest],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 5, rest],
      [s - 2, "transform: rotate(-42deg)"],
      [s, "transform: rotate(52deg)"],
      [s + 1.5, "transform: rotate(46deg)"],
      [s + 4, rest],
    ]),
    [100, rest],
  ];
}

function bobFrames(): Frame[] {
  const still = "transform: rotate(0deg)";
  return [
    [0, still],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 5, still],
      [s - 2, "transform: rotate(-2.5deg)"],
      [s, "transform: rotate(3deg)"],
      [s + 1.5, "transform: rotate(3deg)"],
      [s + 4, still],
    ]),
    [100, still],
  ];
}

/** Little hops while walking, four to a leg of the trip. */
function hopFrames(): Frame[] {
  const ground = "transform: translateY(0px)";
  const frames: Frame[] = [[0, ground]];
  for (const [a, b] of [WALK_OUT, WALK_BACK]) {
    const step = (b - a) / 4;
    for (let k = 0; k < 4; k++) {
      frames.push([a + k * step, ground], [a + k * step + step / 2, "transform: translateY(-5px)"]);
    }
    frames.push([b, ground]);
  }
  // A happy bounce once the gold is in.
  frames.push([69, ground], [70.5, "transform: translateY(-7px)"], [72, ground]);
  frames.push([100, ground]);
  return frames;
}

function walkFrames(): Frame[] {
  const home = "transform: translateX(0px)";
  const chest = `transform: translateX(${CHEST_OFFSET}px)`;
  return [
    [0, home],
    [WALK_OUT[0], home],
    [WALK_OUT[1], chest],
    [WALK_BACK[0], chest],
    [WALK_BACK[1], home],
    [100, home],
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

function cubeFrames(): Frame[] {
  const still = "transform: translate(0px, 0px) scale(1, 1)";
  return [
    [0, still],
    ...STRIKES.flatMap((s): Frame[] => [
      [s - 0.2, still],
      [s + 0.6, "transform: translate(2px, 1px) scale(1.05, 0.93)"],
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

/** Nugget `i` arcs from the cube to its slot on the bean's head. */
function flightFrames(i: number): Frame[] {
  const s = STRIKES[i];
  const [sx, sy] = STRIKE_POINT;
  const [tx, ty] = SLOTS[i];
  const start = `opacity: 0; ${tr(sx, sy)}`;
  return [
    [0, start],
    [s, start],
    [s + 0.3, `opacity: 1; ${tr(sx, sy)}`],
    [s + 2, `opacity: 1; ${tr((sx + tx) / 2 + 6, Math.min(sy, ty) - 26)}`],
    [s + 3.8, `opacity: 1; ${tr(tx, ty)}`],
    [s + 4, `opacity: 0; ${tr(tx, ty)}`],
    [100, `opacity: 0; ${tr(tx, ty)}`],
  ];
}

/** Nugget `i` sits on the head from the moment it lands until the drop. */
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
 * The whole load tips off the head into the chest. The bean faces left by
 * then (mirrored), so the chest is at +x in its own space.
 */
function dropFrames(): Frame[] {
  const head = "transform: translate(0px, 0px) scale(1)";
  const inChest = "transform: translate(58px, 86px) scale(0.5)";
  return [
    [0, head],
    [DROP[0], head],
    [(DROP[0] + DROP[1]) / 2, "transform: translate(32px, -12px) scale(0.9)"],
    [DROP[1], inChest],
    [DROP[1] + 0.3, inChest],
    [DROP[1] + 0.5, head],
    [100, head],
  ];
}

function lidFrames(): Frame[] {
  const shut = "transform: rotate(0deg)";
  const open = "transform: rotate(-38deg)";
  return [
    [0, shut],
    [WALK_OUT[1], shut],
    [WALK_OUT[1] + 2.5, open],
    [72, open],
    [75, shut],
    [100, shut],
  ];
}

function coinFrames(): Frame[] {
  const hidden = "opacity: 0; transform: translate(0px, 0px)";
  return [
    [0, hidden],
    [DROP[1], hidden],
    [DROP[1] + 1, "opacity: 1; transform: translate(0px, 0px)"],
    [DROP[1] + 3.5, "opacity: 1; transform: translate(var(--dx), -18px)"],
    [DROP[1] + 6, "opacity: 0; transform: translate(calc(var(--dx) * 1.5), -4px)"],
    [100, hidden],
  ];
}

function chestGlowFrames(): Frame[] {
  return [
    [0, "opacity: 0"],
    [DROP[0], "opacity: 0"],
    [DROP[1] - 1, "opacity: 0.9"],
    [78, "opacity: 0"],
    [100, "opacity: 0"],
  ];
}

const KEYFRAMES = [
  keyframes("ctxa-swing", swingFrames()),
  keyframes("ctxa-bob", bobFrames()),
  keyframes("ctxa-hop", hopFrames()),
  keyframes("ctxa-walk", walkFrames()),
  keyframes("ctxa-face", faceFrames()),
  keyframes("ctxa-cube", cubeFrames()),
  keyframes("ctxa-spark", sparkFrames()),
  ...SLOTS.map((_, i) => keyframes(`ctxa-fly-${i}`, flightFrames(i))),
  ...SLOTS.map((_, i) => keyframes(`ctxa-load-${i}`, loadFrames(i))),
  keyframes("ctxa-drop", dropFrames()),
  keyframes("ctxa-lid", lidFrames()),
  keyframes("ctxa-coin", coinFrames()),
  keyframes("ctxa-chest-glow", chestGlowFrames()),
].join("\n");

const FLY_RULES = SLOTS.map(
  (_, i) => `.ctxa-fly-${i} { animation-name: ctxa-fly-${i}; } .ctxa-load-${i} { animation-name: ctxa-load-${i}; }`
).join("\n");

const STYLES = `
  .ctxa {
    --ctxa-body-0:#FFE8F1; --ctxa-body-1:#FFA3CB; --ctxa-body-2:#E8599A; --ctxa-body-3:#A8326B;
    --ctxa-core:#7A1D4C;   --ctxa-face-0:#FFFFFF; --ctxa-face-1:#F7D5E3;
    --ctxa-ink:#3A1A28;
    --ctxa-shadow:#1E1B2E; --ctxa-shadow-a:0.32;
    --ctxa-cycle:10s;
  }
  .dark .ctxa {
    --ctxa-body-0:#FBD3E4; --ctxa-body-1:#EC8AB7; --ctxa-body-2:#C94884; --ctxa-body-3:#7E2350;
    --ctxa-core:#4A0F2D;   --ctxa-face-0:#FDF2F7; --ctxa-face-1:#E7BCD0;
    --ctxa-shadow:#000000; --ctxa-shadow-a:0.6;
  }
  /* Mood only retimes the one clock — no forked markup. */
  .ctxa[data-mood="thriving"] { --ctxa-cycle:7.5s; }
  .ctxa[data-mood="strained"] { --ctxa-cycle:13s; }

  .ctxa svg { overflow: visible; }
  .ctxa-loop {
    animation-duration: var(--ctxa-cycle);
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
  }
  .ctxa-walk { animation-name: ctxa-walk; animation-timing-function: linear; }
  .ctxa-face { animation-name: ctxa-face; transform-origin: 105px 0px; }
  .ctxa-hop { animation-name: ctxa-hop; }
  .ctxa-bean { animation-name: ctxa-bob; transform-origin: 105px 140px; }
  .ctxa-arm { animation-name: ctxa-swing; transform-origin: 132px 78px; }
  .ctxa-cube { animation-name: ctxa-cube; transform-origin: 180px 148px; }
  .ctxa-spark { animation-name: ctxa-spark; animation-timing-function: ease-out; opacity: 0; }
  .ctxa-fly, .ctxa-pile-nugget { opacity: 0; }
  .ctxa-drop { animation-name: ctxa-drop; transform-origin: 105px 28px; }
  .ctxa-lid { animation-name: ctxa-lid; transform-origin: 14px 116px; }
  .ctxa-coin { animation-name: ctxa-coin; animation-timing-function: ease-out; opacity: 0; }
  .ctxa-chest-glow { animation-name: ctxa-chest-glow; opacity: 0; }
  ${FLY_RULES}
  ${KEYFRAMES}

  .ctxa-sweat {
    animation: ctxa-sweat 2.9s ease-in infinite;
    transform-origin: 130px 60px;
  }
  .ctxa-glow { animation: ctxa-glow 2.4s ease-in-out infinite; }
  @keyframes ctxa-sweat {
    0%, 55%  { opacity: 0; transform: translateY(0px) scale(0.6); }
    70%      { opacity: 0.9; transform: translateY(3px) scale(1); }
    92%      { opacity: 0; transform: translateY(14px) scale(0.8); }
    100%     { opacity: 0; }
  }
  @keyframes ctxa-glow {
    0%, 100% { opacity: 0.3; }
    50%      { opacity: 0.65; }
  }
  @keyframes ctxa-breathe {
    0%, 100% { transform: scale(1, 1); }
    50%      { transform: scale(1.02, 0.98); }
  }
  @keyframes ctxa-twinkle {
    0%, 70%, 100% { opacity: 0; transform: scale(0.4); }
    80%           { opacity: 1; transform: scale(1); }
  }
  .ctxa-twinkle {
    animation: ctxa-twinkle 3.2s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }

  /* Idle: no plan to mine for, so no trips — the bean rests by the cube. */
  .ctxa[data-mood="idle"] .ctxa-loop { animation: none; }
  .ctxa[data-mood="idle"] .ctxa-arm { transform: rotate(-30deg); }
  .ctxa[data-mood="idle"] .ctxa-bean { animation: ctxa-breathe 3.4s ease-in-out infinite; }

  @media (prefers-reduced-motion: reduce) {
    .ctxa * { animation: none !important; }
    .ctxa-sweat { opacity: 0; }
    .ctxa-glow { opacity: 0.4; }
  }
`;

const SPARK = "M0 -6 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z";

type Spark = { x: number; y: number; dx: number; dy: number; size: number; fill: string; delay?: number };
const SPARKS: Spark[] = [
  { x: 160, y: 104, dx: -8, dy: -14, size: 1, fill: "#FFE38A" },
  { x: 170, y: 100, dx: 10, dy: -10, size: 0.75, fill: "#FFF7D6", delay: 0.05 },
  { x: 165, y: 96, dx: 2, dy: -18, size: 0.6, fill: "#FCD34D", delay: 0.02 },
];
const THRIVING_SPARKS: Spark[] = [
  { x: 156, y: 108, dx: -16, dy: -6, size: 0.65, fill: "#FDE68A", delay: 0.08 },
  { x: 176, y: 104, dx: 18, dy: -4, size: 0.6, fill: "#FFF7D6", delay: 0.11 },
];

/** A soft-edged radial: `color` at `opacity` in the middle, nothing at the rim. */
function Soft({ id, color, opacity }: { id: string; color: string; opacity: number | string }): ReactElement {
  return (
    <radialGradient id={id}>
      <stop offset="0%" stopColor={color} stopOpacity={opacity} />
      <stop offset="100%" stopColor={color} stopOpacity="0" />
    </radialGradient>
  );
}

/** A soft shadow on the ground, darkest where the object touches it. */
function ContactShadow({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }): ReactElement {
  return (
    <>
      <ellipse cx={cx + 3} cy={cy} rx={rx} ry={ry} fill="url(#ctxa-shadow)" opacity="var(--ctxa-shadow-a)" />
      <ellipse cx={cx + 1} cy={cy - 1} rx={rx * 0.55} ry={ry * 0.45} fill="url(#ctxa-shadow)" opacity="var(--ctxa-shadow-a)" />
    </>
  );
}

/**
 * Light comes from the top left everywhere: lit faces and highlights on that
 * side, core shadows and darker faces on the other, and the gold throws a warm
 * bounce onto whatever faces it.
 */
function Defs(): ReactElement {
  return (
    <defs>
      {/* the bean */}
      <radialGradient id="ctxa-body" cx="34%" cy="24%" r="85%">
        <stop offset="0%" stopColor="var(--ctxa-body-0)" />
        <stop offset="30%" stopColor="var(--ctxa-body-1)" />
        <stop offset="72%" stopColor="var(--ctxa-body-2)" />
        <stop offset="100%" stopColor="var(--ctxa-body-3)" />
      </radialGradient>
      <Soft id="ctxa-core" color="var(--ctxa-core)" opacity="0.55" />
      <Soft id="ctxa-bounce" color="#FFC53D" opacity="0.6" />
      <Soft id="ctxa-white" color="#FFFFFF" opacity="0.95" />
      <Soft id="ctxa-cheek" color="#FF5C93" opacity="0.55" />
      <Soft id="ctxa-shadow" color="var(--ctxa-shadow)" opacity="1" />
      <Soft id="ctxa-halo" color="#FBBF24" opacity="0.85" />
      <Soft id="ctxa-pink-glow" color="#FF8FBF" opacity="0.4" />
      <linearGradient id="ctxa-limb" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--ctxa-body-1)" />
        <stop offset="35%" stopColor="var(--ctxa-body-0)" />
        <stop offset="75%" stopColor="var(--ctxa-body-2)" />
        <stop offset="100%" stopColor="var(--ctxa-body-3)" />
      </linearGradient>
      <linearGradient id="ctxa-limb-far" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--ctxa-body-2)" />
        <stop offset="40%" stopColor="var(--ctxa-body-1)" />
        <stop offset="100%" stopColor="var(--ctxa-body-3)" />
      </linearGradient>
      <radialGradient id="ctxa-sphere" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="var(--ctxa-body-0)" />
        <stop offset="45%" stopColor="var(--ctxa-body-1)" />
        <stop offset="100%" stopColor="var(--ctxa-body-3)" />
      </radialGradient>
      {/* In user space, so the eyelids painted with it match the visor behind them. */}
      <radialGradient id="ctxa-visor" gradientUnits="userSpaceOnUse" cx="103" cy="62" r="30">
        <stop offset="0%" stopColor="var(--ctxa-face-0)" />
        <stop offset="70%" stopColor="var(--ctxa-face-0)" />
        <stop offset="100%" stopColor="var(--ctxa-face-1)" />
      </radialGradient>
      <radialGradient id="ctxa-eye" cx="38%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#4B5368" />
        <stop offset="55%" stopColor="#151821" />
        <stop offset="100%" stopColor="#050608" />
      </radialGradient>
      <clipPath id="ctxa-body-clip">
        <rect x="74" y="34" width="62" height="106" rx="31" />
      </clipPath>
      <clipPath id="ctxa-visor-clip">
        <ellipse cx="110" cy="70" rx="22" ry="19" />
      </clipPath>

      {/* the pickaxe */}
      <linearGradient id="ctxa-handle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#7A4A22" />
        <stop offset="35%" stopColor="#D9A066" />
        <stop offset="100%" stopColor="#5C3416" />
      </linearGradient>
      <linearGradient id="ctxa-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F3F4F6" />
        <stop offset="45%" stopColor="#9CA3AF" />
        <stop offset="100%" stopColor="#374151" />
      </linearGradient>

      {/* gold */}
      <linearGradient id="ctxa-gold-top" gradientUnits="userSpaceOnUse" x1="158" y1="94" x2="204" y2="112">
        <stop offset="0%" stopColor="#FFF8D6" />
        <stop offset="40%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#F5B11E" />
      </linearGradient>
      <linearGradient id="ctxa-gold-left" gradientUnits="userSpaceOnUse" x1="152" y1="104" x2="180" y2="148">
        <stop offset="0%" stopColor="#FCD34D" />
        <stop offset="55%" stopColor="#F2A516" />
        <stop offset="100%" stopColor="#C26F08" />
      </linearGradient>
      <linearGradient id="ctxa-gold-right" gradientUnits="userSpaceOnUse" x1="180" y1="104" x2="208" y2="148">
        <stop offset="0%" stopColor="#D98A0B" />
        <stop offset="60%" stopColor="#A35A07" />
        <stop offset="100%" stopColor="#6E3A05" />
      </linearGradient>
      <linearGradient id="ctxa-gold-streak" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF3C4" stopOpacity="0" />
        <stop offset="50%" stopColor="#FFF3C4" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#FFF3C4" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="ctxa-coin" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#FFF8D6" />
        <stop offset="45%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#B86B06" />
      </radialGradient>
      <clipPath id="ctxa-cube-left">
        <path d="M152 104 L180 116 L180 148 L152 136 Z" />
      </clipPath>
      <clipPath id="ctxa-cube-right">
        <path d="M180 116 L208 104 L208 136 L180 148 Z" />
      </clipPath>
      {/* A nugget is cut, not round: three lit facets over a dark base. */}
      <g id="ctxa-nugget-shape" transform="scale(1.5)">
        <path d="M-4 1.5 L-2.5 -3 L2 -3.6 L4.4 0 L2.4 3.4 L-2.6 3.6 Z" fill="#B8690A" />
        <path d="M-4 1.5 L-2.5 -3 L2 -3.6 L0.6 0.4 Z" fill="#FFF0B3" />
        <path d="M2 -3.6 L4.4 0 L2.4 3.4 L0.6 0.4 Z" fill="#E8950F" />
        <path d="M-4 1.5 L0.6 0.4 L2.4 3.4 L-2.6 3.6 Z" fill="#FBBF24" />
        <circle cx="-1.5" cy="-1.6" r="0.75" fill="#FFFFFF" />
      </g>

      {/* the chest */}
      <linearGradient id="ctxa-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#B97436" />
        <stop offset="60%" stopColor="#8B5025" />
        <stop offset="100%" stopColor="#5E3216" />
      </linearGradient>
      <linearGradient id="ctxa-lid-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#D08A48" />
        <stop offset="45%" stopColor="#A2602C" />
        <stop offset="100%" stopColor="#6E3D1A" />
      </linearGradient>
      <linearGradient id="ctxa-side-light" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
        <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="ctxa-band" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#E5E7EB" />
        <stop offset="40%" stopColor="#9CA3AF" />
        <stop offset="100%" stopColor="#3F4651" />
      </linearGradient>
      <linearGradient id="ctxa-trim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFE9A3" />
        <stop offset="50%" stopColor="#E0A82E" />
        <stop offset="100%" stopColor="#8F5B0B" />
      </linearGradient>
      <radialGradient id="ctxa-rivet" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#F9FAFB" />
        <stop offset="100%" stopColor="#4B5563" />
      </radialGradient>
    </defs>
  );
}

function Chest(): ReactElement {
  const rivets = [120, 132, 144].flatMap((y) => [24.5, 65.5].map((x) => ({ x, y })));
  return (
    <g>
      <ContactShadow cx={45} cy={149} rx={40} ry={6} />
      <circle className="ctxa-loop ctxa-chest-glow" cx="45" cy="106" r="38" fill="url(#ctxa-halo)" />

      {/* Inside: dark wood and the hoard, hidden under the lid until it opens. */}
      <rect x="16" y="108" width="58" height="12" rx="2" fill="#2A160A" />
      <path d="M20 117 Q28 106 38 111 Q46 103 56 110 Q65 105 70 117 Z" fill="url(#ctxa-coin)" />
      {[
        [30, 111],
        [44, 108],
        [57, 110],
      ].map(([x, y]) => (
        <ellipse key={x} cx={x} cy={y} rx="3.4" ry="1.6" fill="url(#ctxa-coin)" stroke="#9A5A06" strokeWidth="0.5" />
      ))}

      {/* body: planks, side light, steel bands with rivets, a gold lock */}
      <rect x="16" y="116" width="58" height="32" rx="3" fill="url(#ctxa-wood)" />
      {[127, 138].map((y) => (
        <g key={y}>
          <rect x="16" y={y - 0.6} width="58" height="1.2" fill="#3B1F0C" opacity="0.6" />
          <rect x="16" y={y + 0.6} width="58" height="0.8" fill="#E0A066" opacity="0.35" />
        </g>
      ))}
      <path d="M30 121 Q40 120 50 122 M34 132 Q46 131 58 133 M28 143 Q38 142 46 144" stroke="#3B1F0C" strokeOpacity="0.25" strokeWidth="0.6" fill="none" />
      <rect x="16" y="116" width="58" height="32" rx="3" fill="url(#ctxa-side-light)" />
      <rect x="16" y="144" width="58" height="4" rx="2" fill="#000000" opacity="0.22" />
      <rect x="22" y="116" width="5" height="32" fill="url(#ctxa-band)" />
      <rect x="63" y="116" width="5" height="32" fill="url(#ctxa-band)" />
      {rivets.map(({ x, y }) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="url(#ctxa-rivet)" />
      ))}
      <path d="M39 118 h12 v9 q0 4 -6 5 q-6 -1 -6 -5 Z" fill="url(#ctxa-trim)" stroke="#7A4A08" strokeWidth="0.5" />
      <circle cx="45" cy="123" r="1.5" fill="#2A160A" />
      <rect x="44.4" y="123.5" width="1.2" height="3.2" rx="0.5" fill="#2A160A" />

      {[
        { x: 38, dx: -11, delay: 0 },
        { x: 45, dx: 2, delay: 0.06 },
        { x: 52, dx: 13, delay: 0.12 },
      ].map((coin) => (
        <g
          key={coin.x}
          className="ctxa-loop ctxa-coin"
          style={{ "--dx": `${coin.dx}px`, animationDelay: `${coin.delay}s` } as CSSProperties}
        >
          <ellipse cx={coin.x} cy="110" rx="3.8" ry="3.8" fill="url(#ctxa-coin)" stroke="#9A5A06" strokeWidth="0.6" />
          <ellipse cx={coin.x} cy="110" rx="2.3" ry="2.3" fill="none" stroke="#B8740A" strokeWidth="0.5" />
          <circle cx={coin.x - 1.3} cy="108.6" r="0.8" fill="#FFFFFF" opacity="0.9" />
        </g>
      ))}

      {/* the lid: a rounded top, lit along its crown */}
      <g className="ctxa-loop ctxa-lid">
        <path d="M14 116 L14 108 Q14 99 23 99 L67 99 Q76 99 76 108 L76 116 Z" fill="url(#ctxa-lid-wood)" />
        <path d="M14 116 L14 108 Q14 99 23 99 L67 99 Q76 99 76 108 L76 116 Z" fill="url(#ctxa-side-light)" />
        <path d="M17 104 Q19 101.5 24 101.5 L54 101.5" stroke="#FFE2BF" strokeOpacity="0.55" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <rect x="22" y="99" width="5" height="17" fill="url(#ctxa-band)" />
        <rect x="63" y="99" width="5" height="17" fill="url(#ctxa-band)" />
        <circle cx="24.5" cy="106" r="1.1" fill="url(#ctxa-rivet)" />
        <circle cx="65.5" cy="106" r="1.1" fill="url(#ctxa-rivet)" />
        <rect x="14" y="112.5" width="62" height="3.5" rx="1" fill="url(#ctxa-trim)" />
      </g>
    </g>
  );
}

function GoldCube({ glowing }: { glowing: boolean }): ReactElement {
  return (
    <g>
      <ContactShadow cx={182} cy={148} rx={34} ry={6.5} />
      {glowing && <circle className="ctxa-glow" cx="180" cy="116" r="42" fill="url(#ctxa-halo)" />}
      <g className="ctxa-loop ctxa-cube">
        <path d="M152 104 L180 116 L180 148 L152 136 Z" fill="url(#ctxa-gold-left)" />
        <path d="M180 116 L208 104 L208 136 L180 148 Z" fill="url(#ctxa-gold-right)" />
        <path d="M152 104 L180 92 L208 104 L180 116 Z" fill="url(#ctxa-gold-top)" />

        {/* Polished metal mirrors the room: a pink smear of the bean on the
            near face, a bright streak across the far one. */}
        <g clipPath="url(#ctxa-cube-left)">
          <ellipse cx="156" cy="124" rx="9" ry="20" fill="url(#ctxa-pink-glow)" />
          <rect x="150" y="104" width="10" height="46" fill="url(#ctxa-gold-streak)" transform="rotate(-24 166 126)" />
        </g>
        <g clipPath="url(#ctxa-cube-right)">
          <rect x="186" y="96" width="7" height="60" fill="url(#ctxa-gold-streak)" transform="rotate(20 190 126)" />
          <rect x="178" y="134" width="32" height="16" fill="#000000" opacity="0.18" />
        </g>

        {/* bevels: bright on the edges that face the light, dark on the silhouette */}
        <path d="M152 104 L180 116 L208 104" stroke="#FFF6CF" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        <path d="M180 116 L180 148" stroke="#FFE7A0" strokeOpacity="0.8" strokeWidth="1" />
        <path d="M152 104 L180 92 L208 104 L208 136 L180 148 L152 136 Z" stroke="#7A4206" strokeOpacity="0.45" strokeWidth="0.8" fill="none" strokeLinejoin="round" />

        {/* chips where the pick has been at it */}
        <path d="M158 107 L163.5 105.5 L162 111.5 Z" fill="#8F4E06" opacity="0.55" />
        <path d="M158.6 107.4 L163 106 L161 108 Z" fill="#FFF3C4" opacity="0.7" />
        <path d="M166 100.5 L170.5 99.6 L169 103.6 Z" fill="#8F4E06" opacity="0.45" />

        <ellipse cx="172" cy="99" rx="9" ry="3.4" fill="url(#ctxa-white)" opacity="0.7" transform="rotate(-22 172 99)" />
        <path className="ctxa-twinkle" d={SPARK} transform="translate(196 101) scale(0.75)" fill="#FFFFFF" />
      </g>
    </g>
  );
}

function Face({ mood }: { mood: FinanceMood }): ReactElement {
  const thriving = mood === "thriving";
  const strained = mood === "strained";
  const eye = { rx: thriving ? 4.3 : 3.8, ry: thriving ? 5.6 : 5.2 };
  return (
    <>
      <ellipse cx="110" cy="70" rx="22" ry="19" fill="url(#ctxa-visor)" />
      {/* The visor sits a little into the head: shade under its top rim. */}
      <g clipPath="url(#ctxa-visor-clip)">
        <ellipse cx="110" cy="50" rx="26" ry="9" fill="url(#ctxa-core)" opacity="0.5" />
        <ellipse cx="131" cy="74" rx="6" ry="18" fill="url(#ctxa-core)" opacity="0.35" />
      </g>
      <path d="M90 82 Q110 96 130 82" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.3" fill="none" strokeLinecap="round" />

      <ellipse cx="95" cy="79" rx="5" ry="3" fill="url(#ctxa-cheek)" />
      <ellipse cx="125" cy="79" rx="5" ry="3" fill="url(#ctxa-cheek)" />

      {[103, 117].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="68" rx={eye.rx} ry={eye.ry} fill="url(#ctxa-eye)" />
          <circle cx={cx - 1.4} cy="65.6" r="1.7" fill="#FFFFFF" />
          <circle cx={cx + 1.3} cy="70.6" r="0.8" fill="#FFFFFF" opacity="0.7" />
          {/* Heavy lids, painted with the visor itself. */}
          {strained && (
            <>
              <rect x={cx - 5} y="61" width="10" height="7" fill="url(#ctxa-visor)" />
              <path d={`M${cx - 4.6} 68 L${cx + 4.6} 68`} stroke="var(--ctxa-ink)" strokeWidth="1.3" strokeLinecap="round" />
            </>
          )}
        </g>
      ))}

      {strained ? (
        <path d="M104 81 Q110 79.5 116 81" stroke="var(--ctxa-ink)" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      ) : thriving ? (
        <>
          <path d="M102 77.5 Q110 87 118 77.5 Z" fill="var(--ctxa-ink)" />
          <path d="M105.5 82.4 Q110 80.6 114.5 82.4 Q110 85.4 105.5 82.4 Z" fill="#FF6F9F" />
        </>
      ) : (
        <path d="M104 78.5 Q110 83 116 78.5" stroke="var(--ctxa-ink)" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

function Pickaxe(): ReactElement {
  return (
    <g transform="translate(131.5 103) rotate(38)">
      <rect x="-2.6" y="-47" width="5.2" height="52" rx="2.6" fill="url(#ctxa-handle)" />
      <path d="M-0.8 -40 L-0.8 -30 M0.9 -20 L0.9 -8" stroke="#5C3416" strokeOpacity="0.5" strokeWidth="0.5" />
      <rect x="-3.6" y="-43" width="7.2" height="6" rx="1.2" fill="url(#ctxa-steel)" />
      <path d="M-25 -38 Q0 -59 25 -38 Q0 -48 -25 -38 Z" fill="url(#ctxa-steel)" stroke="#2D333D" strokeOpacity="0.55" strokeWidth="0.6" />
      <path d="M-20 -41.5 Q0 -55 20 -41.5" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Bean({ mood }: { mood: FinanceMood }): ReactElement {
  return (
    <>
      {/* far arm, behind the body and in its shade */}
      <rect x="62" y="76" width="14" height="34" rx="7" fill="url(#ctxa-limb-far)" transform="rotate(14 69 78)" />
      <circle cx="64.5" cy="110" r="6" fill="url(#ctxa-sphere)" opacity="0.85" />

      {/* feet */}
      {[92, 118].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="143" rx="11.5" ry="6.8" fill="url(#ctxa-sphere)" />
          <ellipse cx={cx - 3} cy="140" rx="4" ry="1.6" fill="url(#ctxa-white)" opacity="0.6" />
        </g>
      ))}

      {/* body, then the light on it: core shadow, gold bounce, contact shade, rim */}
      <rect x="74" y="34" width="62" height="106" rx="31" fill="url(#ctxa-body)" />
      <g clipPath="url(#ctxa-body-clip)">
        <ellipse cx="142" cy="96" rx="24" ry="62" fill="url(#ctxa-core)" />
        <ellipse cx="139" cy="112" rx="9" ry="30" fill="url(#ctxa-bounce)" />
        <ellipse cx="105" cy="146" rx="40" ry="16" fill="url(#ctxa-core)" />
        <ellipse cx="76" cy="96" rx="5" ry="36" fill="url(#ctxa-white)" opacity="0.35" />
      </g>
      <ellipse cx="90" cy="51" rx="15" ry="9" fill="url(#ctxa-white)" transform="rotate(-24 90 51)" />
      <ellipse cx="86" cy="48" rx="4" ry="2.4" fill="#FFFFFF" opacity="0.9" transform="rotate(-24 86 48)" />

      <Face mood={mood} />

      {/* A bead of sweat sells "this plan is under water". */}
      {mood === "strained" && (
        <g className="ctxa-sweat">
          <path d="M130 55 Q126.5 61 130 63.5 Q133.5 61 130 55 Z" fill="#7DD3FC" />
          <circle cx="129" cy="61" r="0.9" fill="#FFFFFF" />
        </g>
      )}

      {/* The load on the head, a nugget per hit, tipped into the chest. */}
      <g className="ctxa-loop ctxa-drop">
        {SLOTS.map(([x, y], i) => (
          <use key={i} href="#ctxa-nugget-shape" x={x} y={y} className={`ctxa-loop ctxa-pile-nugget ctxa-load-${i}`} />
        ))}
      </g>

      {/* swinging arm + pickaxe */}
      <g className="ctxa-loop ctxa-arm">
        <rect x="125" y="70" width="13" height="38" rx="6.5" fill="url(#ctxa-limb)" />
        <Pickaxe />
        <circle cx="131.5" cy="104" r="6.5" fill="url(#ctxa-sphere)" />
        <ellipse cx="129.5" cy="101.6" rx="2.2" ry="1.4" fill="#FFFFFF" opacity="0.7" />
      </g>
    </>
  );
}

export function ContextAvatar({
  variant = "finance",
  mood = "steady",
  className,
}: ContextAvatarProps): ReactElement | null {
  if (variant !== "finance") return null;

  const isThriving = mood === "thriving";

  return (
    <div
      aria-hidden="true"
      data-mood={mood}
      className={`ctxa flex justify-center pt-4 pb-2 select-none ${className ?? ""}`}
    >
      <style>{STYLES}</style>
      <svg viewBox="0 0 320 170" className="h-36 w-auto sm:h-40" xmlns="http://www.w3.org/2000/svg">
        <Defs />
        <Chest />

        <g transform="translate(100 0)">
          <GoldCube glowing={isThriving} />

          {[...SPARKS, ...(isThriving ? THRIVING_SPARKS : [])].map((spark) => (
            <g key={`${spark.x}-${spark.y}`} transform={`translate(${spark.x} ${spark.y}) scale(${spark.size})`}>
              <path
                className="ctxa-loop ctxa-spark"
                style={
                  {
                    "--dx": `${spark.dx / spark.size}px`,
                    "--dy": `${spark.dy / spark.size}px`,
                    animationDelay: `${spark.delay ?? 0}s`,
                  } as CSSProperties
                }
                d={SPARK}
                fill={spark.fill}
              />
            </g>
          ))}

          {/* nuggets in flight, cube → head */}
          {SLOTS.map((_, i) => (
            <use key={i} href="#ctxa-nugget-shape" className={`ctxa-loop ctxa-fly ctxa-fly-${i}`} />
          ))}

          <g className="ctxa-loop ctxa-walk">
            <ContactShadow cx={105} cy={149} rx={36} ry={7} />
            <g className="ctxa-loop ctxa-face">
              <g className="ctxa-loop ctxa-hop">
                <g className="ctxa-loop ctxa-bean">
                  <Bean mood={mood} />
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
