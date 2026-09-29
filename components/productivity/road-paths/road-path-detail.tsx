import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { Mono } from "@/components/ui/typography";
import { formatDay } from "@/lib/utils/date";
import type { RoadPathDetail as RoadPathDetailData } from "@/types";

import { MilestoneList } from "./milestone-list";
import { ProgressTracker } from "./progress-tracker";

type RoadPathDetailProps = {
  detail: RoadPathDetailData;
};

/**
 * One road path's figures, milestones and progress log. The page owns the
 * header (title, back link); the path and its stats come from one read, so
 * the percentage and the figure under it always agree.
 */
export function RoadPathDetail({ detail }: RoadPathDetailProps) {
  const { roadPath, stats } = detail;
  const progressPercentage = Math.round(stats.totalProgress);
  const currentValue = roadPath.currentValue ? parseFloat(roadPath.currentValue) : 0;
  const unit = roadPath.unit ?? "";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Progress"
          value={`${progressPercentage}%`}
          sublabel={
            roadPath.targetValue ? (
              <>
                <Mono>{currentValue}</Mono> / <Mono>{parseFloat(roadPath.targetValue)}</Mono>{" "}
                {unit}
              </>
            ) : undefined
          }
          chart={<Progress value={progressPercentage} />}
        />

        <StatCard
          label="Milestones"
          value={`${stats.completedMilestones} / ${stats.totalMilestones}`}
          sublabel="completed"
        />

        {roadPath.targetDate && stats.daysRemaining !== null && (
          <StatCard
            label="Time remaining"
            value={stats.daysRemaining}
            sublabel={
              <>
                days until <Mono>{formatDay(roadPath.targetDate)}</Mono>
              </>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Milestones</CardTitle>
            <CardDescription>Break down your goal into smaller milestones.</CardDescription>
          </CardHeader>
          <CardContent>
            <MilestoneList roadPathId={roadPath.id} milestones={roadPath.milestones} />
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
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
