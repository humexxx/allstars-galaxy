/**
 * The parts every mascot scene is built from: the keyframe timeline helpers,
 * the hero, the ground it stands on and the stage that frames a scene.
 *
 * The look is a handheld-era overworld drawn smooth: a chibi figure two heads
 * tall, one dark outline around flat colours, and a slab of tiled ground seen
 * from above. No gradients and no filters, so nothing needs an id but the
 * ground's clip and tile pattern.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";

export type Frame = [percent: number, css: string];
export type Point = [x: number, y: number];

export function keyframes(name: string, frames: Frame[]): string {
  const body = [...frames]
    .sort((a, b) => a[0] - b[0])
    .map(([p, css]) => `${Number(p.toFixed(2))}% { ${css} }`)
    .join(" ");
  return `@keyframes ${name} { ${body} }`;
}

/** A class that plays `frames` on the scene's clock, with `base` as the pose it holds when motion is off. */
export function loop(name: string, frames: Frame[], base = ""): string {
  return `.${name} { animation-name: ${name}; ${base} } ${keyframes(name, frames)}`;
}

export const tr = (x: number, y: number): string =>
  `transform: translate(${Number(x.toFixed(1))}px, ${Number(y.toFixed(1))}px)`;

export const rot = (deg: number): string => `transform: rotate(${deg}deg)`;

/**
 * A throw from `from` to `to` between two moments of the cycle, `apex` px above
 * the straight line at its middle. Sampled, because a transform cannot follow a
 * parabola by itself; the scene plays it with linear timing.
 */
export function arc(from: Point, to: Point, apex: number, start: number, end: number, samples = 6): Frame[] {
  return Array.from({ length: samples + 1 }, (_, k): Frame => {
    const t = k / samples;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t - 4 * apex * t * (1 - t);
    return [start + (end - start) * t, tr(x, y)];
  });
}

/** Leg swings for each stretch of the cycle the hero spends walking. */
export function stepFrames(walks: [number, number][], direction: 1 | -1, stepsPerWalk = 4): Frame[] {
  const frames: Frame[] = [[0, rot(0)]];
  for (const [a, b] of walks) {
    const step = (b - a) / stepsPerWalk;
    frames.push([a, rot(0)]);
    for (let k = 0; k < stepsPerWalk; k++) {
      frames.push([a + (k + 0.5) * step, rot((k % 2 === 0 ? 26 : -26) * direction)]);
    }
    frames.push([b, rot(0)]);
  }
  frames.push([100, rot(0)]);
  return frames;
}

