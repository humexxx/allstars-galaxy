"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import { formatDay, formatMonth } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/format";
import {
  LineFormDialog,
  type LineFormValues,
  type LineVariant,
} from "./line-form-dialog";

export type EditorLine = {
  id: string;
  name: string;
  monthlyAmount: string;
  kind: "recurring" | "one_time";
  dayOfMonth: number | null;
  date: string | null;
  // Income-only — undefined on expenses.
  startDate?: string | null;
  endDate?: string | null;
};

type PlanLineEditorProps = {
  variant: LineVariant;
  title: string;
  description?: string;
  emptyLabel: string;
  lines: EditorLine[];
  addLabel?: string;
  /** These reject on failure, having already reported it. */
  onAdd: (input: LineFormValues) => Promise<void>;
  onUpdate: (id: string, input: LineFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function PlanLineEditor({
  variant,
  title,
  description,
  emptyLabel,
  lines,
  addLabel = "Add row",
  onAdd,
  onUpdate,
  onDelete,
}: PlanLineEditorProps) {
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: "add" }
    | { open: true; mode: "edit"; line: EditorLine }
  >({ open: false });

  // A deleted row takes its focused button with it; focus lands here instead
  // of on <body>.
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const close = () => setDialogState({ open: false });

  // Failures propagate so the dialog stays open; the caller already toasted.
  const handleSubmit = async (values: LineFormValues) => {
    if (dialogState.open === false) return;
    if (dialogState.mode === "add") {
      await onAdd(values);
    } else {
      await onUpdate(dialogState.line.id, values);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h5" as="h2">{title}</Heading>
          {description && <Text variant="small">{description}</Text>}
        </div>
        <Button
          ref={addButtonRef}
          size="sm"
          onClick={() => setDialogState({ open: true, mode: "add" })}
        >
          <Plus />
          {addLabel}
        </Button>
      </div>

      {lines.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-36">Amount</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  variant={variant}
                  onEdit={() =>
                    setDialogState({ open: true, mode: "edit", line })
                  }
                  onDelete={onDelete}
                  onDeleted={() => addButtonRef.current?.focus()}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LineFormDialog
        open={dialogState.open}
        onOpenChange={(o) => (o ? null : close())}
        variant={variant}
        initial={
          dialogState.open && dialogState.mode === "edit"
            ? { ...dialogState.line }
            : undefined
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function LineRow({
  line,
  variant,
  onEdit,
  onDelete,
  onDeleted,
}: {
  line: EditorLine;
  variant: LineVariant;
  onEdit: () => void;
  onDelete: (id: string) => Promise<void>;
  onDeleted: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <TableRow>
      <TableCell className="font-medium">{line.name}</TableCell>
      <TableCell>
        <Badge variant={line.kind === "recurring" ? "secondary" : "outline"}>
          {line.kind === "recurring" ? "Recurring" : "One-time"}
        </Badge>
      </TableCell>
      <TableCell className="font-mono tabular-nums">
        {formatCurrency(Number(line.monthlyAmount))}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <ScheduleSummary line={line} variant={variant} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label={`Edit ${line.name}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={() =>
              startTransition(async () => {
                try {
                  await onDelete(line.id);
                  onDeleted();
                } catch {
                  // Already reported by the caller.
                }
              })
            }
            disabled={isPending}
            aria-label={`Delete ${line.name}`}
          >
            {isPending ? <Spinner /> : <Trash2 />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ScheduleSummary({
  line,
  variant,
}: {
  line: EditorLine;
  variant: LineVariant;
}) {
  if (line.kind === "one_time") {
    return <>{line.date ? formatDay(line.date) : "—"}</>;
  }
  const day = line.dayOfMonth ?? 1;
  const start = line.startDate ?? null;
  const end = line.endDate ?? null;
  const parts: string[] = [`Day ${day}`];
  if (variant === "income") {
    if (start) parts.push(`from ${formatMonth(start)}`);
    if (end) parts.push(`until ${formatMonth(end)}`);
    if (!start && !end) parts.push("perpetual");
  } else {
    parts.push("monthly");
  }
  return <>{parts.join(" · ")}</>;
}
