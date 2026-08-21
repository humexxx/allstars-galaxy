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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
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
              <Field className="gap-2">
                <FieldLabel htmlFor="trip-title">Title</FieldLabel>
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
              </Field>

              <Field className="gap-2">
                <FieldLabel htmlFor="trip-destination">Destination</FieldLabel>
                <Input
                  id="trip-destination"
                  placeholder="Lisbon, Portugal"
                  {...register("destination", {
                    setValueAs: (v: string | null) => v?.trim() || null,
                  })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field className="gap-2">
                  <FieldLabel htmlFor="trip-start">Start</FieldLabel>
                  <Input id="trip-start" type="date" required {...register("startDate")} />
                  {errors.startDate && (
                    <p className="text-sm text-destructive">{errors.startDate.message}</p>
                  )}
                </Field>
                <Field className="gap-2">
                  <FieldLabel htmlFor="trip-end">End</FieldLabel>
                  <Input
                    id="trip-end"
                    type="date"
                    min={startDate || undefined}
                    {...register("endDate", { setValueAs: (v: string) => v || null })}
                  />
                  {errors.endDate && (
                    <p className="text-sm text-destructive">{errors.endDate.message}</p>
                  )}
                </Field>
              </div>

              <Field className="gap-2">
                <Field className="gap-2">
                  <FieldLabel htmlFor="trip-currency">Currency</FieldLabel>
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
                </Field>
              </Field>

            </div>

            <Field className="gap-2">
              <FieldLabel>Cover photo</FieldLabel>
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
            </Field>

      </div>

      {/* Full width, below the two columns: five swatches wrapped into a ragged
          3-2 block inside a half column, and a textarea is the one field that
          genuinely wants the whole dialog. Both being in the left column is
          also what made it tower over the cover photo beside it. */}
      <Field className="gap-2">
        <FieldLabel>Color</FieldLabel>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use color ${c}`}
                  onClick={() => field.onChange(c)}
                  className={`size-7 rounded-full border-2 ${
                    field.value === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        />
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor="trip-description">Notes</FieldLabel>
        <Textarea
          id="trip-description"
          placeholder="What is this trip about?"
          rows={3}
          {...register("description", {
            setValueAs: (v: string | null) => v?.trim() || null,
          })}
        />
      </Field>

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
