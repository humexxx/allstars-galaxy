# Entertainment

> **Status:** In progress (travel shipped + dashboard card; sports UI shipped, favourites end-to-end on DB; LoL, F1, football, World Cup, padel and tennis wired to free live providers)
> **Last reviewed:** 2026-07-05

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
- `sports-service.ts` — favourites CRUD + `getDashboardSportsSummary` that materialises one highlight per favourited sport (LoL via `getLolData()`, F1 via `getF1Data()`, football via `getFootballData()`, World Cup via `getWorldCupData()` — featured knockout match + latest result, padel via `getPadelData()`, rest from mock fixtures)
- `lolesports-service.ts` — `getLolData()` fetches LEC/LCS/LCK/LPL from Lolesports' unofficial API (`esports-api.lolesports.com`), maps to `LolData` including playoff `BracketRound[]` (**one round per standings SECTION**, labelled with the section's own name — `buildLolBracket`; the old TBD-count heuristic remains only as fallback for unnamed sections, because TBD counting collapsed rounds into one column as ties resolved), picks the currently-active tournament (never the future split), maps regular-season stages (`regular_season`, `groups`, `group_stage`) into standings. A completed event missing `result` renders "—", never a fake 0–0. Cached 30 min via `unstable_cache`, falls back to `LOL_DATA` mock on any error
- `jolpica-f1-service.ts` — `getF1Data()` fetches current-season races, driver + constructor standings and results from Jolpica-F1 (`api.jolpi.ca/ergast/f1`, Ergast-compatible drop-in), maps to `F1Data` with derived race status and podium tallies, cached 30 min, falls back to `F1_DATA` mock on any error
- `football-data-service.ts` — `getFootballData()` fetches standings + matches for UCL, La Liga, EPL and Serie A from football-data.org, maps to `FootballLeagueData[]`, cached 5 min, falls back per-league to mocks. Requires `FOOTBALL_DATA_API_KEY`. Knockout competitions (UCL) fetch the full season in ONE matches call and derive both recent matches and the two-legged knockout bracket (`buildKnockoutBracket` pairs legs by team set → aggregate + winner; **aggregate/winner stay `null` until BOTH legs are `FINISHED`** — summing scheduled legs with `?? 0` used to fabricate an aggregate and bold a "winner" mid-tie); league-only competitions use a ±60d window (capped 40). Finished cup matches map `score.duration` to `aet`/`pen` statuses. Stage labels use real round names (Round of 16 / Quarter-finals / etc.) for knockout, "Matchday N" for league play. Also exports `getWorldCupData()` (cache tag `sports:worldcup`, mock fallback `WORLD_CUP_DATA`): ONE `/competitions/WC/matches` call derives group tables (`buildGroupStandings` computes W/D/L/GF/GA/Pts per group from finished GROUP_STAGE matches → `FootballLeagueData.groups`), the flat match list, AND the single-leg knockout bracket. Undecided knockout fixtures come back with **all team fields `null`** (`teamFromFd` returns `null` → TBD bracket slots; TBD-vs-TBD fixtures are excluded from the flat match list but kept in the bracket). `KNOCKOUT_ROUND_ORDER` covers LAST_32 and THIRD_PLACE for cup formats. Total cold-load cost is 9 calls (4 comps × 2 + 1 WC), within the free 10/min limit
- `padel-api-service.ts` — `getPadelData()` fetches men's + women's rankings and tournament list from Padel API (`padelapi.org/api`), maps to `PadelData`, cached 30 min, falls back to `PADEL_DATA` mock. Requires `PADEL_API_KEY`
- `thesportsdb-tennis-service.ts` — `getTennisData()` fetches the next + last event per tour for ATP (id 4464) and WTA (id 4517) from TheSportsDB free public API (no key), derives a `RacquetTournament` per tournament (groups events by extracted tournament-name prefix), keeps `TENNIS_DATA` mock rankings since TheSportsDB has none. Cached 30 min, falls back to `TENNIS_DATA` mock on any error

## Schemas — `/schemas/`
- `travel.ts`
- `sports.ts` — `sportIdSchema`, `setSportFavoriteSchema`

## Types — `/types/`
- `travel.ts` — `Trip`, `TripItem`, `TripPhoto`, `TripShare`, `TripWithRelations`, `PublicTripView`, plus `DashboardTravelSummary` / `DashboardTravelFeaturedTrip` / `DashboardTravelTripState`
- `sports.ts` — full domain shapes for matches, standings, brackets, F1/NBA/NFL/LoL specifics, plus `UserSportsPreference` and `DashboardSportHighlight`. `SportId` includes `worldcup`; `FootballLeagueId` includes `world-cup`; `FootballLeagueData.groups?: FootballGroupStandings[]` carries per-group cup tables

