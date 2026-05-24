"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createTripAction, updateTripAction } from "@/app/actions/travel";
import type { Trip } from "@/types/travel";

import { PhotoPicker } from "./photo-picker";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function TripForm({ trip }: { trip?: Trip }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Only honour ?startDate= when creating — on edit the trip's own startDate is
  // the source of truth and a stale URL param shouldn't overwrite it.
  const seedStartDate = trip?.startDate ?? searchParams.get("startDate") ?? todayIso();

  const [title, setTitle] = useState(trip?.title ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [description, setDescription] = useState(trip?.description ?? "");
  const [startDate, setStartDate] = useState(seedStartDate);
  const [endDate, setEndDate] = useState(trip?.endDate ?? "");
  const [currency, setCurrency] = useState(trip?.currency ?? "USD");
  const [color, setColor] = useState(trip?.color ?? COLORS[0]);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(
    trip?.coverPhotoUrl ?? null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Trip needs a title");
      return;
    }
    if (!startDate) {
      toast.error("Pick a start date");
      return;
    }
    if (endDate && endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        destination: destination.trim() || null,
        description: description.trim() || null,
        startDate,
        endDate: endDate || null,
        coverPhotoUrl,
        currency: currency.trim().toUpperCase() || "USD",
        color,
      };

      const result = trip
        ? await updateTripAction({ id: trip.id, ...payload })
        : await createTripAction(payload);

      if (result.success) {
        toast.success(trip ? "Trip saved" : "Trip created");
        router.push(`/portal/entertainment/travel-planner/${result.data!.id}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trip-title">Title</Label>
                <Input
                  id="trip-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summer in Lisbon"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trip-destination">Destination</Label>
                <Input
                  id="trip-destination"
                  value={destination ?? ""}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Lisbon, Portugal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="trip-start">Start</Label>
                  <Input
                    id="trip-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trip-end">End</Label>
                  <Input
                    id="trip-end"
                    type="date"
                    value={endDate ?? ""}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="trip-currency">Currency</Label>
                  <Input
                    id="trip-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="USD"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Use color ${c}`}
                        onClick={() => setColor(c)}
                        className={`h-7 w-7 rounded-full border-2 ${
                          color === c ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trip-description">Notes</Label>
                <Textarea
                  id="trip-description"
                  value={description ?? ""}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this trip about?"
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover photo</Label>
              <PhotoPicker
                folder={trip?.id ?? "covers"}
                previewUrl={coverPhotoUrl}
                onPick={(r) => setCoverPhotoUrl(r.url)}
                onClear={() => setCoverPhotoUrl(null)}
              />
            </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : trip ? "Save changes" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}
