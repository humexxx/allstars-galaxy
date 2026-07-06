/**
 * Decorative module mascot — a soft clay-style bean doing an activity themed
 * to the current module (finance → mining gold). Rendered after the page
 * content, purely presentational (aria-hidden) and toggleable from
 * /portal/settings via the `showContextAvatar` user preference.
 *
 * Pure SVG + CSS keyframes: no client JS, no 3D runtime. The "3D" look comes
 * from layered gradients, and animations pause under prefers-reduced-motion.
 */

export type ContextAvatarVariant = "finance";

type ContextAvatarProps = {
  variant?: ContextAvatarVariant;
  className?: string;
};

export function ContextAvatar({
  variant = "finance",
  className,
}: ContextAvatarProps) {
  if (variant !== "finance") return null;

  return (
    <div
      aria-hidden="true"
      className={`ctxa flex justify-center pt-4 pb-2 select-none ${className ?? ""}`}
    >
      <style>{`
        .ctxa svg { overflow: visible; }
        .ctxa-bean {
          transform-origin: 105px 140px;
          animation: ctxa-bob 1.8s ease-in-out infinite;
        }
        .ctxa-arm {
          transform-origin: 132px 78px;
          animation: ctxa-swing 1.8s ease-in-out infinite;
        }
        .ctxa-spark {
          opacity: 0;
          animation: ctxa-spark 1.8s ease-out infinite;
        }
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
        @media (prefers-reduced-motion: reduce) {
          .ctxa-bean, .ctxa-arm, .ctxa-spark { animation: none; }
          .ctxa-spark { opacity: 0; }
        }
      `}</style>
      <svg
        viewBox="0 0 260 170"
        className="h-28 w-auto opacity-90 sm:h-32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ctxa-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#EEF2F6" />
            <stop offset="100%" stopColor="#D9E0E8" />
          </linearGradient>
          <linearGradient id="ctxa-limb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F4F7FA" />
            <stop offset="100%" stopColor="#D3DBE4" />
          </linearGradient>
          <linearGradient id="ctxa-rock" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#B7C2CE" />
            <stop offset="100%" stopColor="#8595A7" />
          </linearGradient>
          <linearGradient id="ctxa-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* ground shadows */}
        <ellipse cx="105" cy="150" rx="40" ry="8" fill="#0F172A" opacity="0.1" />
        <ellipse cx="178" cy="148" rx="30" ry="6" fill="#0F172A" opacity="0.1" />

        {/* gold rock */}
        <path
          d="M156 145 Q152 122 168 114 Q186 105 198 118 Q206 128 202 140 Q199 146 190 146 Z"
          fill="url(#ctxa-rock)"
        />
        <path
          d="M162 126 Q170 116 182 116 Q174 122 170 132 Z"
          fill="#CBD5E1"
          opacity="0.6"
        />
        <circle cx="178" cy="128" r="4.5" fill="url(#ctxa-gold)" />
        <circle cx="167" cy="137" r="3" fill="#FBBF24" />
        <circle cx="188" cy="138" r="2.5" fill="#FCD34D" />

        {/* impact sparks */}
        <g>
          <path
            className="ctxa-spark"
            style={{ "--dx": "-8px", "--dy": "-14px" } as React.CSSProperties}
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
              } as React.CSSProperties
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
              } as React.CSSProperties
            }
            d="M171 100 l1.4 2.4 2.4 1.4 -2.4 1.4 -1.4 2.4 -1.4 -2.4 -2.4 -1.4 2.4 -1.4 Z"
            fill="#FCD34D"
          />
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
            fill="#C9D2DC"
            transform="rotate(14 69 78)"
          />

          {/* body capsule */}
          <rect x="75" y="36" width="60" height="104" rx="30" fill="url(#ctxa-body)" />
          {/* top-left sheen */}
          <ellipse cx="94" cy="52" rx="14" ry="9" fill="#FFFFFF" opacity="0.7" />

          {/* feet */}
          <ellipse cx="93" cy="141" rx="10" ry="6.5" fill="#DDE4EB" />
          <ellipse cx="117" cy="141" rx="10" ry="6.5" fill="#DDE4EB" />

          {/* face inset + eyes */}
          <rect x="86" y="50" width="38" height="36" rx="18" fill="#E7EDF3" />
          <rect x="96" y="60" width="6" height="13" rx="3" fill="#1F2937" />
          <rect x="108" y="60" width="6" height="13" rx="3" fill="#1F2937" />

          {/* swinging arm + pickaxe */}
          <g className="ctxa-arm">
            <rect x="125" y="70" width="13" height="38" rx="6.5" fill="url(#ctxa-limb)" />
            <g transform="translate(131.5 103) rotate(38)">
              {/* handle */}
              <rect x="-2.5" y="-46" width="5" height="50" rx="2.5" fill="#A97142" />
              <rect x="-2.5" y="-46" width="2" height="50" rx="1" fill="#C08A55" />
              {/* pick head */}
              <path
                d="M-24 -38 Q0 -58 24 -38 Q0 -47 -24 -38 Z"
                fill="#56657A"
              />
              <path d="M-24 -38 Q0 -55 24 -38 Q0 -50 -24 -38 Z" fill="#7C8DA3" />
            </g>
            {/* hand */}
            <circle cx="131.5" cy="104" r="6" fill="#EEF2F6" />
          </g>
        </g>
      </svg>
    </div>
  );
}
