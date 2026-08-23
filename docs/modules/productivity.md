# Productivity

> **Status:** Active
> **Last reviewed:** 2026-08-22

## Overview
Two surfaces: a personal kanban *board* for day-to-day tasks, and *road paths*
for long-term goals with milestones, progress tracking, and scheduled
auto-generated tasks.

## Routes
- `/portal/productivity/board` — kanban board
- `/portal/productivity/road-paths` — long-term goals + milestones

## Server actions — `/app/actions/`
- `board.ts` — column/task CRUD, reordering, board initialization
- `road-path.ts` — road path / milestone / progress CRUD; auto-task creation; stats
- `task-automation.ts` — generate scheduled tasks from road paths

## Services — `/lib/services/`
- `board-service.ts`
- `road-path-service.ts`
- `task-automation-service.ts`

## Schemas — `/schemas/`
- `board.ts`
- `road-path.ts`

## Types — `/types/`
- `productivity.ts`

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
- `app/portal/productivity/loading.tsx` provides a column-grid skeleton for the board; `app/portal/productivity/error.tsx` is the module error boundary.
