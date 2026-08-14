/**
 * Decorative module mascot — a soft clay-style bean doing an activity themed
 * to the current module (finance → mining gold). Rendered after the page
 * content, purely presentational (aria-hidden) and toggleable from
 * /portal/settings via the `showContextAvatar` user preference.
 *
 * Pure SVG + CSS keyframes: no client JS, no 3D runtime. The "3D" look comes
 * from layered gradients, and animations pause under prefers-reduced-motion.
 *
 * The bean reads the user's main plan through the `mood` prop (see
 * `deriveFinanceMood`), so it is a glanceable signal rather than pure decor:
 *
 * | mood       | pose                                                        |
 * | ---------- | ----------------------------------------------------------- |
 * | `thriving` | fast swing, wide eyes, extra sparks, a richly veined nugget  |
 * | `steady`   | the baseline swing and a modest amount of gold              |
 * | `strained` | slow swing, heavy lids, a sweat bead, bare rock             |
 * | `idle`     | no plan yet — pickaxe shouldered, nothing to mine           |
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

export function ContextAvatar({
  variant = "finance",
  mood = "steady",
  className,
}: ContextAvatarProps) {
  if (variant !== "finance") return null;

  const isThriving = mood === "thriving";
  const isStrained = mood === "strained";
  const isIdle = mood === "idle";

  return (
    <div
      aria-hidden="true"
      data-mood={mood}
      className={`ctxa flex justify-center pt-4 pb-2 select-none ${className ?? ""}`}
    >
      <style>{`
        .ctxa {
          --ctxa-body-0:#FFFFFF; --ctxa-body-1:#EEF2F6; --ctxa-body-2:#D9E0E8;
          --ctxa-limb-0:#F4F7FA; --ctxa-limb-1:#D3DBE4;
          --ctxa-rock-0:#B7C2CE; --ctxa-rock-1:#8595A7; --ctxa-rock-face:#CBD5E1;
          --ctxa-face:#E7EDF3;   --ctxa-eye:#1F2937;
          --ctxa-feet:#DDE4EB;   --ctxa-far-arm:#C9D2DC;
          --ctxa-hand:#EEF2F6;   --ctxa-sheen:#FFFFFF; --ctxa-sheen-a:0.7;
          --ctxa-shadow:#0F172A; --ctxa-shadow-a:0.1;
          --ctxa-handle-0:#A97142; --ctxa-handle-1:#C08A55;
          --ctxa-pick-0:#56657A; --ctxa-pick-1:#7C8DA3;
          --ctxa-speed:1.8s;
        }
        .dark .ctxa {
          --ctxa-body-0:#5A6B80; --ctxa-body-1:#46566A; --ctxa-body-2:#333F4F;
          --ctxa-limb-0:#546578; --ctxa-limb-1:#3B4857;
          --ctxa-rock-0:#556273; --ctxa-rock-1:#3A4553; --ctxa-rock-face:#64748B;
          --ctxa-face:#64748B;   --ctxa-eye:#F1F5F9;
          --ctxa-feet:#4A5A6D;   --ctxa-far-arm:#455263;
          --ctxa-hand:#5A6B80;   --ctxa-sheen:#FFFFFF; --ctxa-sheen-a:0.16;
          --ctxa-shadow:#000000; --ctxa-shadow-a:0.4;
          --ctxa-handle-0:#8A5C36; --ctxa-handle-1:#A97142;
          --ctxa-pick-0:#41505F; --ctxa-pick-1:#69798F;
        }
        /* Mood only retimes the shared keyframes — no forked markup. */
        .ctxa[data-mood="thriving"] { --ctxa-speed:1.15s; }
        .ctxa[data-mood="strained"] { --ctxa-speed:2.9s; }

        .ctxa svg { overflow: visible; }
        .ctxa-bean {
          transform-origin: 105px 140px;
          animation: ctxa-bob var(--ctxa-speed) ease-in-out infinite;
        }
        .ctxa-arm {
          transform-origin: 132px 78px;
          animation: ctxa-swing var(--ctxa-speed) ease-in-out infinite;
        }
        .ctxa-spark {
          opacity: 0;
          animation: ctxa-spark var(--ctxa-speed) ease-out infinite;
        }
        /* Idle: pickaxe shouldered, nothing struck, so no swing and no sparks. */
        .ctxa[data-mood="idle"] .ctxa-arm { animation: none; transform: rotate(-30deg); }
        .ctxa[data-mood="idle"] .ctxa-spark { animation: none; opacity: 0; }
        .ctxa-sweat {
          animation: ctxa-sweat 2.9s ease-in infinite;
          transform-origin: 128px 62px;
        }
        .ctxa-glow { animation: ctxa-glow var(--ctxa-speed) ease-in-out infinite; }
        @keyframes ctxa-swing {
          0%   { transform: rotate(-6deg); }
          30%  { transform: rotate(-34deg); }
          44%  { transform: rotate(50deg); }
          58%  { transform: rotate(50deg); }
          100% { transform: rotate(-6deg); }
        }
        @keyframes ctxa-bob {
          0%, 100% { transform: rotate(0deg); }
          30%  { transform: rotate(-2deg); }
          46%  { transform: rotate(3deg); }
          60%  { transform: rotate(3deg); }
        }
        @keyframes ctxa-spark {
          0%, 43% { opacity: 0; transform: translate(0px, 0px) scale(0.4); }
          48%  { opacity: 1; transform: translate(var(--dx), var(--dy)) scale(1); }
          64%  { opacity: 0; transform: translate(calc(var(--dx) * 1.9), calc(var(--dy) * 1.9)) scale(0.4); }
          100% { opacity: 0; }
        }
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
        @media (prefers-reduced-motion: reduce) {
          .ctxa-bean, .ctxa-arm, .ctxa-spark, .ctxa-sweat, .ctxa-glow {
            animation: none;
          }
          .ctxa-spark, .ctxa-sweat { opacity: 0; }
          .ctxa-glow { opacity: 0.4; }
        }
      `}</style>
      <svg
        viewBox="0 0 260 170"
        className="h-28 w-auto opacity-90 sm:h-32"
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
          <linearGradient id="ctxa-rock" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ctxa-rock-0)" />
            <stop offset="100%" stopColor="var(--ctxa-rock-1)" />
          </linearGradient>
          <linearGradient id="ctxa-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <radialGradient id="ctxa-halo">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ground shadows */}
        <ellipse
          cx="105"
          cy="150"
          rx="40"
          ry="8"
          fill="var(--ctxa-shadow)"
          opacity="var(--ctxa-shadow-a)"
        />
        <ellipse
          cx="178"
          cy="148"
          rx="30"
          ry="6"
          fill="var(--ctxa-shadow)"
          opacity="var(--ctxa-shadow-a)"
        />

        {/* A thriving plan lights the seam up from behind the rock. */}
        {isThriving && (
          <circle className="ctxa-glow" cx="178" cy="130" r="30" fill="url(#ctxa-halo)" />
        )}

        {/* gold rock */}
        <path
          d="M156 145 Q152 122 168 114 Q186 105 198 118 Q206 128 202 140 Q199 146 190 146 Z"
          fill="url(#ctxa-rock)"
        />
        <path
          d="M162 126 Q170 116 182 116 Q174 122 170 132 Z"
          fill="var(--ctxa-rock-face)"
          opacity="0.6"
        />

        {/* Ore in the rock scales with the plan: bare before there's a plan at
            all or when the projection ends underwater, a rich seam when it
            clears its debt and grows. */}
        {!isStrained && !isIdle && (
          <>
            <circle cx="178" cy="128" r="4.5" fill="url(#ctxa-gold)" />
            <circle cx="167" cy="137" r="3" fill="#FBBF24" />
            <circle cx="188" cy="138" r="2.5" fill="#FCD34D" />
          </>
        )}
        {isThriving && (
          <>
            <circle cx="172" cy="120" r="2.6" fill="#FDE68A" />
            <circle cx="193" cy="128" r="2.2" fill="#FBBF24" />
            <circle cx="182" cy="141" r="2" fill="#FDE68A" />
          </>
        )}

        {/* impact sparks */}
        <g>
          <path
            className="ctxa-spark"
            style={{ "--dx": "-8px", "--dy": "-14px" } as CSSProperties}
            d="M166 106 l2.4 4.2 4.2 2.4 -4.2 2.4 -2.4 4.2 -2.4 -4.2 -4.2 -2.4 4.2 -2.4 Z"
            fill="#FBBF24"
          />
          <path
            className="ctxa-spark"
            style={
              {
                "--dx": "10px",
                "--dy": "-10px",
                animationDelay: "0.05s",
              } as CSSProperties
            }
            d="M176 104 l1.8 3.1 3.1 1.8 -3.1 1.8 -1.8 3.1 -1.8 -3.1 -3.1 -1.8 3.1 -1.8 Z"
            fill="#F59E0B"
          />
          <path
            className="ctxa-spark"
            style={
              {
                "--dx": "2px",
                "--dy": "-18px",
                animationDelay: "0.02s",
              } as CSSProperties
            }
            d="M171 100 l1.4 2.4 2.4 1.4 -2.4 1.4 -1.4 2.4 -1.4 -2.4 -2.4 -1.4 2.4 -1.4 Z"
            fill="#FCD34D"
          />
          {isThriving && (
            <>
              <path
                className="ctxa-spark"
                style={
                  {
                    "--dx": "-16px",
                    "--dy": "-6px",
                    animationDelay: "0.08s",
                  } as CSSProperties
                }
                d="M161 110 l1.6 2.8 2.8 1.6 -2.8 1.6 -1.6 2.8 -1.6 -2.8 -2.8 -1.6 2.8 -1.6 Z"
                fill="#FDE68A"
              />
              <path
                className="ctxa-spark"
                style={
                  {
                    "--dx": "18px",
                    "--dy": "-4px",
                    animationDelay: "0.11s",
                  } as CSSProperties
                }
                d="M184 108 l1.5 2.6 2.6 1.5 -2.6 1.5 -1.5 2.6 -1.5 -2.6 -2.6 -1.5 2.6 -1.5 Z"
                fill="#FBBF24"
              />
            </>
          )}
        </g>

        {/* bean */}
        <g className="ctxa-bean">
          {/* far arm, resting behind the body */}
          <rect
            x="62"
            y="76"
            width="14"
            height="36"
            rx="7"
            fill="var(--ctxa-far-arm)"
            transform="rotate(14 69 78)"
          />

          {/* body capsule */}
          <rect x="75" y="36" width="60" height="104" rx="30" fill="url(#ctxa-body)" />
          {/* top-left sheen */}
          <ellipse
            cx="94"
            cy="52"
            rx="14"
            ry="9"
            fill="var(--ctxa-sheen)"
            opacity="var(--ctxa-sheen-a)"
          />

          {/* feet */}
          <ellipse cx="93" cy="141" rx="10" ry="6.5" fill="var(--ctxa-feet)" />
          <ellipse cx="117" cy="141" rx="10" ry="6.5" fill="var(--ctxa-feet)" />

          {/* face inset */}
          <rect x="86" y="50" width="38" height="36" rx="18" fill="var(--ctxa-face)" />

          {/* Eyes carry the mood: wide open when thriving, heavy-lidded when
              the projection is underwater, neutral otherwise. */}
          {isStrained ? (
            <>
              <rect x="95" y="64" width="8" height="4" rx="2" fill="var(--ctxa-eye)" />
              <rect x="107" y="64" width="8" height="4" rx="2" fill="var(--ctxa-eye)" />
            </>
          ) : isThriving ? (
            <>
              <circle cx="99" cy="66" r="4.5" fill="var(--ctxa-eye)" />
              <circle cx="111" cy="66" r="4.5" fill="var(--ctxa-eye)" />
              <circle cx="100.6" cy="64.2" r="1.5" fill="#FFFFFF" />
              <circle cx="112.6" cy="64.2" r="1.5" fill="#FFFFFF" />
            </>
          ) : (
            <>
              <rect x="96" y="60" width="6" height="13" rx="3" fill="var(--ctxa-eye)" />
              <rect x="108" y="60" width="6" height="13" rx="3" fill="var(--ctxa-eye)" />
            </>
          )}

          {/* A bead of sweat sells "this plan is under water". */}
          {isStrained && (
            <circle className="ctxa-sweat" cx="128" cy="62" r="3.2" fill="#7DD3FC" />
          )}

          {/* swinging arm + pickaxe */}
          <g className="ctxa-arm">
            <rect x="125" y="70" width="13" height="38" rx="6.5" fill="url(#ctxa-limb)" />
            <g transform="translate(131.5 103) rotate(38)">
              {/* handle */}
              <rect
                x="-2.5"
                y="-46"
                width="5"
                height="50"
                rx="2.5"
                fill="var(--ctxa-handle-0)"
              />
              <rect
                x="-2.5"
                y="-46"
                width="2"
                height="50"
                rx="1"
                fill="var(--ctxa-handle-1)"
              />
              {/* pick head */}
              <path d="M-24 -38 Q0 -58 24 -38 Q0 -47 -24 -38 Z" fill="var(--ctxa-pick-0)" />
              <path d="M-24 -38 Q0 -55 24 -38 Q0 -50 -24 -38 Z" fill="var(--ctxa-pick-1)" />
            </g>
            {/* hand */}
            <circle cx="131.5" cy="104" r="6" fill="var(--ctxa-hand)" />
          </g>
        </g>
      </svg>
    </div>
  );
}