export const BASE_STYLES = `
  .ctxa {
    --ctxa-ink:#2A2840;
    --ctxa-skin:#FFD9B8; --ctxa-blush:#FF7A90;
    --ctxa-hair:#7A4A2B;
    --ctxa-cap:#22B8A6; --ctxa-cap-2:#15877B;
    --ctxa-jacket:#5B6CF0; --ctxa-jacket-2:#4350C4;
    --ctxa-scarf:#FFC53D;
    --ctxa-pants:#3F4566; --ctxa-pants-2:#2F3450;
    --ctxa-shoe:#F0554D; --ctxa-pack:#F59E42;
    --ctxa-gold:#FFC83D; --ctxa-gold-2:#E59A12; --ctxa-gold-0:#FFF1B8;
    --ctxa-wood:#C98545; --ctxa-wood-2:#9A5F2C;
    --ctxa-steel:#C9CDD8; --ctxa-steel-2:#8B90A3;
    --ctxa-white:#FFFFFF;
    --ctxa-dirt:#D9BC8C;
    --ctxa-shadow-a:0.2;
    --ctxa-cycle:10s;
  }
  .dark .ctxa {
    --ctxa-ink:#14131F;
    --ctxa-skin:#F3C9A6; --ctxa-hair:#5F381F;
    --ctxa-cap:#1FA394; --ctxa-cap-2:#127267;
    --ctxa-jacket:#5261DB; --ctxa-jacket-2:#3A46AE;
    --ctxa-scarf:#EDB32F;
    --ctxa-pants:#353A58; --ctxa-pants-2:#272B43;
    --ctxa-wood:#B0733A; --ctxa-wood-2:#7F4D22;
    --ctxa-steel:#AEB3C2; --ctxa-steel-2:#70758A;
    --ctxa-white:#E9EAF2;
    --ctxa-dirt:#7A6A4E;
    --ctxa-shadow-a:0.4;
  }
  .ctxa-tone-grass   { --ctxa-g:#8ED36B; --ctxa-g2:#7FC85E; --ctxa-g3:#4E9F44; --ctxa-gs:#B88A5B; }
  .ctxa-tone-cave    { --ctxa-g:#C9B089; --ctxa-g2:#BFA57D; --ctxa-g3:#8E7651; --ctxa-gs:#8A6B48; }
  .ctxa-tone-turf    { --ctxa-g:#5FBF6B; --ctxa-g2:#53B360; --ctxa-g3:#3A8F48; --ctxa-gs:#2F7A3D; }
  .ctxa-tone-wood    { --ctxa-g:#F0C58A; --ctxa-g2:#E8B978; --ctxa-g3:#B98343; --ctxa-gs:#A8733A; }
  .ctxa-tone-clay    { --ctxa-g:#E3A268; --ctxa-g2:#DB9659; --ctxa-g3:#B06F35; --ctxa-gs:#9C5F2B; }
  .ctxa-tone-ice     { --ctxa-g:#E6F4FB; --ctxa-g2:#D8ECF7; --ctxa-g3:#9CC5DC; --ctxa-gs:#8FB7CE; }
  .ctxa-tone-hard    { --ctxa-g:#5C9BE0; --ctxa-g2:#5290D6; --ctxa-g3:#3468AC; --ctxa-gs:#2D5C99; }
  .ctxa-tone-padel   { --ctxa-g:#3F7FE0; --ctxa-g2:#3775D6; --ctxa-g3:#2552A8; --ctxa-gs:#1F4690; }
  .ctxa-tone-asphalt { --ctxa-g:#7C8296; --ctxa-g2:#747A8E; --ctxa-g3:#4F5468; --ctxa-gs:#474B5E; }
  .ctxa-tone-sea     { --ctxa-g:#57C4E8; --ctxa-g2:#49B8DE; --ctxa-g3:#2A8DBA; --ctxa-gs:#237AA3; }
  .ctxa-tone-room    { --ctxa-g:#B9A7E8; --ctxa-g2:#AE9BE0; --ctxa-g3:#7B66BD; --ctxa-gs:#6A56A8; }
  .dark .ctxa-tone-grass   { --ctxa-g:#3F8650; --ctxa-g2:#387A49; --ctxa-g3:#245C36; --ctxa-gs:#6B4E35; }
  .dark .ctxa-tone-cave    { --ctxa-g:#7D6B52; --ctxa-g2:#73624A; --ctxa-g3:#4F4230; --ctxa-gs:#4A3C2B; }
  .dark .ctxa-tone-turf    { --ctxa-g:#2F7D48; --ctxa-g2:#297241; --ctxa-g3:#1B552E; --ctxa-gs:#174A28; }
  .dark .ctxa-tone-wood    { --ctxa-g:#A9824F; --ctxa-g2:#9F7846; --ctxa-g3:#70502A; --ctxa-gs:#644624; }
  .dark .ctxa-tone-clay    { --ctxa-g:#A66F42; --ctxa-g2:#9C6539; --ctxa-g3:#70431F; --ctxa-gs:#613919; }
  .dark .ctxa-tone-ice     { --ctxa-g:#A9C7D8; --ctxa-g2:#9DBCCE; --ctxa-g3:#6690A8; --ctxa-gs:#5A8198; }
  .dark .ctxa-tone-hard    { --ctxa-g:#3A6CAE; --ctxa-g2:#3363A3; --ctxa-g3:#214579; --ctxa-gs:#1C3B68; }
  .dark .ctxa-tone-padel   { --ctxa-g:#2B5AAE; --ctxa-g2:#2552A2; --ctxa-g3:#183878; --ctxa-gs:#142F66; }
  .dark .ctxa-tone-asphalt { --ctxa-g:#4B5064; --ctxa-g2:#454A5D; --ctxa-g3:#2E3242; --ctxa-gs:#282B3A; }
  .dark .ctxa-tone-sea     { --ctxa-g:#2F86AE; --ctxa-g2:#297BA2; --ctxa-g3:#185878; --ctxa-gs:#134A66; }
  .dark .ctxa-tone-room    { --ctxa-g:#6A5AA6; --ctxa-g2:#61529A; --ctxa-g3:#41356F; --ctxa-gs:#372C60; }

  .ctxa svg { overflow: visible; }
  .ctxa-loop {
    animation-duration: var(--ctxa-cycle);
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
  }
  .ctxa-linear { animation-timing-function: linear; }
  .ctxa-arm { transform-origin: -0.8px -27px; }
  .ctxa-arm-far { transform-origin: 4.2px -27px; }
  .ctxa-leg-near { transform-origin: -3.5px -13px; }
  .ctxa-leg-far { transform-origin: 2.5px -13px; }
  .ctxa-head { transform-origin: 1px -33px; }

  /* Flowers and flags flick between two poses, the way overworld tiles do. */
  .ctxa-sway { animation: ctxa-sway 1.4s steps(1) infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  @keyframes ctxa-sway { 0%, 100% { transform: rotate(-9deg); } 50% { transform: rotate(9deg); } }
  .ctxa-scarf { animation: ctxa-scarf 0.9s steps(1) infinite; transform-origin: -8px -30px; }
  @keyframes ctxa-scarf { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-10deg); } }
  .ctxa-twinkle { animation: ctxa-twinkle 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes ctxa-twinkle { 0%, 70%, 100% { opacity: 0; transform: scale(0.4); } 80% { opacity: 1; transform: scale(1); } }
  @keyframes ctxa-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.02, 0.97); } }
  .ctxa-breathe { animation: ctxa-breathe 3.4s ease-in-out infinite; transform-origin: 0px 0px; }

  @media (prefers-reduced-motion: reduce) {
    .ctxa * { animation: none !important; }
  }
`;

