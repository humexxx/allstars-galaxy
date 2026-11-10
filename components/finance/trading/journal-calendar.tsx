"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { isResultOnly } from "@/lib/finance/trading";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/utils/date";
import { formatCurrencyCompact, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalDay, JournalTrade } from "@/types/trading";

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Lanes of multi-day bars drawn under a week before "+N more". */
const MAX_LANES = 3;
const MONTH_TITLE = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const dayDate = (day: string): Date => new Date(`${day}T00:00:00Z`);
const isoOf = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number): string => isoOf(new Date(dayDate(day).getTime() + n * 86_400_000));

/** Monday on or before `day`. */
function mondayOf(day: string): string {
  return addDays(day, -((dayDate(day).getUTCDay() + 6) % 7));
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return isoOf(d).slice(0, 7);
}

/** Every week (Monday first) the month touches. */
function weeksOf(month: string): string[][] {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const weeks: string[][] = [];
  for (let start = mondayOf(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
  }
  return weeks;
}

/** A trade drawn across the days it was held, within one week. */
type Bar = { trade: JournalTrade; start: number; end: number; lane: number };

function barsFor(week: string[], trades: readonly JournalTrade[], today: string): { bars: Bar[]; hidden: number } {
  const from = week[0];
  const to = week[6];
  const spanning = trades
    .map((t) => ({ t, end: t.closedDay ?? today }))
    // One-day trades live in the day cell; a bar is for a position held overnight.
    .filter(({ t, end }) => end > t.openedDay && t.openedDay <= to && end >= from)
    .sort((a, b) => a.t.openedDay.localeCompare(b.t.openedDay) || b.end.localeCompare(a.end));
  const laneEnds: number[] = [];
  const bars: Bar[] = [];
  let hidden = 0;
  for (const { t, end } of spanning) {
    const start = Math.max(0, week.indexOf(t.openedDay < from ? from : t.openedDay));
    const stop = week.indexOf(end > to ? to : end);
    const lane = laneEnds.findIndex((e) => e < start);
    const at = lane === -1 ? laneEnds.length : lane;
    if (at >= MAX_LANES) {
      hidden += 1;
      continue;
    }
    laneEnds[at] = stop;
    bars.push({ trade: t, start, end: stop, lane: at });
  }
  return { bars, hidden };
}

/** Tint by how big the day was against the month's biggest. */
function tint(pnl: number, scale: number): string {
  if (moneySign(pnl) === 0 || scale <= 0) return "";
  const share = Math.abs(pnl) / scale;
  const strength = share > 0.66 ? 3 : share > 0.33 ? 2 : 1;
  if (pnl > 0) return ["", "bg-success/10", "bg-success/15", "bg-success/25"][strength];
  return ["", "bg-destructive/10", "bg-destructive/15", "bg-destructive/25"][strength];
}

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "text-muted-foreground";

/** Today's month, or one picked with the arrows; and the day whose trades are listed. */
export type CalendarState = { month: string; picked: string | null };

export function initialCalendarState(today: string): CalendarState {
  return { month: today.slice(0, 7), picked: today };
}

/** The month the calendar shows, with arrows to move it and Today to come back. */
export function JournalCalendarControls({
  month,
  today,
  onChange,
}: {
  month: string;
  today: string;
  onChange: (next: CalendarState | ((s: CalendarState) => CalendarState)) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous month"
        onClick={() => onChange((s) => ({ ...s, month: shiftMonth(s.month, -1) }))}
      >
        <ChevronLeft />
      </Button>
      <Heading level="h4" as="h2" className="min-w-36 text-center text-sm" aria-live="polite">
        {MONTH_TITLE.format(dayDate(`${month}-01`))}
      </Heading>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next month"
        onClick={() => onChange((s) => ({ ...s, month: shiftMonth(s.month, 1) }))}
      >
        <ChevronRight />
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange(initialCalendarState(today))}>
        Today
      </Button>
    </div>
  );
}

/**
 * The journal's month: each day's realized P&L in green or red, deeper the
 * bigger it was, a week total on the right, and the positions held across
 * days drawn as bars over the days they were open. Pick a day for its trades.
 * On a wide screen the weeks share the card's height between them.
 */
