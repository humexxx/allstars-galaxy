"use client";

import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

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
import { Heading, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatDay, formatMonth } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/format";
import {
  groupLinesByName,
  owedStillToCome,
  type LineGroup,
  type OwedSchedule,
} from "@/lib/finance/line-groups";
import { describeRecurrence } from "@/lib/finance/recurrence-label";
import { isoDay } from "@/lib/finance/schedule";
import type { RecurrenceType } from "@/types/finance";
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
  // The recurrence model, so the Schedule column can say what it is.
  recurrenceType?: RecurrenceType;
  weekOfMonth?: number | null;
  dayOfWeek?: number | null;
  intervalMonths?: number | null;
  recurrenceStart?: string | null;
  owedToMe?: boolean;
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
  /** The reader's calendar day (UTC midnight), as the plan editor's `now`.
   *  Picks each name's current phase; without it the browser's day is used
   *  once hydrated. */
  today?: Date;
  /** The plan's anchor and overrides, so "still owed" matches net worth. */
  schedule?: OwedSchedule;
};

const subscribeNever = (): (() => void) => () => {};

function browserTodayIso(): string {
  const d = new Date();
  return isoDay(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

// The server has no reader's day to offer, so it renders without one and the
// browser fills it in after hydration instead of disagreeing with it.
function useBrowserToday(): string | null {
  return useSyncExternalStore(subscribeNever, browserTodayIso, () => null);
}

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
  today,
  schedule,
}: PlanLineEditorProps): React.JSX.Element {
  const [dialogState, setDialogState] = useState<
    | { open: false }
    | { open: true; mode: "add" }
    | { open: true; mode: "edit"; line: EditorLine }
  >({ open: false });

  // A deleted row takes its focused button with it; focus lands here instead
  // of on <body>.
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const browserToday = useBrowserToday();
  const todayIso = today ? isoDay(today) : browserToday;

  const splitOwed = variant === "income";
  const ownLines = splitOwed ? lines.filter((line) => !line.owedToMe) : lines;
  const owedLines = splitOwed ? lines.filter((line) => line.owedToMe) : [];
  const ownGroups = groupLinesByName(ownLines, todayIso);
  const owedGroups = groupLinesByName(owedLines, todayIso);

  const close = () => setDialogState({ open: false });
  const edit = (line: EditorLine): void =>
    setDialogState({ open: true, mode: "edit", line });
  const rowActions = {
    variant,
    onEdit: edit,
    onDelete,
    onDeleted: () => addButtonRef.current?.focus(),
  };

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
                {/* Phone: type and schedule ride under the name instead of
                    pushing the Schedule column off-screen. */}
                <TableHead className="hidden w-28 sm:table-cell">Type</TableHead>
                <TableHead className="text-right sm:w-36 sm:text-left">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Schedule</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ownGroups.map((group) => (
                <GroupRows key={group.key} group={group} {...rowActions} />
              ))}
            </TableBody>
            {owedLines.length > 0 && (
              <OwedSection
                groups={owedGroups}
                count={owedLines.length}
                total={
                  todayIso === null
                    ? null
                    : owedStillToCome(owedLines, todayIso, schedule)
                }
                {...rowActions}
              />
            )}
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

type RowActions = {
  variant: LineVariant;
  onEdit: (line: EditorLine) => void;
  onDelete: (id: string) => Promise<void>;
  onDeleted: () => void;
};

const disclosure =
  "flex items-start gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function Chevron({ open }: { open: boolean }): React.JSX.Element {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
        open && "rotate-90"
      )}
    />
  );
}

function KindBadge({ line }: { line: EditorLine }): React.JSX.Element {
  return (
    <Badge variant={line.kind === "recurring" ? "secondary" : "outline"}>
      {line.kind === "recurring" ? "Recurring" : "One-time"}
    </Badge>
  );
}

function GroupRows({
  group,
  ...actions
}: { group: LineGroup<EditorLine> } & RowActions): React.JSX.Element {
  const [open, setOpen] = useState(false);

  if (group.lines.length === 1) {
    return <LineRow line={group.lines[0]} {...actions} />;
  }

  const summary = groupSummary(group);
  return (
    <>
      <TableRow>
        <TableCell className="max-w-48 font-medium whitespace-normal sm:max-w-none">
          <button
            type="button"
            className={disclosure}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Chevron open={open} />
            <span className="break-words">{group.name}</span>
            <span className="sr-only">, {group.lines.length} entries</span>
          </button>
          <span className="block pl-5 text-xs font-normal text-muted-foreground sm:hidden">
            {summary}
          </span>
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          <KindBadge line={group.headline} />
        </TableCell>
        <TableCell className="text-right font-mono tabular-nums sm:text-left">
          {formatCurrency(Number(group.headline.monthlyAmount))}
        </TableCell>
        <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
          {summary}
        </TableCell>
        <TableCell />
      </TableRow>
      {open &&
        group.lines.map((line) => (
          <LineRow key={line.id} line={line} nested {...actions} />
        ))}
    </>
  );
}

