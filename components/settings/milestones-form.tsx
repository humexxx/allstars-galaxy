"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mono, Text } from "@/components/ui/typography";
import { SettingRow } from "@/components/settings/settings-shell";
import { DEFAULT_FINANCE_MILESTONES } from "@/lib/finance/milestones";
import { MAX_MILESTONES } from "@/schemas/user-preferences";
import { setFinanceMilestonesAction } from "@/app/actions/user-preferences";

/** Compact display for a milestone chip: 0, 10k, 250k, 1M, 1.5M. */
function format(v: number): string {
  if (v === 0) return "0";
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m % 1 < 0.05 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (v >= 1_000) {
    const k = v / 1_000;
    return `${k % 1 < 0.05 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(Math.round(v));
}

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
  const router = useRouter();
  const [values, setValues] = useState<number[]>(milestones);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  const save = (next: number[]) => {
    const previous = values;
    setValues(next);
    startSave(async () => {
      const result = await setFinanceMilestonesAction({ milestones: next });
      if (result.success) {
        router.refresh();
      } else {
        setValues(previous);
        toast.error(result.error);
      }
    });
  };

  const add = () => {
    const parsed = parseAmount(draft);
    if (parsed === null) {
      setError("Use a number — 250k and 1.5M work too.");
      return;
    }
    if (values.includes(parsed)) {
      setError(`${format(parsed)} is already on the list.`);
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
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {values.length === 0 && (
            <Text variant="small" className="text-muted-foreground">
              No milestones — the charts will show no reference lines.
            </Text>
          )}
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/30 py-1 pr-1 pl-2.5 text-sm"
            >
              <Mono className="tabular-nums">{format(v)}</Mono>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${format(v)}`}
                disabled={isSaving}
                onClick={() => save(values.filter((x) => x !== v))}
              >
                <X className="size-3.5" />
              </Button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-2">
          <div className="grid gap-1">
            <Input
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
              className="w-40"
              inputMode="decimal"
            />
            {error && (
              <Text variant="small" className="text-destructive">
                {error}
              </Text>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={isSaving || draft.trim().length === 0}
          >
            <Plus className="mr-1 size-4" />
            Add
          </Button>
          {!isDefault && (
            <Button
              type="button"
              variant="ghost"
              disabled={isSaving}
              onClick={() => save([...DEFAULT_FINANCE_MILESTONES])}
            >
              <RotateCcw className="mr-1 size-4" />
              Reset
            </Button>
          )}
        </div>

        <Text variant="small" className="text-muted-foreground">
          Labels sit on one row and none are hidden, so a long list will start
          to overlap on the chart. {MAX_MILESTONES} is the cap.
        </Text>
      </div>
    </SettingRow>
  );
}
