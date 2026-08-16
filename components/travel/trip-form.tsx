"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createTripAction, updateTripAction } from "@/app/actions/travel";
import { createTripSchema, type CreateTripInput } from "@/schemas/travel";
import type { Trip } from "@/types/travel";

import { PhotoPicker } from "./photo-picker";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type TripFormValues = z.input<typeof createTripSchema>;

function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function TripForm({ trip }: { trip?: Trip }): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Only honour ?startDate= when creating — on edit the trip's own startDate is
  // the source of truth and a stale URL param shouldn't overwrite it.
  const seedStartDate = trip?.startDate ?? searchParams.get("startDate") ?? todayIso();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TripFormValues, unknown, CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      title: trip?.title ?? "",
      destination: trip?.destination ?? null,
      description: trip?.description ?? null,
      startDate: seedStartDate,
      endDate: trip?.endDate ?? null,
      coverPhotoUrl: trip?.coverPhotoUrl ?? null,
      currency: trip?.currency ?? "USD",
      color: trip?.color ?? COLORS[0],
    },
  });

  const startDate = useWatch({ control, name: "startDate" });

  const onSubmit = (values: CreateTripInput): void => {
    startTransition(async () => {
      const result = trip
        ? await updateTripAction({ id: trip.id, ...values })
        : await createTripAction(values);

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trip-title">Title</Label>
                <Input
                  id="trip-title"
                  placeholder="Summer in Lisbon"
                  required
                  autoFocus
                  {...register("title", {
                    setValueAs: (v: string | null) => v?.trim() ?? "",
                  })}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="trip-destination">Destination</Label>
                <Input
                  id="trip-destination"
                  placeholder="Lisbon, Portugal"
                  {...register("destination", {
                    setValueAs: (v: string | null) => v?.trim() || null,
                  })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="trip-start">Start</Label>
                  <Input id="trip-start" type="date" required {...register("startDate")} />
                  {errors.startDate && (
                    <p className="text-sm text-destructive">{errors.startDate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trip-end">End</Label>
                  <Input
                    id="trip-end"
                    type="date"
                    min={startDate || undefined}
                    {...register("endDate", { setValueAs: (v: string) => v || null })}
                  />
                  {errors.endDate && (
                    <p className="text-sm text-destructive">{errors.endDate.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="trip-currency">Currency</Label>
                  <Input
                    id="trip-currency"
                    maxLength={3}
                    placeholder="USD"
                    className="uppercase"
                    {...register("currency", {
                      setValueAs: (v: string | null) =>
                        v?.trim().toUpperCase() || "USD",
                    })}
                  />
                  {errors.currency && (
                    <p className="text-sm text-destructive">{errors.currency.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Controller
                    control={control}
                    name="color"
                    render={({ field }) => (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Use color ${c}`}
                            onClick={() => field.onChange(c)}
                            className={`h-7 w-7 rounded-full border-2 ${
                              field.value === c ? "border-foreground" : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trip-description">Notes</Label>
                <Textarea
                  id="trip-description"
                  placeholder="What is this trip about?"
                  rows={3}
                  {...register("description", {
                    setValueAs: (v: string | null) => v?.trim() || null,
                  })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover photo</Label>
              <Controller
                control={control}
                name="coverPhotoUrl"
                render={({ field }) => (
                  <PhotoPicker
                    folder={trip?.id ?? "covers"}
                    previewUrl={field.value ?? null}
                    onPick={(r) => field.onChange(r.url)}
                    onClear={() => field.onChange(null)}
                  />
                )}
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
