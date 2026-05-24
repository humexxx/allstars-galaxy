# Entertainment / Travel

> **Status:** In progress (untracked files in repo as of 2026-05-23)
> **Last reviewed:** 2026-05-23

## Overview
Trip planning: trips with items (activities, bookings, transport, food),
photos, expense aggregation, and public read-only sharing via tokens.

## Routes
- `/portal/entertainment/travel-planner` — list of trips (authenticated)
- `/portal/entertainment/travel-planner/new` — create trip
- `/portal/entertainment/travel-planner/[id]` — trip detail + editor
- `/trips/[token]` — **public** shared trip view (top-level, no auth)

## Server actions — `/app/actions/`
- `travel.ts` — trip / item / photo / share CRUD; expense calculations

## Services — `/lib/services/`
- `travel-service.ts`

## Schemas — `/schemas/`
- `travel.ts`

## Types — `/types/`
- `travel.ts`

## Components
`components/travel/` — trip list/detail, item editors, photo gallery, share dialog.

## DB tables — `db/schema.ts`
- `trips` — user-owned trips (date-based, no timezone)
- `trip_items` — activities, bookings, transport, food (optional scheduled dates)
- `trip_photos` — gallery (uploaded or external URLs)
- `trip_shares` — share tokens for read-only public access

## Notes
- Conventional Commits scopes: `travel`, `entertainment`
- `/app/trips/[token]` is **public** — verify no PII leaks through the shared route. The share token model in `trip_shares` is the only authz check.
- A pre-existing TS error references `@/components/travel/trip-detail` (not yet created).
