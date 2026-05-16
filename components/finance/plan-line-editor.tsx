"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

type LineLike = {
  id: string;
  name: string;
  monthlyAmount: string;
};

type PlanLineEditorProps = {
  title: string;
  description?: string;
  emptyLabel: string;
  lines: LineLike[];
  addLabel?: string;
  onAdd: (input: { name: string; monthlyAmount: string }) => Promise<void>;
  onUpdate: (
    id: string,
    input: { name: string; monthlyAmount: string }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function PlanLineEditor({
  title,
  description,
  emptyLabel,
  lines,
  addLabel = "Add row",
  onAdd,
  onUpdate,
  onDelete,
}: PlanLineEditorProps) {
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await onAdd({ name, monthlyAmount: draftAmount.trim() || "0" });
        setDraftName("");
        setDraftAmount("");
      } catch {
        toast.error("Failed to add row");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-[180px]">Monthly amount</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        <Input
          placeholder="Name (e.g. Trabajo 2)"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          className="max-w-xs"
          aria-label="New row name"
        />
        <Input
          placeholder="Amount"
          inputMode="decimal"
          value={draftAmount}
          onChange={(e) => setDraftAmount(e.target.value)}
          className="max-w-[180px]"
          aria-label="New row monthly amount"
        />
        <Button
          onClick={handleAdd}
          disabled={isPending || draftName.trim().length === 0}
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function LineRow({
  line,
  onUpdate,
  onDelete,
}: {
  line: LineLike;
  onUpdate: PlanLineEditorProps["onUpdate"];
  onDelete: PlanLineEditorProps["onDelete"];
}) {
  const [name, setName] = useState(line.name);
  const [amount, setAmount] = useState(line.monthlyAmount);
  const [isPending, startTransition] = useTransition();

  const commit = () => {
    if (name === line.name && amount === line.monthlyAmount) return;
    startTransition(async () => {
      try {
        await onUpdate(line.id, { name: name.trim(), monthlyAmount: amount.trim() || "0" });
      } catch {
        toast.error("Failed to save");
        setName(line.name);
        setAmount(line.monthlyAmount);
      }
    });
  };

  return (
    <TableRow>
      <TableCell>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={commit}
          inputMode="decimal"
          disabled={isPending}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  );
}
