# Productivity

> **Status:** Active
> **Last reviewed:** 2026-11-10

## Overview
Two surfaces: a *daily* kanban board — each day its own, with what was left
open offered to the next — and *road paths*: habits on chosen weekdays whose
task lands on the board by itself, with a streak, a completion rate and a
calendar. A road path is only that: a habit. It once could also be a goal with
a target, milestones and a progress log; that model was removed on 2026-11-08.

## Routes
- `/portal/productivity/board` — one day's board, `?day=YYYY-MM-DD` (default: the reader's today) (`board/layout.tsx`, wide container)
- `/portal/productivity/road-paths` — the habits, each a card; `?path=<id>` opens one (`road-paths/layout.tsx`, default container)

## Server actions — `/app/actions/`
- `board.ts` — column/task CRUD, reordering (a move or edit that takes a habit's task into Done returns its streak line as `message`); `setDoneColumnAction`, `carryOverTasksAction` (moves or leaves each offered task; today from the `tz` cookie), `moveTaskToTodayAction` (refuses a habit's task)
- `road-path.ts` — create / update (every field) / delete a road path; create and update take the reader's today for `scheduleSince`. `reorderRoadPathsAction({ ids })` saves the order the cards were dragged into

All return `ActionResult<X>` through `safe()`; raw ids are checked with
`idSchema`, and "not found" is a returned failure, never a throw. The unused
getter actions were deleted — pages read through the services.

## Services — `/lib/services/`
- `board-service.ts` — every positional write is scoped to (column, day); `getBoardTasksForDay`, `setDoneColumn`, `getCarryOverCandidates`, `carryOverTasks`, `moveTaskToDay`; a move into / out of the Done column sets `completedAt` and writes / removes the habit's check-in. `updateBoardColumn` / `updateBoardTask` return `null` when nothing matched
- `road-path-service.ts` — every write is scoped by owner;
  `getRoadPathDetail(id, userId, today, timeZone)` feeds the server-rendered detail view with its habit figures, `getCheckInMessage` builds the check-in line. `updateRoadPath` clears an old path's target, unit and target date the first time it is saved. `getUserRoadPaths` orders by `position` (nulls — never placed — first, newest first); `reorderRoadPaths(userId, ids)` numbers them in one statement, refusing a list with a path that is not the user's or one listed twice
- `task-automation-service.ts` — `ensureHabitTasksForDay(userId, day, timeZone)`: today's habit tasks, called by the board page and the dashboard card
- `productivity-dashboard-service.ts` — `getDashboardProductivity(userId, today, timeZone | null)`: generates today's habit tasks (zone known only), then reads the board, carry-over count and road paths
- `lib/productivity/dashboard.ts` — `buildDashboardProductivity`: today's done / total, open tasks in board order, habits sorted due → done → next
- `lib/productivity/habit.ts` — pure habit maths on `YYYY-MM-DD` days: `isDueOn`, `dayStatus`, `habitStats` (streaks, completion), `habitOf`, `scheduleLabel`, `isCalendarDay`, `checkInMessage` ("Gym done — 4 in a row, your best yet.": the record is against the best run before this check-in, so a tie says so)

## Schemas — `/schemas/`
- `board.ts` — incl. `carryOverSchema`; a task takes a `boardDate`, never a `roadPathId`
- `road-path.ts` — title, description, start date and `scheduleDaysSchema` (at least one day, sorted, unique 0–6); `updateRoadPathSchema` takes any subset plus `completedAt`

## Types — `/types/`
- `productivity.ts` — incl. `RoadPathDetail` (the path with its check-ins and `HabitStats`), `RoadPathWithCheckIns`, `RoadPathCheckIn`, `CarryOverTask`

