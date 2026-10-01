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
import { cn } from "@/lib/utils";
import { runAction } from "@/lib/actions/run";
import type { RoadPath } from "@/types";

import { calendarDayKey, formatCalendarDay } from "../zoned-date";
import { formatAmount, parseAmount } from "./format";

type RoadPathCardProps = {
  roadPath: RoadPath;
  /** Today in the reader's zone (`YYYY-MM-DD`), from the server so both renders agree. */
  today?: string;
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  every_other_day: "Every other day",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export function RoadPathCard({ roadPath, today }: RoadPathCardProps) {
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

  const target = parseAmount(roadPath.targetValue);
  const current = parseAmount(roadPath.currentValue) ?? 0;
  // A percentage needs something to be a percentage OF. Without a target the
  // card shows the running figure instead of a bar pinned at zero.
  const percent = target && target > 0 ? Math.min(100, (current / target) * 100) : null;
  const reached = target !== null && target > 0 && current >= target;
  // Past the target day and not there yet: the one thing worth flagging.
  const pastTarget =
    !reached && roadPath.targetDate !== null && today !== undefined
      ? calendarDayKey(roadPath.targetDate) < today
      : false;

  return (
    <>
      {/* The title is the link; its ::after stretches over the whole card so
          the card is one big hit area that the keyboard can also reach. */}
      <Card className="relative transition-shadow hover:shadow-md hover:ring-foreground/15">
        <CardHeader>
          {/* Clamped: a long goal ran to five lines and pushed its figures
              far below its neighbours'. The detail page has it in full. */}
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
        {/* Pinned to the bottom so the bars line up across a row, whatever
            the titles above them do; the variable line (date, badges) sits
            above the figures for the same reason. */}
        <CardContent className="mt-auto flex flex-col gap-3">
          {(roadPath.targetDate || roadPath.taskFrequency || reached || pastTarget) && (
            <div className="flex flex-wrap items-center gap-2">
              {roadPath.targetDate && (
                <Text
                  variant="small"
                  as="span"
                  className={cn("inline-flex items-center gap-1.5", pastTarget && "text-destructive")}
                >
                  <Calendar className="size-3.5" aria-hidden="true" />
                  {/* What the date is, not just a date. */}
                  {pastTarget ? "Was due" : "Target"}{" "}
                  <Mono>{formatCalendarDay(roadPath.targetDate)}</Mono>
                </Text>
              )}
              {reached && <Badge variant="success">Reached</Badge>}
              {roadPath.taskFrequency && (
                <Badge variant="secondary">
                  {FREQUENCY_LABELS[roadPath.taskFrequency] ?? roadPath.taskFrequency}
                </Badge>
              )}
            </div>
          )}

          {/* How far along, which is the whole reason for a road path and was
              the one thing the card did not say. */}
          {percent !== null ? (
            <div className="flex flex-col gap-1.5">
              <Progress value={percent} aria-label={`${roadPath.title} progress`} />
              <div className="flex items-baseline justify-between gap-2">
                <Text variant="small">
                  <Mono>{formatAmount(current)}</Mono> / <Mono>{formatAmount(target ?? 0)}</Mono>{" "}
                  {roadPath.unit}
                </Text>
                <Mono className="text-sm font-medium">{Math.round(percent)}%</Mono>
              </div>
            </div>
          ) : current > 0 ? (
            <Text variant="small">
              <Mono>{formatAmount(current)}</Mono> {roadPath.unit} so far
            </Text>
          ) : (
            <Text variant="small">Nothing logged yet</Text>
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
