---
name: responsive-ui
description: Build mobile-first responsive UI in Allstars Galaxy without regressing desktop. Use when a screen "feels too big / too cramped on mobile", when adding cards/rails/headers that must reflow on phones, or when touching typography sizes. Encodes the type scale, the layout patterns we use, the Tailwind-v4 gotchas that have bitten us, and how to verify layout without auth.
---

# Responsive UI Workflow

Mobile-first conventions for this app. The portal switches to multi-column
layouts at the **`sm` breakpoint (640px)**, so `sm:` is the "desktop" step for
most portal work; `lg:` (1024px) is the wide step.

## Golden rule

**Pin the desktop value, step the mobile (base) value down from it.** Write the
size you want at ≥640px as `sm:…` and a smaller base class for phones. This
guarantees desktop is unchanged while phones get denser. Example:
`text-xl sm:text-2xl` (20 → 24). Never leave a single fixed large class on a
heading/stat — it will look oversized on phones.

## Typography

Use the primitives in [`@/components/ui/typography`](../../../components/ui/typography.tsx)
(`Heading`, `Text`, …). The `Heading` levels are already responsive
(mobile → desktop) — see [`docs/TYPOGRAPHY.md`](../../../docs/TYPOGRAPHY.md) for
the full table. Don't re-add fixed sizes on top.

- Headings → `<Heading level="h3">` (h3 = 20→24, etc.). Override only weight
  (`className="font-bold"`), never the size.
- **Hero numbers / KPI stats** are *not* headings — apply the same pattern to a
  `<p>`/`<Mono>`: `text-lg sm:text-xl lg:text-2xl` for a card's main figure,
  `text-base sm:text-lg` for a secondary stat.
- Body/`muted`/`small` are already phone-appropriate (≤14px) — leave them.

## Layout patterns we use

- **Compact mobile variant of a hero widget** (e.g. the financial-health donut):
  render two instances — a small one inline (`sm:hidden`) and the full one in
  its desktop slot (`hidden sm:block`). Give the component a `size` / `showFooter`
  prop instead of forking markup.
- **Pin an element top-right next to a title on mobile**: put title + element in
  one row with `flex items-start justify-between gap-3` (NO `flex-wrap`), give the
  title block `min-w-0` so it shrinks, and the element `shrink-0`. Hide the
  element's widest sub-line on phones (`hidden sm:flex`) so it stays narrow.
- **Horizontal-scroll card rail with a peek** (signals "more to scroll"): on
  mobile `flex gap-3 overflow-x-auto snap-x` with each card `w-[44%] shrink-0
  snap-start`; from `sm` up `sm:grid sm:grid-cols-2 lg:grid-cols-4`. ~44% width
  shows two cards plus a quarter of the third.

## Gotchas (these have actually bitten us)

1. **`overflow-x-auto` clips the cross axis too.** A horizontal rail will shave
   the top/bottom ring + shadow of its cards. Fix with vertical padding
   (`py-1`) for breathing room.
2. **Never use a negative *vertical* margin to offset that padding.** Tailwind v4
   `space-y-*` spaces siblings via `margin-bottom` on non-last children, and a
   `-m-1` / `-my-1` *overrides* that margin-bottom → the next section collapses
   flush against the rail. Use horizontal-only negatives: `-mx-1 px-1` (cancels,
   no shift) **plus** `py-1` (no negative). Verified: this keeps the 24px
   `space-y-6` gap (measured 28px = 24 + 4px padding) vs ~0 with `-m-1`.
3. **Dev-tool helpers need a stable identity.** `useRegisterDevTool` re-registers
   on identity change; an inline object loops. Build it once with
   `useState(() => ({...}))` (not `useMemo(() => ({...}), [])`, which the React
   Compiler lint rejects when deps are empty).

## Verifying layout without auth

Portal pages are behind Supabase auth and you must **not** enter passwords to log
in. To measure spacing/sizes:

1. Create a throwaway **public** route (anything outside `/portal/`, e.g.
   `app/spacing-check/page.tsx`) that reproduces the exact markup/classes. Wrap a
   sub-tree in `style={{ maxWidth: 390 }}` to simulate a phone if the preview
   viewport is wider.
2. The user's `pnpm dev` already runs on `:3010` (the dev wrench is visible in
   their screenshots) and hot-reloads the new route. Next 16 refuses a second dev
   server in the same dir, so drive the user's existing one via the Chrome MCP
   (`navigate` to `http://localhost:3010/spacing-check`, then `javascript_tool`
   to read `getComputedStyle(...).fontSize` / `getBoundingClientRect()`).
3. Note the page viewport may be pinned (~502px) by a side panel — that's still
   `< 640`, so mobile classes apply; use a `maxWidth` wrapper for narrower checks.
4. **Delete the throwaway page** before committing.

## Checklist

- [ ] Desktop (≥640px) sizes/spacing unchanged — diff only adds `sm:`/base steps.
- [ ] Headings via `<Heading>`; hero numbers use the mobile-first stat pattern.
- [ ] Any `overflow-x` rail has `py-*` room and no negative vertical margin.
- [ ] Measured the result in the browser; threw away the test route.
- [ ] If the type scale itself changed, update `docs/TYPOGRAPHY.md` in the same commit.
