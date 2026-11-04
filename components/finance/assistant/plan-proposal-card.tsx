"use client";

import Link from "next/link";
import { ArrowRight, Check, Minus, Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Eyebrow, Mono, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import type { PlanChangeLine, PlanEffect, PlanOutlook, PlanProposal } from "@/types/plans-assistant";

export type PlanProposalState = "open" | "applying" | "applied" | "cancelled";

const ACTION_ICON = { create: Plus, add: Plus, update: Pencil, remove: Minus } as const;
const ACTION_LABEL = { create: "Create", add: "Add", update: "Change", remove: "Remove" } as const;

/**
 * What the assistant wants to change, for the user to approve: each change in
 * words, then what it does to each plan — the debt-free date and net worth,
 * before and after — by the app's own projection. Nothing is written until
 * Apply; once applied, the card is the receipt and links to the plans.
 */
export function PlanProposalCard({
  proposal,
  state,
  error,
  createdPlans,
  onApply,
  onCancel,
}: {
  proposal: PlanProposal;
  state: PlanProposalState;
  error?: string;
  /** Plans Apply created, by name, to link the receipt to. */
  createdPlans?: { id: string; name: string }[];
  onApply: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const byPlan = groupByPlan(proposal.lines);

  return (
    <div
      data-slot="plan-proposal-card"
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-3", state === "cancelled" && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-2">
        <Text weight="medium" className="min-w-0">
          {proposal.set.summary}
        </Text>
        {state === "applied" && <Badge variant="success">Applied</Badge>}
        {state === "cancelled" && <Badge variant="outline">Discarded</Badge>}
      </div>

      {byPlan.map(([planName, lines]) => (
        <div key={planName} className="flex flex-col gap-2">
          {byPlan.length > 1 && (
            <Eyebrow size="sm" as="div">
              {planName}
            </Eyebrow>
          )}
          <ul className="flex flex-col gap-2">
            {lines.map((line, i) => (
              <ChangeRow key={i} line={line} />
            ))}
          </ul>
        </div>
      ))}

      {proposal.effects.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          {proposal.effects.map((effect) => (
            <EffectBlock
              key={effect.planId ?? effect.planName}
              effect={effect}
              showName={proposal.effects.length > 1 || effect.isNew}
              href={state === "applied" ? planHref(effect, createdPlans) : undefined}
            />
          ))}
        </div>
      )}

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

/** Where a receipt's plan lives: its own id, or the id Apply gave a new one. */
function planHref(effect: PlanEffect, created: { id: string; name: string }[] = []): string | undefined {
  const id = effect.planId ?? created.find((p) => p.name === effect.planName)?.id;
  return id ? `/portal/plans/${id}` : undefined;
}

function groupByPlan(lines: PlanChangeLine[]): [string, PlanChangeLine[]][] {
  const groups = new Map<string, PlanChangeLine[]>();
  for (const line of lines) groups.set(line.planName, [...(groups.get(line.planName) ?? []), line]);
  return [...groups];
}

function ChangeRow({ line }: { line: PlanChangeLine }): React.ReactElement {
  const Icon = ACTION_ICON[line.action];
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          (line.action === "add" || line.action === "create") && "bg-success text-white",
          line.action === "update" && "bg-primary-fill text-primary-foreground",
          line.action === "remove" && "bg-destructive text-white"
        )}
      >
        <Icon className="size-3" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className={cn("text-sm", line.action === "remove" && "line-through")}>
          <span className="sr-only">{ACTION_LABEL[line.action]}: </span>
          {line.title}
          {line.subject !== "plan" && <span className="text-muted-foreground"> · {line.subject}</span>}
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

/** One plan's outlook, before → after (only after, for a plan the proposal creates). */
function EffectBlock({
  effect,
  showName,
  href,
}: {
  effect: PlanEffect;
  showName: boolean;
  href?: string;
}): React.ReactElement {
  const rows: { label: string; pick: (o: PlanOutlook) => string }[] = [
    { label: "Debt-free", pick: (o) => o.debtFree },
    { label: "Net worth in 12 months", pick: (o) => formatCurrency(o.netWorthIn12Months) },
    { label: "Net worth at the end", pick: (o) => formatCurrency(o.netWorthAtEnd) },
    { label: "Interest still to pay", pick: (o) => formatCurrency(o.interestStillToPay) },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      {showName && (
        <Eyebrow size="sm" as="div" className="flex items-center gap-1">
          {href ? (
            <Link href={href} className="underline-offset-4 hover:underline">
              {effect.planName}
            </Link>
          ) : (
            effect.planName
          )}
          {effect.isNew && <span className="normal-case tracking-normal">(new)</span>}
        </Eyebrow>
      )}
      <dl className="flex flex-col gap-1">
        {rows.map(({ label, pick }) => {
          const after = pick(effect.after);
          const before = effect.before ? pick(effect.before) : null;
          const changed = before !== null && before !== after;
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
                <Mono className={cn("text-xs", changed && "font-semibold")}>{after}</Mono>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
