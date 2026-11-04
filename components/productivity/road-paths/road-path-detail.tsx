import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { cn } from "@/lib/utils";
import type { RoadPathDetail as RoadPathDetailData } from "@/types";

import { calendarDayKey, daysBetween, formatCalendarDay } from "../zoned-date";
import { formatAmount, parseAmount } from "./format";
import { HabitCalendar } from "./habit-days";
import { MilestoneList } from "./milestone-list";
import { ProgressTracker } from "./progress-tracker";

type RoadPathDetailProps = {
  detail: RoadPathDetailData;
  /** Today in the reader's zone (`YYYY-MM-DD`). */
  today: string;
  /** The reader's IANA zone: progress entries are days in it. */
  timeZone?: string;
};

// Two abreast from a phone up: each card is a label and one figure, and
// stacked they pushed the habit's calendar off the first screen.
const GRID_COLUMNS: Record<number, string> = {
  1: "",
  2: "grid-cols-2",
  3: "grid-cols-2 @xl:grid-cols-3",
  4: "grid-cols-2 @4xl:grid-cols-4",
};

/**
 * One road path: how the habit is going (streak, completion, the calendar),
 * then its target figure, milestones and progress log. The page owns the
 * header (title, back link, edit); the path and its stats come from one read.
 */
export function RoadPathDetail({ detail, today, timeZone }: RoadPathDetailProps) {
  const { roadPath, stats } = detail;
  const progressPercentage = Math.round(stats.totalProgress);
  const currentValue = parseAmount(roadPath.currentValue) ?? 0;
  const targetValue = parseAmount(roadPath.targetValue);
  const unit = roadPath.unit ?? "";
  const habit = habitOf(roadPath, timeZone);
  const scheduled = hasSchedule(habit);
  const habitStats = stats.habit;

  // Whole days from the reader's today to the target day. A target that had
  // passed said "0 days until Sep 15" — clamped, so it read as due today for
  // ever.
  const daysLeft = roadPath.targetDate
    ? daysBetween(today, calendarDayKey(roadPath.targetDate))
    : null;
  const targetDay = roadPath.targetDate ? formatCalendarDay(roadPath.targetDate) : null;
  const next = scheduled ? nextDueDay(habit, today) : null;
  const doneToday = roadPath.checkIns.some((c) => c.day === today);

  const cards: React.ReactNode[] = [];
  if (habitStats) {
    cards.push(
      <StatCard
        key="streak"
        label="Current streak"
        value={habitStats.currentStreak}
        tone={habitStats.currentStreak > 0 ? "positive" : undefined}
        sublabel={
          <>
            {habitStats.currentStreak === 1 ? "due day" : "due days"} in a row · best{" "}
            <Mono>{habitStats.bestStreak}</Mono>
          </>
        }
      />,
      <StatCard
        key="rate"
        label="Completion"
        value={
          habitStats.completionRate === null ? "—" : `${Math.round(habitStats.completionRate * 100)}%`
        }
        sublabel={
          habitStats.due === 0 ? (
            "nothing due yet"
          ) : (
            <>
              <Mono>{habitStats.doneDue}</Mono> of <Mono>{habitStats.due}</Mono> due days done
            </>
          )
        }
      />
    );
  }
  if (targetValue !== null) {
    cards.push(
      <StatCard
        key="progress"
        label="Progress"
        value={`${progressPercentage}%`}
        sublabel={
          <>
            <Mono>{formatAmount(currentValue)}</Mono> / <Mono>{formatAmount(targetValue)}</Mono>{" "}
            {unit}
          </>
        }
        chart={<Progress value={progressPercentage} />}
      />
    );
  }
  if (!habitStats || stats.totalMilestones > 0) {
    cards.push(
      <StatCard
        key="milestones"
        label="Milestones"
        value={`${stats.completedMilestones} of ${stats.totalMilestones}`}
        sublabel="completed"
      />
    );
  }
  if (daysLeft !== null && targetDay !== null && cards.length < 4) {
    cards.push(
      <StatCard
        key="remaining"
        label={daysLeft < 0 ? "Past target" : "Time remaining"}
        value={daysLeft >= 0 ? daysLeft : Math.abs(daysLeft)}
        tone={daysLeft < 0 && progressPercentage < 100 ? "negative" : undefined}
        sublabel={
          daysLeft === 0 ? (
            <>
              due today, <Mono>{targetDay}</Mono>
            </>
          ) : daysLeft > 0 ? (
            <>
              {daysLeft === 1 ? "day" : "days"} until <Mono>{targetDay}</Mono>
            </>
          ) : (
            <>
              {daysLeft === -1 ? "day" : "days"} past <Mono>{targetDay}</Mono>
            </>
          )
        }
      />
    );
  }

  const often = frequencyLabel(habit.scheduleDays);

  return (
    // Sized by the room the page actually has, not the viewport: from `lg`
    // the sidebar takes 192px, and viewport breakpoints split what was left
    // into three stat cards and two narrow panels — a progress note wrapped
    // one letter per line.
    <div className="@container flex flex-col gap-6">
      <div className={cn("grid grid-cols-1 gap-4", GRID_COLUMNS[cards.length])}>{cards}</div>

      {habitStats ? (
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
                "No schedule: these are the days it was done."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HabitCalendar
              habit={habit}
              checkIns={roadPath.checkIns.map((c) => c.day)}
              today={today}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Milestones</CardTitle>
            <CardDescription>Break down your goal into smaller milestones.</CardDescription>
          </CardHeader>
          <CardContent>
            <MilestoneList
              roadPathId={roadPath.id}
              milestones={roadPath.milestones}
              unit={unit}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Progress tracking</CardTitle>
            <CardDescription>Track your progress over time.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressTracker
              roadPathId={roadPath.id}
              progress={roadPath.progress}
              unit={unit}
              timeZone={timeZone}
            />
          </CardContent>
        </Card>
      </div>
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
