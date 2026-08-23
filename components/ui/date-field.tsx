"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
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

  const showClear = clearable && Boolean(value);

  const trigger = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant={showClear ? "ghost" : "outline"}
          disabled={disabled}
          className={cn(
            // `min-w-0 flex-1`, never `w-full`: with a clear button beside it,
            // "100% of the row" is 100% plus a button, and the row overflowed
            // its dialog by exactly that button's width.
            "min-w-0 flex-1 justify-start text-left font-normal",
            showClear && "shadow-none hover:bg-transparent",
            !selected && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0" />
          <span className="truncate">
            {selected ? format(selected, "EEE, d MMM yyyy") : placeholder}
          </span>
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
  );

  if (!showClear) {
    return <div className={cn("flex min-w-0 items-center", className)}>{trigger}</div>;
  }

  // The clear button belongs INSIDE the control, not floating beside it —
  // `InputGroup` + `InputGroupAddon` is what shadcn provides for exactly this
  // and it cannot overflow the row the way a sibling button did.
  return (
    <InputGroup className={cn("min-w-0", className)} data-disabled={disabled}>
      {trigger}
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          disabled={disabled}
          onClick={() => onChange("")}
          aria-label="Clear the date"
        >
          <X />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
