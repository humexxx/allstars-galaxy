"use client";

import Link from "next/link";
import { Check, MapPin, Minus, Pencil, Plus, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { TravelChangeLine, TravelProposal } from "@/types/travel-assistant";

import { CategoryIcon } from "../category";

export type ProposalState = "open" | "applying" | "applied" | "cancelled" | "undoing" | "undone";

const ACTION_ICON = { add: Plus, change: Pencil, remove: Minus } as const;
const ACTION_LABEL = { add: "Add", change: "Change", remove: "Remove" } as const;

/**
 * What the assistant wants to do, for the user to approve.
 *
 * Nothing is written until Apply. Once applied the card becomes the receipt —
 * the rows link to their trips — and the newest receipt carries the Undo.
 */
export function ProposalCard({
  proposal,
  state,
  applied,
  error,
  canUndo,
  onApply,
  onCancel,
  onUndo,
}: {
  proposal: TravelProposal;
  state: ProposalState;
  /** The rows as written, once applied (they carry the new trips' ids). */
  applied?: TravelChangeLine[];
  error?: string;
  canUndo: boolean;
  onApply: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const lines = applied ?? proposal.lines;
  const settled = state === "cancelled" || state === "undone";

  return (
    <div
      data-slot="proposal-card"
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-3", settled && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-2">
        <Text weight="medium" className="min-w-0">
          {proposal.set.summary}
        </Text>
        <StateBadge state={state} />
      </div>

      <ul className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <LineIcon line={line} />
            <div className="flex min-w-0 flex-col">
              <span className={cn("text-sm", line.action === "remove" && "line-through")}>
                <span className="sr-only">{ACTION_LABEL[line.action]}: </span>
                {state === "applied" && line.tripId && line.action !== "remove" ? (
                  <Link
                    href={`/portal/entertainment/travel-planner/${line.tripId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {line.title}
                  </Link>
                ) : (
                  line.title
                )}
              </span>
              <Text variant="small" className="tabular-nums">
                {line.subject === "item" ? `${line.tripTitle} · ${line.detail ?? ""}` : line.detail}
              </Text>
            </div>
          </li>
        ))}
      </ul>

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
            Cancel
          </Button>
        </div>
      )}

      {(state === "applied" || state === "undoing") && canUndo && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={onUndo}
          disabled={state === "undoing"}
        >
          {state === "undoing" ? <Spinner /> : <Undo2 />}
          Undo
        </Button>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: ProposalState }) {
  if (state === "applied" || state === "undoing") return <Badge variant="success">Applied</Badge>;
  if (state === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  if (state === "undone") return <Badge variant="outline">Undone</Badge>;
  return null;
}

function LineIcon({ line }: { line: TravelChangeLine }) {
  const Action = ACTION_ICON[line.action];
  return (
    <span className="relative shrink-0">
      {line.category ? (
        <CategoryIcon category={line.category} />
      ) : (
        <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
          <MapPin className="size-4" />
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full ring-2 ring-card",
          line.action === "add" && "bg-success text-white",
          line.action === "change" && "bg-primary text-primary-foreground",
          line.action === "remove" && "bg-destructive text-white"
        )}
      >
        <Action className="size-3" />
      </span>
    </span>
  );
}