function groupSummary(group: LineGroup<EditorLine>): string {
  const { lines, headline, status, from, to } = group;
  const allOneTime = lines.every((line) => line.kind === "one_time");
  const parts = [`${lines.length} ${allOneTime ? "payments" : "phases"}`];

  if (status === "upcoming") {
    parts.push(
      headline.kind === "one_time"
        ? `next ${headline.date ? formatDay(headline.date) : "—"}`
        : `starts ${headline.startDate ? formatMonth(headline.startDate) : "—"}`
    );
    if (to) parts.push(`until ${formatMonth(to)}`);
  } else if (status === "past" && to) {
    parts.push(`ended ${formatMonth(to)}`);
  } else if (from && to) {
    parts.push(`${formatMonth(from)} – ${formatMonth(to)}`);
  } else if (from) {
    parts.push(`from ${formatMonth(from)}`);
  } else if (to) {
    parts.push(`until ${formatMonth(to)}`);
  }
  return parts.join(" · ");
}

function OwedSection({
  groups,
  count,
  total,
  ...actions
}: {
  groups: LineGroup<EditorLine>[];
  count: number;
  /** Null until today is known. */
  total: number | null;
} & RowActions): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <TableBody className="border-t">
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={5} className="whitespace-normal">
          <button
            type="button"
            className={cn(disclosure, "w-full flex-wrap items-center gap-x-2")}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <Chevron open={open} />
            <span className="font-medium">Owed to you</span>
            <Text as="span" variant="small">
              {count} {count === 1 ? "entry" : "entries"}
            </Text>
            {total !== null && (
              <span className="ml-auto">
                <Mono className="font-medium">{formatCurrency(total)}</Mono>{" "}
                <Text as="span" variant="small">
                  still owed
                </Text>
              </span>
            )}
          </button>
        </TableCell>
      </TableRow>
      {open &&
        groups.map((group) => (
          <GroupRows key={group.key} group={group} {...actions} />
        ))}
    </TableBody>
  );
}

function LineRow({
  line,
  nested = false,
  variant,
  onEdit,
  onDelete,
  onDeleted,
}: { line: EditorLine; nested?: boolean } & RowActions): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const schedule = scheduleText(line, variant);
  // Phases share a name; the schedule tells their buttons apart.
  const label = nested ? `${line.name} (${schedule})` : line.name;

  return (
    <TableRow className={cn(nested && "bg-muted/30")}>
      <TableCell
        className={cn(
          "max-w-48 font-medium whitespace-normal sm:max-w-none",
          nested && "pl-7 font-normal text-muted-foreground"
        )}
      >
        <span className="block break-words">{line.name}</span>
        <span className="block text-xs font-normal text-muted-foreground sm:hidden">
          {line.kind === "recurring" ? "Recurring" : "One-time"} · {schedule}
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <KindBadge line={line} />
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums sm:text-left">
        {formatCurrency(Number(line.monthlyAmount))}
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
        {schedule}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(line)}
            aria-label={`Edit ${label}`}
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
            aria-label={`Delete ${label}`}
          >
            {isPending ? <Spinner /> : <Trash2 />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function scheduleText(line: EditorLine, variant: LineVariant): string {
  if (line.kind === "one_time") {
    return line.date ? formatDay(line.date) : "—";
  }
  const parts: string[] = [
    describeRecurrence({
      recurrenceType: line.recurrenceType ?? "monthly_day",
      dayOfMonth: line.dayOfMonth,
      weekOfMonth: line.weekOfMonth,
      dayOfWeek: line.dayOfWeek,
      intervalMonths: line.intervalMonths,
      recurrenceStart: line.recurrenceStart,
    }),
  ];
  if (variant === "income") {
    const start = line.startDate ?? null;
    const end = line.endDate ?? null;
    if (start) parts.push(`from ${formatMonth(start)}`);
    if (end) parts.push(`until ${formatMonth(end)}`);
  }
  return parts.join(" · ");
}
