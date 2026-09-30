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
 */
export function StatusPill({ status, label }: { status: EventStatus; label?: string }) {
  return (
    <Badge variant={VARIANT[status]}>
      {status === "live" && (
        <span aria-hidden className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
      )}
      {label ?? LABEL[status]}
    </Badge>
  );
}
