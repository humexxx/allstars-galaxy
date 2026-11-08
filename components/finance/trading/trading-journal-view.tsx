"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, LineChart, List, Plus } from "lucide-react";

import { CountUpCurrency } from "@/components/finance/count-up";
import { PageHeader } from "@/components/portal/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { JournalTrade, TradingCashKind, TradingJournal } from "@/types/trading";

import { JournalAnalytics } from "./journal-analytics";
import { JournalCalendar } from "./journal-calendar";
import { CashDialog, CloseTradeDialog, TradeDialog } from "./journal-dialogs";
import { JournalTrades } from "./journal-trades";

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "";

/**
 * The trading journal: the account's balance up top, then a calendar of the
 * days' P&L, the analytics a trader reviews (equity curve, win rate, profit
 * factor…) and the trade list. Trades and money in or out are added from the
 * header; an open trade is closed from the calendar or the list.
 */
export function TradingJournalView({ journal }: { journal: TradingJournal }): React.ReactElement {
  const [editing, setEditing] = useState<JournalTrade | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [closing, setClosing] = useState<JournalTrade | null>(null);
  const [cashKind, setCashKind] = useState<TradingCashKind | null>(null);

  const month = journal.months.at(-1);
  const monthPnl = month && month.month === journal.today.slice(0, 7) ? month.pnl : 0;
  const open = journal.trades.filter((t) => t.status === "open");
  const setups = [...new Set(journal.trades.map((t) => t.setup).filter((s): s is string => Boolean(s)))];
  const empty = journal.trades.length === 0 && journal.cash.length === 0;

  const newTrade = (): void => {
    setEditing(null);
    setTradeOpen(true);
  };
  const openTrade = (trade: JournalTrade): void => {
    if (trade.status === "open") setClosing(trade);
    else {
      setEditing(trade);
      setTradeOpen(true);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trading journal"
        description="Every trade, what it made, and how your trading is going."
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

      {empty ? (
        <EmptyState
          icon={LineChart}
          title="Start your journal"
          description="Deposit what your trading account holds, then log each trade as you open or close it. The calendar, the equity curve and the stats build from there."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setCashKind("deposit")}>
                <ArrowDownLeft />
                Deposit
              </Button>
              <Button onClick={newTrade}>
                <Plus />
                New trade
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col gap-1 md:col-span-2">
                <Eyebrow size="sm" as="p">
                  Account balance
                </Eyebrow>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Mono as="p" className={cn("text-3xl font-semibold sm:text-4xl", journal.balance < 0 && "text-destructive")}>
                    <CountUpCurrency value={journal.balance} />
                  </Mono>
                  <Badge
                    variant={moneySign(monthPnl) > 0 ? "success" : moneySign(monthPnl) < 0 ? "destructive" : "secondary"}
                    className="font-mono"
                  >
                    {formatSignedCurrency(monthPnl)} · this month
                  </Badge>
                </div>
                <Text variant="small" as="p">
                  {formatCurrency(journal.deposited)} deposited · {formatCurrency(journal.withdrawn)} withdrawn ·{" "}
                  <span className={toneText(journal.realizedPnl)}>{formatSignedCurrency(journal.realizedPnl)}</span> from
                  trades
                </Text>
              </div>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-1 md:gap-2 md:border-l md:pl-6">
                <MiniStat
                  label="Win rate"
                  value={journal.stats.winRate == null ? "—" : `${Math.round(journal.stats.winRate * 100)}%`}
                />
                <MiniStat
                  label="Profit factor"
                  value={journal.stats.profitFactor == null ? "—" : journal.stats.profitFactor.toFixed(2)}
                />
                <MiniStat
                  label="Open positions"
                  value={String(open.length)}
                  sub={open.length > 0 ? formatCurrency(journal.openExposure) : undefined}
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="calendar" className="gap-4">
            <TabsList>
              <TabsTrigger value="calendar">
                <CalendarDays />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <LineChart />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="trades">
                <List />
                Trades
              </TabsTrigger>
            </TabsList>
            <TabsContent value="calendar">
              <JournalCalendar days={journal.days} trades={journal.trades} today={journal.today} onOpenTrade={openTrade} />
            </TabsContent>
            <TabsContent value="analytics">
              <JournalAnalytics journal={journal} />
            </TabsContent>
            <TabsContent value="trades">
              <JournalTrades
                trades={journal.trades}
                cash={journal.cash}
                onEdit={(t) => {
                  setEditing(t);
                  setTradeOpen(true);
                }}
                onClose={setClosing}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <TradeDialog open={tradeOpen} onOpenChange={setTradeOpen} trade={editing} setups={setups} />
      <CloseTradeDialog trade={closing} onOpenChange={(o) => !o && setClosing(null)} />
      <CashDialog kind={cashKind} onOpenChange={(o) => !o && setCashKind(null)} balance={journal.balance} />
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }): React.ReactElement {
  return (
    <div className="flex flex-col md:flex-row md:items-baseline md:justify-between md:gap-3">
      <Text variant="small" as="span">
        {label}
      </Text>
      <span className="flex flex-col md:items-end">
        <Mono className="text-sm font-semibold">{value}</Mono>
        {sub && (
          <Mono className="text-2xs text-muted-foreground">{sub}</Mono>
        )}
      </span>
    </div>
  );
}
