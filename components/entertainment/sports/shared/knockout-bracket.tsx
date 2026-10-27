"use client";

import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { Trophy } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Mono } from "@/components/ui/typography";
import { isBracketDrawn } from "@/lib/sports/bracket";
import { cn } from "@/lib/utils";
import type { BracketLink, BracketMatch, BracketRound, Team } from "@/types/sports";

import {
  BracketCanvas,
  BracketDate,
  BracketTeam,
  bracketWhen,
  MatchHover,
  type BracketColumn,
  type BracketEdge,
  type BracketItem,
} from "./bracket-canvas";
import { prefersReducedMotion } from "./reveal";
import { useMatchTime } from "./time-zone-context";

type KnockoutBracketProps = {
  rounds: BracketRound[];
  teams: Map<string, Team>;
  className?: string;
  /**
   * How one tie is drawn. Football, LoL and the NFL share the default box;
   * tennis passes its own, because a draw wants seeds, flags and set scores.
   */
  renderMatch?: (match: BracketMatch, teams: Map<string, Team>) => ReactNode;
  /** A column never narrows past this. */
  minColumnWidth?: string;
  /**
   * A bracket that is not a plain knockout (a double elimination) brings its
   * own branches, each winner to its next match. Its rounds come in the order
   * played, the lower bracket's ties under the upper's.
   */
  links?: BracketLink[];
};

/** Index of the round being played: the first with an undecided tie, or -1. */
function playingRoundIndex(rounds: BracketRound[]): number {
  return rounds.findIndex((r) => r.matches.some((m) => !m.winnerTeamId));
}

/**
 * The round a bracket opens on: the one being played, or for a decided one
 * the last eight — the quarter-finals, semis and final, rather than a lone
 * final or the 64 ties of a first round.
 */
function openingRound(rounds: BracketRound[]): number {
  const playing = playingRoundIndex(rounds);
  return playing === -1 ? Math.max(0, rounds.length - 3) : playing;
}

/**
 * The most ties a round in focus shows at once. A bigger round — a Grand
 * Slam's first, 64 ties — comes in sections of this many, each with its own
 * way to the final, the way a printed draw is read a section at a time.
 */
const SECTION_TIES = 8;

/** A section's ties in round `offset` after the round in focus: the ones its ties feed. */
function sectionRange(section: number, offset: number, length: number): [number, number] {
  const span = SECTION_TIES / 2 ** offset;
  const from = Math.min(Math.floor(section * span), length - 1);
  return [from, Math.min(length, Math.max(from + 1, Math.ceil((section + 1) * span)))];
}

/**
 * The most ties a half of the draw may have for the whole bracket to be drawn
 * at once, two-sided: four, about 400px — a playoff (the NBA's, MLB's) or a
 * Champions League from its last 16. A tennis or padel draw has more.
 */
const HALF_TIES = 4;

/** A round's ties by the half of the draw they are in: the top half, then the bottom. */
function halves<T>(list: T[]): [T[], T[]] {
  const mid = Math.ceil(list.length / 2);
  return [list.slice(0, mid), list.slice(mid)];
}

/** "R16", "QF": a round's name short enough for a tab on a phone, where one is. */
export function shortRoundLabel(label: string): string {
  const numbered = /^Round (?:of )?(\d+)$/i.exec(label);
  if (numbered) return `R${numbered[1]}`;
  if (/^first round$/i.test(label)) return "R1";
  if (/^quarter-?finals?$/i.test(label)) return "QF";
  if (/^semi-?finals?$/i.test(label)) return "SF";
  return label;
}

/**
 * Reorder the active round's matches so the two feeders of next-round match k
 * sit at positions 2k / 2k+1. Feeders are matched by team membership (a
 * next-round slot already naming a team must be fed by the tie that team played
 * in); undecided slots fill up with the remaining matches in original order.
 */
