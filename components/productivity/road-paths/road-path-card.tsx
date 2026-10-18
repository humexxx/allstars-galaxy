"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MoreHorizontal } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { deleteRoadPathAction } from "@/app/actions/road-path";
import { runAction } from "@/lib/actions/run";
import { formatDay } from "@/lib/utils/date";
import type { RoadPath } from "@/types";

type RoadPathCardProps = {
  roadPath: RoadPath;
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  every_other_day: "Every other day",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export function RoadPathCard({ roadPath }: RoadPathCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    const { ok } = await runAction(deleteRoadPathAction(roadPath.id), {
      success: "Road path deleted",
      failure: "Failed to delete road path",
    });
    setDeleting(false);
    // The action revalidates the list, so a success takes this card with it.
    if (ok) setConfirmingDelete(false);
  };

  const target = roadPath.targetValue ? parseFloat(roadPath.targetValue) : null;
  const current = roadPath.currentValue ? parseFloat(roadPath.currentValue) : 0;
  // A percentage needs something to be a percentage OF. Without a target the
  // card shows the running figure instead of a bar pinned at zero.
  const percent = target && target > 0 ? Math.min(100, (current / target) * 100) : null;

  return (
    <>
      {/* The title is the link; its ::after stretches over the whole card so
          the card is one big hit area that the keyboard can also reach. */}
      <Card className="relative transition-shadow hover:shadow-md hover:ring-foreground/15">
        <CardHeader>
          <CardTitle as="h2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Options for ${roadPath.title}`}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmingDelete(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* How far along, which is the whole reason for a road path and was
              the one thing the card did not say. */}
          {percent !== null ? (
            <div className="flex flex-col gap-1.5">
              <Progress value={percent} aria-label={`${roadPath.title} progress`} />
              <div className="flex items-baseline justify-between">
                <Text variant="small">
                  <Mono>{current}</Mono> / <Mono>{target}</Mono> {roadPath.unit}
                </Text>
                <Mono className="text-sm font-medium">{Math.round(percent)}%</Mono>
              </div>
            </div>
          ) : current > 0 ? (
            <Text variant="small">
              <Mono>{current}</Mono> {roadPath.unit} so far
            </Text>
          ) : (
            <Text variant="small">Nothing logged yet</Text>
          )}

          {(roadPath.targetDate || roadPath.taskFrequency) && (
            <div className="flex flex-wrap items-center gap-2">
              {roadPath.targetDate && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="size-4" aria-hidden="true" />
                  {/* A timestamp: server (UTC) and browser can land on
                      different days near midnight. */}
                  <Mono suppressHydrationWarning>{formatDay(roadPath.targetDate)}</Mono>
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
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                // Stay open until the delete settles, so the pending state
                // and any failure show in the dialog that asked for it.
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting && <Spinner />}
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
