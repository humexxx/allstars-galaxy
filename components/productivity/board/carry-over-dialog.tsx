"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { carryOverTasksAction } from "@/app/actions/board";
import { runAction } from "@/lib/actions/run";
import { formatShortDay } from "@/lib/utils/date";
import type { CarryOverTask } from "@/types";

type CarryOverDialogProps = {
  tasks: CarryOverTask[];
};

/**
 * The first look at today's board asks about what earlier days left open.
 * Every task starts ticked; what is unticked stays on its own day, in the
 * history, and is not asked about again. Closing without answering asks again
 * next time.
 */
export function CarryOverDialog({ tasks }: CarryOverDialogProps): React.ReactElement | null {
  const [open, setOpen] = useState(tasks.length > 0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));
  const [pending, setPending] = useState<"move" | "leave" | null>(null);

  if (tasks.length === 0) return null;

  const answer = async (kind: "move" | "leave"): Promise<void> => {
    const moveIds = kind === "move" ? tasks.filter((t) => selected.has(t.id)).map((t) => t.id) : [];
    const leaveIds = tasks.filter((t) => !moveIds.includes(t.id)).map((t) => t.id);
    setPending(kind);
    const { ok } = await runAction(carryOverTasksAction({ moveIds, leaveIds }), {
      success:
        moveIds.length > 0
          ? `Moved ${moveIds.length} ${moveIds.length === 1 ? "task" : "tasks"} to today`
          : undefined,
      failure: "Failed to move the tasks",
    });
    setPending(null);
    if (ok) setOpen(false);
  };

  const toggle = (id: string, checked: boolean): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const count = selected.size;

  return (
    <Dialog open={open} onOpenChange={(next) => pending === null && setOpen(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>You didn’t finish some things</DialogTitle>
          <DialogDescription>
            Move them to today? Each one keeps its column. Whatever you leave stays on its own
            day.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {tasks.map((task) => {
            const id = `carry-${task.id}`;
            return (
              <li key={task.id}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/50"
                >
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={selected.has(task.id)}
                    onCheckedChange={(checked) => toggle(task.id, checked === true)}
                  />
                  <span className="flex min-w-0 flex-col">
                    <Text as="span" weight="medium" className="break-words">
                      {task.title}
                    </Text>
                    <Text as="span" variant="small">
                      {task.columnName} · <Mono>{formatShortDay(task.boardDate)}</Mono>
                    </Text>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="outline" disabled={pending !== null} onClick={() => answer("leave")}>
            {pending === "leave" && <Spinner />}
            Leave them
          </Button>
          <Button disabled={pending !== null || count === 0} onClick={() => answer("move")}>
            {pending === "move" && <Spinner />}
            {count === tasks.length && count > 1
              ? "Move all to today"
              : `Move ${count} to today`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
