"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/typography";
import { setPlanColorAction } from "@/app/actions/finance-plans";
import type { FinancePlan } from "@/types/finance";
import { cn } from "@/lib/utils";

/**
 * The theme palette. Kept in sync with `planColorSchema`, which only accepts
 * these tokens or a 6-digit hex — the value ends up in a `style` attribute and
 * an SVG `stroke`, so arbitrary CSS is rejected server-side.
 */
const PRESETS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The plan's colour swatch in the workspace rail, doubling as its colour
 * picker: presets for the theme palette, plus a native colour input for
 * anything else.
 */
export function PlanColorPicker({
  plan,
  pinned,
  onChanged,
}: {
  plan: FinancePlan;
  /** Draws the pinned-highlight ring; the pin itself lives in the row menu. */
  pinned: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isSaving, startSave] = useTransition();
  // Optimistic overlay: the swatch and the chart line repaint on click rather
  // than after the round-trip. Derived (not an effect syncing state to props)
  // so the React Compiler lint stays happy. Only cleared on failure — on
  // success the refresh makes `plan.color` the same value anyway, and this
  // component is the only writer.
  const [pending, setPending] = useState<string | null>(null);
  const colour = pending ?? plan.color;

  const save = (next: string) => {
    setPending(next);
    startSave(async () => {
      const result = await setPlanColorAction({ id: plan.id, color: next });
      if (result.success) {
        onChanged();
      } else {
        setPending(null);
        toast.error(result.error);
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Colour for ${plan.name}`}
        // -m-2 p-2 keeps the dot visually 12px while giving it a 28px tap
        // target. The ring lives on the inner span so it hugs the dot rather
        // than the padded hit area.
        className="group -m-2 shrink-0 rounded-full p-2 disabled:opacity-50"
        disabled={isSaving}
      >
        {/* The hover scale has to live on the INNER span. Radix anchors the
            popover to the trigger's bounding rect, and a transform changes it —
            scaling the button itself made the open menu jump as the pointer
            entered. A transform on a child leaves the parent's box alone. */}
        <span
          className={cn(
            "block size-3 rounded-full transition-transform group-hover:scale-125",
            pinned &&
              "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background"
          )}
          style={{ backgroundColor: colour }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="grid gap-3">
          <Text variant="small" className="text-muted-foreground">
            Line colour
          </Text>
          <div className="flex items-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => save(preset)}
                aria-label={`Use ${preset}`}
                aria-pressed={colour === preset}
                className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: preset }}
              >
                {colour === preset && (
                  <Check className="size-4 text-background" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 border-t pt-3">
            <input
              type="color"
              // A native colour input always emits #rrggbb, which is exactly
              // what the schema accepts — no parsing needed.
              value={HEX.test(colour) ? colour : "#3b82f6"}
              onChange={(e) => save(e.target.value)}
              className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
            <Text variant="small">Custom…</Text>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