export function JournalCalendarGrid({
  days,
  trades,
  today,
  state,
  onPick,
  onOpenTrade,
}: {
  days: readonly JournalDay[];
  trades: readonly JournalTrade[];
  today: string;
  state: CalendarState;
  onPick: (day: string) => void;
  onOpenTrade: (trade: JournalTrade) => void;
}): React.ReactElement {
  const { month, picked } = state;
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const weeks = useMemo(() => weeksOf(month), [month]);
  const scale = Math.max(0, ...days.filter((d) => d.day.startsWith(month)).map((d) => Math.abs(d.pnl)));

  return (
    <div className="flex flex-col gap-1 xl:min-h-0 xl:flex-1">
      <div className="grid grid-cols-8 gap-0.5 text-center sm:gap-1">
        {[...WEEKDAY_HEADS, "Week"].map((d) => (
          <Eyebrow key={d} size="sm" as="div" className="py-1">
            {d}
          </Eyebrow>
        ))}
      </div>
      {weeks.map((week) => {
        const { bars, hidden } = barsFor(week, trades, today);
        const lanes = Math.max(-1, ...bars.map((b) => b.lane)) + 1 + (hidden > 0 ? 1 : 0);
        const weekDays = week.map((d) => byDay.get(d)).filter((d): d is JournalDay => Boolean(d));
        const weekPnl = weekDays.reduce((s, d) => s + d.pnl, 0);
        const weekTrades = weekDays.reduce((s, d) => s + d.trades, 0);
        return (
          <div
            key={week[0]}
            className="grid grid-cols-8 gap-0.5 sm:gap-1 xl:min-h-0 xl:flex-1"
            // The day cells take what the bars under them leave.
            style={{ gridTemplateRows: `minmax(0, 1fr) repeat(${lanes}, auto)` }}
          >
            {week.map((day, i) => {
              const d = byDay.get(day);
              const outside = !day.startsWith(month);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onPick(day)}
                  aria-pressed={picked === day}
                  aria-label={`${formatDay(day)}${d ? `, ${formatSignedCurrency(d.pnl)} over ${d.trades} trades` : ""}`}
                  style={{ gridColumn: i + 1, gridRow: 1 }}
                  className={cn(
                    "flex min-h-16 min-w-0 cursor-pointer flex-col items-start gap-0.5 overflow-hidden rounded-md border p-1.5 text-left outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-20 xl:min-h-12",
                    d ? tint(d.pnl, scale) : "bg-card",
                    outside && "opacity-40",
                    picked === day && "ring-2 ring-primary/60"
                  )}
                >
                  {/* The count shares the date's row: under the bars a cell is a
                      short box, and a third line cut the amount in half. */}
                  <span className="flex w-full items-center justify-between gap-1">
                    <span
                      className={cn(
                        "font-mono text-2xs",
                        day === today &&
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-fill px-1 font-semibold text-primary-foreground"
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {d && (
                      <span className="hidden truncate text-2xs text-muted-foreground sm:block">
                        {d.trades} {d.trades === 1 ? "trade" : "trades"}
                      </span>
                    )}
                  </span>
                  {d && (
                    <Mono className={cn("mt-auto truncate text-xs font-semibold sm:text-sm", toneText(d.pnl))}>
                      <span className="sm:hidden">{formatCurrencyCompact(d.pnl)}</span>
                      <span className="hidden sm:inline">{formatSignedCurrency(d.pnl)}</span>
                    </Mono>
                  )}
                </button>
              );
            })}
            <div
              style={{ gridColumn: 8, gridRow: 1 }}
              className="flex min-w-0 flex-col items-end justify-center gap-0.5 rounded-md bg-muted/40 p-1.5"
            >
              <Mono className={cn("truncate text-xs font-semibold", toneText(weekPnl))}>
                {weekTrades > 0 ? formatCurrencyCompact(weekPnl) : "—"}
              </Mono>
              {weekTrades > 0 && (
                <span className="hidden text-2xs text-muted-foreground sm:block">
                  {weekTrades} {weekTrades === 1 ? "trade" : "trades"}
                </span>
              )}
            </div>
            {bars.map((b) => (
              <button
                key={`${b.trade.id}-${week[0]}`}
                type="button"
                onClick={() => onOpenTrade(b.trade)}
                style={{ gridColumn: `${b.start + 1} / ${b.end + 2}`, gridRow: b.lane + 2 }}
                title={`${b.trade.symbol}${isResultOnly(b.trade) ? "" : ` ${b.trade.side}`} · ${formatDay(b.trade.openedDay)} → ${b.trade.closedDay ? formatDay(b.trade.closedDay) : "open"}`}
                className={cn(
                  "flex h-5 min-w-0 cursor-pointer items-center justify-between gap-2 rounded px-1.5 text-2xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  b.trade.status === "open"
                    ? "border border-dashed border-primary/60 bg-primary/10 text-primary"
                    : (b.trade.pnl ?? 0) >= 0
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive"
                )}
              >
                <span className="truncate">
                  {b.trade.symbol}
                  {!isResultOnly(b.trade) && (b.trade.side === "long" ? " ↑" : " ↓")}
                </span>
                <Mono className="hidden shrink-0 sm:inline">
                  {b.trade.status === "open" ? "open" : formatCurrencyCompact(b.trade.pnl ?? 0)}
                </Mono>
              </button>
            ))}
            {hidden > 0 && (
              <Text variant="small" as="span" style={{ gridColumn: "1 / 8", gridRow: lanes + 1 }} className="text-2xs">
                +{hidden} more held this week
              </Text>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The month's figures, and the trades of the picked day (it fills what the column has left). */
export function JournalCalendarSide({
  days,
  trades,
  today,
  state,
  onOpenTrade,
}: {
  days: readonly JournalDay[];
  trades: readonly JournalTrade[];
  today: string;
  state: CalendarState;
  onOpenTrade: (trade: JournalTrade) => void;
}): React.ReactElement {
  const { month, picked } = state;
  const inMonth = days.filter((d) => d.day.startsWith(month));
  const monthPnl = inMonth.reduce((s, d) => s + d.pnl, 0);
  const winDays = inMonth.filter((d) => d.pnl > 0).length;
  const lossDays = inMonth.filter((d) => d.pnl < 0).length;
  const best = inMonth.reduce<JournalDay | null>((b, d) => (!b || d.pnl > b.pnl ? d : b), null);
  const worst = inMonth.reduce<JournalDay | null>((w, d) => (!w || d.pnl < w.pnl ? d : w), null);
  const pickedTrades = picked
    ? trades.filter(
        (t) => t.openedDay === picked || t.closedDay === picked || (t.openedDay < picked && (t.closedDay ?? today) > picked)
      )
    : [];

  return (
    <>
      <Card className="gap-3">
        <CardHeader>
          <Eyebrow size="sm" asChild>
            <h3>{MONTH_TITLE.format(dayDate(`${month}-01`))}</h3>
          </Eyebrow>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <SummaryRow label="Net P&L" value={formatSignedCurrency(monthPnl)} tone={toneText(monthPnl)} />
          <SummaryRow label="Trading days" value={String(inMonth.length)} />
          <SummaryRow label="Green · red days" value={`${winDays} · ${lossDays}`} />
          <SummaryRow
            label="Day win rate"
            value={inMonth.length ? `${Math.round((winDays / inMonth.length) * 100)}%` : "—"}
          />
          <SummaryRow
            label="Best day"
            value={best ? `${formatSignedCurrency(best.pnl)} · ${formatDay(best.day).replace(/, \d{4}$/, "")}` : "—"}
            tone={best ? toneText(best.pnl) : undefined}
          />
          <SummaryRow
            label="Worst day"
            value={worst ? `${formatSignedCurrency(worst.pnl)} · ${formatDay(worst.day).replace(/, \d{4}$/, "")}` : "—"}
            tone={worst ? toneText(worst.pnl) : undefined}
          />
        </CardContent>
      </Card>

      <Card className="gap-3 xl:min-h-0 xl:flex-1">
        <CardHeader>
          <Eyebrow size="sm" asChild>
            <h3>{picked ? formatDay(picked) : "Pick a day"}</h3>
          </Eyebrow>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 xl:min-h-0 xl:overflow-y-auto">
          {pickedTrades.length === 0 ? (
            <Text variant="small">No trades that day.</Text>
          ) : (
            pickedTrades.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTrade(t)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {t.symbol}
                    {!isResultOnly(t) && (
                      <span className="text-muted-foreground"> {t.side === "long" ? "Long" : "Short"}</span>
                    )}
                  </span>
                  <span className="text-2xs text-muted-foreground">
                    {t.closedDay === picked ? "Closed" : t.openedDay === picked ? "Opened" : "Held"}
                    {t.setup ? ` · ${t.setup}` : ""}
                  </span>
                </span>
                <Mono className={cn("shrink-0 text-sm", t.pnl == null ? "text-primary" : toneText(t.pnl))}>
                  {t.pnl == null ? "Open" : formatSignedCurrency(t.pnl)}
                </Mono>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: string }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Text variant="small" as="span">
        {label}
      </Text>
      <Mono className={cn("text-sm", tone)}>{value}</Mono>
    </div>
  );
}
