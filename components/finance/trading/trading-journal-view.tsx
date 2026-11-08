"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Info, LineChart, List, Plus } from "lucide-react";

import { CountUpCurrency } from "@/components/finance/count-up";
import { PageHeader } from "@/components/portal/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { hrefWithJournalView, JOURNAL_VIEWS, type JournalView } from "@/lib/finance/journal-view";
import { cn } from "@/lib/utils";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalTrade, TradingCashKind, TradingJournal } from "@/types/trading";

import { JournalAnalyticsMain, JournalAnalyticsSide } from "./journal-analytics";
import {
  initialCalendarState,
  JournalCalendarControls,
  JournalCalendarGrid,
  JournalCalendarSide,
  type CalendarState,
} from "./journal-calendar";
import { CashDialog, CloseTradeDialog, TradeDialog } from "./journal-dialogs";
import { JournalCashCard, JournalTradesTable, TradeFilterControl, type TradeFilter } from "./journal-trades";

const VIEW_ICON = { calendar: CalendarDays, analytics: LineChart, trades: List } as const;
const VIEW_LABEL = { calendar: "Calendar", analytics: "Analytics", trades: "Trades" } as const;

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "";

/**
 * The trading journal, laid out like a plan: one panel as tall as the screen
 * with the balance as its headline and the view switcher beside it — the
 * calendar of the days' P&L, the analytics a trader reviews, the trade list —
 * and a column beside it with what that view is read with. Below `xl`
 * everything stacks at its natural height. An empty journal shows all of it
 * at zero. The view is kept in the address (`?view=`), so a reload stays put.
 */
