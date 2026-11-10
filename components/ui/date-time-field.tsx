"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarClock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const pad = (n: number): string => String(n).padStart(2, "0");

/** A moment as this field holds it: `YYYY-MM-DDTHH:mm` on the browser's clock. */
export function toLocalDateTime(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parse(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}

type TimePart = "hour" | "minute";
type Period = "AM" | "PM";

/** The time of day under the calendar: hour and minute typed or stepped with the arrow keys, and AM or PM. */
function TimeFields({
  time,
  onChange,
}: {
  /** Null until a day is picked: there is no moment to set the time of yet. */
  time: { hour: number; minute: number } | null;
  onChange: (hour: number, minute: number) => void;
}): React.ReactElement {
  // What is being typed, which may not be a time yet ("0" on the way to "05").
  const [draft, setDraft] = useState<{ part: TimePart; text: string } | null>(null);
  const hour = time?.hour ?? 0;
  const minute = time?.minute ?? 0;
  const period: Period = hour < 12 ? "AM" : "PM";
  const shown: Record<TimePart, number> = { hour: hour % 12 || 12, minute };

  const type = (part: TimePart, raw: string): void => {
    const text = raw.replace(/\D/g, "").slice(-2);
    setDraft({ part, text });
    if (text === "") return;
    const n = Number(text);
    if (part === "hour" && n >= 1 && n <= 12) onChange((n % 12) + (period === "PM" ? 12 : 0), minute);
    if (part === "minute" && n <= 59) onChange(hour, n);
  };
  const step = (part: TimePart, by: number): void => {
    setDraft(null);
    if (part === "hour") onChange((hour + by + 24) % 24, minute);
    else onChange(hour, (minute + by + 60) % 60);
  };

  const field = (part: TimePart, label: string): React.ReactElement => (
    <Input
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      disabled={!time}
      placeholder="--"
      value={draft?.part === part ? draft.text : time ? pad(shown[part]) : ""}
      onChange={(e) => type(part, e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        step(part, e.key === "ArrowUp" ? 1 : -1);
      }}
      className="w-11 px-0 text-center font-mono tabular-nums"
    />
  );

  return (
    <fieldset className="flex items-center justify-between gap-2 border-t p-3">
      <legend className="sr-only">Time</legend>
      <div className="flex items-center gap-1">
        {field("hour", "Hour")}
        <span aria-hidden className="font-mono text-muted-foreground">
          :
        </span>
        {field("minute", "Minute")}
      </div>
      <ToggleGroup
        type="single"
        value={time ? period : ""}
        onValueChange={(next) => {
          if (next && next !== period) onChange((hour + 12) % 24, minute);
        }}
        disabled={!time}
        aria-label="AM or PM"
      >
        <ToggleGroupItem value="AM">AM</ToggleGroupItem>
        <ToggleGroupItem value="PM">PM</ToggleGroupItem>
      </ToggleGroup>
    </fieldset>
  );
}

/**
 * A day and a time of day, chosen from the app's calendar with a time row
 * under it. The native `datetime-local` picker is the browser's own: its
 * calendar and its scrolling columns match nothing else on the page, and each
 * browser draws a different one.
 *
 * Values are `YYYY-MM-DDTHH:mm` strings on the browser's clock — what a
 * `datetime-local` input holds — and "" while nothing is picked. Picking a day
 * first gives it the time it is now.
 */
export function DateTimeField({
  id,
  value,
  onChange,
  placeholder = "Pick a day and time",
  min,
  clearable = false,
  clearLabel = "Clear the date and time",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable day: a value of this field, or a plain YYYY-MM-DD. */
  min?: string;
  clearable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
}): React.ReactElement {
  const selected = parse(value);
  const floor = min ? parse(min.slice(0, 10)) : undefined;

  const pickDay = (day: Date): void => {
    const time = selected ?? new Date();
    onChange(
      toLocalDateTime(new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes()))
    );
  };
  const pickTime = (hour: number, minute: number): void => {
    if (!selected) return;
    onChange(
      toLocalDateTime(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), hour, minute))
    );
  };

  const trigger = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant={clearable ? "ghost" : "outline"}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            "min-w-0 flex-1 justify-start text-left font-normal",
            clearable && "shadow-none hover:bg-transparent",
            !selected && "text-muted-foreground"
          )}
        >
          <CalendarClock className="shrink-0" />
          <span className="truncate">{selected ? format(selected, "d MMM yyyy, h:mm a") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? floor}
          onSelect={(d) => d && pickDay(d)}
          disabled={floor ? (d) => d < floor : undefined}
          autoFocus
        />
        <TimeFields
          time={selected ? { hour: selected.getHours(), minute: selected.getMinutes() } : null}
          onChange={pickTime}
        />
      </PopoverContent>
    </Popover>
  );

  if (!clearable) {
    return <div className={cn("flex min-w-0 items-center", className)}>{trigger}</div>;
  }

  // The same wrapper with and without a value: swapping it for another one
  // remounts the popover, which closed it on the first day picked — before
  // the time under the calendar could be set.
  return (
    <InputGroup className={cn("min-w-0", className)} data-disabled={disabled}>
      {trigger}
      {selected && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" disabled={disabled} onClick={() => onChange("")} aria-label={clearLabel}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
