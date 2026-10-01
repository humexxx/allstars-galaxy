import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { Mono } from "@/components/ui/typography";
import type { RoadPathDetail as RoadPathDetailData } from "@/types";

import { calendarDayKey, dayKey, daysBetween, formatCalendarDay } from "../zoned-date";
import { formatAmount, parseAmount } from "./format";
import { MilestoneList } from "./milestone-list";
import { ProgressTracker } from "./progress-tracker";

type RoadPathDetailProps = {
  detail: RoadPathDetailData;
  /** The reader's IANA zone: the target day and the countdown are in it. */
  timeZone?: string;
};

/**
 * One road path's figures, milestones and progress log. The page owns the
 * header (title, back link); the path and its stats come from one read, so
 * the percentage and the figure under it always agree.
 */
export function RoadPathDetail({ detail, timeZone }: RoadPathDetailProps) {
  const { roadPath, stats } = detail;
  const progressPercentage = Math.round(stats.totalProgress);
  const currentValue = parseAmount(roadPath.currentValue) ?? 0;
  const targetValue = parseAmount(roadPath.targetValue);
  const unit = roadPath.unit ?? "";

  // Whole days from the reader's today to the target day. A target that had
  // passed said "0 days until Sep 15" — clamped, so it read as due today for
  // ever.
  const daysLeft = roadPath.targetDate
    ? daysBetween(dayKey(new Date(), timeZone), calendarDayKey(roadPath.targetDate))
    : null;
  const targetDay = roadPath.targetDate ? formatCalendarDay(roadPath.targetDate) : null;

  return (
    // Sized by the room the page actually has, not the viewport: from `md`
    // the sidebar takes 256px, and the viewport breakpoints split a 456px
    // column into three stat cards and two 216px panels — a progress note
    // wrapped one letter per line.
    <div className="@container flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 @xl:grid-cols-3">
        <StatCard
          label="Progress"
          value={`${progressPercentage}%`}
          sublabel={
            targetValue !== null ? (
              <>
                <Mono>{formatAmount(currentValue)}</Mono> / <Mono>{formatAmount(targetValue)}</Mono>{" "}
                {unit}
              </>
            ) : undefined
          }
          chart={<Progress value={progressPercentage} />}
        />

        <StatCard
          label="Milestones"
          value={`${stats.completedMilestones} of ${stats.totalMilestones}`}
          sublabel="completed"
        />

        {daysLeft !== null && targetDay !== null && (
          <StatCard
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
        )}
      </div>

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
