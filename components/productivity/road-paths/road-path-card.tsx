"use client";

import Link from "next/link";
import { Flame } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { dayStatus, habitOf, habitStats, hasSchedule, scheduleLabel } from "@/lib/productivity/habit";
import type { RoadPathWithCheckIns } from "@/types";

import { HabitWeek } from "./habit-days";
import { RoadPathMenu } from "./road-path-menu";

type RoadPathCardProps = {
  roadPath: RoadPathWithCheckIns;
  /** Today in the reader's zone (`YYYY-MM-DD`), from the server so both renders agree. */
  today: string;
  /** The reader's IANA zone: the day a path was completed is a day in it. */
  timeZone?: string;
};

export function RoadPathCard({ roadPath, today, timeZone }: RoadPathCardProps) {
  const completed = roadPath.completedAt !== null;
  const habit = habitOf(roadPath, timeZone);
  const checkIns = roadPath.checkIns.map((c) => c.day);
  // A path from before road paths were habits only may have no days yet.
  const scheduled = hasSchedule(habit);
  const stats = scheduled ? habitStats(habit, checkIns, today) : null;
  const dueToday = scheduled && dayStatus(habit, today, new Set(checkIns), today) === "due";

  return (
    // The title is the link; its ::after stretches over the whole card so the
    // card is one big hit area that the keyboard can also reach.
    <Card className="relative h-full">
      <CardHeader>
        {/* Clamped: a long title ran to five lines and pushed its figures far
            below its neighbours'. The detail page has it in full. */}
        <CardTitle as="h2" className="line-clamp-3 break-words">
          <Link
            href={`?path=${roadPath.id}`}
            scroll={false}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
          >
            {roadPath.title}
          </Link>
        </CardTitle>
        {roadPath.description && (
          <CardDescription className="line-clamp-2">{roadPath.description}</CardDescription>
        )}
        <CardAction className="relative z-10">
          <RoadPathMenu roadPath={roadPath} />
        </CardAction>
      </CardHeader>
      {/* Pinned to the bottom so the figures line up across a row, whatever
          the titles above them do; the variable line (badges) sits
          above the figures for the same reason. */}
      <CardContent className="mt-auto flex flex-col gap-3">
        {(scheduled || completed) && (
          <div className="flex flex-wrap items-center gap-2">
            {scheduled && <Badge variant="secondary">{scheduleLabel(habit.scheduleDays)}</Badge>}
            {completed && <Badge variant="success">Completed</Badge>}
          </div>
        )}

        {stats ? (
          <div className="flex items-end justify-between gap-3">
            <HabitWeek habit={habit} checkIns={checkIns} today={today} />
            <div className="flex flex-col items-end gap-0.5 text-right">
              <Text weight="medium" as="span" className="inline-flex items-center gap-1">
                <Flame
                  className={cn("size-4", stats.currentStreak > 0 ? "text-warning" : "text-muted-foreground")}
                  aria-hidden="true"
                />
                <Mono>{stats.currentStreak}</Mono>
                <span className="sr-only">in a row</span>
              </Text>
              <Text variant="small" as="span">
                {stats.completionRate === null ? (
                  dueToday ? "Due today" : "Nothing due yet"
                ) : (
                  <>
                    <Mono>{Math.round(stats.completionRate * 100)}%</Mono> done
                  </>
                )}
              </Text>
            </div>
          </div>
        ) : (
          <Text variant="small">No days picked yet: edit it to choose them.</Text>
        )}
      </CardContent>
    </Card>
  );
}
