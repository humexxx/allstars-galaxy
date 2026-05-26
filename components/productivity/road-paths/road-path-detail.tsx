"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
};

export function RoadPathDetail({ roadPath, onBack }: RoadPathDetailProps) {
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
          setMilestones(result.data.milestones);
          setProgress(result.data.progress);
          setStats(result.data.stats);
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

  if (!hasLoaded && isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progressPercentage = Math.round(stats?.totalProgress ?? 0);
  const currentValue = roadPath.currentValue ? parseFloat(roadPath.currentValue) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{roadPath.title}</h2>
          {roadPath.description && (
            <p className="text-muted-foreground">{roadPath.description}</p>
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
              <p className="text-2xl font-bold">{progressPercentage}%</p>
              {stats && roadPath.targetValue && (
                <p className="text-sm text-muted-foreground">
                  {currentValue} / {roadPath.targetValue} {roadPath.unit}
                </p>
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
              <p className="text-2xl font-bold">
                {stats?.completedMilestones ?? 0} / {stats?.totalMilestones ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">completed</p>
            </div>
          </CardContent>
        </Card>

        {roadPath.targetDate && stats && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{stats.daysRemaining}</p>
                <p className="text-sm text-muted-foreground">
                  days until {format(new Date(roadPath.targetDate), "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>Break down your goal into smaller milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <MilestoneList
              roadPathId={roadPath.id}
              milestones={milestones}
              onRefresh={loadData}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress Tracking</CardTitle>
            <CardDescription>Track your progress over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressTracker
              roadPathId={roadPath.id}
              progress={progress}
              unit={roadPath.unit || ""}
              onRefresh={loadData}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