export type Tone =
  | "grass"
  | "cave"
  | "turf"
  | "wood"
  | "clay"
  | "ice"
  | "hard"
  | "padel"
  | "asphalt"
  | "sea"
  | "room";

/** The feet line: where a figure standing on the slab touches it. */
export const GROUND_Y = 140;
/** The cast is drawn larger than the scenery, the way a sprite stands out on its map. */
export const CAST_SCALE = 1.6;

const OUTLINE = { stroke: "var(--ctxa-ink)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/**
 * The ground: a slab of 16px tiles seen from above, with a side face below it.
 * `children` are painted on its top and clipped to it (court lines, a path).
 */
function Slab({ tone, plain, children }: { tone: Tone; plain: boolean; children?: ReactNode }): ReactElement {
  return (
    <g>
      <defs>
        <clipPath id="ctxa-slab-clip">
          <rect x="6" y="108" width="308" height="48" rx="12" />
        </clipPath>
        <pattern id={`ctxa-tiles-${tone}`} width="32" height="32" patternUnits="userSpaceOnUse" x="6" y="108">
          <rect width="16" height="16" fill="var(--ctxa-g2)" />
          <rect x="16" y="16" width="16" height="16" fill="var(--ctxa-g2)" />
        </pattern>
      </defs>
      <rect x="6" y="108" width="308" height="56" rx="12" fill="var(--ctxa-gs)" {...OUTLINE} />
      <g clipPath="url(#ctxa-slab-clip)">
        <rect x="6" y="108" width="308" height="48" fill="var(--ctxa-g)" />
        {!plain && <rect x="6" y="108" width="308" height="48" fill={`url(#ctxa-tiles-${tone})`} />}
        {children}
      </g>
      <rect x="6" y="108" width="308" height="48" rx="12" fill="none" {...OUTLINE} />
    </g>
  );
}

export function Tuft({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M0 0 l1.5 -6 l2 3.5 l2 -7 l2 6 l2.5 -5 l1 8.5 z"
      fill="var(--ctxa-g3)"
      stroke="var(--ctxa-ink)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
}

export function Flower({ x, y, color, delay = 0 }: { x: number; y: number; color: string; delay?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="ctxa-sway" style={{ animationDelay: `${delay}s` }} stroke="var(--ctxa-ink)" strokeWidth="1.1">
        <path d="M0 0 v-7" stroke="var(--ctxa-g3)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="-2.7" cy="-9" r="2.3" fill={color} />
        <circle cx="2.7" cy="-9" r="2.3" fill={color} />
        <circle cx="0" cy="-11.7" r="2.3" fill={color} />
        <circle cx="0" cy="-6.6" r="2.3" fill={color} />
        <circle cx="0" cy="-9.1" r="1.6" fill="var(--ctxa-gold)" />
      </g>
    </g>
  );
}

/** A round overworld tree: trunk, two stacked crowns, a lit patch. */
export function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="ctxa-tone-grass" {...OUTLINE}>
      <rect x="-4" y="-12" width="8" height="12" rx="2" fill="var(--ctxa-wood-2)" />
      <path d="M-17 -16 a17 14 0 0 1 34 0 a17 9 0 0 1 -34 0 z" fill="var(--ctxa-g3)" />
      <path d="M-13 -28 a13 12 0 0 1 26 0 a13 8 0 0 1 -26 0 z" fill="var(--ctxa-g3)" />
      <path d="M-8 -33 a6 4 0 0 1 9 -3" fill="none" stroke="var(--ctxa-g)" strokeWidth="2.4" />
    </g>
  );
}

