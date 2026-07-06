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
- Conventional Commits scope: `portal` (no dedicated `settings` scope yet — add it to `commitlint.config.mjs` if the module grows).
- Reached from the user dropdown ([`components/nav-user.tsx`](../../components/nav-user.tsx)), not the sidebar nav sections.
- Each module's layout owns rendering the mascot (e.g. `app/portal/plans/layout.tsx` — see [finance.md](./finance.md)); this module only owns the preference itself.