## Components
- `components/travel/` — trip list/detail, item editors, photo gallery, share dialog
- `components/travel/dashboard-travel-card.tsx` — server-component card mounted on `/portal`: featured trip (in-progress wins → next upcoming → most recent past) with cover photo, state badge, items count and estimated total
- `components/entertainment/sports/sports-hub.tsx` — client tab strip + per-sport view switcher; stars favourites and pins them first
- `components/entertainment/sports/manage-favorites-sheet.tsx` — sheet with per-sport switches, optimistic updates via `setSportFavoriteAction`
- `components/entertainment/sports/dashboard-sports-card.tsx` — server-component card mounted on `/portal` showing one highlight per favourited sport
- `components/entertainment/sports/sports/world-cup-view.tsx` — 🏆 World Cup tab: Knockout (default) / Matches / per-group standings grid
- `components/entertainment/sports/shared/knockout-bracket.tsx` — responsive: below `sm` it renders a Google-style mobile bracket (scrollable round tab strip + each pair of ties connected to the next-round tie they feed; `orderPairs` matches feeders to next-round slots by team membership, falling back to positional order for TBD slots; third-place is skipped as a "next" round so SF winners connect to the final); `sm`+ keeps the 3-column sliding window
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
- **The trip page has two views**, switched by `Tabs` next to *All trips*: the
  list answers *what is the plan*, the calendar answers *what does the month
  look like*. `TripCalendar` draws a whole month with arrows either side and a
  **Trip** button back to the trip's own month.
- **The bar grid carries no padding of its own.** It is `absolute inset-x-0`
  over the day grid with the same columns and the same gap; a `px-1` on it
  shifted every column four pixels in and left each badge starting just
  outside the day it belongs to. The badge is inset by `ml-0.5`/`mr-0.5` only
  where the run really starts or ends — flush where it carries into the next
  week.
- **A bar's label is one string — `title · price`, not two boxes.** Pinned to
  the right, the price ate the title on any bar a single day wide: a flight
  read *"$600 – $"* and never said where it went. As one label the wide bars
  show everything and the narrow ones reveal it on hover, via
  [`MarqueeText`](../../components/travel/marquee-text.tsx), which measures the
  overflow and leaves a label that already fits completely alone. It respects
  `prefers-reduced-motion`.
- **A calendar run is a badge, not a hairline.** Soft wash + full-strength
  label + a ring, because the two things that would give it more weight both
  cost legibility: a solid fill needs white text, and amber (3.19:1), sky
  (4.02) and teal (3.66) do not clear AA against white; deepening the wash
  costs the label instead — 15% leaves it at 3.3:1, 25% drops it to 2.9. So
  the edge does the work. Below `sm` the bar is a few pixels tall with no room
  for a label, so it goes **solid**: there, the colour is the whole signal.
- **Runs are bars, not repeated chips.** `layOutWeek` clips each run to the
  week and stacks overlaps into lanes; the bars ride over the day grid on a
  matching seven-column track, because the length of the bar IS the
  information. `spansDays` decides who gets a run at all: a hotel booked the
  15th to the 17th occupies three days, a return flight occupies the day out
  and the day back and **nothing in between** — drawn as one run it painted a
  plane across the whole holiday.
- **`moneyRange` lives in `lib/travel/format.ts`, not beside a component.** It
  was exported from `traveller-bar.tsx`, a client module, and the public trip
  page is a server component: the first shared link allowed to show prices
  crashed with *Attempted to call moneyRange() from the server*. Unit tests
  cannot see that — jsdom has no such boundary — which is why
  [`e2e/trip-share-links.spec.ts`](../../e2e/trip-share-links.spec.ts) opens
  both kinds of link in a browser with no session.
- **Both grid columns carry `min-w-0`.** An `fr` track still takes an automatic
  minimum from its content, so the gallery's photo rail widened its own column
  and crushed the itinerary to one word per line. The rail scrolls; the column
  has to be allowed to be narrower than it.
- **The banner is `min-h-72` below `sm`.** At 21/9 a 390px phone gives 167px,
  and the traveller pill, the buttons and the title all landed on top of each
  other. Its three overlays are now one `justify-between` column.
- **`components/travel/category.tsx` and `lib/travel/viewer.ts`** hold what the
  list and the calendar share. They used to live in `trip-itinerary.tsx`, which
  meant a view that only draws squares imported the whole server-action layer.
