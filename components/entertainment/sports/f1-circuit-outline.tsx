import { F1_CIRCUIT_OUTLINES, F1_CIRCUIT_VIEWBOX } from "@/lib/data/sports/f1-circuits";
import { cn } from "@/lib/utils";

/**
 * A circuit's layout as one line in the text colour, so it follows the theme.
 *
 * Decorative: the card around it already names the circuit. A circuit with no
 * outline vendored draws nothing at all, not an empty box.
 */
export function F1CircuitOutline({
  circuitId,
  className,
}: {
  circuitId: string;
  className?: string;
}) {
  // `hasOwn`, or an id such as "constructor" would find Object's prototype.
  const d = Object.hasOwn(F1_CIRCUIT_OUTLINES, circuitId)
    ? F1_CIRCUIT_OUTLINES[circuitId]
    : undefined;
  if (!d) return null;

  return (
    <svg aria-hidden viewBox={F1_CIRCUIT_VIEWBOX} className={cn("shrink-0", className)}>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // The box is 1000 units across and drawn about 50px wide: a stroke
        // of 1.5 units would come out under a tenth of a pixel.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