export function TradingJournalView({
  journal,
  initialView,
}: {
  journal: TradingJournal;
  initialView: JournalView;
}): React.ReactElement {
  const [view, setView] = useState<JournalView>(initialView);
  const [calendar, setCalendar] = useState<CalendarState>(() => initialCalendarState(journal.today));
  const [filter, setFilter] = useState<TradeFilter>("all");
  const [editing, setEditing] = useState<JournalTrade | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [closing, setClosing] = useState<JournalTrade | null>(null);
  const [cashKind, setCashKind] = useState<TradingCashKind | null>(null);

  const month = journal.months.at(-1);
  const monthPnl = month && month.month === journal.today.slice(0, 7) ? month.pnl : 0;
  const open = journal.trades.filter((t) => t.status === "open");
  const setups = [...new Set(journal.trades.map((t) => t.setup).filter((s): s is string => Boolean(s)))];
  const { stats } = journal;

  const goView = (next: JournalView): void => {
    setView(next);
    // The History API, not the router: a navigation would render the page again on the server.
    window.history.replaceState(null, "", hrefWithJournalView(window.location.href, next));
  };
  const newTrade = (): void => {
    setEditing(null);
    setTradeOpen(true);
  };
  const editTrade = (trade: JournalTrade): void => {
    setEditing(trade);
    setTradeOpen(true);
  };
  const openTrade = (trade: JournalTrade): void => {
    if (trade.status === "open") setClosing(trade);
    else editTrade(trade);
  };

  const controls =
    view === "calendar" ? (
      <JournalCalendarControls month={calendar.month} today={journal.today} onChange={setCalendar} />
    ) : view === "trades" ? (
      <TradeFilterControl value={filter} onChange={setFilter} />
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        size="compact"
        title="Trading journal"
        badge={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="About the journal: every trade, what it made, and how your trading is going"
                className="text-muted-foreground"
              >
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Every trade, what it made, and how your trading is going. Your plans count the balance and grow it at
              its recent pace.
            </TooltipContent>
          </Tooltip>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setCashKind("deposit")}>
              <ArrowDownLeft />
              Deposit
            </Button>
            <Button variant="outline" onClick={() => setCashKind("withdrawal")} disabled={journal.balance <= 0}>
              <ArrowUpRight />
              Withdraw
            </Button>
            <Button onClick={newTrade}>
              <Plus />
              New trade
            </Button>
          </>
        }
      />

      {/* The panel's height is the plan's (see "Plan panel" in SPACING.md):
          the screen below the page header, never under 40rem. The column
          beside it takes the same height, its last card absorbing the rest. */}
      <div className="grid gap-4 xl:grid-cols-4 xl:items-start">
        <Card className="min-w-0 xl:col-span-3 xl:h-[max(40rem,calc(100svh-11.5rem))]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Eyebrow size="sm" as="p">
                  Account balance
                </Eyebrow>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Mono as="p" className="text-3xl font-semibold sm:text-4xl">
                    <CountUpCurrency value={journal.balance} />
                  </Mono>
                  <Badge
                    variant={moneySign(monthPnl) > 0 ? "success" : moneySign(monthPnl) < 0 ? "destructive" : "secondary"}
                    className="font-mono"
                  >
                    {formatSignedCurrency(monthPnl)} · this month
                  </Badge>
                </div>
                <Text variant="small" as="p" className="text-2xs">
                  {formatCurrency(journal.deposited)} deposited · {formatCurrency(journal.withdrawn)} withdrawn ·{" "}
                  <span className={toneText(journal.realizedPnl)}>{formatSignedCurrency(journal.realizedPnl)}</span>{" "}
                  from trades
                </Text>
                <Text variant="small" as="p" className="text-2xs">
                  {stats.winRate == null ? "—" : `${Math.round(stats.winRate * 100)}%`} win rate · profit factor{" "}
                  {stats.profitFactor == null ? "—" : stats.profitFactor.toFixed(2)} · {open.length} open
                  {open.length > 0 && ` (${formatCurrency(journal.openExposure)})`}
                </Text>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={view}
                  onValueChange={(v) => v && goView(v as JournalView)}
                  aria-label="Journal view"
                >
                  {JOURNAL_VIEWS.map((v) => {
                    const Icon = VIEW_ICON[v];
                    return (
                      <ToggleGroupItem key={v} value={v} aria-label={VIEW_LABEL[v]}>
                        <Icon />
                        <span className="hidden sm:inline">{VIEW_LABEL[v]}</span>
                      </ToggleGroupItem>
                    );
                  })}
                </ToggleGroup>
                {controls}
              </div>
            </div>
          </CardHeader>
          <CardContent
            key={view}
            className="flex flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 xl:min-h-0 xl:flex-1"
          >
            {view === "calendar" && (
              <JournalCalendarGrid
                days={journal.days}
                trades={journal.trades}
                today={journal.today}
                state={calendar}
                onPick={(day) => setCalendar((s) => ({ ...s, picked: day }))}
                onOpenTrade={openTrade}
              />
            )}
            {view === "analytics" && <JournalAnalyticsMain journal={journal} />}
            {view === "trades" && (
              <JournalTradesTable trades={journal.trades} filter={filter} onEdit={editTrade} onClose={setClosing} />
            )}
          </CardContent>
        </Card>

        <div
          className={cn(
            "grid min-w-0 items-start gap-4 lg:grid-cols-2",
            "xl:flex xl:h-[max(40rem,calc(100svh-11.5rem))] xl:flex-col xl:items-stretch"
          )}
        >
          {view === "calendar" && (
            <JournalCalendarSide
              days={journal.days}
              trades={journal.trades}
              today={journal.today}
              state={calendar}
              onOpenTrade={openTrade}
            />
          )}
          {view === "analytics" && <JournalAnalyticsSide journal={journal} />}
          {view === "trades" && <JournalCashCard cash={journal.cash} />}
        </div>
      </div>

      <TradeDialog open={tradeOpen} onOpenChange={setTradeOpen} trade={editing} setups={setups} />
      <CloseTradeDialog trade={closing} onOpenChange={(o) => !o && setClosing(null)} />
      <CashDialog kind={cashKind} onOpenChange={(o) => !o && setCashKind(null)} balance={journal.balance} />
    </div>
  );
}
