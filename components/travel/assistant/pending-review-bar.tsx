"use client";

import { Check, MessageCircle, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { PendingProposal } from "./pending-preview";

/**
 * Where a proposal is decided, on the page that shows it.
 *
 * It floats over whatever page is open while the proposal waits and the chat
 * is closed — on a phone the chat closes on its own to make room — so the
 * changes can be looked at full screen and applied or discarded without going
 * back to it.
 */
export function PendingReviewBar({
  proposal,
  onOpenChat,
  unread,
}: {
  proposal: PendingProposal;
  onOpenChat: () => void;
  /** The assistant said something after the proposal that was not read yet. */
  unread: boolean;
}) {
  const changes = `${proposal.count} change${proposal.count === 1 ? "" : "s"} waiting for you`;
  return (
    <div
      role="region"
      aria-label="Changes to review"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-3 rounded-2xl border bg-popover/95 p-3 shadow-lg backdrop-blur-md">
        <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <Sparkles className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Text weight="medium" className="truncate">
            {proposal.summary}
          </Text>
          <Text variant="small">{changes}</Text>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onOpenChat}
          aria-label="Open the chat"
          className="relative shrink-0"
        >
          <MessageCircle />
          {unread && (
            <span aria-hidden className="absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={proposal.discard}
          disabled={proposal.applying}
          aria-label="Discard"
          className="shrink-0"
        >
          <X />
          <span className="hidden sm:inline">Discard</span>
        </Button>
        <Button
          size="sm"
          onClick={proposal.apply}
          disabled={proposal.applying}
          className={cn("shrink-0")}
        >
          {proposal.applying ? <Spinner /> : <Check />}
          Apply
        </Button>
      </div>
    </div>
  );
}
