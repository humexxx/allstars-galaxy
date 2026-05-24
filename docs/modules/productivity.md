# Productivity

> **Status:** Active
> **Last reviewed:** 2026-05-23

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
- Conventional Commits scope: *(add `productivity` to [`commitlint.config.mjs`](../../commitlint.config.mjs) before first commit here)*
- Auto-task generation runs on the daily cron — see `task-automation.ts`.
