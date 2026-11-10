import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Mono } from "@/components/ui/typography";
import {
  frequencyLabel,
  habitOf,
  hasSchedule,
  nextDueDay,
  scheduleLabel,
} from "@/lib/productivity/habit";
import { formatWeekdayDay } from "@/lib/utils/date";
import type { RoadPathDetail as RoadPathDetailData } from "@/types";

import { HabitCalendar } from "./habit-days";

type RoadPathDetailProps = {
  detail: RoadPathDetailData;
  /** Today in the reader's zone (`YYYY-MM-DD`). */
  today: string;
  /** The reader's IANA zone: check-ins are days in it. */
  timeZone?: string;
};

/**
 * One road path: how the habit is going (streak, completion) over its
 * calendar. The page owns the header (title, back link, edit); the path and
 * its stats come from one read.
 */
export function RoadPathDetail({ detail, today, timeZone }: RoadPathDetailProps) {
  const { roadPath, stats } = detail;
  const habit = habitOf(roadPath, timeZone);
  const scheduled = hasSchedule(habit);
  const next = scheduled ? nextDueDay(habit, today) : null;
  const doneToday = roadPath.checkIns.some((c) => c.day === today);
  const often = frequencyLabel(habit.scheduleDays);

  return (
    <div className="@container flex flex-col gap-6">
      {/* Two abreast from a phone up: each card is a label and one figure,
          and stacked they pushed the calendar off the first screen. */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Current streak"
          value={stats.currentStreak}
          tone={stats.currentStreak > 0 ? "positive" : undefined}
          sublabel={
            <>
              {stats.currentStreak === 1 ? "due day" : "due days"} in a row · best <Mono>{stats.bestStreak}</Mono>
            </>
          }
        />
        <StatCard
          label="Completion"
          value={stats.completionRate === null ? "—" : `${Math.round(stats.completionRate * 100)}%`}
          sublabel={
            stats.due === 0 ? (
              "nothing due yet"
            ) : (
              <>
                <Mono>{stats.doneDue}</Mono> of <Mono>{stats.due}</Mono> due days done
              </>
            )
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Habit</CardTitle>
          <CardDescription>
            {scheduled ? (
              <>
                {scheduleLabel(habit.scheduleDays)}
                {often ? ` · ${often}` : null}
                {" · "}
                <HabitNext
                  completed={roadPath.completedAt !== null}
                  next={next}
                  today={today}
                  doneToday={doneToday}
                />
              </>
            ) : (
              "No days picked yet: edit it to choose them."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HabitCalendar habit={habit} checkIns={roadPath.checkIns.map((c) => c.day)} today={today} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Where the habit stands right now: done, due (and on the board), or when next. */
function HabitNext({
  completed,
  next,
  today,
  doneToday,
}: {
  completed: boolean;
  next: string | null;
  today: string;
  doneToday: boolean;
}) {
  if (completed) return <>completed</>;
  if (doneToday) return <>done today</>;
  if (next === today) {
    return (
      <>
        due today,{" "}
        <Link
          href="/portal/productivity/board"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          it’s on your board
        </Link>
      </>
    );
  }
  return next ? <>next {formatWeekdayDay(next)}</> : <>nothing due in the next two weeks</>;
}
