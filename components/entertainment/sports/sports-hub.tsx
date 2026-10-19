"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Star } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SPORTS } from "@/lib/data/sports/registry";
import type { SportPayload } from "@/lib/sports/payload";
import type { SportId, SportMeta } from "@/types/sports";

import { SportsTodayProvider } from "./shared/time-zone-context";
import { SportSkeleton, SportsNavigationContext } from "./sports-navigation";
import { F1View } from "./sports/f1-view";
import { FootballView } from "./sports/football-view";
import { LolView } from "./sports/lol-view";
import { NbaView } from "./sports/nba-view";
import { NflView } from "./sports/nfl-view";
import { PadelView } from "./sports/padel-view";
import { TennisView } from "./sports/tennis-view";

type SportsHubProps = {
  activeSport: SportId;
  /** Favourites surface as starred tabs and get pinned to the front of the strip. */
  favoriteSportIds?: SportId[];
  /** Exactly the sport being shown — the page fetches one, not all eight. */
  payload: SportPayload;
  /** `?tab=` — lets a link open a view on a given tab (F1's news). */
  initialTab?: string;
  /** The reader's today, decided on the server (`getRequestTodayIso`). */
  today: string;
};

export function SportsHub({
  activeSport,
  favoriteSportIds = [],
  payload,
  initialTab,
  today,
}: SportsHubProps) {
  const favSet = useMemo(() => new Set(favoriteSportIds), [favoriteSportIds]);
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [target, setTarget] = useState<SportId | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fromContent = useRef(false);

  // Every move inside the hub — another sport, another league — runs in this
  // one transition: until the next sport's data is on screen, the content is
  // a skeleton of it rather than the old sport with a spinner by its control.
  const navigate = useCallback(
    (href: string) => {
      const sport = new URLSearchParams(href.split("?")[1] ?? "").get("sport");
      fromContent.current = Boolean(contentRef.current?.contains(document.activeElement));
      setTarget(sport as SportId | null);
      startLoading(() => router.push(href, { scroll: false }));
    },
    [router]
  );

  // A control inside the view (the league picker) unmounts under the
  // skeleton, and focus fell to <body>. Give it back to the view it opened.
  useEffect(() => {
    if (loading || !fromContent.current) return;
    fromContent.current = false;
    if (document.activeElement === document.body) contentRef.current?.focus({ preventScroll: true });
  }, [loading]);

  const loadingLabel = SPORTS.find((s) => s.id === (target ?? activeSport))?.label;

  // Render favourites first so the user lands on their most-watched sports.
  const orderedSports = useMemo(
    () =>
      [...SPORTS].sort((a, b) => {
        const aFav = favSet.has(a.id) ? 0 : 1;
        const bFav = favSet.has(b.id) ? 0 : 1;
        return aFav - bFav;
      }),
    [favSet]
  );

  return (
    <SportsNavigationContext.Provider value={navigate}>
      <div className="flex flex-col gap-6">
        <SportSelector
          active={loading && target ? target : activeSport}
          favSet={favSet}
          sports={orderedSports}
          onPick={(sport) => navigate(`?sport=${sport}`)}
        />
        {/* The skeleton is aria-hidden; this is what a screen reader hears. */}
        <p role="status" className="sr-only">
          {loading ? `Loading ${loadingLabel ?? "sport"}…` : ""}
        </p>
        <div ref={contentRef} tabIndex={-1} aria-busy={loading} className="outline-none">
          {loading ? (
            <SportSkeleton />
          ) : (
            <SportsTodayProvider today={today}>
              <div className="flex flex-col gap-6">
                {payload.sample && <SampleDataNotice />}
                <SportContent payload={payload} initialTab={initialTab} />
              </div>
            </SportsTodayProvider>
          )}
        </div>
      </div>
    </SportsNavigationContext.Provider>
  );
}

/**
 * Says out loud that a sport is showing its fixture.
 *
 * Every sport has a live provider now, but each falls back to a hand-written
 * season when its feed has never answered — a missing key, a provider down on
 * a cold cache. Nothing on the page admitted it, which made a stale scoreboard
 * look like a broken live one.
 */
function SampleDataNotice() {
  return (
    // A standing note, not an alert: nothing happened, so nothing to announce.
    <Alert role="note">
      <Info />
      <AlertTitle>Sample data</AlertTitle>
      <AlertDescription>
        The live feed for this sport is not answering, so these fixtures and
        standings are made up.
      </AlertDescription>
    </Alert>
  );
}

/**
 * The sport strip. Each sport is a link (`?sport=`), so it navigates like one:
 * middle-click opens it, Back returns, and the active one is `aria-current`.
 */
function SportSelector({
  active,
  favSet,
  sports,
  onPick,
}: {
  active: SportId;
  favSet: Set<SportId>;
  sports: SportMeta[];
  onPick: (sport: SportId) => void;
}) {
  // A plain click goes through the hub's transition; a modified one (a new
  // tab, a new window) stays the link it is.
  const pick = (event: MouseEvent<HTMLAnchorElement>, sport: SportId) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (sport !== active) onPick(sport);
  };
  return (
    <nav aria-label="Sports" className="relative -mx-2 overflow-x-auto px-2 pb-1">
      <ul className="flex gap-2">
        {sports.map((sport) => {
          const isActive = sport.id === active;
          const link = (
            <Link
              href={`?sport=${sport.id}`}
              scroll={false}
              onClick={(event) => pick(event, sport.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isActive
                  ? "border-foreground/15 bg-foreground/5 text-foreground shadow-xs"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span aria-hidden className="text-base leading-none">
                {sport.emoji}
              </span>
              <span>{sport.shortLabel}</span>
              {favSet.has(sport.id) && (
                <>
                  <Star aria-hidden className="size-3 fill-warning text-warning" strokeWidth={2} />
                  <span className="sr-only">(favorite)</span>
                </>
              )}
            </Link>
          );
          return (
            <li key={sport.id} className="shrink-0">
              {/* The strip shows the short label; the full name ("League of
                  Legends") rides in a tooltip where the two differ. */}
              {sport.label === sport.shortLabel ? (
                link
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent>{sport.label}</TooltipContent>
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SportContent({
  payload,
  initialTab,
}: {
  payload: SportPayload;
  initialTab?: string;
}) {
  switch (payload.sport) {
    case "football":
      return <FootballView league={payload.league} options={payload.options} />;
    case "f1":
      return <F1View data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "nba":
      return <NbaView data={payload.data} />;
    case "tennis":
      return <TennisView data={payload.data} />;
    case "padel":
      return <PadelView data={payload.data} />;
    case "nfl":
      return <NflView data={payload.data} />;
    case "lol":
      return <LolView data={payload.data} />;
  }
}
