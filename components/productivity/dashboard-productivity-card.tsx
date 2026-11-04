import Link from "next/link";
import { ArrowRight, CircleCheck, Flame, Kanban, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { scheduleLabel } from "@/lib/productivity/habit";
import type { DashboardHabit } from "@/lib/productivity/dashboard";
import { getDashboardProductivity } from "@/lib/services/productivity-dashboard-service";
import { formatWeekdayDay } from "@/lib/utils/date";
import { getRequestTodayIso, readRequestTimeZone } from "@/lib/utils/request-today";

import { HabitWeek } from "./road-paths/habit-days";

const BOARD_PATH = "/portal/productivity/board";
const ROAD_PATHS_PATH = "/portal/productivity/road-paths";
/** Rows per panel; the board and the road paths have the rest. */
const SHOWN = 4;

type DashboardProductivityCardProps = {
  userId: string;
};

/** Today at a glance: the day's board, and how each habit stands. */
export async function DashboardProductivityCard({ userId }: DashboardProductivityCardProps) {
  const [timeZone, today] = await Promise.all([readRequestTimeZone(), getRequestTodayIso()]);
  const summary = await getDashboardProductivity(userId, today, timeZone);
  const { total, done, open, carryOverCount, habits } = summary;
  const percent = total > 0 ? (done / total) * 100 : 0;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <Kanban className="size-5" />
          Productivity
        </CardTitle>
        <CardDescription>
          {formatWeekdayDay(today)}
          {total > 0 ? (
            <>
              {" · "}
              <Mono>{done}</Mono> of <Mono>{total}</Mono> done
            </>
          ) : null}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href={BOARD_PATH}>
              Open board <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      {/* Side by side once the card is wide enough for two readable lists. */}
      <CardContent className="@container">
        <div className="grid gap-3 @2xl:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="dash-today">
            <Eyebrow asChild>
              <h3 id="dash-today">Today’s board</h3>
            </Eyebrow>
            {total > 0 ? (
              <Progress value={percent} aria-label={`${done} of ${total} tasks done`} />
            ) : null}
            {open.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {open.slice(0, SHOWN).map((task) => (
                  <li key={task.id} className="flex items-baseline justify-between gap-3">
                    <Text as="span" className="inline-flex min-w-0 items-center gap-1.5">
                      {task.isHabit ? (
                        <Repeat className="size-3.5 shrink-0 text-primary" aria-label="Habit" />
                      ) : null}
                      <span className="truncate">{task.title}</span>
                    </Text>
                    <Text as="span" variant="small" className="shrink-0">
                      {task.columnName}
                    </Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text variant="muted">
                {total > 0 ? "Everything on today’s board is done." : "Nothing on today’s board yet."}
              </Text>
            )}
            {open.length > SHOWN ? (
              <Text variant="small">
                and <Mono>{open.length - SHOWN}</Mono> more
              </Text>
            ) : null}
            {carryOverCount > 0 ? (
              <Link
                href={BOARD_PATH}
                className="mt-auto text-sm font-medium text-warning underline-offset-4 hover:underline"
              >
                {carryOverCount} unfinished from earlier days — review
              </Link>
            ) : null}
          </section>

          <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="dash-habits">
            <Eyebrow asChild>
              <h3 id="dash-habits">Habits</h3>
            </Eyebrow>
            {habits.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {habits.slice(0, SHOWN).map((habit) => (
                  <HabitRow key={habit.id} habit={habit} today={today} />
                ))}
              </ul>
            ) : (
              <Text variant="muted">
                No habits yet.{" "}
                <Link
                  href={ROAD_PATHS_PATH}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Set one up
                </Link>
              </Text>
            )}
            {habits.length > SHOWN ? (
              <Link href={ROAD_PATHS_PATH} className="text-sm text-muted-foreground hover:underline">
                and {habits.length - SHOWN} more
              </Link>
            ) : null}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function HabitRow({ habit, today }: { habit: DashboardHabit; today: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-col">
        <Link
          href={`${ROAD_PATHS_PATH}?path=${habit.id}`}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {habit.title}
        </Link>
        <Text as="span" variant="small" className={cn(habit.today === "due" && "text-warning")}>
          <HabitToday habit={habit} today={today} />
        </Text>
      </div>
      <div className="flex items-center gap-3">
        <HabitWeek habit={habit.habit} checkIns={habit.checkIns} today={today} />
        <Text weight="medium" as="span" className="inline-flex w-10 items-center justify-end gap-1">
          <Flame
            className={cn("size-4", habit.currentStreak > 0 ? "text-warning" : "text-muted-foreground")}
            aria-hidden="true"
          />
          <Mono>{habit.currentStreak}</Mono>
          <span className="sr-only">in a row</span>
        </Text>
      </div>
    </li>
  );
}

function HabitToday({ habit, today }: { habit: DashboardHabit; today: string }) {
  const days = scheduleLabel(habit.habit.scheduleDays);
  if (habit.today === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <CircleCheck className="size-3.5" aria-hidden="true" /> Done today
      </span>
    );
  }
  if (habit.today === "due" && habit.next === today) return <>Due today · {days}</>;
  return habit.next ? (
    <>
      Next {formatWeekdayDay(habit.next)} · {days}
    </>
  ) : (
    <>{days}</>
  );
}
