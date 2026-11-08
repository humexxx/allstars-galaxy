"use client";

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Minus,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatCurrency, formatSignedCurrency, moneySign } from "@/lib/utils/format";
import type { TradingChangeLine, TradingOutlook, TradingProposal } from "@/types/trading-assistant";

export type TradingProposalState = "open" | "applying" | "applied" | "cancelled";

const ACTION = {
  open: { icon: TrendingUp, label: "Open", tone: "bg-primary-fill text-primary-foreground" },
  add: { icon: Plus, label: "Record", tone: "bg-success text-white" },
  close: { icon: X, label: "Close", tone: "bg-foreground text-background" },
  update: { icon: Pencil, label: "Change", tone: "bg-primary-fill text-primary-foreground" },
  remove: { icon: Minus, label: "Delete", tone: "bg-destructive text-white" },
  deposit: { icon: ArrowDownLeft, label: "Deposit", tone: "bg-success text-white" },
  withdraw: { icon: ArrowUpRight, label: "Withdraw", tone: "bg-destructive text-white" },
} as const;

const toneText = (n: number): string =>
  moneySign(n) > 0 ? "text-success" : moneySign(n) < 0 ? "text-destructive" : "";

/**
 * What the assistant wants to write to the journal, for the user to approve:
 * each change in words with the P&L it realises, then the account before and
 * after by the journal's own maths. Nothing is written until Apply; once
 * applied, the card is the receipt.
 */
export function TradingProposalCard({
  proposal,
  state,
  error,
  onApply,
  onCancel,
}: {
  proposal: TradingProposal;
  state: TradingProposalState;
  error?: string;
  onApply: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const rows: { label: string; pick: (o: TradingOutlook) => string; tone?: (o: TradingOutlook) => string }[] = [
    { label: "Balance", pick: (o) => formatCurrency(o.balance) },
    { label: "Open positions", pick: (o) => String(o.openPositions) },
    { label: "This month", pick: (o) => formatSignedCurrency(o.monthPnl), tone: (o) => toneText(o.monthPnl) },
    { label: "Win rate", pick: (o) => (o.winRate == null ? "—" : `${Math.round(o.winRate * 100)}%`) },
  ];

  return (
    <div
      data-slot="trading-proposal-card"
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-3", state === "cancelled" && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-2">
        <Text weight="medium" className="min-w-0">
          {proposal.set.summary}
        </Text>
        {state === "applied" && <Badge variant="success">Applied</Badge>}
        {state === "cancelled" && <Badge variant="outline">Discarded</Badge>}
      </div>

      <ul className="flex flex-col gap-2">
        {proposal.lines.map((line, i) => (
          <ChangeRow key={i} line={line} />
        ))}
      </ul>

      <dl className="flex flex-col gap-1 border-t pt-3">
        {rows.map(({ label, pick, tone }) => {
          const before = pick(proposal.before);
          const after = pick(proposal.after);
          const changed = before !== after;
          return (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <Text asChild variant="small">
                <dt>{label}</dt>
              </Text>
              <dd className="flex min-w-0 items-baseline gap-1 text-right">
                {changed && (
                  <>
                    <Mono className="text-xs text-muted-foreground line-through">{before}</Mono>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-label="becomes" />
                  </>
                )}
                <Mono className={cn("text-xs", changed && "font-semibold", tone?.(proposal.after))}>{after}</Mono>
              </dd>
            </div>
          );
        })}
      </dl>

      {error && (
        <Text variant="small" className="text-destructive">
          {error}
        </Text>
      )}

      {(state === "open" || state === "applying") && (
        <div className="flex gap-2">
          <Button size="sm" onClick={onApply} disabled={state === "applying"}>
            {state === "applying" ? <Spinner /> : <Check />}
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={state === "applying"}>
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}

function ChangeRow({ line }: { line: TradingChangeLine }): React.ReactElement {
  const { icon: Icon, label, tone } = ACTION[line.action];
  const PnlIcon = line.pnl != null && line.pnl < 0 ? TrendingDown : TrendingUp;
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", tone)}>
        <Icon className="size-3" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("text-sm", line.action === "remove" && "line-through")}>
            <span className="sr-only">{label}: </span>
            {line.title}
          </span>
          {line.pnl != null && (
            <Mono className={cn("flex shrink-0 items-center gap-1 text-xs font-semibold", toneText(line.pnl))}>
              <PnlIcon className="size-3" aria-hidden />
              {formatSignedCurrency(line.pnl)}
            </Mono>
          )}
        </span>
        {line.details.length > 0 && (
          <Text variant="small" className="tabular-nums">
            {line.details.join(" · ")}
          </Text>
        )}
      </div>
    </li>
  );
}
