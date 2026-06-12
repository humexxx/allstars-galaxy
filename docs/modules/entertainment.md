# Entertainment

> **Status:** In progress (travel shipped + dashboard card; sports UI shipped, favourites end-to-end on DB; LoL, F1, football, padel and tennis wired to free live providers)
> **Last reviewed:** 2026-06-09

## Overview
Two sub-modules: Travel Planner (trips, items, photos, public sharing) and
Sports (live scores, standings and brackets for football, F1, NBA, tennis,
padel, NFL and League of Legends, plus a per-user favourites picker). Five
sports are wired to free live providers (Lolesports for LoL, Jolpica-F1 for F1,
football-data.org for football, Padel API for padel, TheSportsDB for tennis);
NBA and NFL still use mocks.

## Routes
- `/portal/entertainment/travel-planner` — list of trips (authenticated)
- `/portal/entertainment/travel-planner/new` — create trip
- `/portal/entertainment/travel-planner/[id]` — trip detail + editor
- `/trips/[token]` — **public** shared trip view (top-level, no auth)
- `/portal/entertainment/sports` — sports hub with tabs per sport + manage-favourites sheet

## Server actions — `/app/actions/`
- `travel.ts` — trip / item / photo / share CRUD; expense calculations
- `sports.ts` — `setSportFavoriteAction` toggles a sport favourite for the current user

## Services — `/lib/services/`
- `travel-service.ts` — trip / item / photo / share CRUD + `getDashboardTravelSummary` (featured trip with state badge + counts for the dashboard card)
- `sports-service.ts` — favourites CRUD + `getDashboardSportsSummary` that materialises one highlight per favourited sport (LoL via `getLolData()`, F1 via `getF1Data()`, football via `getFootballData()`, padel via `getPadelData()`, rest from mock fixtures)
- `lolesports-service.ts` — `getLolData()` fetches LEC/LCS/LCK/LPL from Lolesports' unofficial API (`esports-api.lolesports.com`), maps to `LolData` including playoff `BracketRound[]` (**one round per standings SECTION**, labelled with the section's own name — `buildLolBracket`; the old TBD-count heuristic remains only as fallback for unnamed sections, because TBD counting collapsed rounds into one column as ties resolved), picks the currently-active tournament (never the future split), maps regular-season stages (`regular_season`, `groups`, `group_stage`) into standings. A completed event missing `result` renders "—", never a fake 0–0. Cached 30 min via `unstable_cache`, falls back to `LOL_DATA` mock on any error
- `jolpica-f1-service.ts` — `getF1Data()` fetches current-season races, driver + constructor standings and results from Jolpica-F1 (`api.jolpi.ca/ergast/f1`, Ergast-compatible drop-in), maps to `F1Data` with derived race status and podium tallies, cached 30 min, falls back to `F1_DATA` mock on any error
- `football-data-service.ts` — `getFootballData()` fetches standings + matches for UCL, La Liga, EPL and Serie A from football-data.org, maps to `FootballLeagueData[]`, cached 30 min, falls back per-league to mocks. Requires `FOOTBALL_DATA_API_KEY`. Knockout competitions (UCL) fetch the full season in ONE matches call and derive both recent matches and the two-legged knockout bracket (`buildKnockoutBracket` pairs legs by team set → aggregate + winner; **aggregate/winner stay `null` until BOTH legs are `FINISHED`** — summing scheduled legs with `?? 0` used to fabricate an aggregate and bold a "winner" mid-tie); league-only competitions use a ±60d window (capped 40). Finished cup matches map `score.duration` to `aet`/`pen` statuses. Stage labels use real round names (Round of 16 / Quarter-finals / etc.) for knockout, "Matchday N" for league play. Total cold-load cost is 8 calls (4 comps × 2), within the free 10/min limit
- `padel-api-service.ts` — `getPadelData()` fetches men's + women's rankings and tournament list from Padel API (`padelapi.org/api`), maps to `PadelData`, cached 30 min, falls back to `PADEL_DATA` mock. Requires `PADEL_API_KEY`
- `thesportsdb-tennis-service.ts` — `getTennisData()` fetches the next + last event per tour for ATP (id 4464) and WTA (id 4517) from TheSportsDB free public API (no key), derives a `RacquetTournament` per tournament (groups events by extracted tournament-name prefix), keeps `TENNIS_DATA` mock rankings since TheSportsDB has none. Cached 30 min, falls back to `TENNIS_DATA` mock on any error

