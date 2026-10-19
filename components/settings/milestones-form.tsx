"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { formatCurrencyCompact } from "@/lib/utils/format";
import { SettingRow } from "@/components/settings/settings-shell";
import { DEFAULT_FINANCE_MILESTONES } from "@/lib/finance/milestones";
import { MAX_MILESTONES } from "@/schemas/user-preferences";
import { setFinanceMilestonesAction } from "@/app/actions/user-preferences";

/**
 * Accepts what people actually type for money: "250k", "1.5M", "100,000",
 * "$50 000". Returns null when it isn't a number at all.
 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const match = /^(\d+(?:\.\d+)?)([km])?$/.exec(cleaned);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const scale = match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
  return n * scale;
}

export function FinanceSettings({ milestones }: { milestones: number[] }) {
  const [values, setValues] = useState<number[]>(milestones);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const save = (next: number[]): void => {
    const previous = values;
    setValues(next);
    startSave(async () => {
      // No refresh on success: the action revalidates the pages that read it.
      const result = await setFinanceMilestonesAction({ milestones: next }).catch(
        () => ({ success: false as const, error: "Failed to save milestones" })
      );
      if (!result.success) {
        setValues(previous);
        toast.error(result.error);
      }
    });
  };

  const remove = (value: number): void => {
    save(values.filter((x) => x !== value));
    // The chip and its button are gone; keep focus in the editor.
    inputRef.current?.focus();
  };

  const add = (): void => {
    const parsed = parseAmount(draft);
    if (parsed === null) {
      setError("Use a number — 250k and 1.5M work too.");
      return;
    }
    if (values.includes(parsed)) {
      setError(`${formatCurrencyCompact(parsed)} is already on the list.`);
      return;
    }
    if (values.length >= MAX_MILESTONES) {
      setError(`That's the limit (${MAX_MILESTONES}). Remove one first.`);
      return;
    }
    setError(null);
    setDraft("");
    save([...values, parsed].sort((a, b) => a - b));
  };

  const isDefault =
    values.length === DEFAULT_FINANCE_MILESTONES.length &&
    values.every((v, i) => v === DEFAULT_FINANCE_MILESTONES[i]);

  return (
    <SettingRow
      label="Net-worth milestones"
      description="Marked on every plan's projection chart, so you can see when the line crosses them. Applies to all your plans."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {values.length === 0 && (
            <EmptyState
              title="No milestones"
              description="The charts will show no reference lines."
              className="w-full p-6"
            />
          )}
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-lg border bg-muted/30 py-1 pr-1 pl-2.5 text-sm"
            >
              <Mono className="tabular-nums">{formatCurrencyCompact(v)}</Mono>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${formatCurrencyCompact(v)}`}
                disabled={isSaving}
                onClick={() => remove(v)}
              >
                <X />
              </Button>
            </span>
          ))}
        </div>

        {/* The error runs under the whole row: inside the 160px field it
            broke "Use a number — 250k and 1.5M work too." over three lines. */}
        <Field data-invalid={error !== null} className="gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="e.g. 250k"
              aria-label="New milestone"
              aria-invalid={error !== null}
              aria-describedby={error ? "milestone-error" : undefined}
              inputMode="decimal"
              className="w-40"
            />
            <Button
              type="button"
              variant="outline"
              onClick={add}
              disabled={isSaving || draft.trim().length === 0}
            >
              {isSaving ? <Spinner /> : <Plus />}
              Add
            </Button>
            {!isDefault && (
              <Button
                type="button"
                variant="ghost"
                disabled={isSaving}
                onClick={() => save([...DEFAULT_FINANCE_MILESTONES])}
              >
                <RotateCcw />
                Reset
              </Button>
            )}
          </div>
          <FieldError id="milestone-error">{error}</FieldError>
        </Field>

        <Text variant="small">
          Labels sit on one row and none are hidden, so a long list will start
          to overlap on the chart. {MAX_MILESTONES} is the cap.
        </Text>
      </div>
    </SettingRow>
  );
}
