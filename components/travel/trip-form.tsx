"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createTripAction, updateTripAction } from "@/app/actions/travel";
import {
  createTripSchema,
  type CreateTripData,
  type CreateTripInput,
} from "@/schemas/travel";
import type { Trip } from "@/types/travel";

import { PhotoPicker } from "./photo-picker";

const TRIP_LIST_PATH = "/portal/entertainment/travel-planner";

/** Categorical slots, in order — see "Chart colours" in CLAUDE.md. */
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

export function TripForm({
  trip,
  onCancel,
  onSaved,
}: {
  trip?: Trip;
  /**
   * Inside the edit dialog, Cancel closes the dialog. Without it (the "new
   * trip" page) Cancel goes back to the list — `router.back()` left the app
   * altogether for anybody who opened the page from a link.
   */
  onCancel?: () => void;
  /**
   * Called after an edit saves. The dialog has to close itself: the action's
   * revalidation re-renders the trip page in place, and pushing to the same
   * URL never remounted it, so the dialog used to sit open over the result.
   */
  onSaved?: () => void;
}): React.ReactElement {
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
  } = useForm<CreateTripInput, unknown, CreateTripData>({
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

  const onSubmit = (values: CreateTripData): void => {
    startTransition(async () => {
      if (trip) {
        const result = await updateTripAction({ id: trip.id, ...values });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Trip saved");
        onSaved?.();
        return;
      }

      const result = await createTripAction(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Trip created");
      router.push(`${TRIP_LIST_PATH}/${result.data.id}`);
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field className="gap-2" data-invalid={!!errors.title}>
            <FieldLabel htmlFor="trip-title">Title</FieldLabel>
            <Input
              id="trip-title"
              placeholder="Summer in Lisbon"
              required
              autoFocus
              aria-invalid={!!errors.title}
              {...register("title", {
                setValueAs: (v: string | null) => v?.trim() ?? "",
              })}
            />
            <FieldError errors={[errors.title]} />
          </Field>

          <Field className="gap-2" data-invalid={!!errors.destination}>
            <FieldLabel htmlFor="trip-destination">Destination</FieldLabel>
            <Input
              id="trip-destination"
              placeholder="Lisbon, Portugal"
              aria-invalid={!!errors.destination}
              {...register("destination", {
                setValueAs: (v: string | null) => v?.trim() || null,
              })}
            />
            <FieldError errors={[errors.destination]} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="gap-2" data-invalid={!!errors.startDate}>
              <FieldLabel htmlFor="trip-start">Start</FieldLabel>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DateField
                    id="trip-start"
                    value={field.value}
                    onChange={field.onChange}
                    aria-invalid={!!errors.startDate}
                  />
                )}
              />
              <FieldError errors={[errors.startDate]} />
            </Field>
            <Field className="gap-2" data-invalid={!!errors.endDate}>
              <FieldLabel htmlFor="trip-end">End</FieldLabel>
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <DateField
                    id="trip-end"
                    value={field.value ?? ""}
                    onChange={(day) => field.onChange(day || null)}
                    min={startDate || undefined}
                    placeholder="Same day"
                    clearable
                    aria-invalid={!!errors.endDate}
                  />
                )}
              />
              <FieldError errors={[errors.endDate]} />
            </Field>
          </div>

          <Field className="gap-2" data-invalid={!!errors.currency}>
            <FieldLabel htmlFor="trip-currency">Currency</FieldLabel>
            <Input
              id="trip-currency"
              maxLength={3}
              placeholder="USD"
              className="uppercase"
              aria-invalid={!!errors.currency}
              {...register("currency", {
                setValueAs: (v: string | null) => v?.trim().toUpperCase() || "USD",
              })}
            />
            <FieldError errors={[errors.currency]} />
          </Field>
        </div>

        {/* A fieldset, not a label: the picker is several controls (tabs, a
            link box, an upload button), and a <label> can name only one. */}
        <FieldSet className="gap-2">
          <FieldLegend variant="label" className="mb-2">
            Cover photo
          </FieldLegend>
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
          <FieldError errors={[errors.coverPhotoUrl]} />
        </FieldSet>
      </div>

      {/* Full width, below the two columns: five swatches wrapped into a ragged
          3-2 block inside a half column, and a textarea is the one field that
          genuinely wants the whole dialog. Both being in the left column is
          also what made it tower over the cover photo beside it. */}
      <FieldSet className="gap-2">
        <FieldLegend variant="label" className="mb-2">
          Color
        </FieldLegend>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            // A single-select group, so the chosen swatch is announced as
            // checked rather than shown by its ring alone.
            <ToggleGroup
              type="single"
              variant="outline"
              value={field.value}
              onValueChange={(v) => v && field.onChange(v)}
              className="gap-2"
            >
              {COLORS.map((c, i) => (
                <ToggleGroupItem
                  key={c}
                  value={c}
                  aria-label={`Color ${i + 1}`}
                  className="size-7 min-w-0 flex-none rounded-full border-2 border-transparent p-0 shadow-none data-[state=on]:border-foreground"
                  // The swatch IS the value; a token class per slot would
                  // have to be kept in step with COLORS by hand.
                  style={{ backgroundColor: c }}
                />
              ))}
            </ToggleGroup>
          )}
        />
      </FieldSet>

      <Field className="gap-2" data-invalid={!!errors.description}>
        <FieldLabel htmlFor="trip-description">Notes</FieldLabel>
        <Textarea
          id="trip-description"
          placeholder="What is this trip about?"
          rows={3}
          aria-invalid={!!errors.description}
          {...register("description", {
            setValueAs: (v: string | null) => v?.trim() || null,
          })}
        />
        <FieldError errors={[errors.description]} />
      </Field>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel ?? (() => router.push(TRIP_LIST_PATH))}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner />}
          {isPending ? "Saving…" : trip ? "Save changes" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}