function orderPairs(active: BracketMatch[], next: BracketMatch[]): Array<BracketMatch | null> {
  const used = new Set<string>();
  const slots: Array<BracketMatch | null> = next.flatMap(() => [null, null]);

  const feederFor = (teamId: string | null | undefined): BracketMatch | undefined =>
    teamId
      ? active.find(
          (m) => !used.has(m.id) && (m.homeTeamId === teamId || m.awayTeamId === teamId)
        )
      : undefined;

  next.forEach((nm, k) => {
    const top = feederFor(nm.homeTeamId);
    if (top) {
      slots[k * 2] = top;
      used.add(top.id);
    }
    const bottom = feederFor(nm.awayTeamId);
    if (bottom) {
      slots[k * 2 + 1] = bottom;
      used.add(bottom.id);
    }
  });

  const leftovers = active.filter((m) => !used.has(m.id));
  let li = 0;
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) slots[i] = leftovers[li++] ?? null;
  }
  return slots;
}

/**
 * Every round in tree order, worked back from the final: each round sorted so
 * the two ties that feed a later one sit next to each other. `paired[i]` says
 * round i halves into round i + 1 — only then are there branches between them.
 */
function treeOrder(rounds: BracketRound[]): { rounds: BracketRound[]; paired: boolean[] } {
  const ordered = rounds.map((r) => ({ ...r, matches: [...r.matches] }));
  const paired = rounds.map(() => false);
  for (let i = ordered.length - 2; i >= 0; i--) {
    const next = ordered[i + 1].matches;
    if (ordered[i].matches.length !== next.length * 2) continue;
    ordered[i].matches = orderPairs(ordered[i].matches, next).filter(
      (m): m is BracketMatch => m !== null
    );
    paired[i] = true;
  }
  return { rounds: ordered, paired };
}

/**
 * Whether a touch started inside something that scrolls sideways: there a
 * horizontal swipe scrolls, it does not change the round.
 */
