import { Badge } from "@/components/ui/badge";

type EventStatus = "completed" | "upcoming" | "live";

const VARIANT = {
  completed: "secondary",
  upcoming: "info",
  live: "success",
} as const satisfies Record<EventStatus, string>;

const LABEL: Record<EventStatus, string> = {
  completed: "Completed",
  upcoming: "Upcoming",
  live: "Live",
};

/**
 * The one status badge for sports events (races, tournaments, dashboard
 * highlights). `label` renames the state where the card says it differently
 * ("Result" for a finished match).
 *
 * The hue stays on the tint and the live dot; the words are foreground, since
 * blue or green text on its own tint is under 4.5:1.
 */
export function StatusPill({ status, label }: { status: EventStatus; label?: string }): React.ReactElement {
  return (
    <Badge variant={VARIANT[status]} className="text-foreground">
      {status === "live" && (
        <span aria-hidden className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" />
      )}
      {label ?? LABEL[status]}
    </Badge>
  );
}
