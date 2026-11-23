/**
 * The parts every mascot scene is built from: the keyframe timeline helpers,
 * the ground a figure stands on and the stage that frames a scene. The hero
 * itself — whichever character the reader picked — is in `characters.tsx`.
 *
 * The look is a handheld-era overworld: a chibi figure two heads tall drawn in
 * sprite squares, on scenery drawn smooth — one dark outline around colours
 * shaded in two flat steps, conifers in scalloped tiers, and a block of
 * textured ground seen from above. No gradients and no filters, so nothing
 * needs an id but the ground's clip and its texture pattern.
 *
 * A shade is painted over its shape and the outline drawn again on top, so the
 * shade never has to be clipped to the outline it sits inside.
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
    --ctxa-skin:#FFD9B8; --ctxa-skin-2:#F0B48C; --ctxa-blush:#FF7A90;
    --ctxa-hair:#7A4A2B; --ctxa-hair-2:#5A331C;
    --ctxa-cap:#22B8A6; --ctxa-cap-2:#15877B; --ctxa-cap-0:#6FE0CF;
    --ctxa-hat:#465070; --ctxa-hat-2:#333B56; --ctxa-hat-0:#6C78A0;
    --ctxa-jacket:#5B6CF0; --ctxa-jacket-2:#4350C4; --ctxa-jacket-0:#8E9BFF;
    --ctxa-scarf:#FFC53D; --ctxa-scarf-2:#E59A12;
    --ctxa-pants:#3F4566; --ctxa-pants-2:#2F3450;
    --ctxa-shoe:#F0554D; --ctxa-shoe-2:#C43D36;
    --ctxa-pack:#F59E42; --ctxa-pack-2:#D67C22;
    --ctxa-leaf:#3F9E55; --ctxa-leaf-2:#2A7646; --ctxa-leaf-0:#7CCB68;
    --ctxa-gold:#FFC83D; --ctxa-gold-2:#E59A12; --ctxa-gold-0:#FFF1B8;
    --ctxa-wood:#C98545; --ctxa-wood-2:#9A5F2C;
    --ctxa-steel:#C9CDD8; --ctxa-steel-2:#8B90A3;
    --ctxa-white:#FFFFFF;
    --ctxa-dirt:#D9BC8C;
    --ctxa-shadow-a:0.2;
    --ctxa-lit:100%;
    --ctxa-cycle:10s;
  }
  .dark .ctxa {
    --ctxa-ink:#14131F;
    --ctxa-skin:#F3C9A6; --ctxa-skin-2:#D9A680;
    --ctxa-hair:#5F381F; --ctxa-hair-2:#452611;
    --ctxa-cap:#1FA394; --ctxa-cap-2:#127267; --ctxa-cap-0:#4CC7B6;
    --ctxa-hat:#5A6688; --ctxa-hat-2:#434D6B; --ctxa-hat-0:#7E8BB3;
    --ctxa-jacket:#5261DB; --ctxa-jacket-2:#3A46AE; --ctxa-jacket-0:#7886F0;
    --ctxa-scarf:#EDB32F; --ctxa-scarf-2:#C48A14;
    --ctxa-shoe-2:#B3362F; --ctxa-pack-2:#C2701E;
    --ctxa-leaf:#2F7C47; --ctxa-leaf-2:#1F5B36; --ctxa-leaf-0:#52A45C;
    --ctxa-pants:#353A58; --ctxa-pants-2:#272B43;
    --ctxa-wood:#B0733A; --ctxa-wood-2:#7F4D22;
    --ctxa-steel:#AEB3C2; --ctxa-steel-2:#70758A;
    --ctxa-white:#E9EAF2;
    --ctxa-dirt:#7A6A4E;
    --ctxa-shadow-a:0.4;
    --ctxa-lit:88%;
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

type Texture = "blades" | "stripes" | "pebbles" | "planks" | "tiles";

/** What each ground is strewn with. A court or a road is one flat colour. */
const TEXTURES: Partial<Record<Tone, Texture>> = {
  grass: "blades",
  turf: "stripes",
  cave: "pebbles",
  wood: "planks",
  room: "tiles",
};

const BLADES = "M0 0 l1.7 -4 l1.3 2.6 l1.5 -3.6 l1.4 5 z";

