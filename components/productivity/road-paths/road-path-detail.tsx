"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heading, Text, Mono } from "@/components/ui/typography";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { MilestoneList } from "./milestone-list";
import { ProgressTracker } from "./progress-tracker";
import { getRoadPathDetailAction } from "@/app/actions/road-path";
import type { RoadPath, RoadPathMilestone, RoadPathProgress, RoadPathStats } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";

type RoadPathDetailProps = {
  roadPath: RoadPath;
  onBack: () => void;
  /** Keeps the list behind this view in step with what changes in here. */
  onRefresh?: () => void;
};

export function RoadPathDetail({ roadPath, onBack, onRefresh }: RoadPathDetailProps) {
  const [detail, setDetail] = useState<RoadPath>(roadPath);
  const [milestones, setMilestones] = useState<RoadPathMilestone[]>([]);
  const [progress, setProgress] = useState<RoadPathProgress[]>([]);
  const [stats, setStats] = useState<RoadPathStats | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadData = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await getRoadPathDetailAction(roadPath.id);
        if (result.success) {
          // The freshly-read path, not the snapshot this view was opened with:
          // the percentage and the figure under it have to come from the same
          // read or they disagree on screen the moment progress is logged.
          setDetail(result.data.roadPath);
          setMilestones(result.data.milestones);
          setProgress(result.data.progress);
          setStats(result.data.stats);
        } else {
          toast.error(result.error ?? "Failed to load road path details");
        }
      } catch {
        toast.error("Failed to load road path details");
      } finally {
        setHasLoaded(true);
      }
    });
  }, [roadPath.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * A child changed something: re-read this view AND the list behind it.
   *
   * `loadData` deliberately does not do this itself — it runs on mount, and
   * refreshing the server page from there would put the two in a loop.
   */
  const handleChildRefresh = useCallback(() => {
    loadData();
    onRefresh?.();
  }, [loadData, onRefresh]);

  if (!hasLoaded && isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progressPercentage = Math.round(stats?.totalProgress ?? 0);
  const currentValue = detail.currentValue ? parseFloat(detail.currentValue) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <Heading level="h2">{detail.title}</Heading>
          {detail.description && (
            <Text variant="muted">{detail.description}</Text>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={progressPercentage} />
              <Mono as="p" className="text-2xl font-bold">{progressPercentage}%</Mono>
              {stats && detail.targetValue && (
                <Text variant="muted">
                  <Mono>{currentValue}</Mono> / <Mono>{parseFloat(detail.targetValue)}</Mono>{" "}
                  {detail.unit}
                </Text>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <Mono as="p" className="text-2xl font-bold">
                {stats?.completedMilestones ?? 0} / {stats?.totalMilestones ?? 0}
              </Mono>
              <Text variant="muted">completed</Text>
            </div>
          </CardContent>
        </Card>

        {detail.targetDate && stats && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Mono as="p" className="text-2xl font-bold">{stats.daysRemaining}</Mono>
                <Text variant="muted">
                  days until <Mono>{format(new Date(detail.targetDate), "MMM d, yyyy")}</Mono>
                </Text>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Heading level="h5" as="h3">Milestones</Heading>
            <Text variant="muted">Break down your goal into smaller milestones</Text>
          </CardHeader>
          <CardContent>
            <MilestoneList
              roadPathId={roadPath.id}
              milestones={milestones}
              onRefresh={handleChildRefresh}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Heading level="h5" as="h3">Progress Tracking</Heading>
            <Text variant="muted">Track your progress over time</Text>
          </CardHeader>
          <CardContent>
            <ProgressTracker
              roadPathId={roadPath.id}
              progress={progress}
              unit={detail.unit || ""}
              onRefresh={handleChildRefresh}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
