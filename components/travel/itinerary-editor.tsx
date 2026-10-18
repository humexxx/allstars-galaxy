"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Mono } from "@/components/ui/typography";
import { setTripItemStopsAction } from "@/app/actions/travel";
import type { TripItemStop } from "@/types/travel";

type Draft = {
  /** Stable React key: an index key moved focus and input state onto the
   *  next row whenever one above it was removed. */
  key: string;
  dayNumber: string;
  stopOn: string;
  place: string;
  note: string;
};

const blank = (day: number): Draft => ({
  key: crypto.randomUUID(),
  dayNumber: String(day),
  stopOn: "",
  place: "",
  note: "",
});

/**
 * Edits a cruise's itinerary as a block.
 *
 * Nobody types eight ports by hand — they copy the operator's schedule. So
 * pasting it works, and typing is the fallback rather than the other way
 * round.
 */
export function ItineraryEditor({
  tripId,
  itemId,
  stops,
  onDone,
}: {
  tripId: string;
  itemId: string;
  stops: TripItemStop[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<Draft[]>(() =>
    stops.length > 0
      ? stops.map((s) => ({
          key: s.id,
          dayNumber: String(s.dayNumber),
          stopOn: s.stopOn ?? "",
          place: s.place,
          note: s.note ?? "",
        }))
      : [blank(1)]
  );

  const update = (i: number, patch: Partial<Draft>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () => {
    const filled = rows.filter((r) => r.place.trim());
    startTransition(async () => {
      const res = await setTripItemStopsAction(tripId, {
        itemId,
        stops: filled.map((r, i) => ({
          // Renumber on save: deleting day 3 of eight should not leave a gap
          // the reader has to explain to themselves.
          dayNumber: i + 1,
          stopOn: r.stopOn || null,
          place: r.place.trim(),
          note: r.note.trim() || null,
        })),
      });
      if (res.success) {
        toast.success(filled.length ? "Itinerary saved" : "Itinerary cleared");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    // The frame is a div around the fieldset, not the fieldset itself: a
    // bordered fieldset draws its legend across the top border.
    <div className="rounded-lg border bg-muted/20 p-3">
    <FieldSet className="gap-3">
      <FieldLegend variant="label" className="mb-1 text-xs">
        Itinerary
      </FieldLegend>
      <FieldDescription className="text-xs">
        One row per day. Leave a place blank to drop that row.
      </FieldDescription>

      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[3rem_11rem_1fr_1fr_2rem]">
            <Input
              aria-label={`Day number for row ${i + 1}`}
              inputMode="numeric"
              value={row.dayNumber}
              onChange={(e) => update(i, { dayNumber: e.target.value })}
              className="text-center tabular-nums"
            />
            <div>
              {/* DateField names itself through a label, not aria-label. */}
              <label htmlFor={`stop-date-${row.key}`} className="sr-only">
                Date for row {i + 1}
              </label>
              <DateField
                id={`stop-date-${row.key}`}
                value={row.stopOn}
                onChange={(day) => update(i, { stopOn: day })}
                placeholder="Date"
                clearable
              />
            </div>
            <Input
              aria-label={`Place for row ${i + 1}`}
              value={row.place}
              onChange={(e) => update(i, { place: e.target.value })}
              placeholder="Cozumel, Mexico"
            />
            <Input
              aria-label={`Note for row ${i + 1}`}
              value={row.note}
              onChange={(e) => update(i, { note: e.target.value })}
              placeholder="Docked 8:00 AM – 6:00 PM"
            />
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="self-center text-destructive"
              aria-label={`Remove row ${i + 1}`}
              disabled={rows.length === 1}
              onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            setRows((prev) =>
              // After the highest day present, not `length + 1`: deleting
              // day 2 of four and adding one produced a second "day 4".
              [...prev, blank(Math.max(0, ...prev.map((r) => Number(r.dayNumber) || 0)) + 1)]
            )
          }
        >
          <Plus /> Add day
        </Button>
        <div className="flex items-center gap-2">
          <Mono className="text-2xs text-muted-foreground">
            {rows.filter((r) => r.place.trim()).length} stops
          </Mono>
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={isPending}>
            {isPending && <Spinner />}
            {isPending ? "Saving…" : "Save itinerary"}
          </Button>
        </div>
      </div>
    </FieldSet>
    </div>
  );
}
