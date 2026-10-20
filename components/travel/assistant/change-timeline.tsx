"use client";

import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/utils/date";
import type { TravelChangeLine, TravelDaySpan } from "@/types/travel-assistant";

const DAY = 86_400_000;
const dayIndex = (day: string): number => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY);

const AFTER_TONE = {
  add: "bg-success",
  change: "bg-primary",
  remove: "bg-destructive",
} as const;

/**
 * The proposal drawn on a strip of days: where each thing sits before (a
 * dashed outline) and after (a solid bar). A trip that moves a week, or a
 * cruise swapped ahead of a hotel, reads at a glance — the list under it
 * says the same in words.
 *
 * Only lines with days take part; a proposal that moves nothing draws nothing.
 */
export function ChangeTimeline({ lines }: { lines: TravelChangeLine[] }) {
  const rows = lines.filter((l) => l.before || l.after);
  if (rows.length === 0) return null;

  // The trip's own days set the strip, so one new day shows where in the
  // trip it falls rather than filling the whole width.
  const spans = rows
    .flatMap((l) => [l.before, l.after, l.tripSpan])
    .filter((s): s is TravelDaySpan => Boolean(s));
  const first = Math.min(...spans.map((s) => dayIndex(s.from)));
  const last = Math.max(...spans.map((s) => dayIndex(s.to)));
  const days = last - first + 1;
  const firstDay = new Date(first * DAY).toISOString().slice(0, 10);
  const lastDay = new Date(last * DAY).toISOString().slice(0, 10);

  // A computed layout, not spacing: where a span starts and how wide it is,
  // as a share of the strip.
  const place = (s: TravelDaySpan): { left: string; width: string } => ({
    left: `${((dayIndex(s.from) - first) / days) * 100}%`,
    width: `${((dayIndex(s.to) - dayIndex(s.from) + 1) / days) * 100}%`,
  });

  return (
    <figure data-slot="change-timeline" className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-2">
      <figcaption className="flex justify-between">
        <Text variant="small" className="tabular-nums">
          {formatDay(firstDay)}
        </Text>
        <Text variant="small" className="tabular-nums">
          {formatDay(lastDay)}
        </Text>
      </figcaption>
      {rows.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-2xs text-muted-foreground" title={line.title}>
            {line.title}
          </span>
          <div className="relative h-3 flex-1 rounded-sm bg-background">
            {line.before && (
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 rounded-sm border border-dashed border-muted-foreground/60",
                  line.action === "remove" && "border-destructive bg-destructive/15"
                )}
                style={place(line.before)}
              />
            )}
            {line.after && (
              <span
                aria-hidden
                className={cn("absolute inset-y-0.5 rounded-sm", AFTER_TONE[line.action])}
                style={place(line.after)}
              />
            )}
          </div>
        </div>
      ))}
    </figure>
  );
}
