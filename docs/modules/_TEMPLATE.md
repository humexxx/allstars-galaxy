# <Module name>

> **Status:** <one phrase, e.g. "Active", "In progress", "Deprecated">
> **Last reviewed:** <YYYY-MM-DD — update when you touch the module>

## Overview
2–4 sentences. What the module does **for the user**, not how it's built.

## Routes
- `/path` — what it does

## Server actions — `/app/actions/`
- `file.ts` — one-line summary of exported handlers

## Services — `/lib/services/`
- `file.ts` — one-line summary

## Schemas — `/schemas/`
- `file.ts`

## Types — `/types/`
- `file.ts`

## Components
`components/<module>/` — one-line note about what lives there.

## DB tables — `db/schema.ts`
- `table_name` — purpose

## Notes
- Conventional Commits scope: `<scope>`
- Anything load-bearing that isn't obvious from the code: security model,
  cross-module coupling, gotchas. Keep terse.