## Schemas — `/schemas/`
- `travel.ts`
- `sports.ts` — `sportIdSchema`, `setSportFavoriteSchema`

## Types — `/types/`
- `travel.ts` — `Trip`, `TripItem`, `TripPhoto`, `TripShare`, `TripWithRelations`, `PublicTripView`, plus `DashboardTravelSummary` / `DashboardTravelFeaturedTrip` / `DashboardTravelTripState`
- `sports.ts` — full domain shapes for matches, standings, brackets, F1/NBA/NFL/LoL specifics, plus `UserSportsPreference` and `DashboardSportHighlight`

## Components
- `components/travel/` — trip list/detail, item editors, photo gallery, share dialog
- `components/travel/dashboard-travel-card.tsx` — server-component card mounted on `/portal`: featured trip (in-progress wins → next upcoming → most recent past) with cover photo, state badge, items count and estimated total
- `components/entertainment/sports/sports-hub.tsx` — client tab strip + per-sport view switcher; stars favourites and pins them first
- `components/entertainment/sports/manage-favorites-sheet.tsx` — sheet with per-sport switches, optimistic updates via `setSportFavoriteAction`
- `components/entertainment/sports/dashboard-sports-card.tsx` — server-component card mounted on `/portal` showing one highlight per favourited sport
- `components/entertainment/sports/shared/` — score cards, standings table, knockout bracket, team badge, last-5 form chips, `sport-shell.tsx` (header + body wrapper; every sport view mounts its `Tabs` around the shell and renders the `TabsList` inside the shell's `tabs` slot so the chip strip sits in the header row next to the title, à la Google's sports panels). `leg-score-card.tsx` renders BOTH two-legged ties (UCL: per-leg L1/L2 columns + aggregate) AND single best-of series (LoL/NFL playoffs: one score column from `homeScore`/`awayScore`) — it falls back to the single column when `match.legs` is empty, so bracket scores never disappear
- `components/entertainment/sports/sports/` — one view per sport (football, f1, nba, tennis, padel, nfl, lol). Each view smart-defaults to its knockout tab when bracket data exists (LoL/NFL playoffs, UCL knockout). `score-card.tsx` shows the match date next to the status for finished games (not just upcoming), à la Google's sports panels

## DB tables — `db/schema.ts`
- `trips` — user-owned trips (date-based, no timezone)
- `trip_items` — activities, bookings, transport, food (optional scheduled dates)
- `trip_photos` — gallery (uploaded or external URLs)
- `trip_shares` — share tokens for read-only public access
- `user_sports_preferences` — favourited sports per user; UNIQUE(user_id, sport_id) backs the toggle semantics

## Tests
- `lib/services/sports-service.test.ts` — Vitest, mocks `@/db`; covers favourites CRUD + dashboard summary shape per sport
- `app/actions/sports.test.ts` — Vitest, mocks impersonation + service + `next/cache`; covers happy path, zod rejection, auth failure, impersonation routing
- `e2e/sports-favorites.spec.ts` — Playwright, real Supabase user; covers empty CTA → toggle → persistence → dashboard highlights → un-toggle round trip
- `e2e/auth.setup.ts` + `e2e/fixtures.ts` — shared auth + DB cleanup fixtures

