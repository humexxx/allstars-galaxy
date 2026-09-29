"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { searchAirportsAction } from "@/app/actions/airports";
import type { Airport } from "@/lib/travel/airports";
import { cn } from "@/lib/utils";

/**
 * Airport field: type a code, a city or a name and pick from the matches.
 *
 * Whatever is typed IS the value — suggestions only fill it in faster. A small
 * airfield, a bus terminal, "Grandma's house": the field must accept it,
 * because a picker that refuses what the traveller actually meant is worse
 * than a plain text box. So every keystroke in the search box is committed,
 * and closing the list keeps it.
 *
 * Popover + Command, the combobox `UserSelector` uses, rather than a
 * hand-rolled list: the roles, the active-option tracking and the arrow keys
 * all come with it.
 *
 * Search runs on the server. The dataset is ~7,900 airports and shipping it to
 * the browser would cost 115 KB gzipped for one form field.
 */
export function AirportPicker({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  /** The airport last chosen from the list, so the field can show its flag. */
  const [picked, setPicked] = useState<Airport | null>(null);

  const query = value.trim();
  // Derived rather than cleared through state: a short query has no results by
  // definition, and setting state for it inside the effect would cascade a
  // render on every keystroke.
  const visible = query.length < 2 ? [] : results;

  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < 2) return;
    // Debounced: a request per keystroke would fire five times for "MCO  " and
    // land out of order.
    let cancelled = false;
    const timer = setTimeout(async () => {
      // Loading starts when the request does, not when typing does: a spinner
      // during the debounce flickers on and off for anyone typing at speed.
      setLoading(true);
      try {
        const res = await searchAirportsAction(q);
        if (!cancelled) setResults(res.success ? res.data : []);
      } catch {
        // A failed lookup is a picker with no suggestions, not a stuck spinner:
        // the typed value is still the value.
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [value, open]);

  const pick = (airport: Airport) => {
    onChange(airport.code);
    setPicked(airport);
    setOpen(false);
  };

  const flag = picked && picked.code === value ? picked.flag : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {/* The flag confirms the pick without spending a row on it. */}
            {flag && <span className="text-sm leading-none">{flag}</span>}
            <ChevronsUpDown className="opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        {/* Filtering happens on the server, so cmdk must not filter again. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={value}
            onValueChange={onChange}
            placeholder="Code, city or airport"
          />
          <CommandList>
            {loading && visible.length === 0 ? (
              <div className="flex justify-center py-6">
                <Spinner className="text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>
                {query.length < 2
                  ? "Type two letters to search."
                  : "No airport matches — what you typed is kept."}
              </CommandEmpty>
            )}
            {visible.length > 0 && (
              <CommandGroup>
                {visible.map((a) => (
                  <CommandItem
                    key={a.code}
                    value={a.code}
                    data-checked={a.code.toLowerCase() === query.toLowerCase()}
                    onSelect={() => pick(a)}
                  >
                    <span className="text-base leading-none">{a.flag}</span>
                    <Mono className="w-10 shrink-0 text-xs font-semibold">{a.code}</Mono>
                    <span className="min-w-0 flex-1">
                      <Text as="span" className="block truncate text-xs">
                        {a.city || a.name}
                      </Text>
                      {a.city && (
                        <Text as="span" variant="small" className="block truncate text-2xs">
                          {a.name}
                        </Text>
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <Text variant="small" className="border-t px-3 py-2 text-2xs">
            Not listed? Whatever you type is kept as-is.
          </Text>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
