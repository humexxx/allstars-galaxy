import { cn } from "@/lib/utils";

type GalaxyLogoProps = {
  className?: string;
};

export function GalaxyLogo({ className }: GalaxyLogoProps): React.ReactElement {
  return (
    <span
      className={cn(
        "grid size-8 place-items-center rounded-md bg-foreground text-background",
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
