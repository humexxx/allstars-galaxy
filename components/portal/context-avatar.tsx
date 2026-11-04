/**
 * Decorative module mascot — a soft clay bean doing an activity themed to the
 * current module. Rendered after the page content, purely presentational
 * (aria-hidden) and toggleable from /portal/settings via the
 * `showContextAvatar` user preference.
 *
 * Finance: a pink bean hits a gold cube with a pickaxe. Each hit knocks loose a
 * nugget that lands on its head. After `HITS` of them it walks the load to the
 * chest, drops it in, and walks back — a villager's trip to the storehouse.
 *
 * Pure SVG + CSS keyframes: no client JS, no 3D runtime. The "3D" look comes
 * from layered gradients. Every moving part runs on one clock
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

import type { CSSProperties } from "react";

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
    --ctxa-body-0:#FFD6E7; --ctxa-body-1:#FF9FC8; --ctxa-body-2:#EC6CA6;
    --ctxa-limb-0:#FFB3D3; --ctxa-limb-1:#E4659E;
    --ctxa-face:#FFF5F9;   --ctxa-eye:#1F2937; --ctxa-cheek:#FF7AA8;
    --ctxa-feet:#DD5C95;   --ctxa-far-arm:#E06A9F; --ctxa-hand:#FFA8CC;
    --ctxa-sheen:#FFFFFF;  --ctxa-sheen-a:0.75;
    --ctxa-shadow:#0F172A; --ctxa-shadow-a:0.1;
    --ctxa-handle-0:#A97142; --ctxa-handle-1:#C08A55;
    --ctxa-pick-0:#56657A; --ctxa-pick-1:#7C8DA3;
    --ctxa-wood-0:#B9773A; --ctxa-wood-1:#8A5226; --ctxa-wood-dark:#4A2A10;
    --ctxa-band:#6B7280; --ctxa-trim:#E0A82E;
    --ctxa-cycle:10s;
  }
  .dark .ctxa {
    --ctxa-body-0:#F6A9CB; --ctxa-body-1:#DC76A6; --ctxa-body-2:#AE4C7D;
    --ctxa-limb-0:#E98DB7; --ctxa-limb-1:#B5548A;
    --ctxa-face:#FBE4EE;   --ctxa-eye:#1F2937; --ctxa-cheek:#E2639A;
    --ctxa-feet:#A4477A;   --ctxa-far-arm:#B0558A; --ctxa-hand:#E58AB3;
    --ctxa-sheen:#FFFFFF;  --ctxa-sheen-a:0.35;
    --ctxa-shadow:#000000; --ctxa-shadow-a:0.4;
    --ctxa-handle-0:#8A5C36; --ctxa-handle-1:#A97142;
    --ctxa-pick-0:#5B6B7F; --ctxa-pick-1:#8494AA;
    --ctxa-wood-0:#93592A; --ctxa-wood-1:#6B3D1B; --ctxa-wood-dark:#2E1A09;
    --ctxa-band:#4B5563; --ctxa-trim:#C99227;
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
    transform-origin: 128px 62px;
  }
  .ctxa-glow { animation: ctxa-glow 2.4s ease-in-out infinite; }
  @keyframes ctxa-sweat {
    0%, 55%  { opacity: 0; transform: translateY(0px) scale(0.6); }
    70%      { opacity: 0.9; transform: translateY(3px) scale(1); }
    92%      { opacity: 0; transform: translateY(14px) scale(0.8); }
    100%     { opacity: 0; }
  }
  @keyframes ctxa-glow {
    0%, 100% { opacity: 0.25; }
    50%      { opacity: 0.6; }
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

const NUGGET = "M-4 1.5 L-2.5 -3 L2 -3.6 L4.4 0 L2.4 3.4 L-2.6 3.6 Z";
const SPARK = "M0 -6 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z";

type Spark = { x: number; y: number; dx: number; dy: number; size: number; fill: string; delay?: number };
const SPARKS: Spark[] = [
  { x: 160, y: 104, dx: -8, dy: -14, size: 1, fill: "#FBBF24" },
  { x: 170, y: 100, dx: 10, dy: -10, size: 0.75, fill: "#F59E0B", delay: 0.05 },
  { x: 165, y: 96, dx: 2, dy: -18, size: 0.6, fill: "#FCD34D", delay: 0.02 },
];
const THRIVING_SPARKS: Spark[] = [
  { x: 156, y: 108, dx: -16, dy: -6, size: 0.65, fill: "#FDE68A", delay: 0.08 },
  { x: 176, y: 104, dx: 18, dy: -4, size: 0.6, fill: "#FBBF24", delay: 0.11 },
];

export function ContextAvatar({
  variant = "finance",
  mood = "steady",
  className,
}: ContextAvatarProps) {
  if (variant !== "finance") return null;

  const isThriving = mood === "thriving";
  const isStrained = mood === "strained";

  return (
    <div
      aria-hidden="true"
      data-mood={mood}
      className={`ctxa flex justify-center pt-4 pb-2 select-none ${className ?? ""}`}
    >
      <style>{STYLES}</style>
      <svg
        viewBox="0 0 320 170"
        className="h-32 w-auto opacity-90 sm:h-36"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ctxa-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ctxa-body-0)" />
            <stop offset="55%" stopColor="var(--ctxa-body-1)" />
            <stop offset="100%" stopColor="var(--ctxa-body-2)" />
          </linearGradient>
          <linearGradient id="ctxa-limb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ctxa-limb-0)" />
            <stop offset="100%" stopColor="var(--ctxa-limb-1)" />
          </linearGradient>
          <linearGradient id="ctxa-gold-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF3C7" />
            <stop offset="100%" stopColor="#FCD34D" />
          </linearGradient>
          <linearGradient id="ctxa-gold-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="ctxa-gold-right" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="ctxa-nugget" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient id="ctxa-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ctxa-wood-0)" />
            <stop offset="100%" stopColor="var(--ctxa-wood-1)" />
          </linearGradient>
          <radialGradient id="ctxa-halo">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
          </radialGradient>
          <g id="ctxa-nugget-shape" transform="scale(1.5)">
            <path d={NUGGET} fill="url(#ctxa-nugget)" stroke="#D97706" strokeWidth="0.8" />
            <path d="M-2 -1.8 L1.2 -2.2" stroke="#FFFBEB" strokeWidth="1" strokeLinecap="round" />
          </g>
        </defs>

        {/* ---------- the chest ---------- */}
        <ellipse cx="45" cy="150" rx="36" ry="6" fill="var(--ctxa-shadow)" opacity="var(--ctxa-shadow-a)" />
        <circle className="ctxa-loop ctxa-chest-glow" cx="45" cy="108" r="34" fill="url(#ctxa-halo)" />
        {/* Inside: dark wood and the hoard, hidden under the lid until it opens. */}
        <rect x="16" y="110" width="58" height="10" rx="2" fill="var(--ctxa-wood-dark)" />
        <path d="M20 116 Q30 106 40 112 Q48 104 58 111 Q66 107 70 116 Z" fill="url(#ctxa-nugget)" />
        <rect x="16" y="116" width="58" height="32" rx="4" fill="url(#ctxa-wood)" />
        <rect x="16" y="127" width="58" height="2" fill="var(--ctxa-wood-dark)" opacity="0.35" />
        <rect x="16" y="137" width="58" height="2" fill="var(--ctxa-wood-dark)" opacity="0.35" />
        <rect x="22" y="116" width="5" height="32" fill="var(--ctxa-band)" />
        <rect x="63" y="116" width="5" height="32" fill="var(--ctxa-band)" />
        <rect x="40" y="119" width="10" height="11" rx="2" fill="var(--ctxa-trim)" />
        <circle cx="45" cy="124" r="1.6" fill="var(--ctxa-wood-dark)" />
        {[
          { x: 40, dx: -10, delay: 0 },
          { x: 46, dx: 2, delay: 0.06 },
          { x: 51, dx: 12, delay: 0.12 },
        ].map((coin) => (
          <g
            key={coin.x}
            className="ctxa-loop ctxa-coin"
            style={{ "--dx": `${coin.dx}px`, animationDelay: `${coin.delay}s` } as CSSProperties}
          >
            <circle cx={coin.x} cy="110" r="3.6" fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" />
            <rect x={coin.x - 0.6} y="107.8" width="1.2" height="4.4" rx="0.6" fill="#D97706" />
          </g>
        ))}
        <g className="ctxa-loop ctxa-lid">
          <path d="M14 116 L14 108 Q14 100 22 100 L68 100 Q76 100 76 108 L76 116 Z" fill="url(#ctxa-wood)" />
          <path d="M18 104 Q20 102 24 102 L50 102" stroke="var(--ctxa-sheen)" strokeOpacity="0.35" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <rect x="22" y="100" width="5" height="16" fill="var(--ctxa-band)" />
          <rect x="63" y="100" width="5" height="16" fill="var(--ctxa-band)" />
          <rect x="14" y="113" width="62" height="3" fill="var(--ctxa-trim)" />
        </g>

        <g transform="translate(100 0)">
          {/* ---------- the gold cube ---------- */}
          <ellipse cx="180" cy="149" rx="32" ry="6" fill="var(--ctxa-shadow)" opacity="var(--ctxa-shadow-a)" />
          {isThriving && <circle className="ctxa-glow" cx="180" cy="118" r="38" fill="url(#ctxa-halo)" />}
          <g className="ctxa-loop ctxa-cube">
            <path d="M152 104 L180 116 L180 148 L152 136 Z" fill="url(#ctxa-gold-left)" />
            <path d="M180 116 L208 104 L208 136 L180 148 Z" fill="url(#ctxa-gold-right)" />
            <path d="M152 104 L180 92 L208 104 L180 116 Z" fill="url(#ctxa-gold-top)" />
            <path
              d="M152 104 L180 116 L208 104 M180 116 L180 148"
              stroke="#FFFBEB"
              strokeOpacity="0.7"
              strokeWidth="1"
              fill="none"
              strokeLinejoin="round"
            />
            {/* Chips where the pick has been at it. */}
            <path d="M158 108 L163 106 L162 112 Z" fill="#B45309" opacity="0.5" />
            <path d="M166 101 L170 100 L169 104 Z" fill="#B45309" opacity="0.4" />
            <path className="ctxa-twinkle" d={SPARK} transform="translate(194 112) scale(0.7)" fill="#FFFBEB" />
          </g>

          {/* impact sparks */}
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

          {/* ---------- the bean ---------- */}
          <g className="ctxa-loop ctxa-walk">
            <ellipse cx="105" cy="150" rx="34" ry="7" fill="var(--ctxa-shadow)" opacity="var(--ctxa-shadow-a)" />
            <g className="ctxa-loop ctxa-face">
              <g className="ctxa-loop ctxa-hop">
                <g className="ctxa-loop ctxa-bean">
                  {/* far arm, resting behind the body */}
                  <rect
                    x="62"
                    y="76"
                    width="14"
                    height="34"
                    rx="7"
                    fill="var(--ctxa-far-arm)"
                    transform="rotate(14 69 78)"
                  />

                  {/* feet */}
                  <ellipse cx="92" cy="142" rx="11" ry="6.5" fill="var(--ctxa-feet)" />
                  <ellipse cx="118" cy="142" rx="11" ry="6.5" fill="var(--ctxa-feet)" />

                  {/* body capsule */}
                  <rect x="74" y="34" width="62" height="106" rx="31" fill="url(#ctxa-body)" />
                  <ellipse
                    cx="92"
                    cy="50"
                    rx="13"
                    ry="8"
                    fill="var(--ctxa-sheen)"
                    opacity="var(--ctxa-sheen-a)"
                  />

                  {/* face visor */}
                  <ellipse cx="108" cy="70" rx="22" ry="19" fill="var(--ctxa-face)" />
                  <ellipse cx="94" cy="78" rx="4" ry="2.4" fill="var(--ctxa-cheek)" opacity="0.45" />
                  <ellipse cx="122" cy="78" rx="4" ry="2.4" fill="var(--ctxa-cheek)" opacity="0.45" />

                  {/* Eyes and mouth carry the mood: wide and grinning when
                      thriving, heavy-lidded and flat when underwater. */}
                  {isStrained ? (
                    <>
                      <rect x="97" y="66" width="8" height="4" rx="2" fill="var(--ctxa-eye)" />
                      <rect x="111" y="66" width="8" height="4" rx="2" fill="var(--ctxa-eye)" />
                      <path d="M103 80 L113 80" stroke="var(--ctxa-eye)" strokeWidth="1.8" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <ellipse cx="101" cy="67" rx={isThriving ? 4.4 : 3.6} ry={isThriving ? 5.4 : 5} fill="var(--ctxa-eye)" />
                      <ellipse cx="115" cy="67" rx={isThriving ? 4.4 : 3.6} ry={isThriving ? 5.4 : 5} fill="var(--ctxa-eye)" />
                      <circle cx="102.4" cy="64.8" r="1.5" fill="#FFFFFF" />
                      <circle cx="116.4" cy="64.8" r="1.5" fill="#FFFFFF" />
                      <path
                        d={isThriving ? "M101 77 Q108 85 115 77" : "M102.5 78 Q108 82 113.5 78"}
                        stroke="var(--ctxa-eye)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        fill={isThriving ? "var(--ctxa-eye)" : "none"}
                      />
                    </>
                  )}

                  {/* A bead of sweat sells "this plan is under water". */}
                  {isStrained && (
                    <circle className="ctxa-sweat" cx="130" cy="60" r="3.2" fill="#7DD3FC" />
                  )}

                  {/* The load on the head, a nugget per hit, tipped into the chest. */}
                  <g className="ctxa-loop ctxa-drop">
                    {SLOTS.map(([x, y], i) => (
                      <use
                        key={i}
                        href="#ctxa-nugget-shape"
                        x={x}
                        y={y}
                        className={`ctxa-loop ctxa-pile-nugget ctxa-load-${i}`}
                      />
                    ))}
                  </g>

                  {/* swinging arm + pickaxe */}
                  <g className="ctxa-loop ctxa-arm">
                    <rect x="125" y="70" width="13" height="38" rx="6.5" fill="url(#ctxa-limb)" />
                    <g transform="translate(131.5 103) rotate(38)">
                      <rect x="-2.5" y="-46" width="5" height="50" rx="2.5" fill="var(--ctxa-handle-0)" />
                      <rect x="-2.5" y="-46" width="2" height="50" rx="1" fill="var(--ctxa-handle-1)" />
                      <path d="M-24 -38 Q0 -58 24 -38 Q0 -47 -24 -38 Z" fill="var(--ctxa-pick-0)" />
                      <path d="M-24 -38 Q0 -55 24 -38 Q0 -50 -24 -38 Z" fill="var(--ctxa-pick-1)" />
                    </g>
                    <circle cx="131.5" cy="104" r="6" fill="var(--ctxa-hand)" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