## Notes
- Conventional Commits scopes: `travel`, `sports`, `entertainment`
- `/app/trips/[token]` is **public** — verify no PII leaks through the shared route. The share token model in `trip_shares` is the only authz check.
- **Travel formatting helpers live in [`lib/travel/format.ts`](../../lib/travel/format.ts)** (`parseTripDate`, `formatDateRange`, `tripDays`, `tripDurationLabel`, `formatTripMoney`) — a server-safe module with no `"use client"`. They were previously duplicated per component and exported from the client `trip-detail.tsx`; importing that from the server-rendered `public-trip-view.tsx` turned them into client references and **500'd every public share link**. Never re-export shared helpers from a client module.
- `getPublicTripByToken` is wrapped in `React.cache()` (like `getTripWithRelations`) so `generateMetadata` + page body share one DB hit. The share panel treats **expired** links as inactive (same as revoked — the public resolver rejects both).
- Itinerary/gallery/calendar hover-revealed controls are always visible below `sm` (no hover on touch) and reveal on keyboard focus.
- All trip cover photos and gallery thumbnails render through `next/image` (remote hosts whitelisted in [`next.config.ts`](../../next.config.ts)). The blob-URL preview inside `photo-picker.tsx` stays as a CSS background because the optimizer can't process blob URLs.
- `getTripWithRelations` is wrapped in `React.cache()` so `generateMetadata` and the page body share one DB hit per request.
- `app/portal/entertainment/loading.tsx` and `app/portal/entertainment/travel-planner/[id]/not-found.tsx` give the module its skeleton / 404 boundaries.
- **Sports data — mixed sources (as of 2026-06-04):**
  - **Live**: LoL (Lolesports), F1 (Jolpica-F1), football (football-data.org — UCL/La Liga/EPL/Serie A), padel (Padel API — men + women rankings + tournaments), tennis (TheSportsDB — ATP/WTA active tournament only, mock rankings retained since TheSportsDB has none). All five share the same shape: live fetch → map into the existing typed data shape → fall back to the mock fixture on any error → cached 30 min via `unstable_cache` → lifted into `app/portal/entertainment/sports/page.tsx` and passed down through `SportsHub` as a prop.
  - **Mock only**: NBA (BALLDONTLIE free tier blocks `/standings`, only teams/games — needs $9.99/mo ALL-STAR plan or computed standings from 1230 games of game data which costs 13 paginated calls at 5 req/min = 2.5 min cold start, not viable for SSR), NFL (no decent free provider with current-season data).
  - **Rejected providers**: API-SPORTS (free tier hard-locked to seasons 2022–2024, useless for current data; paid plan ~$100/mo); Riot Games official API (no esports/tournament data, only personal player stats).
  - **Env vars**: `FOOTBALL_DATA_API_KEY` and `PADEL_API_KEY` (both optional — service falls back to mock when unset). Lolesports, Jolpica and TheSportsDB need no key.
- **Vitest setup** in [`vitest.setup.ts`](../../vitest.setup.ts) stubs `next/cache` (so `unstable_cache` becomes a passthrough) and rejects `global.fetch` by default (so live-API services exercise their mock-fallback path). Tests that need real responses can re-stub `fetch` per-file.
- The new sport selector pins favourites to the front of the strip and stars them; non-favourites stay visible so the hub still works with zero favourites picked.
- **Match display order** is centralized in [`lib/sports/match-order.ts`](../../lib/sports/match-order.ts) (`orderMatchesForDisplay`: live → upcoming nearest-first → results most-recent-first). Football and LoL both use it; the previous plain-descending sort put fixtures 60 days away at the top and made the dashboard's `find(scheduled)` pick the furthest-away match as "Upcoming".
- **Sports table/style primitives**: [`shared/table-primitives.tsx`](../../components/entertainment/sports/shared/table-primitives.tsx) (`SportsTh` standard uppercase header cell + `TableCellNum` numeric cell — replaces ~50 copy-pasted `text-xs uppercase tracking-wide text-muted-foreground` chains and 3 duplicate `TableCellNum`s) and [`shared/status-pill.tsx`](../../components/entertainment/sports/shared/status-pill.tsx) (`StatusPill` completed/upcoming/live — was duplicated in f1-view + racquet-view). New sport views should use these instead of hand-rolling.
- **Sport views key their `<Tabs>` by the active league/region** (football, lol): an uncontrolled Tabs keeps its old value when the active trigger unmounts, so switching to a league without that tab stranded the view on a blank body. `KnockoutBracket` opens focused on the current round (first with an undecided tie; fully decided → final) and re-focuses when `rounds` changes.
- `manage-favorites-sheet` tracks in-flight toggles as a `Set<SportId>` (a single pending slot let one toggle's completion clear another's spinner).
