"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CardPending = { pending: boolean; startTransition: TransitionStartFunction };

const CardPendingContext = createContext<CardPending | null>(null);

/**
 * One dashboard card's championship change, shared by the picker that starts
 * it and the parts of the card it will replace: while the card comes back for
 * the new championship, those parts stand in as skeletons.
 */
export function CardPendingProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [pending, startTransition] = useTransition();
  return <CardPendingContext.Provider value={{ pending, startTransition }}>{children}</CardPendingContext.Provider>;
}

/** The card's transition, or one of the caller's own outside a card. */
export function useCardTransition(): [boolean, TransitionStartFunction] {
  const card = useContext(CardPendingContext);
  const own = useTransition();
  return card ? [card.pending, card.startTransition] : own;
}

/**
 * A part of a card that a championship change replaces. While it is pending
 * the part keeps its place, hidden, so the skeleton laid over it is exactly
 * its size and nothing below moves; the content comes back in the same box.
 * `box` is the lead's one block; `list` an eyebrow over as many rows as fit.
 */
export function PendingArea({
  skeleton,
  className,
  overlayClassName,
  children,
}: {
  skeleton: "box" | "list";
  className?: string;
  /** Where the skeleton sits: inside the area's padding. */
  overlayClassName?: string;
  children: ReactNode;
}): React.ReactElement {
  const pending = useContext(CardPendingContext)?.pending ?? false;
  return (
    <div className={cn("relative", className)} aria-busy={pending || undefined}>
      {/* `contents` keeps the children the area's own flex items; the
          visibility it hides them with is inherited through it. */}
      <div className={cn("contents", pending && "invisible")} inert={pending || undefined}>
        {children}
      </div>
      {pending &&
        (skeleton === "box" ? (
          <Skeleton className={cn("absolute inset-0 rounded-lg", overlayClassName)} />
        ) : (
          <div aria-hidden className={cn("absolute inset-0 flex flex-col gap-1.5 overflow-hidden", overlayClassName)}>
            <Skeleton className="h-3 w-16 shrink-0" />
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full shrink-0" />
            ))}
          </div>
        ))}
    </div>
  );
}
