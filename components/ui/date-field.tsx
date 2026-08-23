"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A day, chosen from a calendar rather than typed into a native date input.
 *
 * The native control renders differently in every browser, shows the day in
 * whatever order the OS locale prefers, and gives no view of the month around
 * the date — which is exactly what somebody arranging a trip is looking at.
 *
 * Values are plain `YYYY-MM-DD` strings, never `Date`s: every date in Travel
 * is a calendar day with no time and no zone, and the moment one becomes a
 * `Date` somebody west of Greenwich gets yesterday.
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder = "Pick a day",
  min,
  clearable = false,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (day: string) => void;
  placeholder?: string;
  /** Earliest selectable day, as YYYY-MM-DD. */
  min?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const parse = (day: string): Date | undefined => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const toDay = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const selected = parse(value);
  const floor = min ? parse(min) : undefined;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 size-4" />
            {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? floor}
            onSelect={(d) => d && onChange(toDay(d))}
            disabled={floor ? (d) => d < floor : undefined}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-9 shrink-0 sm:size-8"
          onClick={() => onChange("")}
          aria-label="Clear the date"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
