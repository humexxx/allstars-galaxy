"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { createRoadPathAction } from "@/app/actions/road-path";
import { createRoadPathSchema, type CreateRoadPathInput } from "@/schemas/road-path";
import { toast } from "sonner";
import type { RoadPathFrequency } from "@/types";

type CreateRoadPathDialogProps = {
  /** Extra work after a successful create. The refresh is handled here. */
  onSuccess?: () => void;
  children?: React.ReactNode;
};

/**
 * The message under a field.
 *
 * Every field gets one. Only `title` used to have it, so leaving Target Value
 * empty failed the schema and the form simply refused to submit — no message,
 * no toast, no closed dialog. Nothing on screen said what was wrong.
 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

/** Today as YYYY-MM-DD, in the user's own zone. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function CreateRoadPathDialog({ onSuccess, children }: CreateRoadPathDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    reset,
  } = useForm<CreateRoadPathInput>({
    resolver: zodResolver(createRoadPathSchema),
    defaultValues: {
      createFirstTask: true,
      // The schema requires a start date. Leaving the field empty used to send
      // `new Date("")` — an Invalid Date the transform happily produced and
      // nothing downstream rejected until the insert.
      startDate: today(),
    },
  });

  const autoCreateTasks = useWatch({ control, name: "autoCreateTasks" });
  const taskFrequency = useWatch({ control, name: "taskFrequency" });

  const onSubmit = async (data: CreateRoadPathInput) => {
    try {
      // The action reports failure in its return value, not by throwing. The
      // old code awaited it and announced success either way, so a rejected
      // road path closed the dialog with a green toast and saved nothing.
      const result = await createRoadPathAction(data);
      if (!result.success) {
        toast.error(result.error ?? "Failed to create road path");
        return;
      }
      toast.success("Road path created");
      setOpen(false);
      reset({ createFirstTask: true, startDate: today() });
      router.refresh();
      onSuccess?.();
    } catch {
      toast.error("Failed to create road path");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || <Button>Create Road Path</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Road Path</DialogTitle>
          <DialogDescription>
            Set up a long-term goal with measurable progress
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Learn Spanish"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your goal..."
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="targetValue">Target Value</Label>
              <Input
                id="targetValue"
                type="number"
                inputMode="decimal"
                placeholder="100"
                // An empty number input reads as NaN, and the schema rejects
                // that — so "no target" has to become undefined, not NaN.
                {...register("targetValue", {
                  setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
                })}
              />
              <FieldError message={errors.targetValue?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="hours, lessons, etc."
                {...register("unit")}
              />
              <FieldError message={errors.unit?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <DateField
                    id="startDate"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={field.onChange}
                    placeholder="Pick a start day"
                  />
                )}
              />
              <FieldError message={errors.startDate?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetDate">Target Date</Label>
              <Controller
                control={control}
                name="targetDate"
                render={({ field }) => (
                  <DateField
                    id="targetDate"
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={(day) => field.onChange(day || null)}
                    placeholder="No deadline"
                    clearable
                  />
                )}
              />
              <FieldError message={errors.targetDate?.message} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoCreateTasks"
                checked={autoCreateTasks}
                onCheckedChange={(checked) => setValue("autoCreateTasks", checked as boolean)}
              />
              <Label htmlFor="autoCreateTasks" className="cursor-pointer">
                Automatically create tasks on schedule
              </Label>
            </div>

            {autoCreateTasks && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Task Creation Frequency</Label>
                  <Select onValueChange={(value) => setValue("taskFrequency", value as RoadPathFrequency)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="every_other_day">Every Other Day</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.taskFrequency?.message} />
                  <Text variant="small">
                    Tasks will be created automatically at the start of each day based on this frequency
                  </Text>
                </div>

                {taskFrequency && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createFirstTask"
                      defaultChecked={true}
                      onCheckedChange={(checked) => setValue("createFirstTask", checked as boolean)}
                    />
                    <Label htmlFor="createFirstTask" className="cursor-pointer">
                      Create first task immediately
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Road Path"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
