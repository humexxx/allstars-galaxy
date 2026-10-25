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
import { SportPicker } from "./sport-picker";
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
  const fromContent = useRef(false);

  // Each sport is remembered as it arrives, by the address that asked for it.
  const currentKey = seenKey(activeSport, useSearchParams().get("league"));
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
      fromContent.current = Boolean(contentRef.current?.contains(document.activeElement));
      setTarget(sport);
      setTargetKey(seenKey(sport, params.get("league")));
      startLoading(() => router.push(href, { scroll: false }));
    },
    [router, activeSport]
  );

  // A control inside the view (the league picker) unmounts under the
  // skeleton, and focus fell to <body>. Give it back to the view it opened.
  useEffect(() => {
    if (loading || !fromContent.current) return;
    fromContent.current = false;
    if (document.activeElement === document.body) contentRef.current?.focus({ preventScroll: true });
  }, [loading]);

  const loadingLabel = SPORTS.find((s) => s.id === (target ?? activeSport))?.label;
  const copy = loading && targetKey ? recallSport(viewerId, targetKey) : undefined;
  const shown = copy ?? (loading ? null : { payload, teamFilter, today });
  const shownKey = copy && targetKey ? targetKey : currentKey;

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
      {/* No page header and no strip of sports: the sport's own name row is
          the first row, with the favourites and the sport picker at its end. */}
      <SportHubControls.Provider
        value={
          <>
            <ManageFavoritesSheet favoriteSportIds={favoriteSportIds} trigger="icon" />
            <SportPicker
              active={loading && target ? target : activeSport}
              sports={orderedSports}
              favorites={favSet}
              onPick={(sport) => navigate(`?sport=${sport}`)}
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
                  <SportContent payload={shown.payload} initialTab={copy ? undefined : initialTab} />
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
}: {
  payload: SportPayload;
  initialTab?: string;
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
      return <PadelView data={payload.data} />;
    case "nfl":
      return <NflView data={payload.data} news={payload.news} initialTab={initialTab} />;
    case "lol":
      return <LolView data={payload.data} />;
  }
}
