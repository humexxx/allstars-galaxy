"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SPORTS } from "@/lib/data/sports/registry";
import type { SportPayload } from "@/lib/sports/payload";
import type { SavedTeamFilter, SportId } from "@/types/sports";

import { ManageFavoritesSheet } from "./manage-favorites-sheet";
import { recallSport, rememberSport, seenKey } from "./seen-sports";
import { SportHubControls } from "./shared/sport-shell";
import { SavedTeamFilterProvider } from "./shared/team-filter-context";
import { SportsTodayProvider } from "./shared/time-zone-context";
import { favoritesFirst, SportPicker } from "./sport-picker";
import { SportSkeleton, SportsNavigationContext } from "./sports-navigation";
import { F1View } from "./sports/f1-view";
import { FootballView } from "./sports/football-view";
import { LolView } from "./sports/lol-view";
import { MlbView } from "./sports/mlb-view";
import { NbaView } from "./sports/nba-view";
import { NflView } from "./sports/nfl-view";
import { NhlView } from "./sports/nhl-view";
import { PadelView } from "./sports/padel-view";
import { SurfView } from "./sports/surf-view";
import { TennisView } from "./sports/tennis-view";

type SportsHubProps = {
  activeSport: SportId;
  /** Favourites are starred and listed first in the sport picker. */
  favoriteSportIds?: SportId[];
  /** Exactly the sport being shown — the page fetches one, not all eight. */
  payload: SportPayload;
  /** `?tab=` — lets a link open a view on a given tab (F1's news). */
  initialTab?: string;
  /** The reader's today, decided on the server (`getRequestTodayIso`). */
  today: string;
  /** The match list on screen and the teams last picked in it; null for a sport without one. */
  teamFilter?: SavedTeamFilter | null;
  /** Whose hub this is (the effective user): the sports seen are kept per account. */
  viewerId: string;
};

const SPORT_PICKER = '[role="group"][aria-label="Sports"]';

/**
 * Where focus goes back to once a move has unmounted the control it was made
 * from: that control as found again in what replaced the view, or (null) the
 * view itself.
 */
const RETURN_TO = {
  title: 'h1 [aria-haspopup="menu"]',
  sport: `${SPORT_PICKER} [aria-current="page"]`,
  view: null,
} as const;

type ReturnTo = keyof typeof RETURN_TO;

/** The title's menu is portalled to <body>, so a league picked in it is never inside the content. */
function returnFrom(active: Element | null, content: HTMLElement | null): ReturnTo | null {
  if (active?.closest('[role="menu"]')) return "title";
  if (active?.closest(SPORT_PICKER)) return "sport";
  return content?.contains(active) ? "view" : null;
}