- **Travel forms use `Field` / `FieldLabel`**, not `div` + `Label`. The gap is
  overridden (`gap-1.5`, `gap-2`) to keep the density these forms were tuned
  to; `Field`'s own `gap-3` would double the label-to-control distance. What
  the primitive buys is the `role="group"` and the invalid-state wiring, which
  a bare div does not have.
- **Both lists are clickable rows.** An itinerary row cannot be a `<button>` —
  it holds a link, a disclosure and sometimes a video, and nesting those in a
  button is invalid — so the container listens and steps aside for anything
  that handles its own clicks, and for a click that ends a text selection.
  The title is a real button so the keyboard has a way in. Delete moved into
  the form the row opens.
- **Nothing is reserved at the right of an itinerary row.** The
  The row *is* the control, so every price, subtotal and video runs to the
  card's edge on every screen, and the day header needs no spacer to stay in
  step with them.
- **A payment is a record, not a row of controls.** Tapping it opens a dialog;
  the delete button used to hold space at the right of every row, which is what
  pushed each amount off the card's edge.
- **Icon buttons are `size-9 sm:size-7`** — 36px on touch, 28px on a pointer.
  Several were 20–24px, and the gallery's delete was both the smallest and the
  only destructive one visible without hovering.
- **`space-y-*` stays.** The shadcn skill prefers `gap-*`, but
  [`docs/SPACING.md`](../SPACING.md) mandates `space-y-4`/`space-y-6` for
  stacked blocks, and a blanket swap would silently do nothing wherever the
  parent is not flex or grid.
- **`trip_contributions` records money that actually moved.** What somebody
  owes is a range (the trip is mostly quotes); what they paid is exact. The
  Payments card follows the same selected traveller the itinerary does, and
  progress is measured against the **low** estimate — the high one would leave
  a fully-settled trip reading as short.
- **A share link can be scoped to one traveller** (`trip_shares.member_id`,
  `ON DELETE SET NULL`). The split is computed server-side in `buildScope` and
  only that traveller's figures cross the boundary: every member is needed to
  work out the split, but sending the member list to the page and filtering
  there would put the other travellers in the payload of a link created to hide
  them. A scoped link defaults `showPrices` to true — hiding the money would
  remove the only thing the scoping was for.
- **`ensureMemberBelongsToTrip` is not redundant with the foreign key.** The FK
  proves the member row exists; it says nothing about *which* trip it is on.
  Both the scoped share and the contribution go through it.
- **The public renderer now reads `showPrices`.** It never did — the column has
  always defaulted to false and the page published the costs regardless.
- **Category icons are tinted, and the tint lives on `CATEGORIES` in
  [`category.tsx`](../../components/travel/category.tsx)** — one list feeding
  the picker, the itinerary rows and the calendar through `CategoryIcon`, so
  they can never disagree about what a cruise looks like. Each hue is a theme
  token (`--trip-*` in [`globals.css`](../../app/globals.css)), so the dark step
  is chosen for the dark surface rather than bolted on with a `dark:` override,
  and a hue can be retuned in one place.
  These are **not** `--chart-1..5`: that palette has five slots, must never be
  cycled, and there are eight categories. Colour is the second channel — the
  icon's shape carries the meaning, so a reader who cannot separate two hues
  still reads a plane and a bed. `other` stays neutral because it is the
  absence of a category, not one more kind of thing.
  The hues were measured, not eyeballed: worst pair ΔEok 0.137 (light) /
  0.123 (dark), every icon ≥3:1 against its own surface in both themes.
  Activity is lime rather than emerald because emerald measured 0.056 against
  teal, and lime-**700** rather than 600 because 600 clears contrast at only
  3.06:1.
- **`That price is` offers only the units its category can honestly use**
  (`ItemFieldSpec.priceUnits`). `per_night` multiplies by the nights between
  the two dates, so it belongs where the end day marks a stay — lodging,
  cruise, other. A flight's end day is its *return*, so offering it there would
  turn one fare into nine nights of fares. The list is also the display order,
  and `priceUnits[0]` must equal `defaultPriceUnit` — a test asserts it, since
  a default the dropdown does not offer renders as a blank control.
- **A stored unit always stays selectable** even after its category narrows
  (`priceUnitOptions(category, current)`). Dropping it would blank the control
  while the database kept the value, and the price would stop explaining
  itself. Changing category snaps the unit only when the new category cannot
  use the old one at all.
