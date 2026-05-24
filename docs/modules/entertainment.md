# Entertainment

> **Status:** In progress (travel shipped + dashboard card; sports UI shipped with mock data, favourites end-to-end on DB)
> **Last reviewed:** 2026-05-24

## Overview
Two sub-modules: Travel Planner (trips, items, photos, public sharing) and
Sports (live scores, standings and brackets for football, F1, NBA, tennis,
padel, NFL and League of Legends, plus a per-user favourites picker).

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
- `sports-service.ts` — favourites CRUD + `getDashboardSportsSummary` that materialises one highlight per favourited sport from the mock data files

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
- `components/entertainment/sports/shared/` — score cards, standings table, knockout bracket, team badge, last-5 form chips, sport shell wrapper
- `components/entertainment/sports/sports/` — one view per sport (football, f1, nba, tennis, padel, nfl, lol)

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
- A pre-existing TS error references `@/components/travel/trip-detail` (not yet created).
- All trip cover photos and gallery thumbnails render through `next/image` (remote hosts whitelisted in [`next.config.ts`](../../next.config.ts)). The blob-URL preview inside `photo-picker.tsx` stays as a CSS background because the optimizer can't process blob URLs.
- `getTripWithRelations` is wrapped in `React.cache()` so `generateMetadata` and the page body share one DB hit per request.
- `app/portal/entertainment/loading.tsx` and `app/portal/entertainment/travel-planner/[id]/not-found.tsx` give the module its skeleton / 404 boundaries.
- **Sports data is mocked** in `lib/data/sports/` (registry, football, f1, nba, nfl, tennis, padel, lol). Only the favourites layer hits the DB; standings / matches / brackets / news are static fixtures designed to mirror future API shapes (football-data.org, ergast, nba-api, etc.). When swapping in real APIs, `sports-service.ts` is the single integration point — the UI layer reads typed shapes from `types/sports.ts` and does not care about the source.
- The new sport selector pins favourites to the front of the strip and stars them; non-favourites stay visible so the hub still works with zero favourites picked.
