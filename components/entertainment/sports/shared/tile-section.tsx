"use client";

import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import {
  Children,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";

import { fadeIn, holdScrollStill } from "./reveal";
import { RevealPill } from "./reveal-pill";

/**
 * The parts F1's races and padel's and tennis's tournaments share on their
 * Overview: a section under a heading set like a day heading, tiles that are
 * links whose border firms on hover rather than greying, the events already
 * played brought in a few at a time, and the featured card's "View details".
 */

/** Events played that a tap on "Earlier" brings in, and that show once the season is over. */
const EARLIER_STEP = 3;

/** A tile's frame; each list sets its own gap. */
export const TILE =
  "flex w-full flex-col rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/50";

/** The size, padding and gap of a day heading in `MatchesByDate`. */
export function SectionHeading({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <Eyebrow size="sm" asChild>
      <h3 className="py-1">{children}</h3>
    </Eyebrow>
  );
}

export function TileSection({
  title,
  action,
  children,
}: {
  title: string;
  /** At the end of the heading's line: the pill that brings in more. */
  action?: ReactNode;
  children: ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <SectionHeading>{title}</SectionHeading>
        {action}
      </div>
      {Children.count(children) > 0 && (
        <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">{children}</div>
      )}
    </section>
  );
}

/**
 * The events played, none until asked for — or, with nothing left to come
 * (`open`), the last few from the start — and three more a tap. The new tiles
 * land under the ones shown and fade in without moving the page; the focus
 * stays on the pill while there is more, then goes to the first tile it
 * brought in. Each tile carries its id in `attr`.
 */
export function useRevealEarlier<T extends { id: string }>(
  played: readonly T[],
  { open, attr }: { open: boolean; attr: "data-race" | "data-tournament" }
): { listRef: RefObject<HTMLDivElement | null>; earlier: T[]; next: T[]; reveal: () => void } {
  const [shown, setShown] = useState(open ? EARLIER_STEP : 0);
  const listRef = useRef<HTMLDivElement>(null);
  const added = useRef<string[] | null>(null);
  const earlier = played.slice(0, shown);
  const next = played.slice(earlier.length, earlier.length + EARLIER_STEP);

  useLayoutEffect(() => {
    const ids = added.current;
    const root = listRef.current;
    added.current = null;
    if (!ids || !root) return;
    const tiles = ids
      .map((id) => root.querySelector<HTMLElement>(`[${attr}="${id}"]`))
      .filter((tile): tile is HTMLElement => tile !== null);
    const pill = root.querySelector<HTMLElement>("[data-reveal]");
    (pill ?? tiles[0])?.focus({ preventScroll: true });
    tiles.forEach((tile, i) => fadeIn(tile, i * 40));
  }, [shown, attr]);

  const reveal = (): void => {
    if (!listRef.current) return;
    holdScrollStill(listRef.current);
    added.current = next.map((item) => item.id);
    setShown(shown + EARLIER_STEP);
  };

  return { listRef, earlier, next, reveal };
}

/** The "Earlier" pill on the played events' heading, named by what a tap brings in. */
export function EarlierPill({ detail, onClick }: { detail: string; onClick: () => void }): React.ReactElement {
  return <RevealPill icon={History} label="Earlier" detail={detail} data-reveal onClick={onClick} />;
}

/** A featured card's way to the event's own page, at its foot on the right. */
export function ViewDetailsLink({ href, name }: { href: string; name: string }): React.ReactElement {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href} aria-label={`View details: ${name}`}>
        View details
        <ChevronRight data-icon="inline-end" />
      </Link>
    </Button>
  );
}
