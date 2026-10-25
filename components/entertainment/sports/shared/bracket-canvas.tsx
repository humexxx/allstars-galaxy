"use client";

import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type Ref } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eyebrow, Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { isCalendarDay } from "@/lib/utils/date";
import type { Team } from "@/types/sports";

import type { MatchTimeFormat } from "./match-time";
import { TeamBadge } from "./team-badge";

export type BracketItem = {
  key: string;
  node: ReactNode;
  /** A label over the box inside its column: "Third place". */
  caption?: string;
};

export type BracketColumn = {
  key: string;
  label: string;
  /** The round being played: its heading is lit. */
  current?: boolean;
  /** Which half of a two-sided draw the column is, whose round name the other half repeats. */
  half?: "top" | "bottom";
  items: BracketItem[];
};

/** A branch from one box to another, by their item keys. */
export type BracketEdge = { from: string; to: string };

/**
 * A horizontal run, a rounded turn, the vertical drop, and in again — either
 * way across: a two-sided bracket's right half runs right to left.
 */
export function elbow(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  const dy = y2 - y1;
  const dx = x2 < x1 ? -1 : 1;
  const r = Math.min(8, Math.abs(dy) / 2, Math.abs(x2 - x1) / 4);
  if (r < 1) return `M${x1},${y1} L${x2},${y2}`;
  const s = Math.sign(dy);
  return [
    `M${x1},${y1}`,
    `H${mid - dx * r}`,
    `Q${mid},${y1} ${mid},${y1 + s * r}`,
    `V${y2 - s * r}`,
    `Q${mid},${y2} ${mid + dx * r},${y2}`,
    `H${x2}`,
  ].join(" ");
}

/**
 * A box's place in the canvas from layout offsets, the space the branches are
 * drawn in: a scroll or a transform on an ancestor does not skew them as it
 * does a box measured on screen.
 */
function placeIn(canvas: HTMLElement, el: HTMLElement): { left: number; right: number; middle: number } | null {
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== canvas) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node !== canvas) return null;
  return { left, right: left + el.offsetWidth, middle: top + el.offsetHeight / 2 };
}

/**
 * Columns of boxes joined by branches — the layout every bracket in the hub
 * shares, Swiss stage and knockout alike.
 *
 * The branches are drawn over the laid-out boxes, measured after layout: a
 * box is as tall as what it holds, so where a branch starts and lands is only
 * known once it is on the page. Wider than its card, it scrolls sideways, as
 * a printed bracket would; `w-max min-w-full` sizes the canvas to the columns
 * so the branches cover the part scrolled out of view too.
 */
export function BracketCanvas({
  columns,
  edges,
  minColumnWidth = "8rem",
  className,
  viewportRef,
}: {
  columns: BracketColumn[];
  edges: BracketEdge[];
  /** A column never narrows past this; a tennis draw's set scores need more. */
  minColumnWidth?: string;
  className?: string;
  /** The part that scrolls sideways, for controls that move it. Its columns carry `data-column`. */
  viewportRef?: Ref<HTMLDivElement>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const boxes = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<string[]>([]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const next: string[] = [];
      for (const edge of edges) {
        const fromBox = boxes.current.get(edge.from);
        const toBox = boxes.current.get(edge.to);
        const from = fromBox && placeIn(canvas, fromBox);
        const to = toBox && placeIn(canvas, toBox);
        if (!from || !to) continue;
        // From the side of the box that faces the one it feeds.
        const rightward = from.left <= to.left;
        next.push(
          elbow(rightward ? from.right : from.left, from.middle, rightward ? to.left : to.right, to.middle)
        );
      }
      setPaths((prev) => (prev.join() === next.join() ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    for (const box of boxes.current.values()) observer.observe(box);
    return () => observer.disconnect();
  }, [columns, edges]);

  const register = (key: string) => (el: HTMLElement | null) => {
    if (el) boxes.current.set(key, el);
    else boxes.current.delete(key);
  };

  return (
    <div ref={viewportRef} className={cn("-mx-1 overflow-x-auto px-1 pb-1", className)}>
      <div
        ref={canvasRef}
        className="relative grid w-max min-w-full gap-x-5"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${minColumnWidth}, 1fr))` }}
      >
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full overflow-visible text-muted-foreground"
        >
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
          ))}
        </svg>
        {columns.map((column, i) => (
          <div
            key={column.key}
            data-column={i}
            role="group"
            aria-label={[column.label, column.half && `${column.half} half`, column.current && "being played"]
              .filter(Boolean)
              .join(", ")}
            className="flex flex-col gap-2"
          >
            <Eyebrow as="div" size="sm" aria-hidden className={cn(column.current && "text-foreground")}>
              {column.label}
            </Eyebrow>
            <ul role="list" className="flex flex-1 flex-col justify-around gap-4">
              {column.items.map((item) => (
                <li key={item.key} className="flex flex-col gap-1">
                  {item.caption && (
                    <Eyebrow as="div" size="sm">
                      {item.caption}
                    </Eyebrow>
                  )}
                  <div ref={register(item.key)}>{item.node}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A team in a bracket box: its badge and code, or a dashed TBD slot. */
export function BracketTeam({
  team,
  muted = false,
  strong = false,
}: {
  team?: Team | null;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", muted && "text-muted-foreground")}>
      {team ? (
        <TeamBadge team={team} size="sm" className="size-5" />
      ) : (
        <span aria-hidden className="size-5 shrink-0 rounded-full border border-dashed" />
      )}
      <span className={cn("truncate", strong && "font-semibold", !team && "text-muted-foreground")}>
        {team?.code ?? "TBD"}
      </span>
      {strong && <span className="sr-only">, won</span>}
    </span>
  );
}

/**
 * When a match is, as the small print under it says it: the day and the
 * time, or just the day for a provider that dates matches by calendar day.
 */
export function bracketWhen(date: string, format: MatchTimeFormat): string {
  return isCalendarDay(date) ? format.shortDay(date) : `${format.shortDay(date)} · ${format.time(date)}`;
}

/** The small print under a match: when it is, in the reader's zone. */
export function BracketDate({ children }: { children: ReactNode }) {
  return <Mono className="block truncate text-2xs text-muted-foreground">{children}</Mono>;
}

/**
 * One match's box contents as a button that opens a popover with what the
 * box has no room for. A click, not a hover: a tooltip never opens for a tap,
 * nor for a screen reader that reads the page without moving focus.
 *
 * A button holds only phrasing content, so whatever goes in is spans.
 */
export function MatchHover({
  children,
  details,
  className,
}: {
  children: ReactNode;
  details: ReactNode;
  className?: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full cursor-pointer text-left focus-visible:outline-hidden transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-expanded:bg-muted/60",
            className
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Match details"
        side="right"
        sideOffset={6}
        className="w-auto max-w-xs p-3 text-xs"
        // The popover sits at the end of <body>: Tab out of it would leave the
        // bracket. Closing it hands focus back to the box, and Tab goes on from there.
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="grid gap-0.5">{details}</div>
      </PopoverContent>
    </Popover>
  );
}
