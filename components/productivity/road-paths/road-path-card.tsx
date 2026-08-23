"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Calendar, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteRoadPathAction } from "@/app/actions/road-path";
import { runAction } from "@/lib/actions/run";
import type { RoadPath } from "@/types";
import { format } from "date-fns";

type RoadPathCardProps = {
  roadPath: RoadPath;
  onClick: () => void;
  onRefresh: () => void;
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  every_other_day: "Every other day",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export function RoadPathCard({ roadPath, onClick, onRefresh }: RoadPathCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = async () => {
    const { ok } = await runAction(deleteRoadPathAction(roadPath.id), {
      success: "Road path deleted",
      failure: "Failed to delete road path",
    });
    setConfirmingDelete(false);
    if (ok) onRefresh();
  };

  const target = roadPath.targetValue ? parseFloat(roadPath.targetValue) : null;
  const current = roadPath.currentValue ? parseFloat(roadPath.currentValue) : 0;
  // A percentage needs something to be a percentage OF. Without a target the
  // card shows the running figure instead of a bar pinned at zero.
  const percent = target && target > 0 ? Math.min(100, (current / target) * 100) : null;

  return (
    <>
      <Card
        className="cursor-pointer transition-colors hover:border-primary"
        onClick={onClick}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Heading level="h4" as="h3">{roadPath.title}</Heading>
              {roadPath.description && (
                <Text variant="muted" className="mt-1 line-clamp-2">
                  {roadPath.description}
                </Text>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Road path options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingDelete(true);
                  }}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* How far along, which is the whole reason for a road path and was
              the one thing the card did not say. */}
          {percent !== null ? (
            <div className="space-y-1.5">
              <Progress value={percent} />
              <div className="flex items-baseline justify-between">
                <Text variant="small" className="text-muted-foreground">
                  <Mono>{current}</Mono> / <Mono>{target}</Mono> {roadPath.unit}
                </Text>
                <Mono className="text-sm font-medium">{Math.round(percent)}%</Mono>
              </div>
            </div>
          ) : current > 0 ? (
            <Text variant="small" className="text-muted-foreground">
              <Mono>{current}</Mono> {roadPath.unit} so far
            </Text>
          ) : (
            <Text variant="small" className="text-muted-foreground">
              Nothing logged yet
            </Text>
          )}

          {(roadPath.targetDate || roadPath.taskFrequency) && (
            <div className="flex flex-wrap items-center gap-2">
              {roadPath.targetDate && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <Mono>{format(new Date(roadPath.targetDate), "MMM d, yyyy")}</Mono>
                </span>
              )}
              {roadPath.taskFrequency && (
                <Badge variant="secondary">
                  {FREQUENCY_LABELS[roadPath.taskFrequency] ?? roadPath.taskFrequency}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{roadPath.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its milestones and every progress entry go with it. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
