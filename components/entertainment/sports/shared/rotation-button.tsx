"use client";

import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

import type { AutoAdvance } from "./use-auto-advance";

/** Pauses or resumes a carousel that moves by itself; absent when it never does. */
export function RotationButton({
  rotation,
  what,
  className,
}: {
  rotation: AutoAdvance;
  /** "games", "news": the label reads "Pause games". */
  what: string;
  className?: string;
}): React.ReactElement | null {
  if (!rotation.available) return null;
  const Icon = rotation.playing ? Pause : Play;
  return (
    <button
      type="button"
      aria-label={`${rotation.playing ? "Pause" : "Play"} ${what}`}
      onClick={rotation.toggle}
      className={cn(
        "grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Icon aria-hidden className="size-3" fill="currentColor" />
    </button>
  );
}
