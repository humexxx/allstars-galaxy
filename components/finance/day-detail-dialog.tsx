"use client";

import { format } from "date-fns";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils/format";

export type DayEntryRef = {
  id: string;
  side: "income" | "expense" | "debt";
  name: string;
  amount: number;
  kind: "recurring" | "one_time";
};

type DayDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  entries: DayEntryRef[];
  onEdit: (entry: DayEntryRef) => void;
};

const SIDE_LABEL: Record<DayEntryRef["side"], string> = {
  income: "Income",
  expense: "Expense",
  debt: "Debt",
};

const SIDE_DOT: Record<DayEntryRef["side"], string> = {
  income: "bg-green-500",
  expense: "bg-red-500",
  debt: "bg-amber-500",
};

const SIDE_AMOUNT: Record<DayEntryRef["side"], string> = {
  income: "text-green-700 dark:text-green-300",
  expense: "text-red-700 dark:text-red-300",
  debt: "text-amber-700 dark:text-amber-300",
};

export function DayDetailDialog({
  open,
  onOpenChange,
  date,
  entries,
  onEdit,
}: DayDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {date ? format(date, "PPP") : "Day detail"}
          </DialogTitle>
          <DialogDescription>
            {entries.length === 0
              ? "No entries on this day."
              : `${entries.length} entr${entries.length === 1 ? "y" : "ies"} on this day.`}
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 && (
          <ul className="divide-y rounded-md border">
            {entries.map((entry) => (
              <li
                key={`${entry.side}-${entry.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`inline-block size-2 shrink-0 rounded-full ${SIDE_DOT[entry.side]}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {entry.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {SIDE_LABEL[entry.side]}
                      {entry.kind === "recurring" ? " · Recurring" : " · One-time"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm tabular-nums ${SIDE_AMOUNT[entry.side]}`}
                  >
                    {formatCurrency(entry.amount)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${entry.name}`}
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
