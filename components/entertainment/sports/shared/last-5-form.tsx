import { Check, Dot, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FormResult } from "@/types/sports";

type Last5FormProps = {
  /** Most-recent first; trailing entries may be "-" for unplayed. */
  results: FormResult[];
  className?: string;
};

const COLOR_MAP: Record<FormResult, string> = {
  W: "bg-success/90 text-success-foreground",
  L: "bg-destructive/90 text-destructive-foreground",
  D: "bg-warning/90 text-warning-foreground",
  "-": "bg-muted text-muted-foreground",
};

// A draw and an unplayed game used to share the Minus glyph, which left the
// colour as the only difference between them.
const ICON_MAP: Record<FormResult, typeof Check> = {
  W: Check,
  L: X,
  D: Minus,
  "-": Dot,
};

export function Last5Form({ results, className }: Last5FormProps) {
  return (
    // One image with one name: `aria-label` on role-less spans is ignored, so
    // the form was silent to screen readers.
    <div
      role="img"
      aria-label={`Form: ${results.map(resultLabel).join(", ")}`}
      className={cn("flex items-center gap-1", className)}
    >
      {results.map((result, index) => {
        const Icon = ICON_MAP[result];
        const isLast = index === results.length - 1;
        return (
          <span
            key={index}
            aria-hidden
            className={cn(
              "grid size-5 place-items-center rounded-full text-2xs font-bold ring-1 ring-foreground/5",
              COLOR_MAP[result],
              isLast && "ring-2 ring-foreground/20",
            )}
          >
            <Icon className="size-3" strokeWidth={3} />
          </span>
        );
      })}
    </div>
  );
}

function resultLabel(result: FormResult): string {
  switch (result) {
    case "W":
      return "Win";
    case "L":
      return "Loss";
    case "D":
      return "Draw";
    case "-":
    default:
      return "Not played";
  }
}