function inSideScroller(target: EventTarget | null, root: HTMLElement): boolean {
  for (let el = target as HTMLElement | null; el && el !== root; el = el.parentElement) {
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/**
 * A knockout one round at a time, the way a phone's sports results show one.
 *
 * The round in focus is a plain list, one tie under the other; each later
 * round sits beside it with every tie halfway between the two that feed it,
 * joined by branches, and the rounds before it are put away. So the bracket is
 * as tall as the round in focus, not as its first round: a Grand Slam's
 * quarter-finals are four ties tall, where the whole draw drawn at once was 32.
 *
 * It opens on the round being played. The tabs over it move the focus; on a
 * phone, where the round in focus fills most of the width and the next one
 * shows at the edge, so does a swipe across it.
 *
 * A small knockout on a wide screen — a playoff, whose halves are its
 * conferences or leagues — is drawn whole instead, as a printed bracket is:
 * the top half on the left running in, the bottom half mirrored on the right,
 * the final between them. Both are rendered and the bracket's own width picks
 * one, so a phone never paints the wide one first.
 */
export function KnockoutBracket({
  rounds,
  teams,
  className,
  renderMatch,
  minColumnWidth = "8rem",
  links,
}: KnockoutBracketProps): React.ReactElement | null {
  const tree = useMemo(() => {
    const main = rounds.filter((r) => r.id !== "third-place");
    // Given branches mean the rounds do not halve: nothing to sort by them.
    return links ? { rounds: main, paired: main.map(() => false) } : treeOrder(main);
  }, [rounds, links]);
  const thirdPlace = rounds.find((r) => r.id === "third-place");
  const drawn = rounds.length > 0 && isBracketDrawn(rounds);
  const root = useRef<HTMLDivElement>(null);
  const wholeViewport = useRef<HTMLDivElement>(null);
  const tabRow = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; ignore: boolean } | null>(null);

  // Back to the opening round when the bracket is another one (a new
  // tournament or league), never on a revalidation of the same rounds.
  const shape = tree.rounds.map((r) => r.id).join();
  const [focus, setFocus] = useState({ shape, round: openingRound(tree.rounds), section: 0, moved: 0 });
  if (focus.shape !== shape) setFocus({ shape, round: openingRound(tree.rounds), section: 0, moved: 0 });

  const { columns, edges, whole } = useMemo(() => {
    const playing = playingRoundIndex(tree.rounds);
    const last = tree.rounds.length - 1;
    const item = (match: BracketMatch, caption?: string): BracketItem => ({
      key: match.id,
      caption,
      node: <TieBox match={match} teams={teams} renderMatch={renderMatch} />,
    });
    const columns = tree.rounds.map((round, i) => ({
      key: round.id,
      label: round.label,
      current: i === playing,
      // A double elimination's lower bracket says so on its first tie in each round.
      items: round.matches.map((m, k) =>
        item(m, m.side === "lower" && round.matches[k - 1]?.side !== "lower" ? "Lower bracket" : undefined)
      ),
      // Under the final, with no branch into it: the semi-finals' losers play it.
      after: i === last ? (thirdPlace?.matches ?? []).map((m) => item(m, thirdPlace?.label)) : [],
    }));
    const edges: BracketEdge[] =
      links ??
      tree.rounds.slice(0, last).flatMap((round, i) => {
        if (!tree.paired[i]) return [];
        return tree.rounds[i + 1].matches.flatMap((target, k) =>
          [round.matches[k * 2], round.matches[k * 2 + 1]]
            .filter((feeder): feeder is BracketMatch => Boolean(feeder))
            .map((feeder) => ({ from: feeder.id, to: target.id }))
        );
      });
    // Two halves only for a knockout: every round before the final splits
    // evenly, and from the second on each feeds the next (the NFL's wild-card
    // round of six does not halve into four, but the rest does).
    const before = columns.slice(0, last);
    const halvesFit =
      !links &&
      last > 0 &&
      tree.rounds[last].matches.length === 1 &&
      before.every((c, i) => c.items.length % 2 === 0 && (i === 0 || tree.paired[i])) &&
      before.every((c) => c.items.length / 2 <= HALF_TIES);
    const half = (column: (typeof columns)[number], side: "top" | "bottom"): BracketColumn => ({
      key: `${column.key}-${side}`,
      label: column.label,
      current: column.current,
      half: side,
      items: halves(column.items)[side === "top" ? 0 : 1],
    });
    const whole: BracketColumn[] | null = halvesFit
      ? [
          ...before.map((column) => half(column, "top")),
          { ...columns[last], key: `${columns[last].key}-centre`, items: [...columns[last].items, ...columns[last].after] },
          ...before.map((column) => half(column, "bottom")).reverse(),
        ]
      : null;
    return { columns, edges, whole };
  }, [tree, thirdPlace, teams, renderMatch, links]);

  // Sections only where every round from the focus on halves into the next:
  // only there does a section have a way of its own to the final.
  const sectionsAt = (round: number): number =>
    !links && tree.paired.slice(round, -1).every(Boolean) && columns[round].items.length > SECTION_TIES
      ? Math.ceil(columns[round].items.length / SECTION_TIES)
      : 1;
  const sections = sectionsAt(focus.round);
  const section = Math.min(focus.section, sections - 1);

  const go = (round: number): void => {
    if (round < 0 || round >= columns.length || round === focus.round) return;
    // The same part of the draw: on, the section its ties feed; back, its first.
    const shift = round - focus.round;
    const next = shift > 0 ? Math.floor(section / 2 ** shift) : section * 2 ** -shift;
    setFocus({ shape, round, section: Math.min(next, sectionsAt(round) - 1), moved: shift > 0 ? 1 : -1 });
  };

  const shown: BracketColumn[] = columns.slice(focus.round).map((column, offset) => {
    const [from, to] = sections > 1 ? sectionRange(section, offset, column.items.length) : [0, column.items.length];
    return { ...column, items: [...column.items.slice(from, to), ...column.after] };
  });

  // Drawn whole and a little wider than its card, it opens with the final in
  // the middle: both ends cut alike say there is more either way.
  useLayoutEffect(() => {
    const el = wholeViewport.current;
    if (!el || el.offsetParent === null) return;
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, [whole]);

  // The round in focus keeps its tab in view: a playoff's names ("Championship
  // Series") put the last rounds past the edge of a phone.
  useLayoutEffect(() => {
    const row = tabRow.current;
    const tab = row?.querySelector<HTMLElement>('[data-state="on"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = Math.max(0, tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2);
  }, [focus.round, columns.length]);

  // A round further on is shorter: if the reader was down in a long one, the
  // bracket's top comes back into view instead of the page ending above them.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || focus.moved === 0 || el.getBoundingClientRect().top >= 0) return;
    el.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [focus]);

  if (!drawn) {
    return (
      <EmptyState
        icon={Trophy}
        title="The bracket is not drawn yet"
        description="Nobody has qualified into it."
        className={className}
      />
    );
  }

  const onTouchStart = (event: TouchEvent<HTMLDivElement>): void => {
    const touch = event.touches[0];
    swipe.current = { x: touch.clientX, y: touch.clientY, ignore: inSideScroller(event.target, event.currentTarget) };
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>): void => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.ignore) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Sideways, and clearly so: a scroll down the page that drifts is not a swipe.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(focus.round + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      ref={root}
      // Its own width decides the layout, not the window: a phone, or a
      // narrow card on a desktop.
      className={cn("@container scroll-mt-26 md:scroll-mt-12", className)}
      style={{ "--bracket-min": minColumnWidth } as React.CSSProperties}
    >
      {whole && (
        <div data-layout="whole" className="hidden @4xl:block">
          <BracketCanvas
            columns={whole}
            edges={edges}
            minColumnWidth="var(--bracket-min)"
            viewportRef={wholeViewport}
          />
        </div>
      )}
      <div data-layout="rounds" className={cn("flex flex-col gap-3", whole && "@4xl:hidden")}>
        {columns.length > 1 && (
          // The tabs scroll on their own when a draw has more rounds than fit.
          <div ref={tabRow} className="relative -mx-1 overflow-x-auto px-1">
            <ToggleGroup
              type="single"
              size="sm"
              aria-label="Round"
              value={String(focus.round)}
              onValueChange={(value) => {
                if (value) go(Number(value));
              }}
            >
              {columns.map((column, i) => (
                <ToggleGroupItem
                  key={column.key}
                  value={String(i)}
                  aria-label={column.current ? `${column.label}, being played` : column.label}
                  className="gap-1.5 px-3"
                >
                  <span className="@xl:hidden">{shortRoundLabel(column.label)}</span>
                  <span className="hidden @xl:inline">{column.label}</span>
                  {column.current && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {sections > 1 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              aria-label="Section of the draw"
              value={String(section)}
              onValueChange={(value) => {
                if (value) setFocus({ ...focus, section: Number(value), moved: 0 });
              }}
            >
              {Array.from({ length: sections }, (_, i) => (
                <ToggleGroupItem
                  key={i}
                  value={String(i)}
                  aria-label={sections === 2 ? undefined : `Section ${i + 1} of ${sections}`}
                  className="px-3"
                >
                  {sections === 2 ? (i === 0 ? "Top half" : "Bottom half") : i + 1}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        <div
          // A new focus slides in from the side it came from. Under `@xl` the
          // round in focus takes most of the width and the next one shows at
          // the edge; from `@xl` the rounds left fit side by side, scrolling
          // only when they cannot.
          key={`${focus.round}-${section}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className={cn(
            "[--bracket-column:max(var(--bracket-min),72cqw)] @xl:[--bracket-column:var(--bracket-min)]",
            focus.moved > 0 && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-8",
            focus.moved < 0 && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-8"
          )}
        >
          <BracketCanvas
            columns={shown}
            edges={edges}
            minColumnWidth="var(--bracket-column)"
            className="overflow-x-hidden @xl:overflow-x-auto"
          />
        </div>
      </div>
    </div>
  );
}

/** The card for one tie: the sport's own, or the shared box. */
function TieBox({
  match,
  teams,
  renderMatch,
}: {
  match: BracketMatch;
  teams: Map<string, Team>;
  renderMatch?: KnockoutBracketProps["renderMatch"];
}): React.ReactElement {
  if (renderMatch) return <>{renderMatch(match, teams)}</>;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <TieRows match={match} teams={teams} />
    </div>
  );
}

const has = (n: number | null | undefined): n is number => n !== null && n !== undefined;

/**
 * Both teams with the tie's score, and when it is in small print under them.
 *
 * A two-legged tie shows its aggregate once both legs are in, the running
 * total until then, and the day of each leg; the legs' own scores are in the
 * popover. A single match or series shows its score and its day and time.
 */
function TieRows({ match, teams }: { match: BracketMatch; teams: Map<string, Team> }): React.ReactElement | null {
  const format = useMatchTime();
  const legs = match.legs ?? [];
  const decided = Boolean(match.winnerTeamId);
  const played = legs.filter((l) => has(l.homeScore) && has(l.awayScore));

  const scoreOf = (side: "home" | "away"): number | null => {
    if (legs.length === 0) return side === "home" ? (match.homeScore ?? null) : (match.awayScore ?? null);
    const aggregate = side === "home" ? match.aggregateHome : match.aggregateAway;
    if (has(aggregate)) return aggregate;
    if (played.length === 0) return null;
    return played.reduce((sum, l) => sum + ((side === "home" ? l.homeScore : l.awayScore) ?? 0), 0);
  };

  const sides = [
    { id: match.homeTeamId, score: scoreOf("home") },
    { id: match.awayTeamId, score: scoreOf("away") },
  ].map((side) => ({ ...side, team: side.id ? teams.get(side.id) : undefined }));
  const name = (i: 0 | 1): string => sides[i].team?.code ?? "TBD";
  const scored = has(sides[0].score) && has(sides[1].score);

  const dated = legs.flatMap((l, i) => (l.date ? [{ leg: i + 1, day: format.shortDay(l.date) }] : []));
  const when =
    dated.length > 0
      ? dated.map(({ leg, day }, i) => (
          <Fragment key={leg}>
            {i > 0 && " · "}
            <span aria-hidden>L{leg}</span>
            <span className="sr-only">Leg {leg}</span> {day}
          </Fragment>
        ))
      : match.date
        ? bracketWhen(match.date, format)
        : null;

  return (
    <MatchHover
      className="flex flex-col gap-1 px-2.5 py-1.5"
      details={
        <>
          <span className="font-semibold">
            {scored ? `${name(0)} ${sides[0].score}–${sides[1].score} ${name(1)}` : `${name(0)} vs ${name(1)}`}
          </span>
          {legs.length > 0
            ? legs.map((leg, i) => (
                <span key={i}>
                  Leg {i + 1}
                  {leg.date ? ` · ${format.dayTime(leg.date)}` : ""}
                  {has(leg.homeScore) && has(leg.awayScore) ? ` · ${leg.homeScore}–${leg.awayScore}` : ""}
                </span>
              ))
            : match.date && <span>{format.dayTime(match.date)}</span>}
          {(match.bestOf || decided) && (
            <span className="opacity-70">
              {[match.bestOf ? `Best of ${match.bestOf}` : null, decided ? "Final" : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </>
      }
    >
      {sides.map((side, i) => {
        const won = decided && side.id === match.winnerTeamId;
        return (
          <span key={i} className="flex items-center justify-between gap-2 text-xs">
            <BracketTeam team={side.team} muted={decided && !won} strong={won} />
            {has(side.score) && (
              <Mono className={cn(won ? "font-semibold" : "text-muted-foreground")}>{side.score}</Mono>
            )}
          </span>
        );
      })}
      {when && <BracketDate>{when}</BracketDate>}
    </MatchHover>
  );
}
