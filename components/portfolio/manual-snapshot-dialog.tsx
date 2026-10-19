"use client";

import { useState } from "react";
import { endOfDay, format } from "date-fns";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createManualSnapshotAction } from "@/app/actions/portfolio-snapshots";
import { runAction } from "@/lib/actions/run";
import { toDay } from "@/lib/utils/date";
import type { SnapshotSource } from "@/schemas/snapshot";

interface ManualSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const todayIso = (): string => format(new Date(), "yyyy-MM-dd");

/**
 * The instant a snapshot of `day` is taken at.
 *
 * Snapshots and interest keep every transaction dated `<= snapshot`, and a
 * transaction's date carries a time of day. Local midnight left out anything
 * dated that day — a buy approved at 10:00 was missing from an 11:00 snapshot
 * — and east of UTC it is the previous UTC day. Today is therefore "now"
 * (nothing later has happened yet); an earlier day is the end of that day.
 */
function snapshotInstant(day: string): Date {
  return day === todayIso() ? new Date() : endOfDay(toDay(day));
}

export function ManualSnapshotDialog({
  open,
  onOpenChange,
}: ManualSnapshotDialogProps) {
  const [date, setDate] = useState(todayIso);
  const [applyInterest, setApplyInterest] = useState(false);
  const [source, setSource] = useState<SnapshotSource>("manual");
  const [isLoading, setIsLoading] = useState(false);

  // A snapshot records what the book was worth on a day; a future day has
  // no value yet to record.
  const isFuture = date > todayIso();

  const reset = (): void => {
    setDate(todayIso());
    setApplyInterest(false);
    setSource("manual");
  };

  const handleSubmit = async (): Promise<void> => {
    setIsLoading(true);
    const result = await runAction(
      createManualSnapshotAction({ date: snapshotInstant(date), applyInterest, source }),
      { failure: "Failed to create snapshot" }
    );
    setIsLoading(false);
    if (!result.ok || !result.data) return;

    const created = result.data.snapshotsCreated;
    toast.success(created === 1 ? "1 snapshot created" : `${created} snapshots created`);
    reset();
    onOpenChange(false);
  };

  const handleClose = (next: boolean): void => {
    if (isLoading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create manual snapshot</DialogTitle>
          <DialogDescription>
            Record every portfolio&apos;s value on a given day.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field data-invalid={isFuture}>
            <FieldLabel htmlFor="snapshot-date">Snapshot date</FieldLabel>
            <DateField
              id="snapshot-date"
              value={date}
              onChange={(day) => day && setDate(day)}
              disabled={isLoading}
              aria-invalid={isFuture}
            />
            {isFuture ? (
              <FieldError>The snapshot date can&apos;t be in the future</FieldError>
            ) : (
              <FieldDescription>The date for this snapshot record</FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="source">Snapshot type</FieldLabel>
            <Select
              value={source}
              onValueChange={(value) => setSource(value as SnapshotSource)}
              disabled={isLoading}
            >
              <SelectTrigger id="source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="admin_enforce">Admin enforce (protected)</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              Admin enforce snapshots aren&apos;t deleted when clearing manual
              snapshots
            </FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="apply-interest">Apply monthly interest</FieldLabel>
              <FieldDescription>
                Compound one month of interest on all active investments before
                creating the snapshot. A month compounds once, by this or the
                daily job
              </FieldDescription>
            </FieldContent>
            <Switch
              id="apply-interest"
              checked={applyInterest}
              onCheckedChange={setApplyInterest}
              disabled={isLoading}
            />
          </Field>
        </FieldGroup>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isLoading || isFuture}>
            {isLoading && <Spinner />}
            {isLoading ? "Creating…" : "Create snapshot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