- **Every money figure in Travel is a range**, because most of a plan is
  estimates. `itemCost`, `tripCost` and `splitTrip` all carry `low` and `high`
  together — `splitTrip` returns `owedLow`/`owedHigh`, never a single `owed`.
  The one field was the bug: each reader downstream presented it as the answer,
  and a $600–$800 flight showed up as a settled $600.
- **The day subtotal is the sum of the rows above it**, and it is derived from
  the same figures those rows print. When a traveller is selected the rows
  switch to that person's share so the arithmetic still checks out on screen;
  the full booking price stays underneath, because that is what the hotel's own
  site will quote.
- **The selected traveller lives in `TripDetail`**, not in `TravellerBar`.
  Picking a face re-costs the whole itinerary, so the banner cannot own it.
- **The trip detail page does not render `description`.** The field is still
  stored and still editable (as *Notes* in the trip form), and the public share
  view still shows it — a visitor arriving on a shared link has no other
  context. On the detail page the owner already knows what the trip is, so the
  card was only taking room from the itinerary.
- **Disclosures use shadcn's `Collapsible`**, not a hand-rolled button with
  state. The itinerary accordion started as the latter and was replaced: the
  primitive brings the aria wiring and keyboard behaviour a disclosure needs,
  and this project uses shadcn components rather than one-off equivalents.
- **The traveller chip sits on a photograph**, so its surface is a solid dark
  pill rather than a translucent one. A light-wash cover — a beach, a snowfield
  — leaves white text on white through any amount of transparency, and a scrim
  that only sometimes works is worse than one that always does.
- **The chip is a fixed size.** "you pay" and "Bruno Fabián pays" are different
  lengths, and letting the box track the caption made the banner twitch on
  every click.
- **A price has a unit** (`trip_items.price_unit`: `total` / `per_night` /
  `per_person`). Without it every figure was summed as a total, so a hotel at
  "$100–200" silently meant one night and a cruise at "$1,900 per person"
  silently meant the whole party — both wrong, and both in the direction that
  makes a trip look cheaper than it is.
- **Nights, not days.** The 15th to the 17th is two nights; counting three
  overstates every stay. A missing or backwards range falls back to one night,
  because an undated stay still costs something.
- **The arithmetic is shown, not hidden.** A row reading $400 when you typed
  $200 looks like a bug until the `$100–200 / night × 2` under it explains it.
- `partySize` is 1 until trip members have a UI; the moment they do, every
  per-person figure scales from the real count with no further change.
- Defaults come from the category (`itemFields().defaultPriceUnit`): a hotel is
  nightly, a fare is per person. Changing category adopts the new default only
  while **creating** — rewriting a saved choice behind the user's back is worse
  than making them set it once.
- **Airport fields autocomplete against ~7,900 IATA airports**, searched
  **server-side** (`searchAirportsAction`). The dataset is 115 KB gzipped —
  too much to ship for one form field — and a DB table would add an ~86 ms
  round trip per keystroke for data that changes once a year and nobody edits.
  It lives in `lib/travel/data/airports.ts`, generated by
  `scripts/build-airports.mjs` from https://github.com/mwgg/Airports (MIT).
- **Whatever is typed is the value.** Suggestions only fill it in faster; a
  small airfield or a bus terminal must still save. That is also why the column
  is free text and there is no FK to an airports table.
- Flags are computed from the ISO-3166 alpha-2 code via regional indicator
  symbols, not bundled as 250 emoji.
- **Trip ITEMS carry an optional video** (`trip_items.video_url`) — **YouTube
  or Instagram** —
  a walkthrough of the hotel, a tour of the ship. It briefly lived on `trips`,
  which was the wrong level: a trip is a container, and it is the individual
  activity that has a video worth watching. Moved in `0037` before any row
  used it. Stored as the
  URL the user pasted, never a pre-built embed URL: the video id is derived at
  render time by `lib/travel/youtube.ts`, so a link saved in any of YouTube's
  shapes (`watch?v=`, `youtu.be`, `/shorts/`, `/embed/`, `/live/`) keeps
  working. Validated as a YouTube link specifically — any-URL validation would
  save happily and then render nothing.
- **The embed uses `youtube-nocookie.com`** and renders nothing at all for a
  missing or unrecognised link. The trip page is also served publicly through a
  share token, where the visitor has agreed to nothing.