## Components
`components/productivity/` — board UI, task cards, road paths.
- `zoned-date.ts` — day keys and labels in the reader's zone (`tz` cookie), plus `calendarDayKey` / `formatCalendarDay` for road-path days stored as UTC midnight
- `board/due-date.ts` — `dueTone` (overdue / today / tomorrow)
- `board/board-day-nav.tsx` — previous / next day links and "Back to today"
- `board/carry-over-dialog.tsx` — "You didn't finish some things. Move them to today?"; a task named like one already on today's board starts unticked
- `dashboard-productivity-card.tsx` — the dashboard's card (between finance and travel): today's board and each scheduled habit with its week and streak
- `road-paths/road-path-dialog.tsx` — create and edit (title, description, weekday toggles, start date, completed); `road-path-menu.tsx` — edit / delete for the card and the detail header
- `road-paths/road-paths-view.tsx` — the cards, sortable with dnd-kit (a drag starts after 8px, so a click still opens the card; space and the arrows move a focused one), over a faint grid in the charts' gridline tone that fades out downwards; the new order shows at once and is saved behind it
- `road-paths/road-path-card.tsx` — no hover state (the card is dragged); the days badge, the week row, the streak and the share done; `road-path-detail.tsx` — streak and completion over the habit calendar
- `road-paths/habit-days.tsx` — `HabitCalendar` (a month, paged back to the start) and `HabitWeek` (the card's row of seven)

## DB tables — `db/schema.ts`
- `board_columns` — kanban columns per user; `is_done` flags the one Done column (partial unique index per user)
- `board_tasks` — tasks on a day's board (`board_date`), optionally a road path's (unique per path and day); `carry_over_declined_at` once left behind
- `road_paths` — habits; `schedule_days` (0 = Sunday), `schedule_since`, `position` (migration 0066; null until dragged). `target_value` / `current_value` / `unit` / `target_date`, `auto_create_tasks` / `task_frequency` are unused, kept for production's old code
- `road_path_check_ins` — a day a habit was done (unique per path and day; `task_id` set null when the task is deleted)
- `road_path_milestones`, `road_path_progress` — unused since road paths are habits only (both empty), kept for production's old code; drop them in a release after this one ships

## Notes
- Conventional Commits scope: `productivity`
- **Module mascot**: `board/layout.tsx` and `road-paths/layout.tsx` each append `<ModuleMascot>` after the page, in its own `Suspense` and gated by the `showContextAvatar` preference — see [settings.md](./settings.md). `variant="board"` ([`mascot/board-scene.tsx`](../../components/portal/mascot/board-scene.tsx)) carries a card across a kanban board to Done; `variant="road-paths"` ([`mascot/road-paths-scene.tsx`](../../components/portal/mascot/road-paths-scene.tsx)) walks an endless road, ticking each day's signpost under a streak flame.
- **A task can only sit in the caller's own column.** `createBoardTask`,
  `updateBoardTask` and a cross-column `reorderTask` run
  `ensureColumnOwnership` first; a foreign `columnId` used to be inserted as-is
  and surfaced under the other user's column.
- `/portal/productivity` has no page, so mutations revalidate it with the
  `"layout"` type — the default `"page"` type matched nothing.
- **Logic audit (2026-09-11).** `deleteBoardTask` closes the `order` gap so the positional reorder maths stays right; a new column from the task dialog is a move, which `updateBoardTask` runs through `reorderTask` (end of the list, gap closed). Road-path `currentValue` follows the newest entry by date (and resets to 0 when none remain); `totalProgress` is clamped to 0–100. `MonthPicker` builds dates from parts so the 31st never rolls over.
- **The board is daily.** A task belongs to one day (`board_date`, a calendar day in the reader's zone) and its `order` is its place in its column on that day. Opening today's board first puts the day's habit tasks on it, then offers every open task from earlier days that is not a habit's and not already answered: moved ones go to the top of their own column, left ones get `carry_over_declined_at` and stay in that day's history. Finished tasks stay on the day they were finished. Closing the prompt without answering asks again next time.
- **Nothing is written before the reader's zone is known.** A device's first request has no `tz` cookie, so "today" is UTC's day (tomorrow, on a Costa Rica evening); generating then put tomorrow's habit tasks on the board and stamped the paths, so the reader's own day never got its tasks. The board checks `readRequestTimeZone()` and only reads until the header has written the cookie and refreshed; the carry-over prompt is keyed on what it offers, so it opens when the list arrives with that refresh.
- **Habit tasks are generated on page load — the board's and the dashboard's, where the app opens — not by the cron.** The cron ran at 00:00 UTC — 6 pm the evening before in Costa Rica — so Monday's task appeared on Sunday, dated Sunday, and read as overdue. `lastTaskCreatedAt`'s day in the reader's zone stops a deleted task coming back; the unique (road path, day) index stops two tabs writing it twice. A habit's task never carries over or moves to another day: the next due day gets its own, and the one it was for reads as missed.
- **A schedule change takes effect today** (`schedule_since`). Days before it count check-ins only, so moving from MWF to every day does not paint last week's Tuesdays as missed. A new path is judged from the later of its start day and today, since past days cannot be checked in. A streak counts due days in a row; today, still open, does not break it.
- Board UI keeps optimistic state locally with explicit rollback on error (not via React 19's `useOptimistic`) because the DnD reorder queue depends on a stable local state model.
- **A server action reports failure in its return value; only a crash throws.**
  Awaiting one and then announcing success is how a rejected mutation gets a
  green toast and a closed dialog. Go through `runAction`
  ([`lib/actions/run.ts`](../../lib/actions/run.ts)), the client half of the
  `{ success, error }` envelope in [`lib/actions/safe.ts`](../../lib/actions/safe.ts).
- **A field with no error line is a dead end.** `react-hook-form` will not call
  `onSubmit` while any field fails the schema, so a required field the form
  never fills and never reports — `order` on a milestone, `targetValue` read
  through `valueAsNumber` as `NaN` — leaves a submit button that does nothing
  at all and says nothing about why.
- **The drop index is measured against the destination column WITH the dragged
  card still in it.** That is the convention `reorderTask` uses (arrayMove
  semantics). Measuring against the list with the card removed made every
  downward move land one slot short, and made the shortest one — onto the very
  next card — compare equal to where it already was and get swallowed by the
  no-op guard. The optimistic update renumbers **both** columns, because the
  service closes the gap the card leaves behind.
- **A milestone's `order` is resolved server-side** by `getNextMilestoneOrder`.
  A client counting the prop it was rendered with gave every milestone after
  the first in one session the same value.
- **The board's collision detection is `closestCorners`, not the default.** A
  column's droppable rect contains every card in it, so rect-intersection
  always resolved a drop to the column and `over.id` was never a task id —
  which is why reordering inside a column was impossible and every move landed
  at position 0. `reorderTask` in the service has always taken a real index.
- **`DndContext` carries a fixed `id`.** Without one dnd-kit numbers
  `aria-describedby` from a module counter that server and client disagree on,
  and the board hydration-mismatches on every load.
- **The open road path is a `?path=` search param**, not component state. As
  state it had no history entry, so Back left the module, a refresh dropped
  you back to the grid, and the detail held whatever snapshot the list had
  when it was clicked.
- **The road-path detail renders on the server** from `?path=`, inside a keyed
  `<Suspense>` with `road-path-detail-skeleton`; there is no client fetch and
  no `router.refresh()`. Cards are keyboard-reachable: the title is a `Link`
  whose hit area covers the card.
- **The board drags from a grip button** with a `KeyboardSensor`, and a failed
  mutation rolls back only that change, not a whole-board snapshot.
- `board/loading.tsx` and `road-paths/loading.tsx` draw their own page;
  `app/portal/productivity/error.tsx` is the module error boundary. The
  board's draws what every board has for real — `PageHeader` with its
  buttons disabled, the day arrows, the column frames and their header strip —
  and pulses only the cards inside the frames (the owner's call: structure is
  never a skeleton). Changing the day keeps the current board up instead.
- **Dates are read in the reader's zone, passed from the server.** The board
  and road-path pages read the `tz` cookie (`getRequestTimeZone`) and hand the
  zone — and today's `YYYY-MM-DD` in it — down to the cards. Formatting with the
  runtime's zone and `suppressHydrationWarning` kept the server's UTC text: a
  card said "Sep 25" while the task's own edit dialog said Sep 24.
- **A task's due date is an instant (local noon, from `TaskDialog`); a road
  path's start/target date is a calendar day stored as UTC midnight** (what
  `new Date("YYYY-MM-DD")` gives, and what every existing row holds). The two
  are read differently on purpose — see `zoned-date.ts`.
- **Overdue / Today / Tomorrow** tint a task's due date; a task in the Done
  column is never flagged. "Done" is the column's `is_done` flag, not its name
  (the old name regex missed "Hecho"); a board's Done column cannot be deleted
  until another is chosen. Finished = in the Done column or `completedAt` set,
  so rows moved by production's old code still count.
- **The only column cannot be deleted.** The page re-creates the default three
  for a board with none, so deleting the last one brought Todo / Working / Done
  straight back on the revalidation, and the empty state never stayed.
- Deleting a task asks first, like deleting a column. The board announces drags
  by task title and column name (dnd-kit's defaults read the raw ids), and the
  grip is a column of its own so the title lines up with the text under it.
- The road-path grid, the detail's stat row / panels and the More-apps grid
  size by **container** (`@container`, `@xl` / `@3xl` / `@4xl`), not viewport:
  with the sidebar open a `md:` breakpoint split a 456px column in two or
  three. A road-path card pins its figures to the bottom (`mt-auto`), clamps a
  long title to three lines, says "Target …" / "Was due …", and badges a path
  that has reached its target. The detail's countdown turns into **Past
  target** once the day has gone (it used to sit at "0 days" for ever).
