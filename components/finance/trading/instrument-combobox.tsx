"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { searchInstrumentsAction } from "@/app/actions/trading-journal";
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
import { Mono } from "@/components/ui/typography";
import { marketLabel, MAX_SYMBOL_LENGTH, typedSymbol } from "@/lib/trading/instruments";
import type { TradingInstrument } from "@/types/trading";

/** The market search spends a rate-limited quota: it waits for a pause in the typing. */
const SEARCH_DELAY_MS = 400;
const MIN_QUERY_LENGTH = 2;
const JOURNAL_SHOWN = 6;

function InstrumentItem({
  group,
  symbol,
  detail,
  checked,
  onPick,
}: {
  group: string;
  symbol: string;
  detail: string | null;
  checked: boolean;
  onPick: (symbol: string) => void;
}): React.ReactElement {
  return (
    <CommandItem value={`${group}:${symbol}`} data-checked={checked} onSelect={() => onPick(symbol)}>
      <span className="flex min-w-0 flex-col">
        <Mono className="font-medium">{symbol}</Mono>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </CommandItem>
  );
}

/**
 * The instrument a trade is filed under. It offers what the journal already
 * holds, the assets linked for pricing, and the market-data provider's own
 * tickers for what is typed — and takes the typed text as it stands when none
 * of them is the one, or when the search cannot answer.
 */
export function InstrumentCombobox({
  id,
  value,
  onChange,
  linked,
  recent,
}: {
  /** Set on the trigger so a `<label htmlFor>` names it. */
  id?: string;
  value: string;
  onChange: (symbol: string) => void;
  /** The assets already linked for pricing. */
  linked: readonly TradingInstrument[];
  /** The symbols the journal already holds, latest first. */
  recent: readonly string[];
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Record<string, TradingInstrument[]>>({});
  const [failed, setFailed] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const typed = typedSymbol(query).slice(0, MAX_SYMBOL_LENGTH);
  const searchable = q.length >= MIN_QUERY_LENGTH;
  const results = searchable ? found[q] : undefined;
  const unavailable = searchable && failed === q;
  const searching = searchable && results === undefined && !unavailable;

  useEffect(() => {
    if (!open || !searching) return;
    const timer = setTimeout(async () => {
      const result = await searchInstrumentsAction(q);
      if (result.success && result.data.available) setFound((f) => ({ ...f, [q]: result.data.instruments }));
      else setFailed(q);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open, q, searching]);

  const names = new Map<string, string | null>();
  for (const i of [...Object.values(found).flat(), ...linked]) names.set(i.symbol, i.name);

  const matches = (symbol: string, name: string | null | undefined): boolean =>
    q === "" || (typed !== "" && symbol.includes(typed)) || Boolean(name?.toLowerCase().includes(q));
  const journal = recent.filter((s) => matches(s, names.get(s))).slice(0, JOURNAL_SHOWN);
  const linkedShown = linked.filter((i) => !journal.includes(i.symbol) && matches(i.symbol, i.name));
  const market = (results ?? []).filter((i) => !journal.includes(i.symbol));
  const listed = new Set([...journal, ...linkedShown.map((i) => i.symbol), ...market.map((i) => i.symbol)]);
  const asTyped = typed !== "" && !listed.has(typed) ? typed : null;

  const pick = (symbol: string): void => {
    onChange(symbol);
    setOpen(false);
    setQuery("");
  };

  const valueName = names.get(value);

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
          <span className="flex min-w-0 items-baseline gap-2">
            {value ? (
              <>
                <Mono className="font-medium">{value}</Mono>
                {valueName && <span className="truncate text-muted-foreground">{valueName}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">Search a ticker or a name</span>
            )}
          </span>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 max-w-(--radix-popover-content-available-width) p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="XAU, BTC, Apple…" />
          <CommandList>
            <CommandEmpty>Type a ticker or a name.</CommandEmpty>
            {journal.length > 0 && (
              <CommandGroup heading="Your journal">
                {journal.map((s) => (
                  <InstrumentItem
                    key={s}
                    group="journal"
                    symbol={s}
                    detail={names.get(s) ?? null}
                    checked={s === value}
                    onPick={pick}
                  />
                ))}
              </CommandGroup>
            )}
            {linkedShown.length > 0 && (
              <CommandGroup heading="Linked assets">
                {linkedShown.map((i) => (
                  <InstrumentItem
                    key={i.symbol}
                    group="linked"
                    symbol={i.symbol}
                    detail={i.name}
                    checked={i.symbol === value}
                    onPick={pick}
                  />
                ))}
              </CommandGroup>
            )}
            {(market.length > 0 || searching) && (
              <CommandGroup heading="Market">
                {market.map((i) => (
                  <InstrumentItem
                    key={i.symbol}
                    group="market"
                    symbol={i.symbol}
                    detail={[i.name, marketLabel(i.market)].filter(Boolean).join(" · ") || null}
                    checked={i.symbol === value}
                    onPick={pick}
                  />
                ))}
                {searching && (
                  <p role="status" className="px-2 py-1.5 text-xs text-muted-foreground">
                    Searching the market…
                  </p>
                )}
              </CommandGroup>
            )}
            {asTyped && (
              <CommandGroup heading={unavailable ? "Market search is unavailable right now" : "Not listed?"}>
                <CommandItem value={`typed:${asTyped}`} onSelect={() => pick(asTyped)}>
                  <span>
                    Use <Mono className="font-medium">{asTyped}</Mono> as typed
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