function texture(kind: Texture): ReactElement {
  switch (kind) {
    case "blades":
      return (
        <>
          <path d={BLADES} transform="translate(4 12)" fill="var(--ctxa-g3)" opacity="0.5" />
          <path d={BLADES} transform="translate(20 28)" fill="var(--ctxa-g3)" opacity="0.5" />
          <circle cx="13" cy="24" r="1.1" fill="var(--ctxa-white)" opacity="0.3" />
          <circle cx="27" cy="7" r="1.1" fill="var(--ctxa-white)" opacity="0.3" />
        </>
      );
    case "stripes":
      return <rect width="16" height="32" fill="var(--ctxa-g2)" />;
    case "pebbles":
      return (
        <>
          <ellipse cx="8" cy="9" rx="4" ry="2.2" fill="var(--ctxa-g2)" />
          <ellipse cx="23" cy="24" rx="3.2" ry="1.9" fill="var(--ctxa-g2)" />
          <circle cx="20" cy="7" r="1.1" fill="var(--ctxa-g3)" opacity="0.6" />
          <circle cx="6" cy="25" r="1.1" fill="var(--ctxa-g3)" opacity="0.6" />
        </>
      );
    case "planks":
      return <path d="M0 0.5 h32 M0 16.5 h32 M10 0.5 v16 M26 16.5 v16" stroke="var(--ctxa-g3)" strokeWidth="1" opacity="0.5" fill="none" />;
    case "tiles":
      return (
        <>
          <rect width="16" height="16" fill="var(--ctxa-g2)" />
          <rect x="16" y="16" width="16" height="16" fill="var(--ctxa-g2)" />
        </>
      );
  }
}

/**
 * The ground: a block seen from above, its top strewn with what grows or lies
 * there and its front falling away in two bands. `children` are painted on the
 * top and clipped to it (court lines, a path).
 */
function Slab({ tone, plain, children }: { tone: Tone; plain: boolean; children?: ReactNode }): ReactElement {
  const kind = plain ? undefined : TEXTURES[tone];
  return (
    <g>
      <defs>
        <clipPath id="ctxa-slab-clip">
          <rect x="6" y="108" width="308" height="48" rx="12" />
        </clipPath>
        {kind && (
          <pattern id={`ctxa-ground-${kind}`} width="32" height="32" patternUnits="userSpaceOnUse" x="6" y="108">
            {texture(kind)}
          </pattern>
        )}
      </defs>
      <rect x="6" y="108" width="308" height="58" rx="12" fill="var(--ctxa-gs)" {...OUTLINE} />
      <rect x="6" y="108" width="308" height="58" rx="12" fill="var(--ctxa-ink)" opacity="0.22" />
      <rect x="6" y="108" width="308" height="53" rx="12" fill="var(--ctxa-gs)" />
      <g clipPath="url(#ctxa-slab-clip)">
        <rect x="6" y="108" width="308" height="48" fill="var(--ctxa-g)" />
        {kind && <rect x="6" y="108" width="308" height="48" fill={`url(#ctxa-ground-${kind})`} />}
        {/* The lip: the top's own thickness, seen along the front and the sides. */}
        <rect x="6" y="98" width="308" height="58" rx="12" fill="none" stroke="var(--ctxa-g3)" strokeWidth="7" />
        {children}
      </g>
      <rect x="6" y="108" width="308" height="48" rx="12" fill="none" {...OUTLINE} />
    </g>
  );
}

