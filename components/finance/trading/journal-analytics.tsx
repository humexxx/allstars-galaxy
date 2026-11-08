"use client";

import { useId, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { niceTicks, yAxisWidth } from "@/lib/utils/chart-axis";
import { formatDay, formatProjectionMonth } from "@/lib/utils/date";
import { formatCurrency, formatCurrencyCompact, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalBreakdownRow, TradingJournal } from "@/types/trading";

const EQUITY = "var(--chart-1)";
const GAIN = "var(--success)";
const LOSS = "var(--destructive)";

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "";

const pct = (n: number | null): string => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

/** A journal with nothing in it yet still draws every chart, flat at zero. */
function monthRows(journal: TradingJournal): JournalBreakdownRow[] {
  const months = journal.months.length > 0 ? journal.months : [{ month: journal.today.slice(0, 7), pnl: 0 }];
  return months.map((m) => ({
    key: formatProjectionMonth(new Date(`${m.month}-01T00:00:00Z`)),
    pnl: m.pnl,
    trades: 0,
    wins: 0,
  }));
}

/**
 * The balance over time, filling what the card leaves, and the P&L by month
 * and by weekday under it.
 */
export function JournalAnalyticsMain({ journal }: { journal: TradingJournal }): React.ReactElement {
  return (
    <div className="flex flex-col gap-6 xl:min-h-0 xl:flex-1">
      <EquityChart journal={journal} />
      <div className="grid gap-6 lg:grid-cols-2">
        <BarsChart title="P&L by month" rows={monthRows(journal)} />
        <BarsChart title="P&L by weekday" rows={journal.byWeekday} />
      </div>
    </div>
  );
}

/**
 * The figures a journal is read for (net P&L, win rate, profit factor,
 * expectancy, average win and loss, drawdown, hold time, streaks), and where
 * the money is made, by symbol or by setup.
 */
export function JournalAnalyticsSide({ journal }: { journal: TradingJournal }): React.ReactElement {
  const s = journal.stats;
  const [by, setBy] = useState<"symbol" | "setup">("symbol");
  const stats: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: "Net P&L", value: formatSignedCurrency(s.netPnl), sub: `${s.trades} closed trades`, tone: toneText(s.netPnl) },
    { label: "Win rate", value: pct(s.winRate), sub: `${s.wins} won · ${s.losses} lost` },
    {
      label: "Profit factor",
      value: s.profitFactor == null ? (s.wins > 0 ? "∞" : "—") : s.profitFactor.toFixed(2),
      sub: `${formatCurrencyCompact(s.grossProfit)} won / ${formatCurrencyCompact(s.grossLoss)} lost`,
      tone: s.profitFactor != null ? (s.profitFactor >= 1 ? "text-success" : "text-destructive") : undefined,
    },
    { label: "Expectancy", value: formatSignedCurrency(s.expectancy), sub: "per trade", tone: toneText(s.expectancy) },
    { label: "Avg win", value: formatCurrency(s.avgWin), sub: `Largest ${formatCurrency(s.largestWin)}`, tone: toneText(s.avgWin) },
    {
      label: "Avg loss",
      value: formatCurrency(s.avgLoss),
      sub: `Largest ${formatCurrency(s.largestLoss)}`,
      tone: s.avgLoss > 0 ? "text-destructive" : undefined,
    },
    { label: "Max drawdown", value: formatCurrency(s.maxDrawdown), sub: "from a P&L high" },
    {
      label: "Avg hold",
      value: s.avgHoldDays == null ? "—" : s.avgHoldDays < 1 ? "Intraday" : `${s.avgHoldDays.toFixed(1)} days`,
      sub: `Best run ${s.bestStreak} · worst ${s.worstStreak}`,
    },
  ];

  return (
    <>
      <Card className="gap-3">
        <CardHeader>
          <Eyebrow size="sm" asChild>
            <h3>Stats</h3>
          </Eyebrow>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-2">
            {stats.map((t) => (
              <div key={t.label} className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <Text asChild variant="small">
                    <dt>{t.label}</dt>
                  </Text>
                  {t.sub && (
                    <Text variant="small" as="span" className="truncate text-2xs">
                      {t.sub}
                    </Text>
                  )}
                </div>
                <dd className="shrink-0">
                  <Mono className={cn("text-sm font-semibold", t.tone)}>{t.value}</Mono>
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="gap-3 xl:min-h-0 xl:flex-1">
        <CardHeader className="flex items-center justify-between gap-2">
          <Eyebrow size="sm" asChild>
            <h3>P&amp;L by</h3>
          </Eyebrow>
          <ToggleGroup
            type="single"
            size="sm"
            value={by}
            onValueChange={(v) => v && setBy(v as "symbol" | "setup")}
            aria-label="Break the P&L down by"
          >
            <ToggleGroupItem value="symbol">Symbol</ToggleGroupItem>
            <ToggleGroupItem value="setup">Setup</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="xl:min-h-0 xl:overflow-y-auto">
          <Breakdown rows={by === "symbol" ? journal.bySymbol : journal.bySetup} />
        </CardContent>
      </Card>
    </>
  );
}

const equityConfig = {
  balance: { label: "Balance", color: EQUITY },
  cumulativePnl: { label: "Realized P&L", color: GAIN },
};

function EquityChart({ journal }: { journal: TradingJournal }): React.ReactElement {
  const fill = useId().replace(/:/g, "");
  const data =
    journal.equity.length > 0
      ? journal.equity
      : [`${journal.today.slice(0, 7)}-01`, journal.today].map((day) => ({ day, balance: 0, cumulativePnl: 0 }));
  const ticks = niceTicks(data.flatMap((p) => [p.balance, p.cumulativePnl]));
  return (
    <section className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow size="sm" asChild>
          <h3>Balance over time</h3>
        </Eyebrow>
        <div className="flex items-center gap-3 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: EQUITY }} />
            Balance
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-3" style={{ background: GAIN }} />
            Realized P&amp;L
          </span>
        </div>
      </div>
      <ChartContainer config={equityConfig} className="aspect-auto h-64 w-full sm:h-72 xl:h-auto xl:min-h-0 xl:flex-1">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={EQUITY} stopOpacity={0.3} />
              <stop offset="100%" stopColor={EQUITY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeOpacity={0.25} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(d: string) => formatDay(d).replace(/, \d{4}$/, "")}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={yAxisWidth(ticks.map((t) => formatCurrencyCompact(t)))}
            ticks={ticks}
            domain={[ticks[0], ticks.at(-1) ?? 0]}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
              if (!row) return null;
              return (
                <div className="grid min-w-40 gap-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium">{formatDay(row.day)}</div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Balance</span>
                    <Mono>{formatCurrency(row.balance)}</Mono>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Realized P&amp;L</span>
                    <Mono className={toneText(row.cumulativePnl)}>{formatSignedCurrency(row.cumulativePnl)}</Mono>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={EQUITY}
            strokeWidth={2.5}
            fill={`url(#${fill})`}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={GAIN}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            fill="none"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ChartContainer>
    </section>
  );
}

function BarsChart({ title, rows }: { title: string; rows: JournalBreakdownRow[] }): React.ReactElement {
  const ticks = niceTicks(rows.map((r) => r.pnl));
  return (
    <section className="flex flex-col gap-3">
      <Eyebrow size="sm" asChild>
        <h3>{title}</h3>
      </Eyebrow>
      <ChartContainer config={{ pnl: { label: "P&L", color: GAIN } }} className="aspect-auto h-40 w-full">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeOpacity={0.25} />
          <XAxis dataKey="key" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={yAxisWidth(ticks.map((t) => formatCurrencyCompact(t)))}
            ticks={ticks}
            domain={[ticks[0], ticks.at(-1) ?? 0]}
            tickFormatter={(v: number) => formatCurrencyCompact(v)}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as JournalBreakdownRow | undefined) : undefined;
              if (!row) return null;
              return (
                <div className="grid gap-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium">{row.key}</div>
                  <Mono className={toneText(row.pnl)}>{formatSignedCurrency(row.pnl)}</Mono>
                  {row.trades > 0 && (
                    <span className="text-muted-foreground">
                      {row.trades} trades · {Math.round((row.wins / row.trades) * 100)}% won
                    </span>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="pnl" radius={4}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.pnl >= 0 ? GAIN : LOSS} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </section>
  );
}

function Breakdown({ rows }: { rows: JournalBreakdownRow[] }): React.ReactElement {
  const top = Math.max(0, ...rows.map((r) => Math.abs(r.pnl)));
  return (
    <div className="flex flex-col gap-2">
        {rows.length === 0 && <Text variant="small">No closed trades yet.</Text>}
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium">{r.key}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <Text variant="small" as="span" className="text-2xs">
                  {r.trades} · {Math.round((r.wins / Math.max(1, r.trades)) * 100)}% won
                </Text>
                <Mono className={cn("text-sm", toneText(r.pnl))}>{formatSignedCurrency(r.pnl)}</Mono>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", r.pnl >= 0 ? "bg-success/70" : "bg-destructive/70")}
                style={{ width: `${top > 0 ? (Math.abs(r.pnl) / top) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  );
}
