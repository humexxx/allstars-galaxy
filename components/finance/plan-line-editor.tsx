"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
import { Heading, Text } from "@/components/ui/typography";
import { formatCurrency } from "@/lib/utils/format";
import {
  LineFormDialog,
  fromISODate,
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

  const close = () => setDialogState({ open: false });

  const handleSubmit = async (values: LineFormValues) => {
    if (dialogState.open === false) return;
    try {
      if (dialogState.mode === "add") {
        await onAdd(values);
      } else {
        await onUpdate(dialogState.line.id, values);
      }
    } catch {
      toast.error("Failed to save");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h5" as="h3">{title}</Heading>
          {description && <Text variant="small">{description}</Text>}
        </div>
        <Button
          size="sm"
          onClick={() => setDialogState({ open: true, mode: "add" })}
        >
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>

      {lines.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead className="w-[140px]">Amount</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="w-[80px]" />
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
}: {
  line: EditorLine;
  variant: LineVariant;
  onEdit: () => void;
  onDelete: (id: string) => Promise<void>;
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
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
            aria-label={`Edit ${line.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() =>
              startTransition(async () => {
                try {
                  await onDelete(line.id);
                } catch {
                  toast.error("Failed to delete");
                }
              })
            }
            disabled={isPending}
            aria-label={`Delete ${line.name}`}
          >
            <Trash2 className="h-4 w-4" />
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
    const d = fromISODate(line.date);
    return <>{d ? format(d, "MMM d, yyyy") : "—"}</>;
  }
  const day = line.dayOfMonth ?? 1;
  const start = fromISODate(line.startDate ?? null);
  const end = fromISODate(line.endDate ?? null);
  const parts: string[] = [`Day ${day}`];
  if (variant === "income") {
    if (start) parts.push(`from ${format(start, "MMM yyyy")}`);
    if (end) parts.push(`until ${format(end, "MMM yyyy")}`);
    if (!start && !end) parts.push("perpetual");
  } else {
    parts.push("monthly");
  }
  return <>{parts.join(" · ")}</>;
}
