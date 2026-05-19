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
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" transform="rotate(120 12 12)" />
      </svg>
    </span>
  );
}
