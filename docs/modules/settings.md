# Settings

> **Status:** Active
> **Last reviewed:** 2026-07-01

## Overview
Personal portal preferences. Today it holds a single appearance toggle — the
decorative module mascot (a clay-style bean doing a module-themed activity)
shown after the content of module pages; on Finance it mines for gold.

## Routes
- `/portal/settings` — preferences page (appearance toggles)

## Server actions — `/app/actions/`
- `user-preferences.ts` — `setShowContextAvatarAction` (toggle the module mascot)

## Services — `/lib/services/`
- `user-preferences-service.ts` — `getUserPreferences` (returns defaults when the user has no row) / `setShowContextAvatar` (upsert)

## Schemas — `/schemas/`
- `user-preferences.ts` — `setShowContextAvatarSchema` / `SetShowContextAvatarInput`

## Types — `/types/`
- — (`UserPreferences` is exported from `user-preferences-service.ts`, next to the defaults it describes)

## Components
`components/settings/` — `preferences-form.tsx` (optimistic Switch row + live mascot preview). The mascot itself is [`components/portal/context-avatar.tsx`](../../components/portal/context-avatar.tsx) — shared, pure SVG + CSS keyframes (no client JS), one variant per module (`finance` only so far), animations pause under `prefers-reduced-motion`.

## DB tables — `db/schema.ts`
- `user_preferences` — one row per user, created lazily on first write; absence of a row means "all defaults" (the service layer owns the default values)

## Notes
- **Net-worth milestones** (`user_preferences.finance_milestones`, jsonb) are a
  GLOBAL preference, not plan data — one list applies to every plan's chart.
  `NULL` means "never customised" and falls back to
  `DEFAULT_FINANCE_MILESTONES` in [`lib/finance/milestones.ts`](../../lib/finance/milestones.ts)
  (client-safe, because `user-preferences-service` is `server-only` and the
  chart needs the same defaults). An empty array IS a choice — no reference
  lines — so only `null` falls back. Labels render on ONE row and are never
  dropped, by explicit product decision: the user picks the list, so the count
  is theirs; `MAX_MILESTONES` (12) is the guard rail.
- Conventional Commits scope: `portal` (no dedicated `settings` scope yet — add it to `commitlint.config.mjs` if the module grows).
- Reached from the user dropdown ([`components/nav-user.tsx`](../../components/nav-user.tsx)), not the sidebar nav sections.
- Each module's layout owns rendering the mascot (e.g. `app/portal/plans/layout.tsx` — see [finance.md](./finance.md)); this module only owns the preference itself.
