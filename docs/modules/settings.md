# Settings

> **Status:** Active
> **Last reviewed:** 2026-11-10

## Overview
Personal portal preferences. Appearance holds the decorative module mascot (a
small overworld hero doing whatever the module on screen is about) — whether
it shows, and which character plays it — shown after the content of module pages: mining gold on
Plans, watering a money tree on Portfolio, calling a chart on the Trading
Journal, moving a card to Done on the Board, ticking each day's signpost on
Road Paths, playing the sport on screen on Sports, reading a map on Travel.

## Routes
- `/portal/settings` — preferences page (appearance toggles); the section rail
  is `Tabs orientation="vertical"` with real panels, vertical from `lg` (a
  horizontal scroll rail below — beside the app sidebar a second rail left the
  pane 220px wide). `settings/loading.tsx` draws the rail and one card. An
  admin (by real role) also gets an **AI** category: the travel assistant's
  model, the month's spend against the plan's API credit, and the API key's
  expiry

## Server actions — `/app/actions/`
- `user-preferences.ts` — `setShowContextAvatarAction` (toggle the module mascot), `setMascotCharacterAction` (who plays it), `ActionResult`
- `ai-settings.ts` — `updateAiSettingsAction` (model and/or key expiry; `requireAdminCached`, revalidates the portal layout), `ActionResult<AiSettings>`

## Services — `/lib/services/`
- `user-preferences-service.ts` — `getUserPreferences` (returns defaults when the user has no row) / `setShowContextAvatar` / `setMascotCharacter` (upserts; a stored character the app no longer knows reads as the default)
- `ai-service.ts` — `getAiSettings` (defaults when there is no row; a retired model reads as the default), `updateAiSettings` (upsert of the one row), `recordAiUsage` (one Claude call's tokens and cost), `getAiUsageSummary(timeZone, today)` (today and the last six calendar months, reader's zone)

## Schemas — `/schemas/`
- `user-preferences.ts` — `setShowContextAvatarSchema` / `SetShowContextAvatarData`, `setMascotCharacterSchema` / `SetMascotCharacterData` (one of `MASCOT_CHARACTERS`)
- `ai-settings.ts` — `updateAiSettingsSchema` / `UpdateAiSettingsData` (a model from `AI_MODEL_IDS`, a date or null)

## Types — `/types/`
- `preferences.ts` — `UserPreferences` (the service still owns the default values), `MASCOT_CHARACTERS` / `MascotCharacter` / `DEFAULT_MASCOT_CHARACTER` / `MASCOT_CHARACTER_LABELS` (the cast: explorer, Link, Pikachu, Mario, Goku, Naruto, Messi, Einstein, Buffett)
- `ai.ts` — `AiSettings`, `AiSpend`, `AiUsageSummary`

## Components
`components/settings/` — `preferences-form.tsx` (optimistic Switch row, a radio grid of `HeroPortrait`s to pick the character, and a live mascot preview played by it, the finance scene imported on its own so the other scenes stay out of the settings bundle); `ai-settings.tsx` (`AiSettingsPane`: model `Select`, spend with a `Progress` against the credit, earlier months, key status and an expiry `DateField`); `settings-shell.tsx` takes `ai` and adds the category only when it is present. `components/portal/ai-key-expiry-notice.tsx` is the admins' reminder dialog, mounted by `app/portal/layout.tsx`. The mascot itself is [`components/portal/context-avatar.tsx`](../../components/portal/context-avatar.tsx), a thin entry over [`components/portal/mascot/`](../../components/portal/mascot/): `sprite.ts` (a figure described in shapes — circles, boxes, polygons, in the hero's units — sampled onto a grid of `PX`-wide squares and ringed in ink, one path per colour; `add` grows the figure, `on` paints only where it already is), `looks.ts` (`LOOKS`: per character a palette, a head per face, and what it wears or carries, all on the same rig), `characters.tsx` (`Hero` / `HeroHead` / `HeroPortrait`: the rig — near hand at (-0.8, -15), feet at (0, 0), head centre (1, -46) — with each part rasterised once per character; a sprite's colours are its own hexes, dimmed under `.dark` by `--ctxa-lit`), `kit.tsx` (re-exports the hero; the stage, a block of ground with a lip and an earth side, textured per ground tone; the scalloped conifers, tufts and flowers scenes dress it with; the palette as `--ctxa-*` custom properties re-tinted under `.dark`, and the keyframe helpers `loop` / `arc` / `stepFrames`) and one scene per variant: `finance-scene.tsx` (mines a gold-veined boulder and carries the nuggets to a chest, posed by `FinanceMood`), `sports-scene.tsx` (one short loop per `SportId`: a goal, a field goal, a jump shot, a batting cage, a slap shot, rallies against a wall, a lap, a wave, a ranked game) and `travel-scene.tsx` (a map at a crossroads, suitcase packed, destinations in a thought bubble). Pure SVG + CSS keyframes (no client JS); every part of a scene is keyed to one generated timeline on a `--ctxa-cycle` clock, each scene prefixes its classes because scenes share the page's styles, and animations stop under `prefers-reduced-motion` on a pose that still reads. [`components/portal/module-mascot.tsx`](../../components/portal/module-mascot.tsx) is the server mount: it reads the preferences and renders the variant, played by the chosen character, or nothing. The character travels as a prop — `ContextAvatar` → scene → `Hero` — because server components share no context.

## DB tables — `db/schema.ts`
- `user_preferences` — one row per user, created lazily on first write; absence of a row means "all defaults" (the service layer owns the default values); `mascot_character` (text, default `explorer`) is who plays the mascot
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
- Each module owns rendering the mascot, always inside a `<Suspense fallback={null}>` after the content so no page waits on the preference: `app/portal/plans/layout.tsx` (posed by the main plan — see [finance.md](./finance.md)), the Sports hub and its race and tournament pages (the page knows the sport; the layout does not) and `app/portal/entertainment/travel-planner/layout.tsx` — see [entertainment.md](./entertainment.md) — `app/portal/portfolio/page.tsx` ([portfolio.md](./portfolio.md)), `app/portal/trading/layout.tsx` ([finance.md](./finance.md)) and the Board's and Road Paths' layouts ([productivity.md](./productivity.md)). This module only owns the preference itself. A new variant is a scene file beside the others, a member of `ContextAvatarProps`, and a `<ModuleMascot>` in the module. A new character is an id in `MASCOT_CHARACTERS`, its label, and a `Look` in `looks.ts` — no scene changes, no migration (the column is free text, validated by Zod).
- **AI spend is the app's own count.** An individual Claude Console account
  cannot read its balance or key expiry through the Admin API, so each call's
  `usage` is priced at the list rates in [`lib/ai/models.ts`](../../lib/ai/models.ts)
  (cache writes 1.25× input) and summed by calendar month against
  `MONTHLY_AI_CREDIT_USD` ($100, Max 5x). Console's balance is the exact
  figure. The key's expiry is typed in by an admin; `lib/ai/key-expiry.ts`
  turns it into reminder stages (30, 20 and 10 days out, then daily, then
  daily once expired), each named after the expiry date so a new key starts
  over, and each shown once per browser (`localStorage`).