/** A clump of tall grass: three broad blades, the middle one lit. */
export function Tuft({ x, y }: { x: number; y: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`} stroke="var(--ctxa-ink)" strokeWidth="1.2" strokeLinejoin="round">
      <path
        d="M0 0 C-0.5 -3.5 -2 -5.5 -3.5 -7 C-0.5 -7 1.5 -5.5 2.5 -3 C3 -6.5 4.2 -9 5.5 -11 C7 -8.5 7.6 -5.5 7.5 -3 C8.5 -5 10 -6.5 12.5 -7 C11 -5 10.5 -2.5 10.5 0 Z"
        fill="var(--ctxa-g3)"
      />
      <path d="M5.3 -1.2 C4.8 -4 5 -6.4 5.6 -8.4" fill="none" stroke="var(--ctxa-g)" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
}

export function Flower({ x, y, color, delay = 0 }: { x: number; y: number; color: string; delay?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="ctxa-sway" style={{ animationDelay: `${delay}s` }} stroke="var(--ctxa-ink)" strokeWidth="1.1" strokeLinejoin="round">
        <path d="M0 0 v-7" stroke="var(--ctxa-g3)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M0 -1.5 q-4.2 -0.4 -4.8 -3.6 q3.6 -0.2 4.8 3.6 q1.2 -3.8 4.8 -3.6 q-0.6 3.2 -4.8 3.6 z" fill="var(--ctxa-g3)" strokeWidth="0.9" />
        <circle cx="-2.7" cy="-9.6" r="2.3" fill={color} />
        <circle cx="2.7" cy="-9.6" r="2.3" fill={color} />
        <circle cx="0" cy="-12.3" r="2.3" fill={color} />
        <circle cx="0" cy="-7.2" r="2.3" fill={color} />
        <circle cx="0" cy="-9.7" r="1.6" fill="var(--ctxa-white)" />
      </g>
    </g>
  );
}

const n = (v: number): number => Number(v.toFixed(2));

/** One tier of a conifer: a cone with a scalloped hem, its shaded side and its lit patch. */
function tier(top: number, base: number, half: number, scallops: number): { body: string; shade: string; light: string } {
  const w = (half * 2) / scallops;
  const h = base - top;
  const hem = (dir: 1 | -1, count: number): string =>
    Array.from({ length: count }, () => `q${n((dir * w) / 2)} ${n(w * 0.5)} ${n(dir * w)} 0`).join(" ");
  const flank = (side: 1 | -1): string =>
    `C${n(side * half * 0.3)} ${n(top + h * 0.42)} ${n(side * half * 0.74)} ${n(top + h * 0.72)} ${n(side * half)} ${base}`;
  const shaded = Math.floor(scallops / 2);
  const px = half - shaded * w;
  return {
    body: `M0 ${top} ${flank(-1)} ${hem(1, scallops)} C${n(half * 0.74)} ${n(top + h * 0.72)} ${n(half * 0.3)} ${n(top + h * 0.42)} 0 ${top} Z`,
    shade: `M0 ${top} ${flank(1)} ${hem(-1, shaded)} C${n(px + 1.5)} ${n(top + h * 0.7)} ${n(px * 0.4 + 2)} ${n(top + h * 0.4)} 0 ${top} Z`,
    light: `M${n(-half * 0.16)} ${n(top + h * 0.3)} C${n(-half * 0.38)} ${n(top + h * 0.5)} ${n(-half * 0.6)} ${n(top + h * 0.7)} ${n(-half * 0.72)} ${n(base - 2)} q${n(w * 0.3)} ${n(w * 0.3)} ${n(w * 0.6)} 0 C${n(-half * 0.3)} ${n(top + h * 0.72)} ${n(-half * 0.16)} ${n(top + h * 0.52)} ${n(-half * 0.16)} ${n(top + h * 0.3)} Z`,
  };
}

const TIERS = [tier(-36, -10, 16, 5), tier(-48, -23, 13, 4), tier(-59, -36, 9.5, 3)];

/** An overworld conifer: a short trunk under three scalloped tiers, lit from the left. */
export function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }): ReactElement {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} {...OUTLINE}>
      <ellipse cx="0" cy="0" rx="13" ry="3.6" fill="var(--ctxa-ink)" opacity="var(--ctxa-shadow-a)" stroke="none" />
      <rect x="-3.5" y="-12" width="7" height="12" rx="1.5" fill="var(--ctxa-wood-2)" />
      {TIERS.map(({ body, shade, light }) => (
        <g key={body}>
          <path d={body} fill="var(--ctxa-leaf)" />
          <path d={shade} fill="var(--ctxa-leaf-2)" stroke="none" />
          <path d={light} fill="var(--ctxa-leaf-0)" stroke="none" />
          <path d={body} fill="none" />
        </g>
      ))}
    </g>
  );
}

export const SPARK = "M0 -6 l1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z";

export { Hero, HeroHead, HeroPortrait, type HeroProps } from "./characters";
export type { HeroFace } from "./looks";

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
  /** A slab with nothing strewn on it: water, ice, asphalt. */
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