export function SportsHub({
  activeSport,
  favoriteSportIds = [],
  payload,
  initialTab,
  today,
  teamFilter = null,
  viewerId,
}: SportsHubProps): React.ReactElement {
  const favSet = useMemo(() => new Set(favoriteSportIds), [favoriteSportIds]);
  const router = useRouter();
  const [loading, startLoading] = useTransition();
  const [target, setTarget] = useState<SportId | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<ReturnTo | null>(null);

  // Each sport is remembered as it arrives, by the address that asked for it.
  const league = useSearchParams().get("league");
  const currentKey = seenKey(activeSport, league);
  useEffect(() => {
    rememberSport(viewerId, currentKey, { payload, teamFilter, today });
  }, [viewerId, currentKey, payload, teamFilter, today]);

  // Every move inside the hub — another sport, another league — runs in this
  // one transition. Until the next sport's data is here, the content is the
  // copy last seen of it (within half an hour), so going back to a sport is
  // instant and the fresh copy takes its place when it lands; a sport not
  // seen yet is a skeleton of it rather than the old one with a spinner.
  const navigate = useCallback(
    (href: string) => {
      const params = new URLSearchParams(href.split("?")[1] ?? "");
      const sport = (params.get("sport") as SportId | null) ?? activeSport;
      returnTo.current = returnFrom(document.activeElement, contentRef.current);
      setTarget(sport);
      setTargetKey(seenKey(sport, params.get("league")));
      startLoading(() => router.push(href, { scroll: false }));
    },
    [router, activeSport]
  );

  const loadingLabel = SPORTS.find((s) => s.id === (target ?? activeSport))?.label;
  const copy = loading && targetKey ? recallSport(viewerId, targetKey) : undefined;
  const shown = copy ?? (loading ? null : { payload, teamFilter, today });
  const shownKey = copy && targetKey ? targetKey : currentKey;
  const skeleton = !shown;

  // The control a move was made from (a league in the title's menu, a sport
  // in the picker) unmounts with the view it sat in, and focus fell to
  // <body>. Put it on that control again in each view that replaces it: the
  // copy, the skeleton's picker, the fresh view. The skeleton has no title,
  // so a league waits for the view. A passive effect, so a closed menu has
  // lifted the aria-hidden it laid over the page first.
  useEffect(() => {
    const to = returnTo.current;
    if (!to) return;
    const root = contentRef.current;
    if (document.activeElement === document.body) {
      const selector = RETURN_TO[to];
      const control = selector ? root?.querySelector<HTMLElement>(selector) : null;
      if (control) control.focus({ preventScroll: true });
      else if (!loading) root?.focus({ preventScroll: true });
    }
    if (!loading) returnTo.current = null;
  }, [loading, shownKey, skeleton]);

  // Render favourites first so the user lands on their most-watched sports.
  const orderedSports = useMemo(() => favoritesFirst(favSet), [favSet]);
  const shownSport = loading && target ? target : activeSport;

  return (
    <SportsNavigationContext.Provider value={navigate}>
      {/* No page header and no strip of sports: the sport's own name row is
          the first row, with the favourites and the sport picker at its end. */}
      <SportHubControls.Provider
        value={
          <>
            <ManageFavoritesSheet favoriteSportIds={favoriteSportIds} trigger="icon" />
            <SportPicker
              active={shownSport}
              sports={orderedSports}
              favorites={favSet}
              onPick={(sport) => {
                if (sport !== shownSport) navigate(`?sport=${sport}`);
              }}
            />
          </>
        }
      >
        {/* The skeleton is aria-hidden; this is what a screen reader hears. */}
        <p role="status" className="sr-only">
          {loading ? `Loading ${loadingLabel ?? "sport"}…` : ""}
        </p>
        <div ref={contentRef} tabIndex={-1} aria-busy={loading} className="outline-none">
          {shown ? (
            // Keyed by address: a copy and the fresh one of the same sport are
            // one view, and keep its tab and picks; another sport starts anew.
            <SportsTodayProvider key={shownKey} today={shown.today}>
              <SavedTeamFilterProvider filter={shown.teamFilter}>
                <div className="flex flex-col gap-6">
                  {shown.payload.sample && <SampleDataNotice />}
                  {/* Keyed by tab too: a link to another tab of the sport on
                      screen (the assistant's) opens it, which a view's
                      uncontrolled tabs would otherwise ignore. */}
                  <SportContent
                    key={copy ? "" : (initialTab ?? "")}
                    payload={shown.payload}
                    initialTab={copy ? undefined : initialTab}
                    league={league}
                  />
                </div>
              </SavedTeamFilterProvider>
            </SportsTodayProvider>
          ) : (
            <SportSkeleton sport={target ?? activeSport} />
          )}
        </div>
      </SportHubControls.Provider>
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
function SampleDataNotice(): React.ReactElement {
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

function SportContent({
  payload,
  initialTab,
  league,
}: {
  payload: SportPayload;
  initialTab?: string;
  /** `?league=`: LoL's league or event; football's arrives as its payload. */
  league: string | null;
}): React.ReactElement {
  switch (payload.sport) {
    case "football":
      return (
        <FootballView league={payload.league} options={payload.options} news={payload.news} initialTab={initialTab} />
      );
    case "f1":
      return (
        <F1View
          data={payload.data}
          news={payload.news}
          initialTab={initialTab}
          weekend={payload.weekend}
        />
      );
    case "nba":
      return <NbaView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "tennis":
      return <TennisView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "padel":
      return <PadelView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "nfl":
      return <NflView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "mlb":
      return <MlbView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "nhl":
      return <NhlView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "surf":
      return <SurfView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "lol":
      return <LolView data={payload.data} news={payload.news} initialTab={initialTab} initialRegion={league} />;
  }
}
