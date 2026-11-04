# Settings

> **Status:** Active
> **Last reviewed:** 2026-10-19

## Overview
Personal portal preferences. Today it holds a single appearance toggle — the
decorative module mascot (a clay-style bean doing a module-themed activity)
shown after the content of module pages; on Finance it mines for gold.

## Routes
- `/portal/settings` — preferences page (appearance toggles); the section rail
  is `Tabs orientation="vertical"` with real panels, vertical from `lg` (a
  horizontal scroll rail below — beside the app sidebar a second rail left the
  pane 220px wide). `settings/loading.tsx` draws the rail and one card. An
  admin (by real role) also gets an **AI** category: the travel assistant's
  model, the month's spend against the plan's API credit, and the API key's
  expiry

## Server actions — `/app/actions/`
- `user-preferences.ts` — `setShowContextAvatarAction` (toggle the module mascot), `ActionResult`
- `ai-settings.ts` — `updateAiSettingsAction` (model and/or key expiry; `requireAdminCached`, revalidates the portal layout), `ActionResult<AiSettings>`

## Services — `/lib/services/`
- `user-preferences-service.ts` — `getUserPreferences` (returns defaults when the user has no row) / `setShowContextAvatar` (upsert)
- `ai-service.ts` — `getAiSettings` (defaults when there is no row; a retired model reads as the default), `updateAiSettings` (upsert of the one row), `recordAiUsage` (one Claude call's tokens and cost), `getAiUsageSummary(timeZone, today)` (today and the last six calendar months, reader's zone)

## Schemas — `/schemas/`
- `user-preferences.ts` — `setShowContextAvatarSchema` / `SetShowContextAvatarData`
- `ai-settings.ts` — `updateAiSettingsSchema` / `UpdateAiSettingsData` (a model from `AI_MODEL_IDS`, a date or null)

## Types — `/types/`
- `preferences.ts` — `UserPreferences` (the service still owns the default values)
- `ai.ts` — `AiSettings`, `AiSpend`, `AiUsageSummary`

## Components
`components/settings/` — `preferences-form.tsx` (optimistic Switch row + live mascot preview); `ai-settings.tsx` (`AiSettingsPane`: model `Select`, spend with a `Progress` against the credit, earlier months, key status and an expiry `DateField`); `settings-shell.tsx` takes `ai` and adds the category only when it is present. `components/portal/ai-key-expiry-notice.tsx` is the admins' reminder dialog, mounted by `app/portal/layout.tsx`. The mascot itself is [`components/portal/context-avatar.tsx`](../../components/portal/context-avatar.tsx) — shared, pure SVG + CSS keyframes (no client JS), one variant per module (`finance` only so far), animations pause under `prefers-reduced-motion`.

## DB tables — `db/schema.ts`
- `user_preferences` — one row per user, created lazily on first write; absence of a row means "all defaults" (the service layer owns the default values)
- `ai_settings` — app-wide, at most one row (`id = 1`, checked), created on the first save: `model`, `api_key_expires_on`, `updated_by`
- `ai_usage` — one row per Claude API call: feature, model, token counts (fresh, cache write, cache read, output) and `cost_usd`

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
- **AI spend is the app's own count.** An individual Claude Console account
  cannot read its balance or key expiry through the Admin API, so each call's
  `usage` is priced at the list rates in [`lib/ai/models.ts`](../../lib/ai/models.ts)
  (cache writes 1.25× input) and summed by calendar month against
  `MONTHLY_AI_CREDIT_USD` ($100, Max 5x). Console's balance is the exact
  figure. The key's expiry is typed in by an admin; `lib/ai/key-expiry.ts`
  turns it into reminder stages (30, 20 and 10 days out, then daily, then
  daily once expired), each named after the expiry date so a new key starts
  over, and each shown once per browser (`localStorage`).

