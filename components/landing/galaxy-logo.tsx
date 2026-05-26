import { cn } from "@/lib/utils";

type GalaxyLogoProps = {
  className?: string;
  /**
   * `theme` follows the app theme (background/foreground tokens).
   * `light` is white-bg friendly, `dark` is black-bg friendly. The landing uses the
   * explicit variants so it stays consistent regardless of the user's theme.
   */
  variant?: "theme" | "light" | "dark";
};

// Shooting-star mark. Mirrors the favicon at app/icon.svg so the brand reads
// the same in the browser tab and inside the product.
export function GalaxyLogo({
  className,
  variant = "theme",
}: GalaxyLogoProps): React.ReactElement {
  const variantClass =
    variant === "light"
      ? "bg-neutral-900 text-white"
      : variant === "dark"
      ? "bg-white text-neutral-900"
      : "bg-foreground text-background";

  return (
    <span
      className={cn(
        "grid size-8 place-items-center rounded-md",
        variantClass,
        className
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-4" fill="none">
        {/* Trailing streak */}
        <g stroke="currentColor" strokeLinecap="round">
          <line x1="6" y1="26" x2="10" y2="22" strokeWidth="1.6" opacity="0.35" />
          <line x1="9" y1="23" x2="14" y2="18" strokeWidth="1.9" opacity="0.6" />
          <line x1="13" y1="19" x2="18" y2="14" strokeWidth="2.2" opacity="0.9" />
        </g>
        {/* Star head */}
        <path
          fill="currentColor"
          d="M22 5 L23.2 10 L28 11.2 L23.2 12.4 L22 17 L20.8 12.4 L16 11.2 L20.8 10 Z"
        />
      </svg>
    </span>
  );
}
