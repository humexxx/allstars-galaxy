# Entertainment

> **Status:** In progress (travel shipped + dashboard card; sports UI shipped, favourites end-to-end on DB; LoL, F1, football, World Cup, padel, tennis, NBA and NFL wired to free live providers)
> **Last reviewed:** 2026-10-26

## Overview
Two sub-modules: Travel Planner (trips, items, photos, public sharing) and
Sports (live scores, standings and brackets for football, F1, NBA, tennis,
padel, NFL and League of Legends, plus a per-user favourites picker). Every
sport is wired to a free live provider (Lolesports for LoL, Jolpica-F1 + ESPN
for F1, football-data.org for football and the World Cup — ESPN for MLS and
Costa Rica's Primera División —, Padel API for padel,
ESPN for tennis and the NFL, balldontlie + ESPN's table, bracket and preseason
for the NBA) and falls
back to its fixture only when its feed has never answered.

## Routes
- `/portal/entertainment/travel-planner` — list of trips (authenticated)
- `/portal/entertainment/travel-planner/new` — create trip
- `/portal/entertainment/travel-planner/[id]` — trip detail + editor
- `/portal/entertainment/travel-planner/preview` — a trip the assistant's open proposal would create, drawn from the preview before it exists (client-only: a reload has nothing to show)
- `/api/travel/assistant` — the travel assistant's chat, `POST`, streamed as NDJSON (`TravelAssistantEvent` per line); admins only, 120s max
- `/trips/[token]` — **public** shared trip view (top-level, no auth); `loading.tsx` paints the shell before the trip resolves
- `/portal/entertainment/sports` — sports hub, no `PageHeader` and no strip of sports: the sport's own name row comes first, the page's `<h1>`, with the favourites button and the sport picker at its end, then its sticky tabs bar; `?sport=` picks the sport, `?league=` the football league, `?tab=news` opens F1 on its news (the article page's "All news"); F1's other tab is Overview, and the old `standings` / `races` / `drivers` / `constructors` open it (the last two on that table). For football, the NBA and the NFL it also reads the teams last picked in that match list (`teamFilterList` + `getSportTeamFilter`, beside the sport's own load) and hands them to the hub. The page and its `loading.tsx` sit in the `(hub)` route group, so the hub's skeleton never paints over a page under it. Titled by the sport, or by the football competition ("La Liga · Sports"; `generateMetadata`), so a finished switch is announced; plain "Sports" without `?sport=`, whose default comes from the favourites; its `loading.tsx` says "Loading sports…" in an sr-only status beside the skeleton
- `/portal/entertainment/sports/padel/[tournamentId]`, `/portal/entertainment/sports/tennis/[tournamentId]` — one tournament on a page of its own (`RacquetTournamentPage`), by the feed's id (`padelapi-748`, `espn-440-2026-mens-singles`): what "View details" and every tile on padel's and tennis's Overview open (`tournamentPath`). Gated by `requireEffectiveContext()`, as the hub is; read on the server by `loadRacquetTournament`, beside the reader's favourites (the name row's controls) and `?tab=` (`overview` opens the Overview; the Bracket otherwise); titled by the tournament, and "Not on this season's calendar" when there is none; `loading.tsx` is `TournamentPageSkeleton`
- `/portal/entertainment/sports/f1/[round]` — one race of the season on a page of its own (`F1RacePage`), by its round (`f1RoundSchema`: one or two digits, no leading zero; whether the round exists is `loadF1Race`'s to say): what "View details" and every race tile open (`f1RacePath`). Gated by `requireEffectiveContext()`, as the hub is; read on the server by `loadF1Race`; titled by the race, and "Not on this season's calendar" when there is none; `loading.tsx` is `RacePageSkeleton`
- `app/portal/entertainment/sports/not-found.tsx` — a tournament or race the season does not have: "Not on this season's calendar", back to Sports
- `/news/f1/[id]` — **public** F1 article page (top-level, no auth; see *Notes*); `loading.tsx` paints its shell

## Server actions — `/app/actions/`
- `travel.ts` — trip / item / photo / member / share CRUD, plus
  `addTripContributionAction` / `updateTripContributionAction` /
  `deleteTripContributionAction` for the payment log and
  `setTripItemStopsAction` for a cruise's ports. `createTripShareAction`
  takes a `memberId` to scope a link to one traveller and an `expiresAt`;
  `updateTripShareExpiryAction` resets a link's expiry, which revives an
  expired link but never a revoked one. Every action returns
  `ActionResult<X>`; trip, item and member mutations also revalidate `/portal`
  (the dashboard travel card) through `revalidateTrip()`
- `airports.ts` — `searchAirportsAction` → `ActionResult<Airport[]>`; the query
  is checked with `airportQuerySchema` and a bad one returns no results
- `sports.ts` — `setSportFavoriteAction` toggles a sport favourite for the current user (`ActionResult`); `setSportCompetitionAction({ sportId, competition })` sets the championship a favourite's dashboard card shows (null: the card's own pick) — `requireEffectiveContext()`, `setSportCompetitionSchema`, "Add this sport to your favorites first" when it is not one, then `refresh()` re-renders the dashboard rather than revalidating `/portal` (see *Notes*; the hub takes its league from the URL); `setSportTeamFilterAction({ sportId, competition, teamIds })` remembers the teams a sports-page match list is narrowed to (`setSportTeamFilterSchema`, `requireEffectiveContext()`, logged as `sportTeamFilter.set`), then `refresh()` for the same reason
- `racquet.ts` — `getRacquetDrawAction({ sport, tournamentId })` → `ActionResult<RacquetDraw>`: the hub's featured padel or tennis draw when the feed did not ship it, for Overview's round under way and seeds (a tournament's page reads its draw on the server). `requireAuth()` (not anybody's data, but every miss spends a provider's daily budget), `racquetDrawSchema`, then `getRacquetDraw(sport, id)` (`lib/services/racquet-draw-service.ts`); null is "The draw could not be loaded"
- `lol.ts` — `getLolSplitAction(input: LolSplitData)` → `ActionResult<LolSplit>`: another of a league's splits this season, for the view to move to from inside the league. `requireAuth()`, `lolSplitSchema`, then `getLolSplit`; null is "The split could not be loaded"

- `travel-assistant.ts` — `applyTravelChangesAction` (re-validates a proposal the user approved and applies it in one transaction → lines + signed undo receipt) and `undoTravelChangesAction`; admins only, both revalidate every Travel page and `/portal`

## Services — `/lib/services/`
- `travel-service.ts` — trip / item / photo / member / share CRUD,
  `updateTripShareExpiry` (sets only `expires_at`, on a share of the owner's
  trip that is not revoked; null when none matched),
  `addTripContribution` / `updateTripContribution` / `deleteTripContribution`,
  `buildScope` (one traveller's own view of a shared link), `toPublicItem` (a
  share link's item, field by field: costed as the planner costs it, never the
  raw price, and no figure or note on a link that hides money) and
  `getDashboardTravelSummary(userId, readerToday)` (up to two featured trips —
  in progress, then upcoming, then the latest past — with state badge + counts
  for the dashboard card; costs per-person items by their attendees, not the
  whole party). `ensureMemberBelongsToTrip` guards anything that names a
  member: the foreign key proves the row exists, not which trip it is on.
  `updateTrip` / `deleteTrip` scope the WHERE by owner and `updateTrip` throws
  when no row matched
- `sports-service.ts` — favourites CRUD (`listUserFavoriteSports`, request-cached, carries each row's `competition`; `listUserFavoriteSportIds` derives from it) + `setSportCompetition(userId, sportId, competition)` (updates only the caller's own favourite row; null when there is none) + `getSportTeamFilter(userId, list)` / `setSportTeamFilter(userId, list, teamIds)` (the teams a match list is narrowed to: upsert per (user, sport, competition), each team once in the order picked; every team deletes the row) + `getDashboardSportCard(sportId, competition?)`: one favourite's dashboard card (featured match and the top five of its table — football, the NBA and the NFL with the four games after it in `following`, live first then fixtures soonest first, else the latest results (`featuredAndFollowing`, `CARD_FOLLOWING`), LoL stepping through its series in `following` like football; or for tennis and padel the tournament on or next and the rankings) from the same cached feed as its view, for the championship it is set to, with its picker in `competitions`; football's, the NBA's and the NFL's also carry `news`, their ESPN wire's latest six stories and recaps (football's for the league shown, fetched beside it, no football-data request spent) (`cardNews`: no clips — a clip's page is a video player); null for F1, whose card is its own. Football reads only the league it is set to (the Champions League by default; the World Cup from `getWorldCupData`); tennis and padel follow the men's tour alone, with no picker (`racquetCard`: the tournament on or next, "Rankings", the line under the title "ATP" or "Premier Padel"), whatever an old favourite still has stored; LoL shows the chosen split. A stored value the sport no longer offers (a LoL event out of today's feed) falls back to the card's own pick, and LoL sends it as `competitions.waiting` (still stored, shown again when the event returns) so the picker can tick and clear it. The NBA's card, before the opener and so with no table, carries a `note` in its place (`nbaNote`: last season's champion, or "Standings start with the opener", plus "Tips off …"). LoL's card follows `LolData.splits[0]`; its lead box steps through the series still to come (or, with none ahead, the latest results), so it is as tall as football's, the NBA's and the NFL's. With no standings it carries `swiss` in the table's place (`lolSwiss`, drawn by `dashboard-swiss.tsx`): a row a record from `swissRecords` (wins desc, losses asc, nobody until a match is decided), those through and those out on one row each, so it never runs past four or five rows — only while that stage still has teams to place (`swissFinished`), so the knockouts carry nothing stale. After an international final it is the off-season card (`lolOffSeasonCard`): the final, the other knockouts newest first, and `lolChampionsTable` (the event's winner, then each regional split's of the same season, `unranked`) — "<season> champions" after Worlds, "Latest champions" after MSI / First Stand (see *Notes*). `getF1DashboardHighlight(now)` feeds the F1 card an `F1DashboardHighlight`, worked out per request from the cached feed (`leadRace`, then `weekendNow` / `startsIn` for the session live and next), with last year's winner at its circuit from `getF1SeasonWinners` — asked for alongside the feed, and again only when the feed's season is not the calendar year; none for a race already run or the sample
- `lolesports-service.ts` — `getLolData()` reads every league's tournament list first (`getLeagueTournaments` → `{ current, next }`), then fetches Worlds / MSI / First Stand — the one being played (from its start until the first regional tournament starting after its final is under way, and while none is listed — `isCurrentEvent`) and this season's that are over (`over`, ordered among the rest by end date, so MSI stays to be looked back on; last season's never) — plus LEC/LCS/LCK/LPL from Lolesports' unofficial API (`esports-api.lolesports.com`), maps to `LolData` including playoff `BracketRound[]` (one round per standings section, **split by the schedule's `blockName`** when a whole playoff arrives as one section — `buildLolBracket`; the TBD-count heuristic remains only as fallback for unnamed sections), picks the currently-active tournament (never the future split), keeps only that tournament's schedule events (`findInSchedule` reads up to `SCHEDULE_PAGES` = 3 pages, newest first, while a page holds none of the tournament and starts after it ended, then `/getCompletedEvents` as a last resort — matches with a VOD only; failing both, the split keeps its standings and bracket with no matches), maps `regular_season` / `groups` / `group_stage` / `swiss` into standings and leaves play-ins out of the bracket; an international event's play-ins are a bracket of their own (`LolSplit.playIns`). Each stage's bracket is `buildStageBracket`: the schedule's blocks as rounds, unless a block holds several rounds (a team plays twice in it — MSI's double elimination is one "Knockouts" block of thirteen, its play-ins one of six), when `flowBracket` lays the stage out by where its teams went, since the API links no match to the ones feeding it: in the order played, each match one column after the later of its teams' previous matches (`round-N` ids, "Round N", a last single match "Final"), a match between two teams that have both lost in the lower bracket (`BracketMatch.side`), and each winner's next match linked to the one it won (`playInLinks` / `playoffLinks`). `orderSplits`: the current international event, then the splits on today, then the rest by latest end date (`TARGET_LEAGUES` only breaks ties). `LolSplit.champion` is the winner of the round named Finals once they hold a majority of its best-of (`findChampion`, bo5 when unknown; see *Notes*); `LolData.upcoming` is each league's next tournament, soonest first. A league's split carries its `tournamentId` and, with more than one, `seasonSplits` — its tournaments this season that have started, in order (`seasonSoFar`). `getLolSplit(region, tournamentId)` reads another of them for the view: only a tournament of that league, this season and started (the id arrives from the browser), cached a day (`lolesports:split`). Every team with a logo sits on a `#222` disc (`LOGO_DISC`; the logos are drawn for a dark ground, and T1's and Fnatic's vanished on their own colours) — `FALLBACK_COLOR_BY_CODE` only colours initials. Worlds' Swiss stage also becomes a `SwissStage` (`buildSwissStage`, see *Notes*). A completed event missing `result` renders "—", never a fake 0–0. Cached 5 min via `cachedFeed`, `LOL_DATA` only when there is no last good answer
- `openf1-service.ts` — `getF1WeekendResults(season, round, from, to, now?)`: every finished session of one weekend from OpenF1 (`api.openf1.org/v1`, no key), practice included, which Jolpica does not carry: `/sessions` in the window (half a day either side), `/drivers` for the meeting, then `/session_result` per session that is over, one after another through `rateLimiter(3, 1_100)`. `sessionRows` orders each by position: the best lap (qualifying: the last part reached, with its `segment`; a sprint or race: the winner's total time only), the gap ("+0.042", "+2 laps"), "DNF" / "DNS" / "DSQ", team and colour. Two `cachedFeed`s, picked by the clock: `openf1:weekend` (5 min) while the weekend can still change, and `openf1:weekend-settled` (a day) once it is 48h past its race (Jolpica's settling window), where a weekend with no sessions is thrown rather than stored, so an empty answer is never kept for a day; nothing on a failure. `loadSport("f1")` and `loadF1Race` read it, the hub for the race on now or next once its first session has started (`weekendWindow`); `rateLimiter` itself now lives in `upstream.ts`, shared with Jolpica
- `jolpica-f1-service.ts` — `getF1Data(now = Date.now())` is a plain function that puts the season together on every read from cached parts, all asked for at once (see *Notes*): `getF1Core` (`/current.json` and both standings from Jolpica-F1, `api.jolpi.ca/ergast/f1`, an Ergast-compatible drop-in; ESPN's portraits joined inside it) and `getSeasonRaces`, one 5-min `cachedFeed` entry per season-wide list — the three podium steps (`results/1|2|3`), `qualifying/1`, `fastest/1` and `sprint/1` (see *Notes* for the first two) — all on Jolpica's `current` season; rounds of another season, which an entry can still hold around the new year, are left out. A list that fails keeps its last answer, one never fetched is just empty; `F1_DATA` only when the core has never answered. `tallyPodiums` counts each driver's and constructor's podiums; `mapRaces(…, now)` derives each race's status (with no results, completed 3h after its start, since results land hours later, or at the end of its day with no start time), `circuitId`, `startsAt`, `country`, `sprint`, `sessions` (sorted by instant: Jolpica lists a sprint weekend's Qualifying before its Sprint), `winner`, `podiumGaps` (a lapped car is "+1 lap", not its `Time`), `pole` (its Q3, else Q2, else Q1 time), `fastestLap` and `sprintWinner`. Drivers get ESPN's headshot + flag (`getF1DriverPortraits`, matched by race code → full name → surname by `portraitLookup`; ESPN failing only drops the pictures) and constructors their vendored logo (`teamLogo`). `getF1RaceClassification(season, round, now)` reads one race's whole field (`mapClassification`; an unplaced car is DNF / DSQ / NC…): 5 min within 48h of the start, while stewards' penalties can still reorder it (`jolpica:f1-classification-recent`; a race the calendar cannot place counts as recent), a day after, or at once for a past season (`jolpica:f1-classification-settled`), and an empty answer throws, so "no results yet" is never kept. `getF1SeasonWinners(season)` is one `/{season}/results/1.json` call → the winner at each `circuitId`, cached a day. Every Jolpica call waits for the module's rate limiter (see *Notes*)
- `espn-f1-standings-service.ts` — `getF1DashboardStandings(top)` reads ESPN's public `site.api.espn.com` racing standings (no key) for the dashboard card, because Jolpica carries no driver photos or team liveries and the card wants both; `getF1DriverPortraits()` reads the same table for the F1 feed (every driver's face and flag, uncached on its own). Cached 5 min, returns `null` when ESPN fails and there is no last good answer, so the card simply drops the tables. Two provider quirks it has to work around: the points figure is `championshipPts` for drivers but `points` for constructors (a variadic `stat()` takes the first name that resolves, or every constructor reads 0 pts), and ESPN's `abbreviation` on a constructor row is the *driver's* initials — Mercedes came through as "LP" — so `teamCode()` derives the code from the team name instead. ESPN publishes no constructor logo at all — every racing `teamlogos` path 404s — so `TEAM_LOGOS` maps ESPN's team name (or Jolpica's: "RB F1 Team", "Haas F1 Team") to a file under `public/f1/teams/`
- `rapidapi-f1-news-service.ts` — `refreshF1News()` (the daily cron's upsert of RapidAPI's window into `f1_news`; nothing without `RAPIDAPI_KEY`), and the reads, all from the table: `getF1News(limit)` newest first, `getF1Article(id)` (request-cached for `generateMetadata` and the page) and `getOtherF1News(id)` for the foot of an article (see *Notes*)
- `espn-news-service.ts` — `getEspnNews(feed)`: a News tab's wire from ESPN's key-less site API (`/apis/site/v2/sports/{sport}/{league}/news?limit=24`), for `nba`, `nfl`, `atp` and each football competition (`FEEDS`: `soccer/eng.1`, `esp.1`, `ita.1`, `fra.1`, `ger.1`, `usa.1`, `crc.1`, `uefa.champions`, `fifa.world`; a feed may carry query parameters of its own — Costa Rica's is ESPN's Costa Rican edition, `lang=es&region=cr`, in Spanish, as espn.com's English wire for it stopped in 2023; `newsUrl`), as `NewsStory`s newest first, each once. `storyFrom` drops ESPN+ (paywalled) and anything with nothing to link to, opens at the source over https, marks clips (`Media`) as videos and game recaps as recaps, files a story under its team and athlete categories (`about`), and takes the widest photograph — never a recap's "stitcher" picture, its two logos on a card. Cached 15 min (`espn:news`); `[]` when ESPN does not answer, so the tab goes rather than the sport
- `football-service.ts` — the router: `getFootballCompetition(id)` reads the World Cup from `getWorldCupData`, MLS and Costa Rica from `getEspnFootballLeague` and the rest from `getFootballLeagueData`, so neither ESPN league spends a football-data request (`loadSport` and the dashboard's football card both go through it). `FOOTBALL_COMPETITIONS` is the picker's list, by name: football-data's leagues, ESPN's, the World Cup last
- `espn-football-service.ts` — `getEspnFootballLeague(id)` for `mls` (`usa.1`) and `costa-rica` (`crc.1`), key-less, 5-min `cachedFeed` (`espn:football-league`), mapped before caching, the league's fixture (the very object) when cold. Reads six weeks back and four ahead from the scores bar a week a request (`fetchHeaderDays`), the table (`/apis/v2/sports/soccer/{slug}/standings`) and the teams list (colours), the last two failing soft. Status from the scores bar plus `STATUS_FINAL_PEN` → `pen` with `penalties` from each side's `shootoutScore`, `STATUS_FINAL_AET` → `aet`; live, the minute from `shortDetail` ("90'+5'" keeps its stoppage time in `statusText`, "HT" says half-time). Rows in ESPN's `rank` order; zones from ESPN's row notes where a table has any (MLS: Round One / wild card), else `ZONE_BAND_DEFAULTS` (Costa Rica's top four). **MLS's two conferences go in `groups` (East, West) and `standings` holds the league-wide table, the Supporters' Shield's (points, wins, goal difference, goals; no zones)** — the view and the dashboard card show the conferences, the news leads with the Shield's top three. The knockout is built from the games, as ESPN has no bracket naming clubs, and only inside a league's play-off span (`playoffs`: MLS mid-October to mid-December, kept up until February; Costa Rica's Apertura in December and Clausura in May), reading the span's earlier days in requests of up to two months when they fall before the days listed, and leaving the bracket out rather than half drawn when that read fails. MLS: Wild card (one game a conference), Round One best of three (`seriesTie`, wins; a cancelled Game 3 is neither a game of the series nor in the match list), conference semi-finals and finals and MLS Cup single games; Round One in seed order (1 v 8 above 4 v 5, 2 v 7 above 3 v 6, the East's half first), every later round by the ties its clubs came out of, an empty slot naming the winners it waits for. Costa Rica: semi-finals (1 v 4 above 2 v 3) and final over two legs, each leg from the tie's first side, the aggregate once both are over, the winner from ESPN's `advance` on the second leg (its notes say "Alajuelense advance 4-1 on aggregate"), else the aggregate, else the shoot-out; one leg alone has no winner; a grand final only when one is played. Stage labels: "East · Round One · Game 2", "Apertura semi-final · Leg 1", "Relegation play-off"; league games none. Two clubs with one short name ("San Carlos") go by their full names
- `football-data-service.ts` — `getFootballLeagueData(id)` fetches standings + matches for one of UCL, La Liga, EPL, Serie A, Ligue 1 and the Bundesliga from football-data.org (each its own 5-min `cachedFeed` entry; typed `FootballDataLeagueId`, so MLS, Costa Rica or the World Cup cannot reach it; `FOOTBALL_DATA_LEAGUES` and `WORLD_CUP_LEAGUE` name them for the picker; `ZONE_BAND_DEFAULTS` is every competition's zones by position, ESPN's leagues' included), keeps the last good table through a failed refresh and falls back per league to the fixture only when cold. Requires `FOOTBALL_DATA_API_KEY`. Stops sending once the provider's `x-requests-available-minute` reaches 0 or it answers 429 (until `x-requestcounter-reset`), two requests in flight at most; shoot-outs come out of `fullTime` into `Match.penalties` (`goalsOf`). Knockout competitions (UCL) fetch the full season in ONE matches call and derive both recent matches and the two-legged knockout bracket (`buildKnockoutBracket` pairs legs by team set → aggregate + winner; **aggregate/winner stay `null` until BOTH legs are `FINISHED`** — summing scheduled legs with `?? 0` used to fabricate an aggregate and bold a "winner" mid-tie); league-only competitions use a ±60d window (`MATCH_CAPS`: 30 fixtures, 80 results). Finished cup matches map `score.duration` to `aet`/`pen` statuses. Stage labels use real round names (Round of 16 / Quarter-finals / etc.) for knockout, "Matchday N" for league play. Also exports `getWorldCupData()` (cache tag `sports:worldcup`, mock fallback `WORLD_CUP_DATA`): ONE `/competitions/WC/matches` call derives group tables (`buildGroupStandings` computes W/D/L/GF/GA/Pts per group from finished GROUP_STAGE matches → `FootballLeagueData.groups`), the flat match list, AND the single-leg knockout bracket. A one-leg match (the final, any one-legged round) takes its winner from `score.winner` only once it is `FINISHED`, as a two-legged tie waits for both legs — while it is played football-data names whoever leads — and carries a shoot-out in `BracketMatch.penalties`. Undecided knockout fixtures come back with **all team fields `null`** (`teamFromFd` returns `null` → TBD bracket slots; TBD-vs-TBD fixtures are excluded from the flat match list but kept in the bracket). `KNOCKOUT_ROUND_ORDER` covers LAST_32 and THIRD_PLACE for cup formats. Cold-load cost is 2 calls per competition and 1 for the World Cup
- `padel-api-service.ts` — `getPadelData()` takes the 5-min `getPadelFeed` (the men's rankings, `per_page` not `limit`, and the Premier Padel season from Padel API, `padelapi.org/api`: `level=major,p1,p2,finals` from Jan 1, or 45 days back when that is earlier — 2 calls; maps `pending | live | finished`, tier, poster, venue, prize, the men's `winners` and the whole season as `calendar`; the hub follows no women's draw) and joins in, OUTSIDE that cache (see *Notes*), the draws worth having (`drawsWanted`): the featured tournament's once it can exist (`drawIsOut`), the current one's and the three just finished (for their finals' runners-up), each from `padel-api:draw:live` (5 min) or `padel-api:draw:finished` (24h). Only the featured and current tournaments keep their brackets. One `/tournaments/{id}/matches` call (fifty, final first) holds both categories down to the round of 16, and `fetchPadelDraw` keeps the men's (`drawFrom(id, matches, "men")`) and, while their round of 16 still has a side to fill (`roundIsSet`: named by the provider, or the winner of the match feeding it), reads the draw's other pages too, three at most for a Major's 126 matches, and only in a tournament's first days. `drawFrom` builds a round-of-16-to-final bracket — or, while the round of 16 is being filled, the whole draw from its first round, as tennis does, so a draw just published reads as one rather than "not drawn yet" — of pairs (with both players' `photos`, spelled from their names as the rankings' faces are) keyed by their sorted player ids ("65-66" — the provider flips the order between rounds), placing slot (round, i)'s winner in (round/2, i/2), with tie-breaks, walkovers / retirements and byes (`outcome: "bye"`, the missing side shown as "Bye"); a draw whose results the free plan hides (`hidden_free_plan`, older than ~6 months) comes back `resultsHidden` with no rounds. A champion pair is named in player-id order, as the draw names it. `getPadelDraw(id)` serves a tournament's page and the hub's featured draw from the same caches (`drawFor` → `getLiveDraw` / `getFinishedDraw`), only for a tournament on the season's calendar, and asks nothing before its draw can exist. Requires `PADEL_API_KEY`; `PADEL_DATA` only when cold, returned as is so `sample` still sees it. The rankings carry no photo, so `photoFor` spells each player's from the name (`media.padelapi.org/player-api/{slug}.webp`, the address the player record serves as `photo_url`) — no extra request
- `espn-tennis-service.ts` — `getTennisData()` takes the 5-min `getTennisFeed` (ESPN's public tennis API, no key; the ATP only — one scoreboard over today ±14 days — status from the matches, champion, main draw, Grand Slam tier, venue and defending champion, `tournamentFrom`, with days read by `espnDay` so an event ends on its final's day — and the top 20 of `/rankings`, `rankingFrom`: 2 calls) and joins in the season's calendar OUTSIDE that cache (see *Notes*): `getTennisCalendar`, the core API's `calendar/whitelist`, 24h, the previous season's while the new one is empty, matched to the scoreboard by `calendarWith`. Only the featured and current tournaments keep their draws. The ATP is hard-wired (`SLUG = "mens-singles"`, `/atp/` paths): no function takes a tour. `getTennisDraw(id)` (men's singles ids only) reuses a shipped draw (`shippedDraw`, its players narrowed to the draw's own), else reads the scoreboard for the event's final day (today while it is live) with `cache: 'no-store'` (see *Notes*), trims it to that event's singles and caches the mapped draw (`espn:tennis-draw:live` 5 min, `:finished` 24h); only an event on the tour's calendar is read. `TENNIS_DATA` only when cold. Photos only from the rankings' `athlete.headshot` (the id-shaped path 404s for players without one); draw players get theirs from the same rankings by athlete id (`photosById`, into `Team.logoUrl`)
- `racquet-draw-service.ts` — server-only `getRacquetDraw(sport, tournamentId)` → `RacquetDraw | null`: `getPadelDraw` or `getTennisDraw`, through that provider's cache; shared by `loadRacquetTournament` and `getRacquetDrawAction`
- `balldontlie-nba-service.ts` — `getNbaData()` shows ONE season, S = `currentSeason(today)` (it flips on Oct 1, as ESPN's does), joined from three caches. `getNbaFeed` (5 min) holds one page of balldontlie games (`BALLDONTLIE_API_KEY`; fourteen days back and seven ahead in season, June 1 → +130 days out of it — `gameWindow`; another page only while the last has a `next_cursor`, `MAX_PAGES` 3) filtered to S, ESPN's regular-season table for S (`season=S+1&seasontype=2`, `standingsFrom`; teams keyed by abbreviation so the two join; `[]` while every row is 0–0), and until the opener `tipOff` (`tipOffFrom`: S's first regular-season game, read only off a page that starts before Oct 1 of S) and last season's `champion` (`championFrom`, off the finals already on the page; the series score is left out when it is not all there). Outside that cache (see *Notes*) come the bracket — `getNbaPlayoffs`, keyed by year, only while `playoffYear` names one (S+1 while the page holds S's postseason games, or Apr 10 → Jun 30): ONE call to ESPN's scoreboard header (`site.web.api.espn.com/apis/v2/scoreboard/header`, Apr 10 → Jul 31 — the site API's `/scoreboard` 400s on date ranges), grouped by `playoffsFrom` into best-of-seven series (wins from ESPN's `seriesRecord`, first round placed by seed 1v8/4v5/3v6/2v7, East half first, later rounds TBD until drawn, play-in left out) — and, while `tipOff` is set, the preseason: `getNbaPreseason`, keyed by season, the same header from Oct 1 through tomorrow (`limit=300`), whose season-type-1 games `preseasonFrom` lists as "Preseason" (a side outside the NBA, the London Lions, keeps a monogram). `recentAndNext` then trims both providers' games to two weeks of results and a week of fixtures, never fewer than six of either (six by count was one busy night: the list showed today alone; a few nights alone was a finals series' last game or two). A third extra, while a game to come is within the next nine days, is the national channels: `getNbaChannels`, keyed by the day it starts from, the same header from yesterday through `FIXTURE_DAYS + 1` ahead (balldontlie has no channels at all); `channelsFrom` keeps each game's national line by balldontlie's codes, and `withChannels` gives each listed game the channels of ESPN's game between the same home and away sides nearest its tip-off, within 36 hours (a bare-date tip-off is up to a day off ESPN's; a playoff pair plays again two nights later). A failed request lists the games without channels. Either extra keeps its last good answer through a failed refresh; only a cold cache gives `playoffs: []`. `NBA_DATA` only when the games have never answered. Every team's logo, games and table alike, comes off ESPN's CDN by ESPN's abbreviation (`logoFor`: `gs`, `no`, `ny`, `sa`, `utah`, `wsh` for the six balldontlie spells differently)
- `lib/sports/paths.ts` — the module's addresses: `SPORTS_PATH`, `sportPath(sport)` (`?sport=`), `tournamentPath(sport: RacquetSport, id)` and `f1RacePath(round)`, the pages under the hub; the favourite toggle's revalidation, the dashboard cards' links, the breadcrumbs and the not-found page read them
- `lib/sports/detail.ts` — server-only loaders for those pages, each `cache`d for the request so the page and its metadata read once. `loadRacquetTournament(sport, id)`: the tournament from the men's tour (feed, else the season's calendar — `findTournament`) and its draw as a `DrawState` — the one the feed shipped (`shippedDraw`, its players narrowed to its own), "unavailable" for a fixture id, "pending" before it can exist (`drawIsOut`), else `getRacquetDraw` through the provider's cache ("error" when the provider did not answer) — the reader's today and the tour's `season`; null for an id the tour does not list. `loadF1Race(round)`: the race from `getF1Data`, whether it is the one on now or next, its sessions so far (`getF1WeekendResults`, only once its weekend has started) and, run, its classification (`getF1RaceClassification`; null while Jolpica has none); null for a round the season does not have
- `lib/sports/espn-broadcasts.ts` — a game's national channels as ESPN names them, TV first then streaming (`["NBC", "Peacock"]`): `headerBroadcasts` reads the scores bar's `broadcast` line ("Peacock/NBC", `""` for none), `siteBroadcasts` the site API's `national` market. Regional networks (on in one city) and League Pass (on nearly every game) are never named, since neither says where to watch; the channels are the US's
- `espn-scoreboard.ts` — the ESPN scores bar (`site.web.api.espn.com/apis/v2/scoreboard/header`), the one ESPN host that takes a date range (the site scoreboard answers 400 to one for every league but tennis): `fetchHeaderDays` reads a range a week per request (the bar 502s past ~200 games), `cache: "no-store"` so raw pages never reach Next's cache; `headerMatch` / `headerStatus` / `headerTeam` map an event (postponed and cancelled before its state); `groupSeries` / `seriesTie` / `seriesBracket` build best-of series from playoff games (wins as the score, decided at the majority, the top half first, the final oriented to it). Shared by the MLB and the NHL; the NFL reads its `headerStatus` and `sidesOf` too (a suspended game is postponed in all three).
- `espn-site.ts` — the site API's other half, shared by the NFL, MLB and NHL services: the team and standings response types, `fetchEspnJson`, `teamColour` (each sport's own set of marks that vanish on their colour), `teamsListFrom`, `standingStat` / `standingValue`.
- `espn-mlb-service.ts` — `getMlbData()`: the teams, the standings (`level=3`, by playoff seed, games behind from the division's), the games from 14 days back to 13 ahead (four weeks of the scores bar) and, from Sep 26 to Feb 14, the postseason as a bracket (Wild Card 3, Division Series 5, LCS 7, World Series 7). Status words in `Match.statusText` ("Top 7th", "F/10"); the All-Star Game and MLB.TV dropped; ten clubs whose marks vanish on their colour get a white disc. Five minutes; a scores bar that fails throws so the last good answer stays.
- `espn-nhl-service.ts` — `getNhlData()`: the same on the NHL: games ±14 days, the standings (`level=3&seasontype=2`, East/West, the four divisions, conference seeds), the playoffs' four best-of-seven rounds from April; "P2 12:34", "OT" / "2OT" / "SO" read from ESPN's own words, never the period number; Utah's "UTAH" read as UTA.
- `lolesports-news-service.ts` — `getLolNews()`: Riot's lolesports.com news page (robots.txt allows every reader; no JSON API, so the stories are read out of the page's React payload, each an `Article`), pro play only, about eight a month; a YouTube link is a video, the banner a 768px Sanity copy. An hour; fails soft to no News tab. GosuGamers had daily match reports but its terms forbid scraping; Dot Esports and Sheep Esports sit behind Cloudflare.
- `premier-padel-news-service.ts` — `getPadelNews()`: Premier Padel's own news (`api-prod.premierpadel.com/api/news/getNews`, the backend premierpadel.com's news page reads; no key, undocumented, so it fails soft to no News tab), about a story a day, each opened on premierpadel.com with its compressed picture off `cdn.premierpadel.com`. A quarter of an hour. Padel API's news carried one story across four events; ESPN has no padel.
- `stab-surf-news-service.ts` — `getSurfNews()`: Stab Magazine's WSL tag through its WordPress API (`stabmag.com/wp-json/wp/v2/posts?tags=26`, robots.txt allows every reader), the 768px picture, premium (paywalled) posts dropped; an hour. ESPN has no surfing. HTML to text through `lib/utils/html.ts` (`decodeEntities`, `htmlText`), shared with the WSL parsers.
- `wsl-surf-service.ts` — `getSurfData()` reads the World Surf League's own pages (the owner's call, against its terms of use, which forbid automated reading; no API exists), server-side with a descriptive User-Agent: the season's schedule (`/events/{year}/ct?all=1`) and the men's rankings (`/athletes/tour/mct`), an hour each; the featured stop's draw (`…/results?showAll=1&statEventId=`), five minutes while it is live, else an hour; each finished stop's winner and runner-up from its own results page, a week once surfed. At most four pages in flight, the second wave inside what is left of `UPSTREAM_TIMEOUT_MS`; an unreadable schedule falls back to `SURF_DATA`. Parsers in `lib/sports/wsl-parse.ts` (regexes over the pages' BEM classes, no dependency), tested on trimmed copies in `lib/sports/__fixtures__/`.
- `espn-nfl-service.ts` — `getNflData()` reads ESPN's public NFL API (no key): this week's scoreboard and, a call each, the four weeks before it and the three after (`weeksAround`, inside the season type's own weeks; a week that fails is left out), `standings?level=3` (conference seed + division), and in the postseason one scoreboard per round for the bracket (`roundFrom`). Cached 5 min via `cachedFeed`, `NFL_DATA` only when cold. `team.logo` (scoreboard) / `team.logos[0]` (standings) → `Team.logoUrl`. Each game's national channels ride on the scoreboard it already reads (`siteBroadcasts`: the `national` market, TV before streaming → `Match.broadcasts`)

- `travel-assistant-service.ts` — the assistant's reads (`listAssistantTrips`, `getAssistantTrip`) and its one write path, `runChanges`: `previewTravelChanges` runs it in a transaction it rolls back, `applyTravelChanges` commits it, `undoTravelChanges` replays the signed inverse (see *Notes*). `travel-service.ts` exports `tripRowValues` / `itemRowValues` / `setItemMembers` so the forms and the assistant save the same way, and `loadTripWithRelations(exec, …)` (what `getTripWithRelations` caches) so a preview can read the trip inside its own transaction

## Schemas — `/schemas/`
- `travel.ts` — `createTripSchema`, `updateTripSchema`, `tripItemBaseSchema` →
  `tripItemSchema` / `updateTripItemSchema` (both carry the `endsAfterStart`
  refinement — a backwards range makes the calendar compute a negative span),
  `tripPhotoSchema`, `createTripShareSchema` / `updateTripShareExpirySchema`
  (an `expiresAt` is null or in the future), `tripContributionSchema` /
  `updateTripContributionSchema`, `setItemStopsSchema`, `setTripMembersSchema`,
  `airportQuerySchema`, `tripChildIdsSchema`. Types are `…Data`; an `…Input`
  (`z.input`) exists only where the schema defaults or coerces
  (`CreateTripInput`, `UpdateTripInput`, `TripItemInput`, `UpdateTripItemInput`,
  `TripPhotoInput`, `CreateTripShareInput`, `UpdateTripShareExpiryInput`), and
  that is what the actions take
- `sports.ts` — `sportIdSchema` (`z.enum(SPORT_IDS)`), `setSportFavoriteSchema` / `SetSportFavoriteData`, `setSportCompetitionSchema` / `SetSportCompetitionData` (`competition` checked against that sport's `SPORT_COMPETITIONS` list or null; NBA, NFL, F1, tennis and padel refuse any — the last two follow the men's tour alone), `setSportTeamFilterSchema` / `SetSportTeamFilterData` (a discriminated union: football with one of its leagues, or `nba` / `nfl` with their own id; up to 64 team ids)
- `racquet.ts` — `racquetDrawSchema` / `RacquetDrawData`: a union on `sport` — padel (`padelapi-<n>`) or tennis (`espn-<n>-<yyyy>-mens-singles`: the men's only) — so an id not in the feed's own shape is refused before it costs a provider request. The view runs it in the browser too, so a fixture's ids never reach the server
- `lol.ts` — `lolSplitSchema` / `LolSplitData`: a league's own region (`z.enum(LOL_LEAGUE_REGIONS)` from `types/sports.ts`, i.e. lec|lcs|lck|lpl — an international event has one tournament a season) and Lolesports' numeric tournament id, so nothing else costs a request
- `f1.ts` — `f1RoundSchema` / `F1RoundData`: a race page's round from the URL: digits only, no leading zero (`/^[1-9]\d?$/`, then `Number`), so each race has one address (`z.coerce` also read "1.0", "0x3" and "1e1")

- `travel-assistant.ts` — `travelChangeSetSchema` (`summary` + 1–60 `changes`: `create_trip` with a `ref`, `update_trip` (cover included), `delete_trip`, `add_item` by `tripId` or `tripRef`, `update_item`, `delete_item`, `add_member` / `update_member` / `remove_member`, `add_photo` / `remove_photo`, `add_payment` / `update_payment` / `remove_payment`; fields are patches, and items and payments can name their travellers with `attendeeNames` / `payerNames` / `memberName`) and `travelUndoTokenSchema`

## Types — `/types/`
- `travel.ts` — `Trip`, `TripItem`, `TripPhoto`, `TripShare`,
  `TripContribution`, `TripMemberView`, `TripItemStop`, `TripItemWithStops`,
  `TripWithRelations`, `PublicTripView` + `PublicTripScope` + `PublicTripItem`,
  plus `DashboardTravelSummary` / `DashboardTravelFeaturedTrip` /
  `DashboardTravelTripState`, `CalendarTrip` (the planner's month) and
  `SharedCalendarTrip` (a share link's month: dates, names and figures only)
- `sports.ts` — `NewsStory` (a News tab's story from any wire: `href` and `external` — our own page for F1's stored wire, the source for ESPN's — `image`, `at` as ISO, `kind` story / recap / video, `about`), `SPORT_IDS` (the one list `SportId` derives from), `SPORT_COMPETITIONS` (what each sport's dashboard card can be set to, football and LoL only: `FOOTBALL_COMPETITION_IDS`, which `FootballLeagueId` derives from, and `LOL_REGIONS`, which `LolRegion` derives from — `LOL_LEAGUE_REGIONS` (`LolLeagueRegion`, `isLolLeague`: the four leagues, whose splits are read on demand) plus the international events), `DashboardSportCard.competitions?` (`DashboardCompetitions`: `value`, `automatic?`, `options`, `waiting?` — a stored choice the card cannot show today), `FavoriteSport` (`sportId` + `competition`), `F1StandingRow` / `F1DashboardStandings`, `F1DriverPortrait` (ESPN's pictures for the F1 feed; `F1Driver.imageUrl` / `flagUrl`, `F1Constructor.logoUrl`), `F1Race.circuitId` (Jolpica's track key, which finds the race's outline), `F1Race.startsAt` (the start as an instant; `date` is the UTC day, see *Notes*), `country`, `sprint`, `sessions` (`F1Session`: an `F1SessionKind` and an instant), `winner` (`F1RaceWinner`), `podiumGaps`, `pole` / `fastestLap` (`F1LapMark`), `sprintWinner` and, on the dashboard's race only, `lastYear` (`F1PastWinner`); `F1RaceClassification` (`F1ClassificationRow[]`), `F1DashboardHighlight` (`season`, `race`, `liveSession?`, `nextSession?`, `nextSessionIn?`), `F1NewsArticle`, and the full domain shapes for matches, standings, brackets, F1/NBA/NFL/LoL specifics, plus `F1SessionResultRow` / `F1SessionResult` / `F1WeekendResults` (a weekend's finished sessions, OpenF1's order), `UserSportsPreference`, `UserSportsTeamFilter`, `TeamFilterList` (a football league, or the NBA's / NFL's one list) and `SavedTeamFilter` (`list` + `teamIds`). `SportId` no longer includes `worldcup` (the World Cup is a football competition; `?sport=worldcup` links land on it); `FootballLeagueId` includes `world-cup`; `DashboardSportCard` / `DashboardMatch` / `DashboardTable` shape every sport's dashboard card (`following?`: the games its lead box steps through after `featured`; `matches`: a list under the lead, LoL's); `FootballLeagueData.groups?: FootballGroupStandings[]` carries per-group cup tables; `Match.penalties` holds a shoot-out outside the score; `LolRegion` includes `worlds` / `msi` / `first-stand`; `LolSplit.swiss` is a `SwissStage` (`SwissPool` / `SwissMatch` / `SwissExit`); `LolSplit.international?` / `LolSplit.champion?` (`LolChampion`: `teamId` + the `final` as a `BracketMatch`) and `LolData.upcoming?` (`LolUpcoming`: region, name, a `YYYY-MM-DD` start); `NbaChampion` (season label, `teamId`, `summary`), `NbaData.champion?` / `NbaData.tipOff?` (both only until the opener; the tip-off an instant, or a calendar day); `DashboardSportCard.note?` (`{ title, text?, when?: { label, startsAt } }`, printed in place of the tables) and `DashboardTable.unranked?` (a list, not a ranking: no position column); `RacquetTournament.tier?` / `imageUrl?` / `venue?` / `prize?` / `defendingChampion?` (its `bracket` shipped only for the featured and current tournament), `RacquetCalendarEntry` + `RacquetData.calendar?`, `RacquetDraw` (`rounds`, `players`, `champion?`, `runnerUp?`, `resultsHidden?`), `RacquetSport` (`padel | tennis`), `DrawVariant` (`player | pair`: singles players with a flag, or padel's pairs) and `DrawState` (pending / error / unavailable / ready with its draw; no loading state, since a tournament's page reads its draw on the server and the hub's `useRacquetDraws` keeps its own); `BracketMatch.legs[]` carry `homeTiebreak` / `awayTiebreak`, `BracketMatch.outcome?` is `walkover | retired`, and `BracketMatch.penalties?` is a one-leg match's shoot-out, kept apart from the score it settled

- `travel-assistant.ts` — `TravelChangeLine`, `TravelProposal`, `AppliedTravelChanges`, `TravelAssistantMessage`, `TravelAssistantEvent`

## Components
- `components/travel/` — trip list/detail, item editors, banner photos, share panel.
- `lib/travel/banner-slides.ts` — `bannerSlides` (the cover, then the trip's own photos) and `BannerSlide`; a plain module because the shared page, a server component, calls it and cannot call a client module's function
- `components/travel/banner-photos.tsx` — the banner carousel shared by the trip page and the public view: `useBannerCarousel` (a turn every 5s, restarted by a hand-picked dot; still under reduced motion; only the marked slides while a proposal marks some), `BannerSlides` (crossfading layers) and `BannerDots`; `BannerPhotos` puts the two together. `banner-photos-dialog.tsx` — `BannerPhotosDialog`, adding and removing the trip's own photos from the banner's Photos button (the cover is still set from Edit)
- `components/travel/assistant/` — `TravelAssistant` (corner button + chat: a floating, non-modal window on wide screens, a full-screen sheet on phones; mounted by `app/portal/entertainment/travel-planner/layout.tsx` when `canUseTravelAssistant`; attaches images through `lib/travel/photo-upload.ts`, the upload `PhotoPicker` uses too), `ProposalCard` (Apply / Cancel, then the receipt with Undo on the newest one), `ChangeTimeline` (the card's strip of the trip's days: dashed where things were, solid where they go), `pending-preview.tsx` (the open proposal as context: `useTripPreview`, `PendingMarks` / `usePendingMark` (`PendingMarks` also scrolls the first `data-pending` badge into view when a proposal lands), `PendingBadge`, `pendingRowClass`, `reviveTrip`), `PendingReviewBar` (Apply / Discard / back to the chat, floating over any page while a proposal waits and the chat is closed), `NewTripPreview` and `VoiceButton` (Web Speech dictation into the message box, ES / EN, with a live level meter; absent where the browser has no speech recognition)
  List/Calendar switches are `ToggleGroup` (they own no tab panels); dates are
  picked with `DateField`; the airport picker is `Popover` + `Command`; the
  trip form takes `onCancel` / `onSaved` so the edit dialog closes on both
- `TripDetail` draws a trip the open proposal touches as the proposal would leave it (`TripPreview.trip`) and locks its content until the user decides; `TripItinerary`, `TravellerBar`, `TripPayments` and the banner (a photo added or removed becomes the slide on show, badged "New photo" / "Removing photo") light up new and changed rows (blue, sliding in one after another), show what changed (old price struck, "moved from"), and keep removed ones on screen, crossed out in red and out of every total
- `components/travel/trip-photo.tsx` — every trip/item photo and cover; a
  dead link shows a muted tile (covers fall back to the trip colour) instead of
  the browser's broken-image glyph
- `components/travel/trips-overview.tsx` — the trips page under the shell: its
  `PageHeader` holds the List / Calendar switch and the page's one "New trip"
  (the empty state's, when there are no trips). The first tab is **List**
  (Upcoming and Past as headed sections). `TripsCalendar` draws each trip as
  one bar per week it crosses (`layOutTrips`), square-cut where a week wraps
  it, stacked in lanes where trips share a day; the month fills the height the
  shell leaves (a week never under 64px, so a short window scrolls) and the
  whole day cell is the "plan a trip here" link.
  `relativeDays` counts to the END of a trip under way and from the last day of
  a past one ("Ends in 3 days", "6 mo ago")
- `app/portal/entertainment/travel-planner/{,new/,[id]/}loading.tsx` — one
  skeleton per page shape; a non-uuid `[id]` is a `notFound()`
- `components/travel/trip-calendar.tsx` — the month view behind the List /
  Calendar tabs; bars laid over the day grid by `lib/travel/calendar.ts`.
  `TripCalendar` (planner, editable) and `SharedTripCalendar` (share links,
  read-only) wrap the same month grid
- `components/travel/unit-arithmetic.tsx` — the "$120 / night × 3" line under
  a figure; the planner and the share page both print it from here
- `components/travel/trip-payments.tsx` — the payment log, per traveller
- `components/travel/share-expiry.tsx` — a share link's lifetime: `ShareExpiryField` (the create form's *Expires* select) and `ShareExpiryEditor` (the row's "Expires Jan 16" popover, *Extend* on an expired link); the maths is `lib/travel/share-expiry.ts`
- `components/travel/category.tsx` — the one category table (icon, tint, dot,
  bar); both the itinerary and the public page read it
- `components/travel/marquee-text.tsx` — a label that walks left on hover, but
  only when it does not fit
- `components/travel/dashboard-travel-card.tsx` — server-component card mounted on `/portal`: two featured trips side by side once the card is `@3xl` wide, only the first on a phone (in progress → next upcoming → most recent past), each with cover photo, state badge, items count and estimated total
- `components/entertainment/sports/sports-hub.tsx` — the per-sport view switcher. It hands every sport's shell, through `SportHubControls` (`shared/sport-shell.tsx`), the round favourites button (`ManageFavoritesSheet trigger="icon"`) and `SportPicker` (`sport-picker.tsx`), which the shell puts at the end of the name row; the skeleton shows them too, so they stay in reach while a sport loads. `SportPicker` is every sport as one `ButtonGroup` (`components/ui/button-group.tsx`) of links to each sport's page (`sportPath`, whole, so they work from a tournament's page too), the favourites first (`favoritesFirst`), every sport by its emoji and short name: the one on screen `aria-current` and shaded, a shortened name ("LoL") with the full one in a tooltip. On a phone the group runs past the screen's edge and slides sideways, starting at the sport on screen (`revealInRow`, `shared/scroll.ts`, which the tabs row uses too); each link is named "<short name>" or "<short name> (favorite)". Switching sport (or football league, via `useSportsNavigation()`) runs `router.push` in the hub's own transition: the picker shows the target at once, and until it lands the body shows the copy of that sport last seen in this visit (`seen-sports.ts`, within 30 minutes), else its `SportSkeleton`. A copy and the fresh page of the same address share one React key, so the tab and picks made on the copy stay. Modified clicks stay plain links
- `components/entertainment/sports/seen-sports.ts` — the sports opened in this visit, in memory, by address (`seenKey`: `"nba|"`, `"football|la-liga"`): `rememberSport` as each lands, `recallSport` for a copy no older than `SEEN_MS` (30 min). It belongs to one account (`viewerId`, the effective user, from the page) and empties when another is looked at, since an impersonation starts and ends with a soft navigation; `rememberTeams` writes a saved team pick into every copy of that list, because the refresh after saving renews only the copy on screen, and another address can show the same list (football's default league with and without `?league=`). `recallSport` only reads, since the hub calls it while rendering: clearing the copies of another account happens in `rememberSport`, in the hub's effect, and an expired copy is just not returned. Server data is already cached (5 min); what a switch waited on was auth and the database, ~0.8s a sport in dev
- `components/entertainment/sports/sports-navigation.tsx` — `SportsNavigationContext` / `useSportsNavigation()` and `SportSkeleton({ sport })` (laid out as `SportShell` is — a name row, then the tabs row — then the Overview's left as that sport fills it: days of match cards, or — F1, padel, tennis — the event on now or next as a card and the ones after it as tiles, each under a heading line; and beside it the table: label, header band, ten rows and the "Show more" line, F1's with its Drivers ⇄ Constructors row), which the route's `loading.tsx` shows alone. Its name row ends on the hub's own favourites and picker inside the hub (`SportHubControls`), on their placeholders in `loading.tsx`, which has no hub
- `components/entertainment/sports/manage-favorites-sheet.tsx` — sheet with per-sport switches, optimistic updates via `setSportFavoriteAction`. `trigger="icon"` (the hub's) is a round star button with the count on its corner, a tooltip and the accessible name "Manage favorites (N)" once any is picked; the default `button` spells it out
- `components/entertainment/sports/dashboard-sport-cards.tsx` — mounted on `/portal`: one card per favourite sport in the order picked, each in its own Suspense boundary (F1's is `DashboardF1Card`) and on the championship its favourite row is set to, or a "Pick favorites" card when there are none
- `components/entertainment/sports/dashboard-sport-card.tsx` — one sport's half-row card for its `competition`, laid out like F1's; the line under the title is `DashboardCompetitionPicker` on a sport with a choice, and "Open" lands football's hub on the same league (`&league=`): the featured match (or tournament), the list under it in labelled groups — "Live", "Up next", "Latest results", each in the service's order (`groupCardMatches`; the list used to be named after its first match, which put results under "Up next") — then `dashboard-sport-tables.tsx`. A card with `following` (football, the NBA, the NFL) has no list: its lead box steps through the featured game and the ones after it (`LeadCarousel`, named "<sport> games" so two cards are two landmarks, keyed by its first game so another championship starts from its own, each box with room under the teams for the dots). Under the lead, the list, the tables and the news fill the two rows in that order, so a card with nothing to list (the stepping ones, tennis, padel, the World Cup with no table) leaves no empty row beside its neighbour's; the four rows stay, so a pair of cards still lines up. `dashboard-sport-tables.tsx` is a client island toggling the tables (East / West, AFC / NFC; the racquet cards follow the men's tour alone, one table) with team crests or player faces, no position column for an `unranked` one. A `note` (the NBA before its opener) prints where the tables would be, its `when` in the reader's zone
- `components/entertainment/sports/dashboard-sport-card-skeleton.tsx` — `DashboardSportCardSkeleton`, a sport card's Suspense fallback in the same four subgrid rows (`dashboard-card-rows.ts`) at typical heights, so a pair takes the row tracks a pair of cards will; the dashboard's `loading.tsx` and its sports fallback draw two
- `components/entertainment/sports/dashboard-competition-picker.tsx` — `DashboardCompetitionPicker`, client island: a quiet shadcn `Select` (aria-label "Championship") reading as the card's line, the card's own pick first where it has one (LoL's "Follow what's on", stored as null; football has none); calls `setSportCompetitionAction` in a transition, shows the choice at once (`useOptimistic`) and pulses while the card comes back. It ticks what is stored, not what the card honoured: a `waiting` LoL event is listed, disabled, as "MSI · when it's on", so "Follow what's on" is a change that clears it (Radix reports no change for the ticked item, and the stale row used to survive it)
- `components/entertainment/sports/dashboard-swiss.tsx` — `DashboardSwiss`, LoL's Swiss stage in a card's table slot: a striped row a record ("Through" in the success colour, "Out" muted and faded), its teams as `TeamBadge` crests, each named for screen readers, a list per record labelled by it
- `components/entertainment/sports/dashboard-f1-card.tsx` — F1's own `/portal` card, half the row once the dashboard is `@xl` wide, gated on F1 being favourited: "<season> World Championship", `F1NextRace`, the championship top 3, then the news rail (`NewsRail` over `fromF1Wire`); "Open" and the next race link to `sportPath("f1")`
- `components/entertainment/sports/shared/champion-card.tsx` + `confetti.ts` — `ChampionCard`, who won a competition (LoL's splits and events, the World Cup): the crest, "<competition> champions", "Beat X 3–1 in the final · <day>" read off the final from the champion's side (a final drawn and settled on penalties is "Beat France 1–1, 4–3 on penalties, in the final", the shoot-out from the champion's side too, from `BracketMatch.penalties`; "Won the final" without a score), and an `aside` (LoL's "Next up"). The first time a champion is shown in a visit, `burstConfetti` throws ninety pieces from the crest on a canvas over the page, in the `--chart-*` colours and gold, removed after 1.8s; nothing under reduced motion (`prefersReducedMotion` from `shared/reveal.ts`, the check the bracket's scroll and the reveals share), nor again on a tab switch.
- `components/entertainment/sports/shared/lead-carousel.tsx` — `LeadCarousel`, a dashboard card's lead box stepping through games: a scroll-snap track (`no-scrollbar`, `overscroll-x-contain`), so a swipe moves it natively and tabbing into a later game scrolls it in, and a dot per game in the box's bottom right corner — 24px targets, the one shown longer and in the foreground colour, the rest `muted-foreground`, each clear of the card — with `aria-current` on the one shown, following wherever the scroll lands (the listener comes and goes with the track), and a tap scrolling to its game, without the smooth scroll under reduced motion. The boxes draw their focus ring inside their border (`FeatureBox`), since the track clips anything outside it. `role="region"` with `aria-roledescription="carousel"`, each game a "slide" named "2 of 5". It moves on by itself (`useAutoAdvance`), a pause button before the dots. One game renders alone, with no dots
- `components/entertainment/sports/shared/news-rail.tsx` — `NewsRail`, a dashboard card's "Latest news": a scroll-snap rail of small cards, picture over headline, our own page for F1's wire and ESPN in a new tab (marked) for the rest, a clip badged "Video" as on the News tab. F1's card ends on it; football's, the NBA's and the NFL's give it the last row to itself, their table having moved up into the list's row (see `dashboard-sport-card.tsx`)
- `components/entertainment/sports/shared/news-rail-track.tsx` — `NewsRailTrack`, the rail's client row: a carousel region named "<sport> news" that steps one story on by itself and back to the first after the last, a pause button at the heading's end
- `components/entertainment/sports/shared/use-auto-advance.ts` — `useAutoAdvance`, the dashboard carousels' turn every `ADVANCE_MS` (7s, long enough to read a headline or a fixture), as the WAI-ARIA carousel pattern asks: holds under the pointer or with focus inside, waits off screen (`IntersectionObserver`, half in view) or in a hidden tab, stops for good once the reader swipes, scrolls or picks a dot, never runs under reduced motion; the region is `aria-live="off"` while it turns and `polite` once the reader moves it. `RotationButton` (`rotation-button.tsx`) pauses and plays it, absent when nothing moves
- `components/entertainment/sports/shared/story-parts.tsx` — the parts of a story card, server-safe and hook-free: `StoryLink` (our own page for F1's wire, the source in a new tab for ESPN's), `StoryImage` (an unoptimized picture with the "Video" badge on a clip; its alt is the provider's alt or caption, else empty, since the headline is already the link's text) and `StoryFoot` (a preformatted day, and the new-tab mark). `NewsList` and the dashboard's `NewsRail` are both built from them
- `components/entertainment/sports/f1-next-race.tsx` — `F1NextRace`, the card's race in a `FeatureBox`: the round with the start on its right as football writes a kickoff (a live pill while the race runs, "Final · <day>" once the season's last race is run), flag, name, sprint badge, circuit and country, the outline, a live pill while another session runs, the next session and how far off it is, winner and pole for a race run, and last year's winner there. Everything time-dependent arrives worked out in the highlight, so it renders on the server only
- `components/entertainment/sports/shared/feature-box.tsx` — `FeatureBox`, the boxed lead of a dashboard sport card (a label, a status on its right, the sport's own body), shared by `dashboard-sport-card.tsx`'s featured match and F1's next race so two cards side by side open on the same box
- `components/entertainment/sports/f1-standings-tabs.tsx` — client island inside that card, Drivers ⇄ Constructors over the same three rows. Drivers carry an ESPN headshot + country flag, constructors their team logo, both drawn by the shared `Portrait`
- `components/entertainment/sports/shared/portrait.tsx` — a face or team logo in a disc filled with `muted` rather than white (so it reads as part of the card, not a lit disc), the flag image or emoji as a badge beside the disc rather than clipped inside it. No picture, or one that fails to load, draws the caller's `fallback` in a disc-sized slot; with none, a livery disc with a 3-letter code in `readableInk`. `size="table"` is 24px on a phone, 28px from `sm`
- `components/entertainment/sports/sports/f1-view.tsx` + `racquet-view.tsx` — faces through `Portrait`: F1 drivers (ESPN, flag badge, and their team's logo — or livery — showing from behind the face on its right, `DriverAndTeam`, in place of the team's name on a second line: one line a row, the team still read out to a screen reader; the constructor is found by the driver's `team`, which is its short name) and constructors (logo or livery, by short name so the row stays inside a phone), tennis/padel rankings and the tennis draw (`DrawMatchCard withFaces`, via `racquet-draw.tsx`). A row without a photo keeps its flag, in a disc-wide slot once any row has one; with no photos at all the table is unchanged
- `components/entertainment/sports/sports/f1-view.tsx` — tabs Overview / News (News only with stored articles, so `?tab=news` without any opens Overview). News leads with one story, big (`NewsList`'s `lead`: its picture beside the headline and more of its standfirst, "Top story"), then the rest as cards; which story is `leadStory` in `lib/sports/news.ts` — shared by every News tab — over `fromF1Wire` (the stored wire as `NewsStory`s, opened on `/news/f1/[id]`) with `f1Interest` (the race weekend on now or next or just run — name, town, country — the championship's top three, and the words of a weekend's news: sessions and results). Overview is `OverviewSplit`, as football's: `F1Races` on the left and, beside it from `@4xl` (below it under that), "Standings": one table under a Drivers ⇄ Constructors `ToggleGroup` (each keeps its faces and logos). The table card is its own `@container`: Wins shows from `@xs` and Podiums from `@sm`, so it holds #, name, Points beside the races (about 300px), adds Wins on a phone and everything from a tablet, never scrolling sideways
- `components/entertainment/sports/f1-races.tsx` — `F1Races`, the left of F1's Overview and its own `@container`, split by `racesTabGroups` (every race after the featured one, and every one run, latest first); every part opens on a heading set like a day heading (`SectionHeading`, `TileSection`), which is what puts its first card level with the standings card: "Next race" / "On now" over the race on now or next as a featured card that does not grey on hover and opens the race's page from a "View details" link at its foot, on the right (the tiles are links to it too, their border firming on hover instead of a grey fill). The featured card holds the round, sprint badge, flag, name, circuit and town, the start, a large outline, `WhatsNext` ("Race weekend", the session live or "Qualifying in 3h", from `useNow`) and the timetable. Under it "Coming up" lists every race still to come, and "Earlier races" stands as a heading line with no races under it: there is no full calendar, and as the match lists bring in earlier days, its `EarlierPill` brings in three races run a tap (`useRevealEarlier`), latest first with winner, pole and fastest lap, under that line after any already in and without moving the page ("Show rounds 15 – 17"). Once nothing is left to run there is an `EmptyState`, and the last three races run are there from the start. Every race opens its own page (`f1RacePath(round)`); the featured card's timetable shows the sessions the page shipped with it (`weekend`). The weekend's rules are `lib/sports/f1-weekend.ts` (`raceSessions`, `weekendNow`, `startsIn`, `isRaceWeekend`, `weekendPhrase`, `leadRace`, `racesTabGroups`, `SESSION_LABEL`), none of which reads the clock (whatever needs the time takes `now`), shared with the dashboard's highlight
- `components/entertainment/sports/f1-race-page.tsx` — `F1RacePage`, one race on its own page, laid out as F1's (`SportShell` with `SportPageControls`, the title a breadcrumb "Formula 1 › the race", "Round N · season" under it) with two tabs, Overview and Results (locked until a session has run; `?tab=results`). Overview: the circuit's outline big in its own card with the place, status, sprint badge and start (for the race on now or next, `current`, the session on track or next instead, by name and time: "Next · Practice 3", from `weekendNow`), the weekend's timetable, the podium with each gap to the winner and pole / fastest lap / sprint; beside it, from `@4xl`, the weekend's timetable, podium and marks in white cards; Results: "Sessions" (each finished session's order from OpenF1: a `ToggleGroup` of P1 / P2 / P3 / SQ / Sprint / Q / Race, named "P1 (Practice 1)" and so on for a screen reader (the name starts with what is on the button), the latest shown until the reader picks one, so a refresh that brings in a newer session moves to it; and a table of position, face, driver and team, time and gap, ten rows at first like every table in the hub; a finished race's own order is left to the classification with its points) and, run, the whole classification (its fastest lap a `Timer`, `aria-hidden`, with "Fastest lap" for a screen reader). The page's section headings are `h2`s. Everything comes with the page; a classification not in yet is a default (not destructive) `Alert` whose Retry refreshes the page
- `components/entertainment/sports/f1-race-parts.tsx` + `f1-race-labels.tsx` — `SessionList` (the timetable in the reader's zone; `results` and `drivers` are required; given `now`, sessions run fade and the live and next ones are marked; with its `results`, a finished session shows its leader — fastest, pole or winner, said to a screen reader — by face and the time in place of when it ran; `sessionDriver` matches a session's row to the standings' driver by code for the face and name, a disc in the team's colour with the code where there is no face), `ResultsLine` (winner, pole, fastest lap), `Podium` (names and faces from the standings: the race feed carries codes only); `raceWhen`, `racePlace`, `SprintBadge`. Neither is a client module: the labels serve the server-rendered dashboard card too, and the parts take `format`, a function a server component could not hand to a client one
- `components/entertainment/sports/use-now.ts` — `useNow()`, the browser's clock through `useSyncExternalStore`, ticking every 30s and `null` on the server and in the hydration that matches it, so "Qualifying in 3h" never differs between the two renders
- `components/entertainment/sports/f1-circuit-outline.tsx` — a circuit's layout as one `currentColor` stroke (`aria-hidden`, non-scaling) from the vendored `lib/data/sports/f1-circuits.ts`; nothing at all for a circuit without one, so its card simply goes without
- `components/entertainment/sports/sports/world-cup-view.tsx` — the World Cup inside football (`?sport=football&league=world-cup`): Groups (the per-group standings grid) / Knockout (default once drawn) / News, with no Matches tab, and football's competitions' menu as its title; once the final has a winner (only once football-data marks it `FINISHED`), `ChampionCard` above the tabs
- `components/entertainment/sports/shared/bracket-canvas.tsx` — the layout every bracket shares: `BracketCanvas` (a column per round, boxes, SVG `elbow` branches measured after layout, sideways scroll when narrower than its columns, `minColumnWidth`), `BracketTeam`, `BracketDate` + `bracketWhen` (the small print under a match: day and time in the reader's zone, or the day alone for a date-only provider) and `MatchHover` (highlight + shadcn tooltip)
- `components/entertainment/sports/shared/league-view.tsx` — `LeagueView`, the NFL's, NBA's, MLB's and NHL's page in one: Overview (the games by day beside the sport's own table, under `TeamPicksProvider`), the bracket tab (`?tab=bracket`, labelled "Playoffs" or "Postseason", locked until `isBracketDrawn`; `opensOnBracket` for the NHL's rule, `lead` for the NBA's season note) and News; `useTeamsMap` and `StandingsTeamCell` (the row header: `TeamPick`, badge, the name truncated or, `codeWhenNarrow`, the club code below `@sm`). Each sport keeps its columns and toggle.
- `components/entertainment/sports/shared/event-facts.tsx` — `Fact`, `FactList`, `VersusLine` and `TileWinner`, shared by padel's and tennis's tournaments and surf's stops (`TILE_FRAME`, the tile without its hover, and `showNames` in `tile-section.tsx`).
- `components/entertainment/sports/shared/knockout-bracket.tsx` — a knockout drawn as a printed bracket is, on every screen size (its scroll controls: each end, a column either way, and a trophy between them that centres the view on the final): `treeOrder` sorts each round back from the final so a later tie's two feeders sit together (`orderPairs` matches them by team, positional for TBD slots), then each round splits in two (`halves`): the top half of the draw on the left running in, the bottom half mirrored on the right, the final between them with the third-place match under it, captioned. Two-sided only for a knockout — every round before the final of even size, and from the second on each halving into the next (the NFL's wild-card six into four is the exception allowed); anything else is drawn one-sided, its rounds in order. `links` (a double elimination's branches, each winner to their next match) draws exactly those branches one-sided, the lower bracket's first tie in each round captioned. Branches and the scroll's columns are measured from layout offsets (`placeIn`, `offsetLeft`): what `scrollLeft` counts in, and a transform on an ancestor does not skew them. Branches only where a round halves into the next. Wider than its card it scrolls sideways — swipe, or the buttons over it: ‹ › a column a tap, « » straight to either end, the other half of the draw — and they show only when it overflows; its scroll and resize listeners attach once the bracket is drawn, so one that first rendered as the not-drawn `EmptyState` still follows the reader's scrolling. It opens on the round being played, its top half's column centred, and again on new rounds, never on the reader's own scrolling. The default box shows the score (a two-legged tie's aggregate, or its running total) and each leg's day; `renderMatch` swaps in a sport's own box (tennis, padel)
- `components/entertainment/sports/shared/matches-by-date.tsx` — every match one day at a time, oldest first, under day headings in the reader's zone ("Today · …" for today) that stick under the sport bar; it opens on a day heading, with no label row of its own. Its own `@container`: cards one, two (`@xl`) or three (`@5xl`) abreast by the list's width, so beside a table it stays at two. A team filter narrows it to some teams' fixtures; it sits on the first day's heading line beside "Earlier", a pill set as that one is (outline, 24px in the 22px line) showing a filter icon or up to three picked crests, with "All teams" / the team / "N teams" and a chevron from `@md` and the icons alone on a phone. Its menu is a `Popover` + `Command`: a search, "All teams", then every team with a tick (`aria-checked`; the list is deliberately not `aria-multiselectable`, since cmdk spends `aria-selected` on its highlight, and it is named "Teams, pick one or more"; the popover is a dialog named "Filter by team", rendered once beside the days, so a tick that moves the pill to another day keeps the search and the highlight); each day is an `h2`, its cards a `ul role="list"` of `ScoreCard as="li"`; the list behind follows each tick, and the pick is saved once (`setSportTeamFilterAction`, `runAction`) when the menu closes having changed. A team picked opens on its last three results (`openingDayIndex(days, today, results)`; the whole list opens on its latest day with one), and what is next. Every league's Overview shares the pick (`TeamPicksProvider`, `shared/team-picks.tsx`, given the list's matches: only a team with games there is a button, and a saved pick no longer in the list counts for nothing) with their table and cards: a team's badge and name there are a toggle (`TeamPick`, `shared/team-pick.tsx`, named by its visible text and described "Shows only this team's matches", `aria-pressed` while it is the list's one team, its own hover, the table row's off) that narrows the list to it, saved as a menu pick is, and back to every team on a second tap; the list's first day is scrolled back under the bar if it was above the screen (a table under it on a phone). It opens on the saved teams (`useSavedTeamFilter`, `shared/team-filter-context.tsx`), letting go of one no longer in the list; with no saved list (a test, a sport without one) nothing is saved. Grouping is `matchDays` in `lib/sports/match-days.ts`. The page is the only scroller (no box of its own, no focusable region): the list opens on the latest day up to today with a finished match and everything after it (`openingDayIndex`), the days before behind an "Earlier" pill with a clock (`History`) at the end of the first day's heading line (named and tooltipped by what a tap brings in, "Show Oct 10 – Oct 14"; a 24px pill that leaves the 22px line alone). Each tap brings in three more days (`EARLIER_STEP`) above the first without scrolling: scroll anchoring is off on the scroller while they go in (`holdScrollStill`), the days on screen slide down from where they were and the new ones fade in after them (`slideIn`, the Web Animations API, none under `prefers-reduced-motion`), and the clock stays on the new first heading, focused, until nothing older is left, when the focus goes to that first day; picking a team reopens it on that team's freshest results and, when the first day's heading was stuck under the bar as the pick was made, scrolls the new first day back under it. "Today" is the request's (`SportsTodayProvider`, fed by the page's `getRequestTodayIso()`), never the client's clock
- `components/entertainment/sports/shared/reveal-pill.tsx` + `reveal.ts` — `RevealPill`, the "Earlier" pill at the end of a list's heading line (outline, rounded, 24px in a 22px line; named and tooltipped by what it brings in), and how a list grows without a jump: `holdScrollStill` (scroll anchoring off while it grows), `fadeIn`, `holdStill` (reduced motion, or no Web Animations API), `prefersReducedMotion` (the one check, read when the motion starts: the reveals, the bracket's scroll buttons and the confetti) and the shared timings. `MatchesByDate` and `useRevealEarlier` use both
- `components/entertainment/sports/shared/tile-section.tsx` — what F1's races and padel's and tennis's tournaments share on their Overview: `TILE` (a tile that is a link, its border firming on hover rather than greying), `SectionHeading` (set like a day heading: `Eyebrow` sm, `py-1`), `TileSection` (a heading line, an optional action at its end, the tiles one, two (`@xl`) or three (`@4xl`) abreast), `useRevealEarlier` (the events played, none until asked for — or, with nothing left to come, the last three from the start — and three more a tap, `EARLIER_STEP`: the new tiles land under the ones shown and fade in without moving the page, the focus stays on the pill while there is more and then goes to the first tile it brought in), `EarlierPill` (a `RevealPill` with `History`, named by what a tap brings in) and `ViewDetailsLink` (a featured card's way to the event's page, at its foot on the right). Used by `F1Races` and `RacquetOverview`
- `components/entertainment/sports/shared/overview-split.tsx` — the Overview grid football, the NBA, the NFL, F1, padel and tennis share: matches (F1's races, the tournament on now) on the left, the table (`tableLabel`, default "Table", on a line with the size, padding and gap of a day heading, so the table card starts level with the first match card) beside them from `@4xl`, stacked below; without a table the matches fill the row. Beside them the table sticks right under the sport bar, its label on the stuck day heading's line, or by its foot (`bottom-6 self-end`) once it is taller than the room, so football's last rows stay reachable. `shared/scroll.ts` (`scrollParent` / `scrollportHeight` / `scrollByFrom`) finds what scrolls: the portal's `<main>` from `md`, the document below it
- `components/entertainment/sports/shared/show-more.tsx` — every table in the hub shows `ROWS_SHOWN` (10) rows, then a "Show N more" button under it (ten a tap, or as many as are left) that turns into "Show fewer" once all are in: one button whose words change, so the focus stays on it, and nothing for a table of ten or fewer. `useShownRows(rows, resetKey)` keeps the limit and drops back to ten when its key changes (another conference, another session). Used by `StandingsTable` (football, World Cup groups), F1's drivers and constructors, the NBA, the NFL, LoL, the padel and tennis rankings, and the F1 race page's session results and classification. A tap says what it did in an sr-only status ("Showing 20 of 36"), and a button pushed out of view by the new rows is scrolled back to, for the keyboard only
- `components/entertainment/sports/shared/match-time.ts` + `time-zone-context.tsx` — kickoff / dateline formatters pinned to the reader's zone (`tz` cookie, provided portal-wide by `ReaderTimeZoneProvider` (app/portal/layout.tsx) and read with `useReaderTimeZone()`; `useMatchTime()` in client cards, `matchTimeFormat(tz)` in server ones); `weekdayDay` is "Tue, Oct 20"
- `components/entertainment/sports/shared/swiss-bracket.tsx` — a Swiss stage as a tree: one column per games played (the pools still playing and the records just reached), joined by branches, winners up and losers down, on `BracketCanvas`. Every match has its day and time in small print; hovering or focusing one highlights it and opens a tooltip with the best-of and status
- `components/entertainment/sports/shared/` — score cards, standings table, knockout bracket, team badge, last-5 form chips, `sport-shell.tsx` (the page's `<h1>` and a sticky sport bar; every sport view mounts its `Tabs` around the shell and renders a `variant="line"` `TabsList` in its `tabs` slot. Two rows at every width: the name — tile, `h4` title, muted subtitle — with the hub's favourites and sport picker on its right (`SportHubControls`), which scrolls away; then the 48px tabs row with its border, the tabs alone, which sticks, scrolls sideways when the tabs outrun a phone and slides to the selected one. A page under a sport passes `parent` (a tournament's: the sport and its page), and the title becomes a breadcrumb in the heading's type, the sport a link back in muted, a chevron, then the `h1`. A view with competitions to switch between passes them as `titleMenu` (football's leagues, LoL's events and leagues, each a `DropdownMenuRadioGroup`): the title itself opens that menu, in the heading's own type with a chevron after it, truncating on a phone; without one the title is plain text. Once the name row is out of sight (`useScrolledAway`, an IntersectionObserver clearing the app header) a small copy of the name, `aria-hidden`, slides into the tabs row. A tab picked while the bar is stuck puts the new panel's top back under it. Offsets in [`docs/SPACING.md`](../SPACING.md)). `draw-match-card.tsx` is a racquet tie in the bracket's own box: faces or flags, the seed in its own column left of the name (between the name and the sets it read as a first set), set scores with the won set lit, a tie-break as 7–6(3) in the tooltip, the day (an instant: day and time in the reader's zone) and "Walkover" / "Retired" in small print, and the shared hover; `variant="pair"` is a padel pair, both surnames stacked, no flag, and both players' faces side by side before them (`PairFaces`, from `Team.photos`, `xs` here and `lg` for the top seeds; an initial for a photo that does not load) once any pair in the draw has one — the column widens to 13rem for them. (`leg-score-card.tsx` is gone: the knockout's default box replaced it.)
- `components/entertainment/sports/sports/` — one view per sport (football, f1, nba, tennis, padel, nfl, lol). The NBA, the NFL, each football league, the World Cup and tennis have a News tab beside F1's (ESPN's wire, `NewsTab` in `shared/news-list.tsx`: `leadStory` then `NewsList`), shown only with news and opened by `?tab=news`. A football league, the NBA and the NFL render `TeamNewsTab` (same file), which reads the saved team filter itself and leads with stories naming the teams picked in the match list or the top of the table, a point each (`teamInterest`; the NBA's and NFL's top two a conference, a league's top three); tennis's tab leads by the ATP's top five and the tournament featured, the World Cup's by no names at all (the latest day's first story with a picture). Padel and LoL have none: neither provider publishes news. Every story opens at ESPN in a new tab, marked as leaving the page; a clip says "Video". Each view smart-defaults to its knockout tab when bracket data exists (LoL/NFL playoffs, the NBA postseason, UCL knockout). Football, the NBA, the NFL, F1, padel and tennis open on one Overview tab, `OverviewSplit` (F1: its races beside the drivers' or constructors' table; padel and tennis: the tournament on now beside the tour's rankings; football: the whole table as `StandingsTable`'s #, club, MP, GD, Pts, and no Table tab of its own; NBA East / West: #, W, L, GB; NFL AFC / NFC: #, W, L, T). Until the opener the NBA's Overview leads with `SeasonNote`: last season's champion with its crest, "Tips off Tue, Oct 20" in the reader's zone and, with no table, "Standings start with the opener". The NBA's Postseason and the NFL's Playoffs tabs are always listed, disabled with a lock until there is a bracket. An international LoL event is its stages, a tab each in the order played — Play-ins, Standings where it has groups, Swiss stage, Playoffs — with no Matches tab; Playoffs is locked until its bracket names anybody, and the event opens on the playoffs once drawn, else the Swiss stage, else the play-ins (MSI: Play-ins and Playoffs, its double elimination by `playoffLinks`). An event whose only stage is a bracket nobody is drawn into yet (no play-ins, no Swiss stage) has no stage under way to land on, so it gets a league's layout: Matches, Standings and Playoffs, Playoffs open and showing "not drawn yet". The title is the split or event on screen ("LCK Split 1", "Worlds 2026") and opens the menu of them, which groups this season's international events ("International") above each league's latest split ("Leagues"); a league's earlier splits this season are a row of pills inside it (`SeasonSplits`: "2026 · Split 1 · Split 2 · Split 3"), read on demand (`useLeagueSplits` → `getLolSplitAction`, kept for the visit, a failure retried with "Try again") and kept per league. A league keeps Matches, Standings and Playoffs, and lands on Standings for a split with a table but no matches (its Matches tab an `EmptyState`); a split or event with a champion gets `LolSeasonEnd` above its tabs (`ChampionCard`, with a "Next up" list of each league's start day once `LolData.upcoming` has any, and only under the split the feed leads with, `data.splits[0]`: an earlier split picked from the pills, or another league's champion, gets no "Next up"), and the subtitle is "League of Legends", with the season unless the name already carries it ("Worlds 2026"). `score-card.tsx` shows the match date next to the status for finished games (not just upcoming), à la Google's sports panels, and under a fixture's time (or a live game's status) where it is on: a TV icon and the first of `Match.broadcasts` in the team names' colour (the one line of that column worth spotting; in the date's grey it went unseen), every channel in its title and for a screen reader, gone once the game is over. The line is as wide as the column and never wider (`w-0 min-w-full`, truncating), so a long name cannot move a card's divider off its neighbours'; "Prime Video" shows as "Prime" (`SHORT_CHANNEL`), the one name that did not fit
- `components/entertainment/sports/sports/racquet-view.tsx` — padel and tennis (`sport` prop), the men's tour alone (`data`: padel's men, the ATP) with no tour picker: tabs Overview and, with news, News, opening on Overview; every tournament's draw is on its own page. Overview is `OverviewSplit`, laid out as F1's: `RacquetOverview` on the left and "Rankings" beside it (ten rows); a tour with no rankings published leaves the tournaments the whole row. The tournament picked of those on now is featured, else the first, else the next to start. Its draw, for the round under way and the seeds, is the one the feed shipped (`shippedDraw`); otherwise, once it can exist (`drawIsOut`), the view's private `useRacquetDraws` asks `getRacquetDrawAction` for it once (a tournament picked from several on now, or a feed that could not ship it), keeping each draw by tournament id and checking `racquetDrawSchema` before calling the action. Nothing is asked for a tournament the Overview does not show, such as last week's final
- `components/entertainment/sports/sports/racquet-tournaments.tsx` — `RacquetOverview`, laid out as F1's races: "On now" (with two or more being played — a week of tennis is three or four — a pill for each by its city on the heading's line, `OnNowHeading`, named "<city>, <tournament>" for a screen reader; `chipLabel` falls back to the name where two share a city) or "Next up" (the heading whenever nothing is under way, over the season-over `EmptyState` too) over `FeaturedTournament` (tier, status, name, `TournamentFacts`, and at its foot, clear of the facts, the round under way from its draw in the secondary text — nothing before play starts — beside "View details" on the right; the card itself does not grey). Both it and the tournament page are a `TournamentCard`: the poster where there is one (padel's, A-format portrait, 1132×1600), beside the content in a 5:7 box 224px wide so the whole poster shows and the card is at least its height (a 2:5 share of the card's width cut its top and foot), and the draw's three best seeds (`TopSeeds` — no label, the faces say it: a 40px face each, `Portrait size="lg"`, a pair's two, the surname small under it for a player with no photo, the seed in its tooltip and for a screen reader) in the content's top right, off the poster. The featured card is keyed by tournament, so a failed poster is not remembered for the next one picked. The seeds are picked from the players in the draw's own rounds (`topSeeds`), since the tour's player list spans every draw the page carries; a week of tennis splits the best players between events, and the seeds say which has them. ESPN publishes no photo for many players, who show their flag. Then "Coming up" (every tournament still to start, from the feed and the season's calendar — `seasonOf`) and "Earlier tournaments" (the ones played, none until "Earlier" brings in three a tap, latest first, as F1's earlier races; the last three from the start once the season is over), as `TournamentTile`s (`TILE`, `TileSection`), their icons `aria-hidden` with the words for a screen reader ("Champion: "). "View details" and every tile are links to the tournament's page (`hrefFor` → `tournamentPath`). Posters are `next/image unoptimized` (a provider host, as with `Portrait`) and drop out on error. Which tournament each part shows is `lib/sports/racquet.ts` (`featuredTournament`, `currentTournament`, `justFinished`, `drawsShipped`, `drawIsOut` / `DRAW_LEAD_DAYS` = 3, `statusByDates`, `clampDay`, `addDays`, and `seasonOf` / `findTournament`, the feed's tournaments with the calendar's behind them), the same helpers the feeds use, so the feed ships the very draws the view opens on; it also holds the pure pieces the view, the page and the loaders share: `drawVariant(sport)`, `shippedDraw(t, players)` (the draw the feed shipped, its players narrowed to its own), `topSeeds`, `cityOf`, `placeOf`, `startsInDays` and `playLine`
- `components/entertainment/sports/sports/racquet-tournament-page.tsx` + `racquet-draw.tsx` — `RacquetTournamentPage`, one tournament on its own page, laid out as the sport's page is (the owner's call: opening a tournament changes only the title and the tabs): `SportShell` with the sport's tile and line (`tourLine`), the favourites and the sport picker at the row's end (`SportPageControls`, `sport-page-controls.tsx`: the hub's two controls for a page outside the hub, a pick — the sport's own included — going to that sport's page), and the title a breadcrumb, "Padel › Kuwait Major 2026" (`parent`: the sport, back to its page; the tournament the `h1`). Two tabs: Bracket, which it opens on, the draw the whole width of the page; and Overview, a `TournamentCard` with the tier and surface, the status, the poster the card's whole height beside `TournamentFacts` (the champions among them once there are some), the round under way or "Starts in 5 days" (`playLine`) and the three best seeds (on the poster where there is one). `DrawBody` covers not out yet, error with "Try again" (a required `onRetry`; here a page refresh), unavailable (a fixture id), champions only and the bracket (`RacquetBracket`, private to `racquet-draw.tsx`: `KnockoutBracket` + `DrawMatchCard`)
- `components/entertainment/sports/shared/detail-skeleton.tsx` — `TournamentPageSkeleton` and `RacePageSkeleton`, the two pages' `loading.tsx`: the tournament's as its page is (`ShellHeadSkeleton` from `sports-navigation.tsx`, the name row and the tabs `SportSkeleton` starts with, then the draw's columns); the race's breadcrumbs and header lines, then the circuit's card, the timetable and the results table. The picture is `aria-hidden`; an sr-only status beside it says "Loading race…" / "Loading tournament…"

## DB tables — `db/schema.ts`
- `trips` — user-owned trips (date-based, no timezone)
- `trip_items` — activities, bookings, transport, food (optional scheduled dates)
- `trip_photos` — uploaded or external URLs; with `item_id` on an activity, without it one of the photos taking turns on the trip's banner
- `trip_shares` — share tokens for read-only public access; `member_id` scopes
  a link to one traveller, `show_prices` / `show_members` gate what it exposes,
  `expires_at` ends it (null: until revoked)
- `trip_members` — who is going, with an optional fixed `share_percent`
- `trip_contributions` — money a traveller has actually handed over
- `trip_item_stops` — a cruise's day-by-day ports
- `trip_item_attendees` — who an item is FOR, when it is not the whole party
- `trip_item_payers` — who covers one item, when it is not the whole party
- `user_sports_preferences` — favourited sports per user; UNIQUE(user_id, sport_id) backs the toggle semantics; `competition` (nullable text, migration 0055) is the championship that favourite's dashboard card shows, null for the card's own pick, and goes with the row when the sport is unfavourited
- `user_sports_team_filters` — the teams a reader narrowed a sports-page match list to, one row per (user_id, sport_id, competition) (UNIQUE): `competition` is the football league id, or `nba` / `nfl`; `team_ids` is a `text[]` in the order picked; every team is no row. RLS on, no grants (migration 0056); cascades with the user
- `f1_news` — the stored F1 wire, one row per provider article, ordered by `first_seen_at` since the provider sends no publication date (see *Notes*)

**"Today" comes from the reader, not the server.** Pages pass
`getRequestTodayIso()` (`lib/utils/request-today.ts`, from the `tz` cookie) to
the client components that need it — the new-trip form seeded its start date
from `new Date()` and hydration-failed every evening west of UTC.

## Tests
- `lib/travel/*.test.ts` — Vitest, pure: `calendar` (week packing, lane caps,
  which items really span days, trips' bars across week rows), `pricing`,
  `split`, `item-fields`, `format`, `airports`, `video`, `share-expiry` (each choice's instant in the reader's zone)
- `schemas/travel.test.ts` — Vitest; backwards date ranges, airport queries, a share expiry in the past or missing
- `lib/services/travel-service.test.ts` — Vitest, mocks `@/db`; covers the CRUD,
  the query count for `getTripWithRelations`, the scoped-share guards, what
  a link without prices carries (no price, payment or note) and the expiry
  update's WHERE (this trip, not revoked)
- `app/actions/travel.test.ts` — Vitest; covers zod rejection, auth failure,
  the audit metadata a share records, and the expiry update (past dates,
  ownership, revoked links)
- `components/travel/*.test.tsx` — Vitest + jsdom; the itinerary, the calendar
  (both versions), the trips overview (one bar per week, lanes, one New
  trip), the payment log, the traveller bar, the marquee, the share
  bar's sign-in, the unit arithmetic, the public page (its client calendar's
  props, its figures) and the share panel's expiry (default, zone, change, extend)
- Travel assistant — Vitest: `schemas/travel-assistant.test.ts` (refs, money), `lib/travel/assistant/{converse,undo-token,stream}.test.ts` (the tool loop against a fake client, web search status and paused turns, signed receipts, NDJSON), `lib/services/travel-assistant-service.test.ts` (apply, merge, ownership, travellers by name, removing one and undoing it, photos, preview, undo), `app/actions/travel-assistant.test.ts`, `app/api/travel/assistant/route.test.ts`, `components/travel/assistant/{travel-assistant,change-timeline}.test.tsx` (stream, card, Apply note, Undo, attachments, dictation, the timeline, following the assistant to a trip, the floating window staying open on desktop and making way on a phone, the review bar), `components/travel/assistant/pending-preview.test.tsx` (new, changed and removed rows on the itinerary, totals without the removed, scrolling to the first change)
- Banner — Vitest: `components/travel/banner-photos.test.tsx` (a turn every five seconds and back to the first, a hand-picked photo's full five, only the marked photos while a proposal waits, no dots for one photo, `bannerSlides`' order)
- `e2e/trip-lifecycle.spec.ts` — Playwright, real Supabase user
- `e2e/trip-share-links.spec.ts` — Playwright; opens both kinds of share link in
  a browser with no session, which is the only place the server/client boundary
  is real
- `lib/services/sports-service.test.ts` — Vitest, mocks `@/db`; covers favourites CRUD (rows with their `competition`, `setSportCompetition` touching only an existing favourite) + `getSportTeamFilter` / `setSportTeamFilter` (upsert per list, deduped; every team deletes) + dashboard summary shape per sport, each sport's card per championship (football's leagues and the World Cup feed, tennis / padel narrowed to one tour, LoL's chosen split, a stale or foreign value falling back, a stale LoL event sent as `waiting`), the NBA highlight reading the live feed and its note before the opener, the LoL card's Swiss records (empty until a series is finished, best record first), and the LoL card across a season (Swiss, knockouts, off-season champions, a new split) and after MSI / First Stand ("Latest champions")
- `lib/sports/news.test.ts` + `lib/services/espn-news-service.test.ts` — Vitest; the lead story about F1's weekend and its leaders, never an older day's, a followed team found by what a story is filed under, never a video, a recap or a betting piece, a picture preferred and the wire's order on a tie; `teamInterest` (picked teams first, clubs without their letters, accents aside); `fromF1Wire`; ESPN's articles mapped (the widest photograph, no recap logos, clips as videos, ESPN+ and linkless ones dropped), newest first and once each, nothing when ESPN fails
- `app/actions/lol.test.ts` — Vitest; another split read, an international event and an id of the wrong shape refused before Lolesports is asked, a split not this season's, anybody signed out
- `lib/services/lolesports-service.test.ts` (also under the line below) — `seasonSoFar` (the current split's year so far, first first); `flowBracket` on Worlds 2026's play-ins: the columns by where the teams went, the lower bracket, the winners' links; `buildStageBracket` keeping a knockout's blocks and rebuilding a block of several rounds; an international event that is over ordered by its end date
- `lib/services/{football-data,jolpica-f1,espn-f1-standings,espn-tennis,espn-nfl,padel-api,balldontlie-nba,lolesports}-service.test.ts` — Vitest, the mappers against trimmed copies of each provider's real payload (shoot-outs, budget headers, a one-leg final with no winner while it is played and its shoot-out carried beside the draw, podium steps, F1 portrait matching, circuit keys, weekends in time order, winner, gaps, pole without the Q1 / Q2 toppers, fastest lap, sprint, classification, ESPN draw states and photos, NFL seeds/divisions/bracket/logos, padel states and photo addresses, NBA window, table, logo slugs, playoff bracket and channels (ESPN's codes, the nearest game between the same sides, none the other way round or days away, games kept when ESPN fails), NFL national channels, LoL blocks), padel draws (the men's read out of a list that holds the women's too, winners fed slot to slot, seeds, byes marked as such, walkovers and retirements, hidden results, the whole draw from its first round while the round of 16 is being filled and its other pages read only then, nothing asked for before a draw can exist), tennis calendars, event days and draws on demand, the NBA's tip-off, champion and preseason and a whole year of `getNbaData` on fake clocks, and LoL's logo discs, off-season rule, champions, split order and a season's end through `getLolData` against a fake Lolesports API (`__fixtures__/lolesports.ts`, which answers as of any day). `upstream.test.ts` covers `cachedFeed`
- `lib/services/espn-football-service.test.ts` — Vitest, on trimmed copies of ESPN's answers (`__fixtures__/espn-{mls,crc}-*.json`: MLS's 2025 play-offs, Costa Rica's 2025 Apertura play-offs, both leagues' days and tables around 26 October 2026); live minute and stoppage time, a shoot-out kept beside its score, stage labels, both conferences in rank order with ESPN's zones, the Shield table, the San Carlos clubs told apart, the cancelled Game 3s dropped, MLS's bracket in seed and feeder order (best-of-three in wins), Costa Rica's two-legged aggregates and winners (ESPN's `advance` over a level aggregate, none after one leg), the play-off spans, the fixture fallback by identity
- `lib/services/rapidapi-f1-news-service.test.ts` — Vitest; a refresh with no `RAPIDAPI_KEY` skips quietly
- `lib/sports/espn-images.test.ts` — Vitest; ESPN CDN images go through the resizer, anything else passes untouched
- `lib/sports/espn-broadcasts.test.ts` — Vitest; the national line split TV first, nothing for League Pass and regional networks, a name ESPN lists under another spelling kept, the site API's national market only
- `components/entertainment/sports/shared/{portrait,draw-match-card}.test.tsx` — Vitest + jsdom; face, logo, livery and fallback, a failed load swapping to the fallback, photos in a draw, and a padel pair (stacked names, seed, reader's time, tie-break, walkover)
- `lib/sports/circuit-outline.test.ts` — Vitest; the projection (one scale for both axes, cos φ, north up, fitted and centred), the path (whole-unit relative steps that do not drift), and the vendored outlines (the 2026 calendar and the fixture covered, each one closed line inside the box)
- `components/entertainment/sports/{f1-circuit-outline,sports/f1-view}.test.tsx` — Vitest + jsdom; the outline (one `currentColor` path, nothing for an unknown circuit), Overview (the races beside the standings, both cards level, Wins and Podiums by the card's width) and the toggle, old `?tab=standings|races|drivers|constructors` links, `?tab=news` with no news, the featured race with its outline and a tile without one, its circuit still named
- `lib/services/openf1-service.test.ts` — Vitest; lap and race clocks, gaps, names, a practice / qualifying (last part reached) / race order (winner timed, the rest gaps, DNF) from trimmed real answers, and the weekend read: only sessions that are over, in order, an empty one skipped, one call before the first session; a clock that rounds into the next second (59.9996 → 1:00.000); the five-minute cache until 48h after the race, then the day one, and an empty settled weekend never stored
- `lib/services/jolpica-f1-service.feed.test.ts` — Vitest, a file of its own because the rate limiter lives in the module and runs on a fake clock; `getF1Data` against a fake Jolpica behind an `unstable_cache` that keeps its last answer: one wave, never more than four starts in the window, one deadline, queue included, each race moved on from the status it was cached with, a list keeping its last answer or missing without costing the rest, another season's rounds left out; `getF1RaceClassification` (nothing until results are in, 5 min for 48h, a day after or for a past season, a race the calendar cannot place read as recent) and `getF1SeasonWinners`
- `lib/sports/f1-weekend.test.ts` + `lib/services/sports-service.f1.test.ts` — Vitest; the session live and next, the race live for three hours, `startsIn`, `weekendPhrase`, `isRaceWeekend`, `leadRace`, `racesTabGroups`; the dashboard highlight's weekend from the time it is given, last year's winner asked for alongside the feed (and again for another season), none for a new circuit, a season over or the sample
- `components/entertainment/sports/{f1-races,f1-race-page,f1-next-race}.test.tsx` — Vitest + jsdom on `__fixtures__/f1.ts` (a late-2026 calendar around Austin); the featured race in the reader's zone with its next session, its page linked from View details on its right (the card no link, never grey), each finished session's leader by face, a race weekend under way, every race to come under Coming up and none run until asked for, every tile a link to its round's page, Earlier bringing in races run three at a time below the ones shown (the pill kept and focused, gone when the season runs out, no scroll), the season over with its last races shown; the page's breadcrumbs, heading, the next session (or the one on track) by name and time for the race on now and the Grand Prix's date for any other, podium gaps, marks, Results (the latest session shown, and a newer one a refresh brings in until the reader picks one; faces; the race left to the classification), a plain "not in yet" with Retry refreshing the page, and the classification; the dashboard's race written like a kickoff, the start kept on top while another session is live, a live pill while the race runs, the final, and a race with no start time
- `lib/sports/load.test.ts` — Vitest; `sample` is set when a sport serves its fixture and not otherwise; the football tab spends exactly two football-data requests, both for the `?league=` it was given, and none at all for MLS or Costa Rica (ESPN's scores bar for that league alone, Costa Rica's news in Spanish); `footballLeagueFrom` defaults
- `lib/sports/match-order.test.ts` — Vitest; live first, fixtures soonest first, results latest first, and two caps of their own (`MatchCaps`), unused room not lent to the other side, live always in
- `lib/sports/match-days.test.ts` — Vitest; matches grouped by the reader's day (a late kickoff in Costa Rica is a day earlier than in UTC) and the team filter (one team, several, none)
- `components/entertainment/sports/sports/nba-view.test.tsx` — Vitest + jsdom; the Postseason tab locked with no bracket, the view opening on it once there is one, and the season note before the opener
- `components/entertainment/sports/sports/world-cup-view.test.tsx` + `shared/champion-card.test.tsx` — Vitest + jsdom; Groups, Knockout and News (only with news), opening on the knockout once drawn, else the groups with Knockout disabled, and on the news when the address asks (`openNews`); the champion card only once the final has a winner, a shoot-out told from the champion's side; the card's final line from the champion's side, a final settled on penalties ("1–1, 4–3 on penalties"), "Won the final" without a score, and the confetti once a visit
- `schemas/f1.test.ts` — Vitest; `f1RoundSchema` reads a round as its number, refuses any other spelling of it ("03", "1.0", "0x3", "1e1", " 3", "+3") and anything that could not be a round ("0", "100", "-1")
- `components/entertainment/sports/shared/{sport-shell,overview-split,matches-by-date,show-more}.test.tsx` + `sports-hub.test.tsx` + `seen-sports.test.ts` — Vitest + jsdom; a sport seen before shown at once while it loads, a skeleton for one not seen, never another account's copy; copies kept half an hour, per account, by address, emptied once another account's sport is remembered (a recall clears nothing), and a saved team pick carried into them; ten rows, more as many as are left, fewer, and back to ten on a new key; the one `<h1>`, the name row then the sticky tabs row, the name's small copy once it has scrolled away, the scroll back under a stuck bar and the sideways tabs row; the table stuck by its top or its foot and its label set like a day heading; the list opening on its freshest results with the clock on the first heading, focus, the filter beside Earlier on the first day's heading line, following the first day as Earlier brings days in and kept open through a tick that moves it, and gone with its tab, several teams ticked in one menu, the search, the saved teams on opening (a gone one let go), one save per changed menu and none without a saved list, the team reset, the scroll back after a deep pick and no scroller of its own; the title as the competitions' menu and plain text with nothing to switch to; the hub's favourites and sports at the end of the name row, every sport by its emoji and name
- `sport-picker.test.tsx`, `manage-favorites-sheet.test.tsx`, `shared/{detail-skeleton,standings-table,status-pill,tile-section,swiss-bracket,news-list}.test.tsx`, `components/ui/toggle.test.tsx` and the route tests in `app/portal/entertainment/sports/` (`(hub)/{loading,page}`, `f1/[round]/page`, `{padel,tennis}/[tournamentId]/page`) — Vitest + jsdom; the accessibility pass: focus back on the control a move was made from (the title's menu, the sport picked, LoL's league and split), the outline's `h2`s and `h3`s, named tables and row headers, spoken abbreviations and zones, status words in the text colour, bracket groups, lists and ", won", a tie's details in a popover Tab closes, the loading statuses, per-sport titles and the not-found title
- `components/entertainment/sports/sports/{football,nfl,lol,racquet}-view.test.tsx` — Vitest + jsdom; football's table on Overview, ten teams and the rest on a tap, no Table tab, and the league switched from the title; the NFL's split and locked Playoffs; LoL's champion banner, Next up and opening on Standings, an international event's stage tabs (Play-ins, Swiss stage, a locked Playoffs, opening on the playoffs once drawn, MSI's play-ins and playoffs, a league's matches and table, an event with only an undrawn bracket laid out as a league and opening on Matches, a league's earlier splits read from its pills and the latest back without asking, no Next up under an earlier split picked from the pills); the racquet tabs (Overview alone, News with news; no Draw tab), Overview as F1's — the next tournament featured with poster, facts and when it starts, its seeds once the feed ships its draw days before, its page linked from View details, every one to come linked to its page, the ones played three a tap, the calendar's own included — a pill for each tournament on now, the featured draw's top three seeds from its own players and back on the poster of the tournament picked after the last one's failed, the rankings beside it (ten rows, more and fewer, none without rankings), no draw asked for while nothing is played and the next is not out (last week's final included), the next one's asked for once it can exist when the feed could not ship it, and a current draw the feed did not ship asked for once. `racquet-tournament-page.test.tsx`: the breadcrumbs back to the sport, name, place, prize and champions, the bracket, the seeds on the poster and in the corner once it fails to load, not drawn yet, "Try again" refreshing the page, champions only and a fixture's draw. `lib/sports/detail.test.ts`: the loaders — a shipped draw handed over without asking, any other read through the provider's cache, a failure, the calendar's own tournaments, nobody asked weeks early or for a fixture, null for an unknown id; a race with its sessions and field, a field not in yet, nothing asked of a weekend to come, null for an unknown round
- `components/entertainment/sports/dashboard-sport-card{,-note}.test.tsx` + `shared/match-time.test.ts` — Vitest + jsdom; `groupCardMatches`, kickoffs and the NBA note in the reader's zone, `weekdayDay`, the picker in place of the line only for a sport with a choice, football's "Open" on its league
- `components/entertainment/sports/dashboard-competition-picker.test.tsx` — Vitest + jsdom; the options and the ticked one, football with no automatic entry, the choice shown at once while saving, null for the card's own pick, a waiting LoL event ticked and cleared by the card's own pick, a refused change rolling back with its toast
- `schemas/sports.test.ts` — Vitest; `setSportCompetitionSchema` per sport, refusing another sport's value, an unknown one and any for NBA / NFL / F1; `setSportTeamFilterSchema`'s lists and team limits
- `lib/sports/team-filter.test.ts` — Vitest; `teamFilterList` per sport
- `lib/sports/racquet.test.ts` + `app/actions/racquet.test.ts` — Vitest; which tournament is featured, current and just finished, which draws ship, `drawIsOut`, `statusByDates`, `clampDay` / `addDays`; the action routing per sport, refusing a women's draw, a missing one and anybody signed out
- `components/entertainment/sports/shared/{knockout-bracket.test.tsx,bracket-canvas.test.ts}` — Vitest + jsdom; the top half on the left, the final between, the bottom half mirrored, the third place under the final, a double elimination one-sided with its own branches and the lower bracket captioned, even rounds that do not halve left one-sided, no buttons while it fits, and on a laid-out scroller the ends and a column at a time, and a bracket that opened undrawn following the scroll once drawn; the branch drawn either way across
- `components/entertainment/sports/dashboard-sport-card.test.tsx` + `lib/services/sports-service.test.ts` + `shared/lead-carousel.test.tsx` — also the games a card steps through (the four after the featured one, soonest first, and no list), the lead box's slides and dots with the table in the list's row and the news in the last, the carousel's names, dots, scroll and lone game, a card with nothing to list putting its table right under the lead, another live game before the fixtures and the latest results, newest first, when nothing is ahead; football's, the NBA's and NFL's latest news on their dashboard cards (stories and recaps, no clips), the rail opening ESPN in a new tab, and none for a sport without a wire
- `components/entertainment/sports/shared/score-card.test.tsx` — Vitest + jsdom; a shoot-out prints beside the score and marks its winner; the channel under the time (the first shown, all for a screen reader, "Prime"), kept while live and gone at full time
- `app/actions/sports.test.ts` — Vitest, mocks impersonation + service + `next/cache`; covers happy path, zod rejection, auth failure, impersonation routing, for the favourite toggle, the championship (no favourite → its message; the dashboard re-rendered through `refresh()`, nothing revalidated) and the team filter (saved for the effective user, cleared, a list that is not the sport's refused)
- `e2e/sports-favorites.spec.ts` — Playwright, real Supabase user; covers empty CTA → toggle → persistence → dashboard highlights → un-toggle round trip
- `e2e/auth.setup.ts` + `e2e/fixtures.ts` — shared auth + DB cleanup fixtures

## Notes
- **The travel assistant proposes; the user applies.** The model (picked by an admin in Settings → AI, Claude Opus 5.5 by default; effort medium, `fallbacks: "default"` except on Haiku, which has none; every call's tokens recorded in `ai_usage`) reads with `list_trips` / `get_trip` and writes only through `propose_changes`, which runs the real write path in a rolled-back transaction, so the card shows what the database actually said, and a bad date or someone else's trip fails before the user sees it. Apply re-validates and commits; what the user did with a card reaches the model as a note on their next message. Undo replays a signed inverse (a deleted trip comes back with all nine of its tables), keyed off `CRON_SECRET`, bound to the user, valid 24h; only the newest receipt offers it. The browser keeps the API transcript and sends it back unchanged (append-only), and the date and open trip arrive as mid-conversation system notes so the system prompt stays cached. Admins only (`lib/travel/assistant/access.ts`): every message spends the owner's API credit. It can also add, edit and remove travellers (removing one revokes links scoped to them, as `setTripMembers` does, and Undo restores them with their payments), set the cover and add or remove photos (the row only, so Undo has a file to point at), and look up prices with Anthropic's web search (`max_uses` 3, $0.01 a search). Attached images go to the trip-photos bucket first, then to Claude as URL image blocks, with a note giving each one's `storagePath` so it can be kept as a photo. Payments are logged records (nothing is charged); only the trip's owner can apply them, like everything else. The proposal is decided on the page, not in the chat: the preview also reads each touched trip before and after inside its rolled-back transaction (`TripPreview`), the assistant opens that trip (`open_trip`, or `/preview` for a new one), the page draws it and scrolls to the first change. On a wide screen the chat floats in a corner and stays open beside the page (clicking the page does not close it), and its card decides; on a phone the chat closes and the review bar decides. Applying offers Undo in a toast.
- **Logic audit (2026-09-11).** Travel: `TripCalendar` takes `showPrices` and the public calendar tab honours the link's setting; removing a traveller revokes their scoped share links (the FK would have widened them to the whole trip); `defaultShares` scales fixed shares up when they total under 100 with nobody flexible; a per-person item whose named payers are a subset of its attendees charges the payers for the other seats; the dashboard estimate uses `tripCost` with the party size; a hidden end date is not saved; stops renumber on save and "Add day" continues from the highest day; the public payload omits the owner's user id and shows item notes only on priced links. Sports: F1 picks a live race first and derives `live` from the race time; NBA live games carry scores and "recent" means finals; an ESPN tennis event that has not started is `upcoming`; F1 news dedupes a batch by article id and orders with a tiebreaker; date-only strings are read as calendar days; the dashboard card counts followed sports.
- **`setTripMembers` scopes every member update to the trip.** A member id
  borrowed from somebody else's trip used to be overwritten and re-parented.
- **Sports feeds carry an 8s abort signal** (`lib/services/upstream.ts`); a hung
  provider falls through to the mock fallback instead of holding the render.
  `listUserFavoriteSports` is request-cached — the dashboard asks three times.
- **ESPN images go through ESPN's own resizer** (`lib/sports/espn-images.ts`,
  `/combiner/i`): a headshot is ~230 KB and an NFL scoreboard logo up to
  570 KB at the original size, for a disc under 40px. Padel's photos have no
  resizer and load as served (~45 KB). A team whose logo is drawn in its own
  club colour gets a white badge instead (NBA: HOU, TOR, UTA; NFL: LAR, NYG,
  NYJ), or the logo vanishes into the disc.
- **The trip page has two views**, switched by `Tabs` next to *All trips*: the
  list answers *what is the plan*, the calendar answers *what does the month
  look like*. `TripCalendar` draws a whole month with arrows either side and a
  **Trip** button back to the trip's own month.
- **The bar grid carries no padding of its own.** It is `absolute inset-x-0`
  over the day grid with the same columns and the same gap; a `px-1` on it
  took 8px off the width and made every track **1.1px** narrower than the day
  it sits over, so a badge drifted further left the later in the week it fell.
  A test asserts the overlay has no padding class, because the symptom is a
  couple of pixels and reads as sloppiness rather than as a bug.
- **Every badge is inset the same at both ends** (`mx-0.5`). Insetting only
  where a run began left two badges on one day disagreeing about where that
  day starts. Weeks are separate rows, so nothing is continuous across the
  boundary anyway — the square corner is the cue that a run carries on.
- **Bars use shadcn's `Tooltip`, not the browser's `title`.** It opens at once
  rather than after a second, and it holds the three things worth knowing:
  what it is, what it costs, and when it runs.
- **A bar's label is one string — `title · price`, not two boxes.** Pinned to
  the right, the price ate the title on any bar a single day wide: a flight
  read *"$600 – $"* and never said where it went. As one label the wide bars
  show everything and the narrow ones reveal it on hover, via
  [`MarqueeText`](../../components/travel/marquee-text.tsx), which measures the
  overflow and leaves a label that already fits completely alone. It respects
  `prefers-reduced-motion`.
- **Sharing lives on the banner, not in a card down the page**, and the
  dialog asks who the link is for. The traveller in focus is where that picker
  starts, not a lock — choosing a different recipient used to mean closing the
  dialog, clicking a face behind it, and opening it again.
  `TripSharePanel` is the dialog's body; it renders no `Card` of its own.
- **A shared link carries the videos too.** `ActivityVideo` already routed
  YouTube through `youtube-nocookie.com` and said why in its own comment — a
  visitor holding a share token has agreed to nothing — but the public page
  never rendered it.
- **A shared link carries the stops.** `getPublicTripByToken` loads
  `trip_item_stops` alongside the items, so a cruise arrives as a journey
  rather than a booking. Still one round of queries — the stops join
  `trip_items` in a single call rather than one per item.
- **Category is the item form's first question**, full width and on its own
  line. It decides which fields appear below it, what the price may be quoted
  in, and what a good title looks like (`titlePlaceholder` — a hotel example
  under a form set to Food prompts for the wrong answer). Squeezed beside the
  title it also read as a control of a different weight.
- **Everything else in that form pairs up.** Price / *Up to* / *That price is*
  are one question asked three ways and share a row; *Link* and *Video* are two
  optional URLs and share another; *From* and *To* get their own sub-grid so a
  one-way flight cannot render "Departs | From" with "To" stranded on the next
  line. The two money inputs stay paired even on a phone — they are short
  enough. Category and title are the exception above and stay on their own
  lines.
- **Dates use `DateField`** (Popover + Calendar), not `<input type="date">`.
  The native control renders differently in every browser and shows no view of
  the month around the date, which is what somebody arranging a trip is
  looking at. Values stay `YYYY-MM-DD` strings throughout — the moment one
  becomes a `Date`, somebody west of Greenwich gets yesterday.
- **Photos attach to an item** (`trip_photos.item_id`, which had existed
  unused since the table did). A photo picked before the item exists waits in
  the form and is attached once the insert returns an id. The trip's own
  photos (no item) take turns on the banner; the rest travel with their item.
- **No gallery: the banner is the trip's only picture.** A photo of something
  done belongs on that activity, so the Gallery card went (planner and shared
  page alike) and the trip's own photos became banner slides after the cover,
  crossfading every five seconds with dots along the bottom edge, inside the
  padding so they never meet the dates. No migration: they were already the
  rows without an `item_id`.
- **The payments column is sticky** (`lg:sticky lg:top-6 lg:self-start`) on
  the planner and the shared page, so the money stays beside the days as they
  scroll. `self-start` matters: a grid stretches its items to the row, and a
  column as tall as the itinerary has nothing to stick against.
- **The banner's buttons are dark glass with white text** (the traveller
  pill's `bg-black/60 ring-white/20`), not `secondary`: that variant is a pale
  grey with blue text, which over a photograph read as a light patch. Delete
  turns red on hover rather than carrying a red icon a dark surface swallows.
- **The shared page's view switcher sits on the banner**, opposite the total,
  dark and ringed for the same reason the pill is: the photograph underneath
  is unknown. `PublicTripViews` owns the page layout rather than a slot inside
  it, because that one piece of state spans the banner and the column below
  the grid — so the banner, the list and the aside arrive as slots.
- **The shared page offers the calendar too**, as `SharedTripCalendar`: the month
  arrows stay, because reading a plan means looking at the days around it, but
  the bars stop being handles and `ItemForm` is a dynamic import that a
  visitor never fetches.
- **A day's heading carries the run it begins** (`dayGroupLabel` +
  `runsUntil`): "Sunday, Jan 17 – Sun, Jan 24" rather than a date the reader
  has to open the item to complete. `spansDays` decides which items count, so
  a return flight never stretches a heading. Both views use it.
- **The shared page's sign-in lives on the bar**, in
  [`app/trips/[token]/layout.tsx`](../../app/trips/[token]/layout.tsx) — that
  layout exists so the invitation can be token-specific: sign-up prefills the
  address the link was labelled with and returns the reader to the trip. It
  was a card above the itinerary, which is a lot of furniture in front of the
  thing somebody was sent to look at. While signups are closed
  (`signupsAllowed()`, read by the layout) the bar offers only *Sign in*, and
  the dead-link page drops *Plan your own trip* — both would land on the
  closed notice.
- **`Still to go` is a range** on the shared page, like everything else that
  is still an estimate. Only what has been paid is one figure: that money
  either moved or it did not.
- **The public page is the planner, minus every control.** Same banner, same
  day groups, same money in the same column — the owner describes a link by
  what they are looking at, and a recipient seeing a different layout has to
  be told how to map one onto the other. There is no add, edit, menu or drag
  anywhere in it: a share link grants a view.
- **A share link's origin comes from `getBaseUrl`**, which prefers
  `NEXT_PUBLIC_BASE_URL`, then Vercel's `VERCEL_PROJECT_PRODUCTION_URL`.
  `VERCEL_URL` is the *deployment's* hostname — new on every push, and on this
  project it 302s to `vercel.com/sso-api`, so a link built from it lands the
  recipient on a login page. The production alias is **not** protected and
  serves `/trips/<token>` to anybody; Deployment Protection covers the
  per-deployment hosts only, which is what they are for. Nothing needs
  disabling — the app just has to write the right host into the link.
  [`lib/env.test.ts`](../../lib/env.test.ts) pins the order.
- **Each active link can show its QR** (`qrcode.react`). A phone cannot be
  handed a URL, and the code is how a link crosses to a device that is not
  this one. The code is drawn on white whatever the theme — a dark surface
  inverts the quiet zone and most scanners give up.
- **A calendar bar is a control: tap it to edit, drag its glyph to move it.**
  Only the glyph is draggable — a bar that is both clickable and draggable
  needs one of them to have its own handle, or every attempt to open an item
  becomes a half-started drag. It follows
  [`plan-calendar.tsx`](../../components/finance/plan-calendar.tsx): native
  HTML5 drag with a private MIME type, and a payload carrying the day the drag
  began so a stay keeps its grip — grabbed on its second night, it lands on
  its second night and keeps its length. The drop day is read from the week's
  geometry rather than per-cell handlers, because the bars sit on top of the
  cells and would otherwise swallow the drop. The glyph is `hidden sm:block`,
  so there is no dragging on a phone — HTML5 drag has no touch story, and the
  list view is the editing surface there.
- **`moveTripItemAction` sends only the dates.** The calendar renders from a
  snapshot; echoing every field back would overwrite a title or a price edited
  elsewhere since that snapshot with whatever the browser still believed.
- **`ItemForm` lives in its own module.** Both views open it, and reaching
  into the itinerary for it would drag the whole list along.
- **A price range is written with `~`, not a dash** (`moneyRange`). Money set
  as "$600 – $800" reads as a subtraction or a negative figure at a glance,
  and the itinerary is full of both real arithmetic and real date ranges using
  dashes. Date ranges keep the dash.
- **A calendar bar carries its label at every size.** It used to go solid
  below `sm` on the grounds that a bar with no room for a label had only its
  colour to say anything; the label shows there now, so the soft wash is right
  everywhere — a name on a solid amber or sky ground is a name nobody can
  read. The label needs `flex-1`: with only `min-w-0` the box measures 0,
  `MarqueeText` reads that as overflow, gives the text `w-max`, and the box
  stays 0 wide forever.
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
  minimum from its content, so the old gallery's photo rail (gone since) widened
  its own column and crushed the itinerary to one word per line. Any row that
  scrolls sideways does the same; the column has to be allowed to be narrower
  than it.
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
   row *is* the control, so every price, subtotal and video runs to the
  card's edge on every screen, and the day header needs no spacer to stay in
  step with them.
- **One dialog logs a payment and corrects one.** They ask for the same four
  things, so separate forms only made them look like different work and had to
  be kept in step by hand. `payerId` is the contract for "the payer is already
  decided" — its presence is why the form does not ask when the card is
  filtered to one traveller. Who paid is fixed once a payment exists: moving it
  rewrites two balances at once and only one is on screen.
- **A payment is a record, not a row of controls.** Tapping it opens a dialog;
  the delete button used to hold space at the right of every row, which is what
  pushed each amount off the card's edge.
- **Icon buttons are `size-9 sm:size-7`** — 36px on touch, 28px on a pointer.
  Several were 20–24px, and the old gallery's photo delete was both the
  smallest and the only destructive one visible without hovering.
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
- **`showPrices` is applied in the service, not the renderer.** The renderer
  first never read it, then read it only to decide what to draw — while the
  rows still went to the browser whole, so View Source on a link "without
  prices" (the whole-trip default) showed every price and note.
  `toPublicItem` now builds each item field by field: the raw price never
  crosses (an item carries `cost`, the figure for whoever holds the link — a
  scoped traveller's share, never the fare everybody splits), and a link that
  hides money gets no figure, unit or note, and no scope, so its payments are
  not even read.
- **A whole-trip link with prices costs each item as the planner does.** A
  per-person fare counts once per attendee, or once per traveller when nobody
  is named. The page used to cost it for one reader, so its "trip total" sat
  under the planner's — the direction that makes a trip look affordable. The
  party crosses only as a count (`rate.times`, from a `$count` read only for
  such links), never as member ids. The line under each figure is the
  planner's ("$120 / night × 3", `UnitArithmetic`): the page printed a stay's
  total over a bare "/ night", which reads as the nightly rate. A scoped link
  shows a share and no arithmetic, because the fare per unit is everybody's.
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
- **An item may name its own payers** (`trip_item_payers`, edited from the
  *Who pays for this* row in the item form). An empty list is the common case
  and means "however the trip divides" — naming nobody is not the same as
  naming everybody, because the trip's own `sharePercent` still applies. Named
  payers split the item equally between themselves, except for a `per_person`
  price, which is already one person's cost and so is charged to each payer in
  full. `setItemPayers` replaces the whole set and rejects a member who is not
  on the trip.
- **The day subtotal is the sum of the rows above it**, and it is derived from
  the same figures those rows print. When a traveller is selected the rows
  switch to that person's share so the arithmetic still checks out on screen;
  the full booking price stays underneath, because that is what the hotel's own
  site will quote.
- **Who is on an item and who pays for it are two lists, not one.**
  `trip_item_attendees` answers the first, `trip_item_payers` the second, and
  both mean "everybody" when empty. **Naming no payer means the attendees
  pay** — otherwise the form's own default (a named attendee, payers left on
  *Everyone*) billed the other travellers for something the itinerary had just
  told them they were not on. A `per_person` price likewise multiplies by the
  attendees, not the whole party. Filtering on payers was wrong in both
  directions: the festival all four travellers are going to vanished off the
  two who are not paying for it, and a flight one person takes stayed on
  everybody else's day. The form asks both questions side by side (*Who's
  coming* / *Who pays for this*).
- **Picking a traveller narrows the plan, not just its prices.** `viewerItems`
  ([`lib/travel/viewer.ts`](../../lib/travel/viewer.ts)) filters on
  `attendeeIds` via `itemConcerns` in
  [`lib/travel/split.ts`](../../lib/travel/split.ts) — never on payers.
  Re-costing alone left Ana's flight from Mexico sitting on Jafet's day worth
  $0, a row that says nothing except that it is not his. A scoped share link is
  narrowed **server-side** in `getPublicTrip` instead, so the trip's member ids
  never reach the browser; the split still runs over every item, so the totals
  are unaffected.
- **A public link never carries `payerIds` / `attendeeIds`.** They are raw
  `trip_members` UUIDs and the page is unauthenticated; `getPublicTripByToken`
  narrows and splits with them and then drops them, which is why the payload
  type is `PublicTripItem` rather than `TripItemWithStops`.
- **Item writes run in a transaction.** One save touches `trip_items`,
  `trip_item_payers` and `trip_item_attendees`; without one, a rejected
  traveller left the item written and its member lists half-replaced.
- **A flight offers neither a video nor a photo** (`video` and `photos` in
  [`lib/travel/item-fields.ts`](../../lib/travel/item-fields.ts)). The row is
  two airport codes and a fare — the pickers were inviting a picture of
  nothing. Photos already attached still render, so an item re-categorised to
  Flight does not strand them out of reach.
- **The calendar draws every run on a day.** There used to be a four-lane cap
  with a "+N" chip on the overflow; a day with six things on it now shows six
  and the week's row grows to fit. `capLanes` went with it.
- **The cover runs edge to edge on a phone** (`-mx-4 sm:mx-0`, square with
  top/bottom borders below `sm`). The page container's 16px gutters were
  cropping a photograph for no gain. On the public view the negative margin
  sits on the `relative` wrapper in `PublicTripViews`, not the header — that
  wrapper is the view switcher's positioning context, and the two have to share
  an edge or the switcher floats inside the image.
- **A card's context badge drops under its heading below `sm`** — whose share
  on the itinerary and the calendar, whose payments on Payments. Inline, a name
  like "Alejandra's share" pushed the row against Add item with nowhere to go.
- **The traveller chips carry a real tooltip**, not a native `title`. Two
  initials cannot separate Jason from Jafet or Ana from Alejandra, and `title`
  never appears on a phone — which is exactly where the chips are smallest.
  The name is also the button's `aria-label`, so the accessible name is the
  person rather than "JF".
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
- `getPublicTripByToken` is wrapped in `React.cache()` (like `getTripWithRelations`) so `generateMetadata` + page body share one DB hit. The share panel treats **expired** links as inactive (same as revoked — the public resolver rejects both); an expired link that was never revoked can be *Extended* back to life, a revoked one cannot.
- **The owner picks how long a share link lives** — *Until the trip ends*, 1 / 7 / 30 days, a day from the calendar, or *Never* — when it is made and later from its row. A trip with an end date starts on *Until the trip ends*: the last millisecond of its last day in the **reader's** zone (`endOfDayInTimeZone` with `useReaderTimeZone()`), because UTC midnight would end a Costa Rican trip at 6 pm on its final day. An open-ended or finished trip starts on *Never*, which is what every link did before. A preset counts 24-hour days from the click. Whatever the choice, `expires_at` stores one instant, so editing the trip's dates afterwards does not move a link's expiry. The schema refuses an expiry in the past, and the server compares instants only, so no server-side day ever meets the browser's.
- Itinerary/banner-photos/calendar hover-revealed controls are always visible below `sm` (no hover on touch) and reveal on keyboard focus.
- All trip banner photos and thumbnails render through `next/image` (remote hosts whitelisted in [`next.config.ts`](../../next.config.ts)). The blob-URL preview inside `photo-picker.tsx` stays as a CSS background because the optimizer can't process blob URLs.
- `getTripWithRelations` is wrapped in `React.cache()` so `generateMetadata` and the page body share one DB hit per request.
- Each route ships its own `loading.tsx` (the trip list's sits in `travel-planner/(list)/` with its page, so it does not wrap the new-trip and trip routes); `app/portal/entertainment/travel-planner/[id]/not-found.tsx` and `app/portal/entertainment/error.tsx` give the module its 404 / error boundaries.
- **Sports data — sources (as of 2026-10-19):**
  - **Live**: LoL (Lolesports, with Worlds / MSI / First Stand while they run), F1 (Jolpica-F1; ESPN for the drivers' faces and the dashboard card's standings; OpenF1 for each session's order), football (football-data.org — UCL/La Liga/EPL/Serie A), World Cup (football-data.org — one of football's competitions since 2026-10-18, no longer a sport tab of its own; the 2026 edition is over, so it shows the finished tournament), padel (Padel API — the men's rankings, the Premier Padel season and its draws), tennis (ESPN — the ATP's calendar, draws and rankings), NBA (balldontlie — regular-season and postseason games). All share the same shape: live fetch → map into the existing typed data shape → cached **5 min** via `cachedFeed` ([`lib/services/upstream.ts`](../../lib/services/upstream.ts)), which keeps the last good answer through a failed refresh and falls back to the mock fixture only when there has never been one → fetched by [`lib/sports/load.ts`](../../lib/sports/load.ts) for **the active sport only** and passed to `SportsHub` as one `SportPayload`.
  - **Also live**: NFL (ESPN — scoreboard, standings, postseason bracket) and the NBA's table, bracket and preseason (ESPN; balldontlie's free tier blocks `/standings` and has no preseason, and computing the table from 1230 games would cost 13 paginated calls at 5 req/min).
  - **Mock only**: none. Each sport still has its fixture, served only when its feed has never answered, and the hub then says so (see `SportPayload.sample`).
  - **Rejected providers**: API-SPORTS (free tier hard-locked to seasons 2022–2024, useless for current data; paid plan ~$100/mo); Riot Games official API (no esports/tournament data, only personal player stats); TheSportsDB (its free key `3` now answers 403 to everything, and the replacement test key `123` returns one past event per tour and nothing upcoming).
  - **Env vars**: `FOOTBALL_DATA_API_KEY`, `BALLDONTLIE_API_KEY` and `PADEL_API_KEY` (all optional — the service falls back to mock when unset). Lolesports, Jolpica and ESPN need no key.
- **A failed refresh used to cache the mock.** Every service caught its own error inside `unstable_cache` and returned the fixture, which was then stored as the data for the full five minutes — one football-data 429 was five minutes of invented tables. `unstable_cache` already keeps a stale entry when its callback throws, so `cachedFeed` lets the fetch throw and applies the fallback outside the cache.
- **A cache inside a cache never serves.** Next bypasses the read of an `unstable_cache` called inside another one's callback, so an entry of its own nested in a feed's `fetchLive` is refetched on every refresh of the feed, and its fallback is stored inside the feed's entry. It cost three ways: every five-minute padel refresh fetched seven draws again (2,016 calls a day against the provider's 2,000), a tennis calendar that failed once sat in the feed empty for five minutes, and a failed NBA bracket call was stored with the games as `[]` and locked the Postseason tab mid-playoffs. `getNbaData`, `getPadelData` and `getTennisData` are now plain functions that read the feed's cache and then each extra's own (the rule is in [`lib/services/AGENTS.md`](../../lib/services/AGENTS.md)).
- **Padel's budget is 2,000 requests a day, and the draws are where it goes.** The feed is 3 calls every five minutes (864 a day), the live draw 288 more, and each finished one 1 a day, so a live week stays under 1,200; no draw is asked for until 3 days before it starts (`DRAW_LEAD_DAYS`), when one can exist, and only the featured and current draws travel with the page — the rest are read when their page is opened (`loadRacquetTournament`, on the server), and the hub's featured draw through `getRacquetDrawAction` only when the feed could not ship it. The free plan withholds results older than about six months (`hidden_free_plan`), so those draws show their champions only. Padel players carry no nationality, so pairs have no flag; ESPN flags only Grand Slams, so Masters, 500s and 250s have no tier. The fixtures carry a calendar but no draws.
- **football-data's ten a minute belong to the key, not the process.** Production, previews and every local dev server share them; two other dev servers were spending the same key while this was investigated. So each competition is its own cache entry (a refresh costs 2 calls, not 9), the dashboard asks for the Champions League alone, the football tab for the league in its URL, at most two requests are in flight, and the service stops asking once the provider's own `x-requests-available-minute` reaches 0 or it answers 429, until `x-requestcounter-reset`. A league is cached whole or not at all: a failed matches call used to store a live table with nothing played.
- **Changing a dashboard card's championship refreshes, it does not revalidate.** `revalidatePath("/portal")` expires the `/portal` path tag, and every `unstable_cache` entry read while rendering that page carries it as a soft tag, so the next render missed every provider feed on the dashboard — for every user, not only the one who changed it. The football card alone is two football-data calls a change; five changes in a minute spent the key's ten and, a miss not being a stale hit, the card showed the sample league. The choice is an uncached row on a `force-dynamic` page, so `setSportCompetitionAction` calls `refresh()` (the action's response re-renders the dashboard and expires no cache entry). `setSportFavoriteAction` still revalidates: it changes which cards exist and runs rarely.
- **football-data folds a shoot-out into `fullTime`.** Germany 1–1 Paraguay, 3–4 on penalties, arrived as 4–5 — in the match list, the World Cup bracket, and a two-legged aggregate. `goalsOf` takes `regularTime + extraTime` and carries the penalties in `Match.penalties`; `ScoreCard` prints "PEN 3–4" and marks the shoot-out's winner.
- **Jolpica caps `limit` at 100 rows.** `results.json?limit=300` returned the first five races of a ~500-row season, so every podium from round six on was blank and the podium tallies stopped in May. One call per podium step (`results/1|2|3`) returns one row per race whatever the round.
- **Jolpica allows bursts of about four requests a second, and a cold F1 read makes nine** — the calendar, both standings, three podium steps, poles, fastest laps and sprints. Sent at once, the calls past the fourth could come back 429 and a podium went missing. So every Jolpica call takes a slot from one module-level limiter, four starts per 1.2s (a little over a second: calls started a second apart can still arrive closer together). All nine go out in one wave, and each call's 8s `upstreamSignal` starts before it queues for its slot, so a Jolpica that never answers holds a cold read for one deadline, the wait for a slot included.
- **`qualifying/1` is not the list of poles.** It also returns whoever topped Q1 or Q2 when somebody else took pole — 33 rows for 17 races — so `polesByRound` keeps position "1" only.
- **An F1 race's status is worked out on every read, never stored.** It used to be set inside the feed's cache, and `unstable_cache` serves a stale entry while it refreshes: the first visit after a quiet weekend got Friday's "upcoming", and the dashboard and F1's Overview races (`F1Races`) led with Sunday's race, already run. `getF1Data(now)` joins its cached parts outside any cache, as `getNbaData` does (see *A cache inside a cache never serves*), and runs `mapRaces(…, now)` each time; the session live or next is worked out later still, per request on the dashboard and after mount in `F1Races`, since nothing in [`lib/sports/f1-weekend.ts`](../../lib/sports/f1-weekend.ts) reads the clock. Each season-wide list has an entry of its own because, caught inside the feed's, one 429 stored the feed without that list over the good one: every pole gone or, with the winners' step, every result.
- **An F1 race's `date` is its UTC day, not the reader's.** Melbourne starts at 04:00Z and Las Vegas on Saturday night, so both fall on Sunday in UTC and on Saturday evening across the Americas, and the race cards, which printed `date`, put both on the Sunday. Races, sessions and the dashboard's race print `startsAt` and each session's instant in the reader's zone (`raceWhen`, `SessionList`, `F1NextRace`); `date` shows only for a race the feed gave no start time, as the calendar day it names.
- **Padel API renamed its states** to `pending` / `live` / `finished` and ignores `limit` (its page size is `per_page`). Read as the old names every tournament was "upcoming", so the dashboard billed a finished FIP Gold as next; the calendar is now Premier Padel only, since FIP events ran beside it every week.
- **Vitest setup** in [`vitest.setup.ts`](../../vitest.setup.ts) stubs `next/cache` (so `unstable_cache` becomes a passthrough) and rejects `global.fetch` by default (so live-API services exercise their mock-fallback path). Tests that need real responses can re-stub `fetch` per-file.
- The sport picker puts the favourites first; every other sport stays in the group, so the hub still works with zero favourites picked.
- **Match display order** is centralized in [`lib/sports/match-order.ts`](../../lib/sports/match-order.ts) (`orderMatchesForDisplay`: live → upcoming nearest-first → results most-recent-first; `max` is a `MatchCaps`: each side capped on its own, so a long window of fixtures cannot crowd out the results, and live always in — football's is 30 fixtures and 80 results, the history its clock reaches). Football, LoL and the NFL use it; the previous plain-descending sort put fixtures 60 days away at the top and made the dashboard's `find(scheduled)` pick the furthest-away match as "Upcoming".
- **The active sport is a `?sport=` search param.** It was component state,
  which meant no deep link, no Back between sports, a refresh landing you back
  on football — and, because the page could not know which sport it was about,
  a `Promise.all` over **all six providers on every load** to render one view.
  football-data.org allows ten requests a minute on the free tier and this page
  spent two of them per visit before anything was chosen.
  [`lib/sports/payload.ts`](../../lib/sports/payload.ts) is the client-safe half
  (the `SportPayload` union, `isSportId`);
  [`lib/sports/load.ts`](../../lib/sports/load.ts) is `server-only` and does the
  fetching. The NBA, the NFL, a football league and tennis bring
  their ESPN news alongside, in parallel, and football's costs football-data
  no request.
  - **The football league is a `?league=` param too** (`footballLeagueFrom`,
    defaulting to the Champions League). The view picked one of four leagues
    the page had already fetched, so every visit spent eight of
    football-data's ten requests a minute on three tables behind a picker.
    The payload now carries the one league plus the picker's options by name;
    the picker navigates through the hub's `useSportsNavigation()`
    (`router.push` in the hub's transition, `scroll: false`), and the hub shows
    `SportSkeleton` until the new league lands. Focus goes back to the
    control the move was made from, which unmounted with the view: the
    title's competition menu (at once over a copy, once the league lands over
    the skeleton), or the sport picked, on its link in the picker throughout.
- **News leads with one story** (2026-10-23). The wire was a grid of cards
  all one size. `leadStory` picks the latest day's story most about what the
  reader follows, with a picture, and it leads big. The NBA, the NFL, the
  football leagues and tennis took ESPN's key-less news the same day
  (`espn-news-service.ts`): images and a real publication date with every
  article. F1 keeps its RapidAPI wire for now — no publication date, 40
  requests a month; ESPN's `racing/f1` would replace it. Padel API and
  Lolesports have no news.
- **LoL's picker is the season's international events and each league's
  latest split** (2026-10-23). A league's earlier splits this season are
  moved between from inside it, so the picker stays short.
- **Padel and tennis are laid out as F1** (2026-10-23). Every sport made of
  separate events now leads with the one on now (or next), big, with "View
  details", and lists the ones after it and, three a tap, the ones before.
  The Tournaments tab repeated that in another shape and went; the bracket
  moved off the Overview card to a Draw tab of its own, the page's whole
  width and the screen's on "Expand" — both gone since, for a page of its
  own (*A tournament or a race is a page, not a sheet*).
- **LoL's international events are their stages** (2026-10-23). Worlds is
  play-ins, a Swiss stage and knockouts, MSI play-ins and a double
  elimination, each a tab; the Matches tab only repeated them by day. MSI
  had vanished the day Worlds began (`isCurrentEvent`), so this season's
  events that are over now stay, behind the one on now. Lolesports links
  no bracket match to the ones before it, so a double elimination is laid
  out by where its teams went (`flowBracket`). An event with nothing but an
  undrawn bracket keeps the league layout (Matches / Standings / Playoffs):
  as stages, it opened on a Matches tab it did not list, Playoffs locked.
- **Brackets are two-sided** (2026-10-23). A knockout is a normal draw — not
  LoL's Swiss stage — so it is drawn as one is printed: half the draw on each
  side, meeting at the final. It halves each column's height, and « » reach
  the other half at once. The window of four rounds paged by chevrons went
  with it; the bracket scrolls, and the buttons move the scroll.
- **Padel's draw is read whole while its round of 16 fills** (2026-10-23).
  The provider sends the matches final first, fifty a page, and the bracket
  started at the round of 16 — which stays empty through a tournament's first
  days, so Kuwait's published draw read "not drawn yet". It now starts at the
  first round until the round of 16 is set (`roundIsSet`), reading up to three
  pages for it. It follows the data, so every tournament gets it with nobody
  asking; `drawFrom`'s and `fetchPadelDraw`'s tests hold it there.
- **Going back to a sport is instant** (2026-10-23). Every switch waited on
  the server, about 0.8s even with every provider's answer cached, because
  the page checks the session and reads favourites and team picks from the
  database first, and the hub showed a skeleton the whole time. The hub now
  keeps, in memory and for the visit, the copy of each sport it has shown
  and puts it up at once while the fresh one loads (`seen-sports.ts`). Not
  Next's router cache (`staleTimes.dynamic`): that is app-wide, and would
  have served the portal's other pages stale too, impersonation included.
- **The NBA is live** via balldontlie
  ([`lib/services/balldontlie-nba-service.ts`](../../lib/services/balldontlie-nba-service.ts)),
  `BALLDONTLIE_API_KEY`. Two things shape it: the free tier allows **five
  requests a minute shared by every visitor**, so a cold cache spends exactly
  one — a single window, trimmed to the last six results and next six
  fixtures in memory rather than by a second request; and `/standings` is not
  on the free tier, so the table comes from ESPN's public standings instead —
  for the season shown (S + 1, ESPN's end-year label; `seasontype=2`, since
  without it ESPN returns preseason records), and dropped rather than
  failing the feed if ESPN does not answer. Teams are keyed by abbreviation
  (`NYK`, not balldontlie's `20`), with ESPN's six differing codes (`NY`,
  `GS`, `SA`, `NO`, `UTAH`, `WSH`) mapped across. **A page is the
  oldest hundred games in the range**, so the window is today ±4 days in
  season and June 1 → +130 days out of it (`gameWindow`); the old ±130 days
  would have frozen on the season's first fortnight from November. Out of
  season that window holds two seasons, June's finals and October's openers,
  and the openers sat under last season's heading and table. **The feed shows
  one season**, S = `currentSeason`, which flips on Oct 1: only S's games are
  listed, so the heading, the table and the games always agree. Before the
  opener ESPN lists all thirty at 0–0 in its own team order, which put New
  Orleans top of the West, so there is no table until a game is played — the
  view and the card say when it tips off and who won last time instead. The
  tip-off is read only off a page that starts before Oct 1: across the
  All-Star break the in-season page is all fixtures, and Feb 17 named Feb 19
  as the opener. balldontlie's free tier has no preseason; ESPN's scoreboard
  header does (season type 1, labelled S + 1, London Lions and all; `limit=300`
  works, 500 or more answers 502, and a span over about five months returns
  nothing). The dashboard card reads the same feed (it read `NBA_DATA`).
- **The Sample data notice follows the payload, not a list of sports.**
  `loadSport` sets `SportPayload.sample` when a feed hands back its fixture —
  an identity check, since `cachedFeed` returns the fixture object itself and
  never a copy. The fixed `SAMPLE_DATA_SPORTS` set held only the NFL, and a
  live sport serving its fixture (a missing key, a provider down on a cold
  cache) said nothing at all.
- **The NFL is ESPN's public API**
  ([`lib/services/espn-nfl-service.ts`](../../lib/services/espn-nfl-service.ts)),
  the same endpoints espn.com reads. It had been a fixture on the belief that
  no free provider carried current data; its invented Super Bowl LX was
  Chiefs–Lions, the real one Seahawks 29–13 Patriots.
  - `standings?level=3` nests conference → division, the only place the
    division is named; each team sits at ESPN's conference seed.
  - ESPN takes no date range for the NFL, so the bracket is one scoreboard per
    round (`dates=<season>&seasontype=3&week=1|2|3|5`; week 4 is the Pro
    Bowl), fetched only once the season type is postseason or off-season.
  - Badges stay monograms in club colour, as before: a logo on a disc of its
    own colour disappears (the Chiefs' red arrowhead on red). The scoreboard
    names a colour only for teams playing that week, so the colours are a
    table.
- **Tennis has a draw.** `RacquetTournament.bracket` had been in the type since
  the start with nothing rendering it. `KnockoutBracket` now takes an optional
  `renderMatch`, so the same bracket machinery draws a tennis tie
  through `DrawMatchCard` — seeds, flags and set-by-set scores, the won set
  highlighted — instead of football's L1/L2-plus-aggregate card. **A set is a
  `leg`**: the type already carried per-leg scores and a set is exactly that
  under another name, so nothing new was needed to hold one.
- **Tennis is ESPN's public API end to end**
  ([`lib/services/espn-tennis-service.ts`](../../lib/services/espn-tennis-service.ts)) —
  the same endpoints espn.com reads, no key and no signup. One ATP scoreboard
  call over today ±14 days gives the fortnight's events, their draws and
  champions; the core API's `calendar/whitelist` gives the season; `/rankings`
  gives the table. TheSportsDB used to supply the
  calendar until its free key was switched off: October showed Roland Garros
  as live.
  - **A tournament's state comes from its matches.** The event's own
    `status` called Ningbo completed with 27 of 45 matches to play. ESPN also
    leaves cancelled TBD slots (`post`, never completed) beside real ties —
    Basel read as under way a week early with seven quarter-finals — so those
    are dropped. Walkovers and retirements are completed and stay.
  - The place is `venue.displayName` ("Tokyo, Japan"); `address.city` is null.
  - **Qualifying is dropped and only followed rounds are kept.** ESPN returns
    Qualifying 1st/2nd/Final alongside the main draw, and qualifying is not the
    tournament.
  - **Players travel as `drawPlayers`, a list not a Map**, so they cross the
    server/client boundary as plain data; the view builds the lookup.
  - Overview features the tournament being played, else the next to start;
    the list itself runs in date order, bigger draw first on a day.
  - **ESPN dates an event by its local midnights in a US zone**, so an end's
    UTC date is a day late (Shanghai read "Oct 5 – 19" for a final on the
    18th); `espnDay` reads each edge twelve hours in.
  - **Any day of an event returns its whole draw** (`event=` is ignored), so a
    finished event's draw is read off its final day. That day is fetched with
    `no-store` — the US Open's final day is 1.76 MB, near the 2 MB Next's cache
    refuses — and only the one mapped draw is cached.
- **Team logos are vendored, not hotlinked** (`public/f1/teams/`, 36 KB).
  They come from F1's own media CDN, which is versioned by season and moves:
  the 2026 paths already 404 while the 2025 ones serve. Copying them buys a
  badge that cannot break mid-season. Audi and Cadillac joined the grid for
  2026 with no mark published yet, which is why the livery fallback stays —
  and a test asserts every mapped file actually exists on disk, since a
  renamed asset would fail silently as a blank badge.
  - **They are not the files F1 serves.** Each ships pre-plated on an opaque
    white rounded square (only the corners are transparent), which on the dark
    card renders as a column of bright discs. The plate is flood-filled away
    from the border inwards — so white *inside* a mark survives, Mercedes' star
    and Haas' box — and the result trimmed to its bounding box, so a wide mark
    like Red Bull's fills the badge instead of floating in it. Every mark then
    reads on both surfaces unplated, including the three that looked at risk
    (Aston Martin is silver, not black; Williams and Racing Bulls are bright
    blue). A test asserts no asset is still 96x96, which is what every raw
    download is — the one way this regresses is somebody dropping a fresh file
    in.
- **Circuit outlines are vendored, not fetched** —
  [`lib/data/sports/f1-circuits.ts`](../../lib/data/sports/f1-circuits.ts),
  18 KB (8 KB gzipped) shipped with the view, since every race tile draws
  one. Generated once by `pnpm exec tsx scripts/build-f1-circuits.ts`
  from the GeoJSON track lines of
  [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT,
  © Tomislav Bacinger; the notice is in the file's header) at a pinned commit.
  [`lib/sports/circuit-outline.ts`](../../lib/sports/circuit-outline.ts)
  projects each line north up with one scale for both axes and longitude
  shrunk by cos(latitude) — raw lon/lat stretched Silverstone 1.6× east–west —
  and fits it to a `0 0 1000 1000` box as one path of whole-unit relative
  steps. Keys are Jolpica's `circuitId`, mapped by hand in the script: the 23
  circuits of the 2026 calendar plus Bahrain, Jeddah and Imola (2025's, and the
  fixture's). The script ends by naming any circuit on Jolpica's current
  calendar still without an outline; such a race is drawn without one.
- **The dashboard reads standings from a different provider than the F1 view**
  — ESPN for the card, Jolpica for the page. Not an oversight: ESPN ships the
  headshots and livery colours the card is built around, Jolpica ships the
  fuller table the page needs. The two were checked against each other and
  agree on points.
- **F1 news is stored, not fetched on demand** — `f1_news` (migration `0048`),
  read by [`lib/services/rapidapi-f1-news-service.ts`](../../lib/services/rapidapi-f1-news-service.ts).
  RapidAPI's feed is a rolling window of the last 25 articles, so anything
  older is gone the moment it falls off; keeping each one is what makes an
  archive possible. `article_id` is the provider's own `dataSourceIdentifier`
  and carries a unique index, so a refresh upserts and re-running the cron
  never duplicates. The page reads the table and never the provider.
  - **The refresh rides the existing daily cron** (`/api/cron/daily`), not a
    schedule of its own.
  - **It came from the humex-champions Firebase project**, which had been
    collecting the same feed on an 08:00 UTC Cloud Function since August 2025.
    188 articles were migrated across. Worth knowing: that project's per-article
    writes had silently stopped in September 2025 while its cache document kept
    updating daily, so the migration had to read both.
  - `RAPIDAPI_KEY` unset just means no refresh — the stored archive still reads.
  - **F1 owns one dashboard card**, `DashboardF1Card`: the next race and the
    wire together, gated on the favourite. Every other favourite sport gets
    a card of its own in the same mould (`DashboardSportCard`), so there is no
    general sports card to leave F1 out of.
  - It takes **a grid column, not the whole row** — one sport among
    several — and the news is a scroll-snap rail rather than a carousel
    library: the card is narrow, a swipe is the gesture already used here, and
    it adds no dependency.
  - **`/news/f1/[id]` is a public page**, like a shared trip: no auth, its own
    layout, and OG tags so the link unfurls. Every headline in the app points
    there rather than straight at the source, because that page is the one
    worth sending somebody and it carries the rest of the wire underneath.
  - **The page never reproduces the article.** RapidAPI sends a headline, a
    short description and a link; the story belongs to whoever wrote it, so the
    page shows the summary and points at the original.
- **A `ScoreCard` prints its `stageLabel`** and does not pretend to be a link.
  It carried the label without showing it, so a Finals game and a Tuesday in
  November looked identical, and a hover chevron promised a screen that does
  not exist.
- **`TeamBadge` picks its ink from the background's luminance.** Club colours
  are whatever the league uses and some are nearly white — the Spurs' silver
  rendered white-on-white.
- **A logo sits inset in its `TeamBadge` disc, never cropped by it.** The disc
  is round and most NBA logos are not: at `object-cover` the Lakers, 76ers,
  Hornets, Heat, Pelicans, Grizzlies, Kings and Bulls lost their edges. The
  image is `object-contain` with padding per size. The Pelicans' navy mark
  vanished into its own navy disc, so New Orleans joins the teams with a white
  one (`TEAM_COLORS`).
- **Matches and the table share one Overview tab** (2026-10-18). Football's
  Overview showed a few matches and its Matches tab the rest, so the same
  fixtures lived in two places. Now every match is on Overview, by day, with the
  table beside it; the NBA and NFL views got the same layout. Football's Table
  tab went the same way (2026-10-19): it only repeated the Overview table with
  more columns, so Overview shows the whole table in its compact columns
  instead of the top eight. The three share `OverviewSplit`.
- **Every table shows ten rows, then a button** (2026-10-23). Football's whole
  table, the NBA's and NFL's conferences, F1's drivers, a tour's rankings: each
  had its own length, from eight to the whole field. Now every one shows ten
  and "Show N more" (`shared/show-more.tsx`), so the hub reads the same
  wherever you are in it. The same day padel and tennis lost their Current and
  Rankings tabs to one Overview, the tournament on now beside the rankings, and
  F1's Overview stopped showing "Just finished": Coming up lists every race to
  come and the races run come in from "Earlier races".
- **The sports page has no page header** (2026-10-19). At 1440×900 the header
  took about 400px before a single match: a "Sports" title, the strip, then
  the sport's own title and tabs on rows of their own. The strip is now the
  first row and scrolls away, the sport or competition is the `<h1>`
  ([`docs/TYPOGRAPHY.md`](../TYPOGRAPHY.md)) on a row of its own, and only the
  tabs stick ([`docs/SPACING.md`](../SPACING.md) has every offset stacked on
  them). A first version put the name and the tabs in one sticky row from
  `@4xl`; a two-line title centred on that row beside tabs sitting on its
  border never lined up, so the name went back to its own row and comes into
  the sticky one, small, only once it has scrolled away.
- **The match list opens on its latest results, in the page's own scroll.** It
  scrolled inside a box of its own from `@4xl`, so the reader scrolled the
  matches and then the page, and its scroll-to-today never ran on a phone,
  where there was no box to scroll. Now the list starts at the freshest
  results and what follows, with the days before one tap away.
- **F1's sessions come from OpenF1** (2026-10-23). The race sheet showed the
  timetable and the podium the card already had. Jolpica has no practice, so
  each session's order (practice to race) is read from OpenF1, which needs no
  key and has a session once it is over; the card names who led each one and
  the race page lists them all. The card no longer greys on hover: "View
  details" opens the race page. A weekend 48h past its race is settled and
  cached for a day; before that, five minutes.
- **A tournament or a race is a page, not a sheet** (2026-10-23). Padel's and
  tennis's draws had a Draw tab, an "Expand" dialog and a sheet each, and a
  64-player draw fitted none of them; F1's race was a narrow sheet. Now "View
  details" and every tile link to a page under the hub, read on the server
  (`lib/sports/detail.ts`), with breadcrumbs back to the sport, so Back, a
  refresh and a shared link all land on it. The Draw tab, the sheets and the
  two F1 actions that fed the sheet (`getF1RaceClassificationAction`,
  `getF1WeekendResultsAction`) are gone; a draw or classification not in yet
  is asked for again by refreshing the page. The hub moved into a `(hub)`
  route group so its skeleton never paints over these pages on a reload.
- **The hub follows the men's tours only** (2026-10-23): padel's men and the
  ATP. The Men / Women and ATP / WTA pickers are gone, from the views and the
  dashboard cards alike, and so are the women's requests — padel's feed is two
  calls every five minutes instead of three, tennis's two instead of four,
  and no WTA news. A favourite still storing "wta" or "women" is ignored.
- **Earlier days come in a few at a time, where the reader is** (2026-10-23).
  The clock used to put every earlier day in at once and scroll the newest
  of them under the bar, a jump of up to 1,500px. Now each tap adds three
  days and the page stays put; the browser's scroll anchoring, which would
  otherwise scroll by the height added, is off for the moment they go in.
  Football, the NBA and the NFL also keep more history for it (80 results,
  two weeks, four weeks).
- **The team filter picks several teams and remembers them** (2026-10-19), per
  list and per account (`user_sports_team_filters`), not in the browser: the
  owner wanted it on every device. It saves when the menu closes, not on each
  tick, so a run of ticks is one write and two writes cannot land out of order.
- **Nothing stands between the tabs and the first match** (2026-10-19). The
  Overview had a "Matches" label row with the team filter, then an "Earlier
  results (N days)" button, then the first day; the table card started about
  80px above the first match card. The filter moved to the sport bar's right
  end, where it also stays in reach while scrolling; the earlier days are
  behind a clock icon at the end of the first day's heading line (the owner's
  pick over a text link); the table opens on a line set like a day heading. Both cards now start on the same line, and their labels share
  one, at rest and stuck. On a phone the stuck bar shows the name's copy, the
  tabs and the filter icon, so a second tab can start cut at the edge (the
  row scrolls sideways).
- **Migration 0058_acoustic_mercury's journal `when` (1792462687957) is older than 0057's (1792465020485).** Both are recorded on the shared database (applied out of order there), and a fresh database applies them in journal order. Do not renumber it: a changed `when` would read as unrecorded and re-run its `CREATE TABLE`. A later migration needs a `when` past the newest recorded `created_at` (`pnpm db:migrate` plans it).
- **Padel no longer falls to its sample season on a burst** (2026-10-26). Padel API allows ten requests a minute a key, shared by production and a local server; a cold read (rankings, the calendar, up to five draw pages, the dashboard's card at once) went past it, the calendar came back 429 and the hub showed the fixture. `fetchPadel` now counts the instance's minute and keeps three for the rankings and the calendar (a draw that does not fit is left out of that answer), a 429 spends the minute and a short Retry-After is waited out once for what the page needs, concurrent misses share one read, and a draw keeps its first page when a later one fails.
- **The dashboard's racquet and surf cards carry news** (2026-10-26): tennis's from ESPN, padel's from Premier Padel; surfing gets its card (`surfCard`: the stop on now or next, the WSL rankings, Stab's news).
- **Ligue 1 and the Bundesliga** (2026-10-26) join football's competitions on football-data's free tier (FL1, BL1: two requests a league, cached on its own, so a visit costs no more), with ESPN's fra.1 / ger.1 news; eighteen clubs, so 16th is a relegation play-off and the last two go down. MLS and Costa Rica's Primera División are not on football-data's free tier; ESPN carries both — see the next note.
- **MLS and Costa Rica's Primera División, from ESPN** (2026-10-26): `espn-football-service.ts`, routed by `getFootballCompetition` so football-data's ten requests a minute are not touched. On the football page MLS's table is one conference at a time behind an East / West toggle (`ConferenceStandings`, the NBA's segmented control), keyed so each opens on its first ten; Costa Rica's is any league's. Both have a Knockout tab, locked until the play-offs are drawn. The play-off spans are calendar guesses (ESPN's season types carry last year's dates as placeholders): a format change moving the play-offs outside them hides the bracket rather than breaking it. ESPN's site scoreboard rejects a date range, so the days come from the scores bar a week a request.
- **Every sport has news** (2026-10-26). Padel's News tab reads Premier Padel's own feed, surfing's Stab Magazine's WSL coverage and LoL's Riot's lolesports.com news; every dashboard card now carries its sport's news. Google News was ruled out: its robots.txt disallows `/rss`, and its links are redirects with no pictures.
- **Baseball and ice hockey from ESPN** (2026-10-25). The MLB and the NHL join as the NFL did, key-less: `MlbView` and `NhlView` (Overview with the games and a league or conference table — MLB by division, W / L / PCT / GB; NHL GP / W / L / OTL / PTS — Postseason / Playoffs, News), their dashboard cards, the team filter, favourites. The season names itself as hockey does on both (`splitSeasonLabel`, "2026–27"). The fixtures hold no live game, so a dashboard on sample data never shows one as live.
- **Surfing, from the WSL's own pages** (2026-10-25). No free source has the Championship Tour: ESPN and TheSportsDB carry none, the WSL's API wants a login, the paid ones are thin or for sportsbooks. Its site has it all, server-rendered; its terms forbid automated reading and its robots.txt blocks AI agents (`*` is allowed), so the parsers were built from saved copies, never by an agent reading the site, and the app reads it gently (cached, four at a time, a plain User-Agent). The owner's call. The men's tour only, as padel and tennis. `SurfView`: Overview (the featured stop, the season's stops with their winners, the rankings) and Draw (the featured stop's heats round by round, open while it is live).
- **The race page and the tournament page share the hub's layout** (2026-10-25). F1's race page lost its breadcrumbs and page header for F1's own name row, a breadcrumb title and Overview / Results tabs; the circuit grew on the featured card (two-fifths of it, centred) and on the race's Overview; the tables sit on white cards. `SportsBreadcrumbs` went with the last page that used it. The sports picker is one row beside the title, sliding sideways when eleven sports outgrow it (from `@5xl` it never wraps under the title); the sport's tile is white.
- **A team tapped is the list's filter** (2026-10-25). On football's, the
  NBA's and the NFL's Overview a club's name in the table or in a match card
  narrows the matches to it, through the same filter as the pill beside
  "Earlier" (saved the same way), and opens on its last three results rather
  than the one latest day: a team's own fixtures one day apart said nothing
  of its form. The owner's call, over the per-team pages researched the same
  day, which wait.
- **A tournament opens in the sport's own layout** (2026-10-25). Its page
  had breadcrumbs (Sports › Padel › the tournament) over a page header, so
  "View details" swapped the whole head of the page. Now the name row, the
  favourites and the sport picker stay put; the title reads "Padel › Kuwait
  Major 2026", "Padel" the way back; and the tabs are the tournament's,
  Overview and Bracket, opening on the Bracket — the owner's layout, padel
  first, tennis the same. On the sport's Overview the featured card's
  poster shows whole (a 5:7 box for padel's A-format posters, which a box
  two-fifths of the card wide cut top and foot), the seeds moved off it to
  the content's corner, and the round under way went to the card's foot,
  muted, beside "View details" — nothing there before play starts.
- **Accessibility pass** (2026-10-25). An audit of every sport, tab and
  page (code read area by area, page outlines, axe and the keyboard in the
  browser, each finding checked by a second reader) fixed: focus given back
  after a sport, league or LoL split switch; a page outline of one `h1`,
  `h2` sections (day headings, the table label, `SectionHeading`, World Cup
  groups, news stories) and `h3` tiles; named tables with row headers,
  expanded abbreviations (MP, GD, Pts, W, L, GB, T, FT, AET, BO3, "d.") and
  qualification zones named in text and in a key under the table; status
  words in the text colour with the hue on the tint or a dot (the badges'
  blue and green text was 3–3.9:1); solid focus rings (`ring-ring`, not
  `/50`, with `focus-visible:outline-hidden` so forced colours keep one);
  bracket columns as named groups of lists, the winner said, the round being
  played named (none once all are decided), a tie's details in a popover a
  tap or a key opens; the team filter's listbox semantics; loading and
  "Show more" announced; the sticky bar never covering what takes focus
  (a scroll margin on what follows `[data-sport-tabs]`, see
  [`docs/SPACING.md`](../SPACING.md)); per-sport page titles. The app-wide
  `--muted-foreground` went from 3.5–4:1 to ≥4.5:1 in light mode in its own
  commit, the owner's call.
- **One row of controls fewer** (2026-10-25). The strip of sport chips is
  gone: the sport is picked from one button group at the end of the sport's
  name row (the owner's call over a menu: every sport in reach, each by its
  emoji and name, sliding sideways on a phone), the favourites button beside
  it. The competition picker is gone too: the title is the competitions' menu,
  in the heading's own type (the owner's idea), so the stuck bar is the tabs
  alone and LoL's title names the split or event on screen. The team filter
  is a pill on the first day's heading line, beside "Earlier" — the owner's
  layout. `SportBarEnd`, the portal that put a tab's own control in the bar,
  went with the filter, and `CompetitionTrigger` with the picker.
- **A bracket with nobody in it is not rendered as a bracket.** Providers hand
  back the shape of a playoff before the draw is made — LoL returned eight
  TBD-vs-TBD slots — so `isBracketDrawn`
  ([`lib/sports/bracket.ts`](../../lib/sports/bracket.ts)) gates both the
  bracket's empty state and whether the LoL view is allowed to *open* on the
  Playoffs tab.
- **Padel and tennis no longer share 🎾.** Two tabs with the same glyph were
  told apart only by reading them; padel is 🏓 (a paddle). Padel's provider also
  reports no week-on-week movement, so the rankings table drops the *Move*
  column entirely rather than printing "— 0" down every row.
- **Sports table/style primitives**: [`shared/table-primitives.tsx`](../../components/entertainment/sports/shared/table-primitives.tsx) (`SportsTh` standard uppercase header cell + `TableCellNum` numeric cell — replaces ~50 copy-pasted `text-xs uppercase tracking-wide text-muted-foreground` chains and 3 duplicate `TableCellNum`s) and [`shared/status-pill.tsx`](../../components/entertainment/sports/shared/status-pill.tsx) (`StatusPill` completed/upcoming/live — was duplicated in f1-view + racquet-view). New sport views should use these instead of hand-rolling.
- **Sport views key their `<Tabs>` by the active league/region** (football, lol): an uncontrolled Tabs keeps its old value when the active trigger unmounts, so switching to a league without that tab stranded the view on a blank body. `KnockoutBracket` opens on the round being played and scrolls to it again when `rounds` changes.
- `manage-favorites-sheet` tracks in-flight toggles as a `Set<SportId>` (a single pending slot let one toggle's completion clear another's spinner).
- **Kickoffs print in the reader's zone on the server too.** Score, bracket,
  LoL and news cards formatted with the runtime's zone and suppressed the
  hydration warning, so a server-rendered tab kept UTC ("Sun, Jul 5, 8:00 PM")
  while the same fixture on a tab mounted later read 2:00 PM. The page passes
  the `tz` cookie's zone down (the portal-wide `ReaderTimeZoneProvider`); date-only strings stay
  calendar days (`isCalendarDay` in `lib/utils/date.ts`, the one test the
  match-time formatters, `bracketWhen` and the draw card share).
- **Tables sit flush in `TableCard`** (`shared/table-primitives.tsx`): the old
  `Card` + `CardContent px-0` kept the card's vertical padding as an empty band
  above the header row. `StandingsTable` (it takes the `competition`, which
  names its zones, and a `label`, the table's name) is #, club, MP, GD, Pts and nothing
  else (the unused full variant, with W/D/L/GF/GA and Last 5, is gone), for
  the football overview's side column and World Cup groups, where a full
  table was clipped before the points; its narrow number columns keep **Pts
  on a 390px screen**.
- **Sport views lay out by container, not viewport** — `SportShell` is the
  `@container`; its header, the match grids, the overview split and
  `KnockoutBracket`'s mobile/desktop switch use `@xl` / `@2xl` / `@4xl`. With the
  sidebar open, `sm:` put a 224px league picker beside the title (three-line
  "UEFA Champions League") and a three-column bracket in 456px.
- The status column is a fixed `min-w-16` with the
  code over the day for a result and the day over the time for a fixture, the
  same shape in LoL's card. `TeamBadge` discs grew to 24px (`sm`) — a 3-letter
  code ran edge to edge in 20px and the curve clipped it.
- The favourites sheet says what each sport covers instead of repeating its
  short label ("Football / Football").
- **LoL's international events lead the region menu while they run.** In October the four regional splits were a month old while Worlds was being played and not on the list. An international event shows from its start until the first regional tournament that starts after its final is under way, and stays while none is listed — a fixed three weeks had December falling back to LEC's September final. The menu labels each entry with its own name ("Worlds 2026", "LEC Split 3"), and the Standings tab is hidden while a stage has no table (Worlds' Swiss stage before it starts).
- **A LoL champion is the winner of the round named Finals**, never the bracket's last round: LPL plays a Regional Qualifier after its final, whose winner (IG) was not the champion (AL). A bracket match names whoever leads as its winner, so a champion also needs the majority of the best-of — a final at 2–1 crowns nobody. After Worlds the card and the hub show the season's champions until the next split starts; after MSI or First Stand the card's table is "Latest champions", because the regional rows are the split before's winners, not the year's.
- **Once next season is scheduled, a league's newest schedule page can hold only next season** (`pages.newer` is null), and the split on screen kept its standings and lost every match. `findInSchedule` reads older pages, then the tournament's completed events; a split never shows another season's matches.
- **Every bracket shares the Swiss stage's layout** (2026-10-18): football and the World Cup, LoL playoffs, the NBA and the NFL, and the padel and tennis draws all sit on `BracketCanvas`. Each match shows when it is in small print, because following a round should not take a hover. LoL's double-elimination playoffs arrive with `previousMatchIds` empty and no round that halves into the next, so they get the boxes without branches rather than guessed ones.
- **Worlds' Swiss stage is drawn as a tree, not a list of cards.** The API sends it as one standings section of 33 matches. No match says which record it was played on, and `previousMatchIds` is empty. The order is the only key: round by round, best record first within a round. `buildSwissStage` finds the Swiss format that plays that many matches (16 teams, three wins through and three losses out) and reads the pools off the order. It checks every team the results place in a match against that match's record and returns null rather than draw a team in the wrong pool. The schedule adds each match's date and best-of.
- **A LoL playoff now arrives as ONE standings section** (LEC: eight matches in "Playoffs"; Worlds: seven in "Knockouts"), so one round per section had become one column. The schedule still names each match's block ("Quarterfinals", "Finals"), and the section lists matches in bracket order, so contiguous blocks become the rounds. A league's schedule page also spans tournaments — LEC's carried the spring split, Worlds' last year's knockouts — so only events inside the tournament's dates are kept.
