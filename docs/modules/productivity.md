# Productivity

> **Status:** Active
> **Last reviewed:** 2026-09-29

## Overview
Two surfaces: a personal kanban *board* for day-to-day tasks, and *road paths*
for long-term goals with milestones, progress tracking, and scheduled
auto-generated tasks.

## Routes
- `/portal/productivity/board` — kanban board (`board/layout.tsx`, wide container)
- `/portal/productivity/road-paths` — long-term goals + milestones (`road-paths/layout.tsx`, default container)

## Server actions — `/app/actions/`
- `board.ts` — column/task CRUD, reordering, board initialization
- `road-path.ts` — road path / milestone / progress CRUD and auto-task creation.
  `createRoadPathAction` returns a `message` when the path saved but its first
  task did not
- `task-automation.ts` — generate scheduled tasks from road paths (no UI caller)

All return `ActionResult<X>` through `safe()`; raw ids are checked with
`idSchema`, and "not found" is a returned failure, never a throw. The unused
getter actions were deleted — pages read through the services.

## Services — `/lib/services/`
- `board-service.ts` — `updateBoardColumn` / `updateBoardTask` return `null` when nothing matched
- `road-path-service.ts` — every write is scoped by owner or parent row;
  `getRoadPathDetail()` feeds the server-rendered detail view
- `task-automation-service.ts` — `createAutomatedTasksForAllUsers()` (the daily
  cron's entry point; only users with an active auto-creating path)

## Schemas — `/schemas/`
- `board.ts`
- `road-path.ts`

## Types — `/types/`
- `productivity.ts` — incl. `RoadPathDetail`

## Components
`components/productivity/` — board UI, task cards, milestone editors.

## DB tables — `db/schema.ts`
- `board_columns` — kanban columns per user
- `board_tasks` — tasks (optionally linked to a road path)
- `road_paths` — long-term goals with auto-task frequency
- `road_path_milestones` — intermediate checkpoints
- `road_path_progress` — value updates for tracking toward target

## Notes
- Conventional Commits scope: `productivity`
- **A task can only sit in the caller's own column.** `createBoardTask`,
  `updateBoardTask` and a cross-column `reorderTask` run
  `ensureColumnOwnership` first; a foreign `columnId` used to be inserted as-is
  and surfaced under the other user's column.
- `/portal/productivity` has no page, so mutations revalidate it with the
  `"layout"` type — the default `"page"` type matched nothing.
- **Logic audit (2026-09-11).** `deleteBoardTask` closes the `order` gap so the positional reorder maths stays right; moving a task to another column from the dialog goes through `reorderBoardTaskAction` first. Task automation compares calendar days / months (UTC), not elapsed hours. Road-path `currentValue` follows the newest entry by date (and resets to 0 when none remain); `totalProgress` is clamped to 0–100 and `daysRemaining` to ≥ 0. `MonthPicker` builds dates from parts so the 31st never rolls over.
- Auto-task generation runs on the daily cron — see `task-automation.ts`.
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
  `app/portal/productivity/error.tsx` is the module error boundary.