export const STAR = "M0 -3.8 L1.1 -1.2 L3.6 -1.2 L1.6 0.5 L2.3 3.1 L0 1.6 L-2.3 3.1 L-1.6 0.5 L-3.6 -1.2 L-1.1 -1.2 Z";
export const SPARK = "M0 -6 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z";

export type HeroFace = "calm" | "happy" | "tired";

/** The head alone, so a scene can seat it in a car. Centre (1, -46), facing right. */
export function HeroHead({ face = "calm" }: { face?: HeroFace }): ReactElement {
  return (
    <g {...OUTLINE}>
      <circle cx="1" cy="-46" r="14.5" fill="var(--ctxa-skin)" />
      <path
        d="M-7 -58 C-12 -55 -14.5 -50 -14.5 -45 C-14.5 -40 -13 -36 -11 -33.5 L-8.5 -38 L-5.5 -34.5 L-4.5 -40.5 L-1.5 -38.5 L-1.5 -45 L2 -49.5 L4 -45.5 L7 -50 L9.5 -47 L13 -53 L10 -59 Z"
        fill="var(--ctxa-hair)"
      />
      <ellipse cx="2.5" cy="-37.5" rx="2.6" ry="1.5" fill="var(--ctxa-blush)" opacity="0.55" stroke="none" />
      {face === "tired" ? (
        <>
          <path d="M4.6 -41.5 h3.8 M11 -41.5 h2.6" strokeWidth="1.8" fill="none" />
          <path d="M8 -36 h3.6" strokeWidth="1.5" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="6.5" cy="-42" rx="2" ry="3.2" fill="var(--ctxa-ink)" stroke="none" />
          <ellipse cx="12.3" cy="-42" rx="1.5" ry="3" fill="var(--ctxa-ink)" stroke="none" />
          <circle cx="7.1" cy="-43.4" r="0.9" fill="#FFFFFF" stroke="none" />
          <circle cx="12.7" cy="-43.4" r="0.7" fill="#FFFFFF" stroke="none" />
          {face === "happy" ? (
            <path d="M7.4 -37.2 q2.3 3.6 4.6 0 z" fill="#C0392B" strokeWidth="1.2" />
          ) : (
            <path d="M8 -36.6 q1.9 1.7 3.8 0" strokeWidth="1.5" fill="none" />
          )}
        </>
      )}
      <path d="M-13.5 -50 C-13.5 -62 -3 -64.5 3 -64 C11 -63.5 16 -58 16 -51.5 Q1 -55.5 -13.5 -50 Z" fill="var(--ctxa-cap)" />
      <path d="M11 -54 C17 -55 24 -53.5 25 -50.5 C21 -49.5 16 -50 12.5 -50.5 Z" fill="var(--ctxa-cap-2)" />
      <path d={STAR} transform="translate(1 -58.5)" fill="var(--ctxa-gold)" strokeWidth="1" />
    </g>
  );
}

type HeroProps = {
  face?: HeroFace;
  /** Painted in the near arm's space, so it swings with it. The hand is at (-0.8, -15). */
  tool?: ReactNode;
  /** Painted over the backpack, in the hero's space. */
  load?: ReactNode;
  /** Extra classes for the parts a scene animates. */
  arm?: string;
  farArm?: string;
  nearLeg?: string;
  farLeg?: string;
  head?: string;
};