- Conventional Commits scopes: `travel`, `sports`, `entertainment`
- `/app/trips/[token]` is **public** — verify no PII leaks through the shared route. The share token model in `trip_shares` is the only authz check.
- **Travel formatting helpers live in [`lib/travel/format.ts`](../../lib/travel/format.ts)** (`parseTripDate`, `formatDateRange`, `tripDays`, `tripDurationLabel`, `formatTripMoney`) — a server-safe module with no `"use client"`. They were previously duplicated per component and exported from the client `trip-detail.tsx`; importing that from the server-rendered `public-trip-view.tsx` turned them into client references and **500'd every public share link**. Never re-export shared helpers from a client module.
- `getPublicTripByToken` is wrapped in `React.cache()` (like `getTripWithRelations`) so `generateMetadata` + page body share one DB hit. The share panel treats **expired** links as inactive (same as revoked — the public resolver rejects both).
- Itinerary/gallery/calendar hover-revealed controls are always visible below `sm` (no hover on touch) and reveal on keyboard focus.
- All trip cover photos and gallery thumbnails render through `next/image` (remote hosts whitelisted in [`next.config.ts`](../../next.config.ts)). The blob-URL preview inside `photo-picker.tsx` stays as a CSS background because the optimizer can't process blob URLs.
- `getTripWithRelations` is wrapped in `React.cache()` so `generateMetadata` and the page body share one DB hit per request.
- `app/portal/entertainment/loading.tsx`, `app/portal/entertainment/travel-planner/[id]/not-found.tsx`, and `app/portal/entertainment/error.tsx` give the module its skeleton / 404 / error boundaries.
- **Sports data — mixed sources (as of 2026-06-04):**
  - **Live**: LoL (Lolesports), F1 (Jolpica-F1), football (football-data.org — UCL/La Liga/EPL/Serie A), World Cup (football-data.org — its own `worldcup` sport tab, NOT in the football league selector), padel (Padel API — men + women rankings + tournaments), tennis (TheSportsDB — ATP/WTA active tournament only, mock rankings retained since TheSportsDB has none). All share the same shape: live fetch → map into the existing typed data shape → fall back to the mock fixture on any error → cached **5 min** via `unstable_cache` (was 30 min; shortened so scores are near-current whenever the user lands — rate budgets checked per provider) → lifted into `app/portal/entertainment/sports/page.tsx` and passed down through `SportsHub` as a prop.
  - **Mock only**: NBA (BALLDONTLIE free tier blocks `/standings`, only teams/games — needs $9.99/mo ALL-STAR plan or computed standings from 1230 games of game data which costs 13 paginated calls at 5 req/min = 2.5 min cold start, not viable for SSR), NFL (no decent free provider with current-season data).
  - **Rejected providers**: API-SPORTS (free tier hard-locked to seasons 2022–2024, useless for current data; paid plan ~$100/mo); Riot Games official API (no esports/tournament data, only personal player stats).
  - **Env vars**: `FOOTBALL_DATA_API_KEY` and `PADEL_API_KEY` (both optional — service falls back to mock when unset). Lolesports, Jolpica and TheSportsDB need no key.
- **Vitest setup** in [`vitest.setup.ts`](../../vitest.setup.ts) stubs `next/cache` (so `unstable_cache` becomes a passthrough) and rejects `global.fetch` by default (so live-API services exercise their mock-fallback path). Tests that need real responses can re-stub `fetch` per-file.
- The new sport selector pins favourites to the front of the strip and stars them; non-favourites stay visible so the hub still works with zero favourites picked.
- **Match display order** is centralized in [`lib/sports/match-order.ts`](../../lib/sports/match-order.ts) (`orderMatchesForDisplay`: live → upcoming nearest-first → results most-recent-first). Football and LoL both use it; the previous plain-descending sort put fixtures 60 days away at the top and made the dashboard's `find(scheduled)` pick the furthest-away match as "Upcoming".
- **Sports table/style primitives**: [`shared/table-primitives.tsx`](../../components/entertainment/sports/shared/table-primitives.tsx) (`SportsTh` standard uppercase header cell + `TableCellNum` numeric cell — replaces ~50 copy-pasted `text-xs uppercase tracking-wide text-muted-foreground` chains and 3 duplicate `TableCellNum`s) and [`shared/status-pill.tsx`](../../components/entertainment/sports/shared/status-pill.tsx) (`StatusPill` completed/upcoming/live — was duplicated in f1-view + racquet-view). New sport views should use these instead of hand-rolling.
- **Sport views key their `<Tabs>` by the active league/region** (football, lol): an uncontrolled Tabs keeps its old value when the active trigger unmounts, so switching to a league without that tab stranded the view on a blank body. `KnockoutBracket` opens focused on the current round (first with an undecided tie; fully decided → final) and re-focuses when `rounds` changes.
- `manage-favorites-sheet` tracks in-flight toggles as a `Set<SportId>` (a single pending slot let one toggle's completion clear another's spinner).