/**
 * The hero, facing right, feet at (0, 0). A kid in a starred cap with a scarf
 * and a backpack — the app's own figure, in the proportions of a handheld
 * overworld sprite.
 */
export function Hero({ face = "calm", tool, load, arm = "", farArm = "", nearLeg = "", farLeg = "", head = "" }: HeroProps): ReactElement {
  return (
    <g {...OUTLINE}>
      <g className={`ctxa-arm-far ${farArm}`}>
        <rect x="1" y="-29" width="6.5" height="13" rx="3.2" fill="var(--ctxa-jacket-2)" />
        <circle cx="4.2" cy="-15" r="3.1" fill="var(--ctxa-skin)" />
      </g>
      <g className={`ctxa-leg-far ${farLeg}`}>
        <rect x="-1" y="-14" width="7" height="11" rx="3" fill="var(--ctxa-pants-2)" />
        <path d="M-2 -5 h7 a5 5 0 0 1 5 5 h-12 z" fill="var(--ctxa-shoe)" />
      </g>
      <rect x="-18" y="-31" width="11" height="16" rx="4" fill="var(--ctxa-pack)" />
      <path d="M-18 -22.5 h7" strokeWidth="1.4" fill="none" />
      {load}
      <g className={`ctxa-leg-near ${nearLeg}`}>
        <rect x="-7" y="-14" width="7" height="11" rx="3" fill="var(--ctxa-pants)" />
        <path d="M-8 -5 h7 a5 5 0 0 1 5 5 h-12 z" fill="var(--ctxa-shoe)" />
      </g>
      <rect x="-10" y="-31" width="19" height="19" rx="6" fill="var(--ctxa-jacket)" />
      <path d="M-9 -17 h17 M3 -29 v11" strokeWidth="1.3" opacity="0.45" fill="none" />
      <path className="ctxa-scarf" d="M-8 -30 q-9 0 -13 7 l5 2.5 q2 -4 8 -4.5 z" fill="var(--ctxa-scarf)" />
      <rect x="-9" y="-34" width="18" height="6" rx="3" fill="var(--ctxa-scarf)" />
      <g className={`ctxa-head ${head}`}>
        <HeroHead face={face} />
      </g>
      <g className={`ctxa-arm ${arm}`}>
        {tool}
        <rect x="-4" y="-29" width="6.5" height="13" rx="3.2" fill="var(--ctxa-jacket)" />
        <circle cx="-0.8" cy="-15" r="3.3" fill="var(--ctxa-skin)" />
      </g>
    </g>
  );
}

/** The soft patch a figure throws on the ground under it. */
export function Shadow({ rx = 14, x = 0, y = 0 }: { rx?: number; x?: number; y?: number }): ReactElement {
  return <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.28} fill="var(--ctxa-ink)" opacity="var(--ctxa-shadow-a)" />;
}

/**
 * The space the cast is drawn in: origin on the feet line at the middle of the
 * stage, y up being negative, one unit `CAST_SCALE` stage pixels. About 95
 * units reach either edge.
 */
export function Cast({ children }: { children: ReactNode }): ReactElement {
  return <g transform={`translate(160 ${GROUND_Y}) scale(${CAST_SCALE})`}>{children}</g>;
}

type StageProps = {
  styles: string;
  tone: Tone;
  /** Painted on the top of the slab and clipped to it: court lines, a path. */
  ground?: ReactNode;
  /** A slab without the tile checker: water, ice, asphalt. */
  plain?: boolean;
  mood?: string;
  /** Seconds one loop takes, when the scene does not retime it by mood. */
  cycle?: number;
  className?: string;
  children: ReactNode;
};

/** The frame every scene is drawn in: 320 by 170, the slab along the bottom. */
export function Stage({ styles, tone, ground, plain = false, mood, cycle, className, children }: StageProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      data-mood={mood}
      className={`ctxa flex justify-center pt-4 pb-2 select-none ${className ?? ""}`}
      style={cycle ? ({ "--ctxa-cycle": `${cycle}s` } as CSSProperties) : undefined}
    >
      <style>{BASE_STYLES + styles}</style>
      <svg viewBox="0 0 320 170" className={`h-36 w-auto sm:h-40 ctxa-tone-${tone}`} xmlns="http://www.w3.org/2000/svg">
        <Slab tone={tone} plain={plain}>
          {ground}
        </Slab>
        {children}
      </svg>
    </div>
  );
}
