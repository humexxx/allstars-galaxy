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
3. **An `overflow-x` rail MUST also be `relative`.** `overflow` only clips
   descendants whose containing block is inside the scroller. Anything
   `position: absolute` — including Tailwind's `sr-only`, which every icon
   button ships — resolves against the nearest *positioned* ancestor instead.
   In the portal that is `SidebarInset`, so the labels paint at their full
   un-scrolled x offset, inflate the document's scroll width and the **entire
   page** scrolls sideways on phones. Measured on the task board: document
   `scrollWidth` 882px on a 375px viewport; adding `relative` to the rail →
   375px. `min-w-0` on the shell does **not** fix this (the inset is already
   375px wide — the overflow is painted, not laid out), and `overflow: hidden`
   higher up only masks it. The shadcn `Table` primitive already gets this
   right — copy it: `relative w-full overflow-x-auto`.
4. **Dev-tool helpers need a stable identity.** `useRegisterDevTool` re-registers
   on identity change; an inline object loops. Build it once with
   `useState(() => ({...}))` (not `useMemo(() => ({...}), [])`, which the React
   Compiler lint rejects when deps are empty).

## Auditing every portal route at once (preferred)

Portal pages are behind Supabase auth and you must **not** type a password
yourself — but you don't have to. The Playwright setup project already logs the
dedicated test user in from `.env.test` and persists `playwright/.auth/user.json`,
so a throwaway spec inherits a real session and can walk **every** authenticated
route unattended:

```ts
// e2e/zz-audit.spec.ts — delete before committing
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

test("audit", async ({ page }) => {
  test.setTimeout(600_000); // the config's 30s per-test cap kills a multi-route walk
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    await page.screenshot({ path: `/tmp/audit/${route.replace(/\//g, "_")}.png`, fullPage: true });
  }
});
```

Run it with `npx playwright test e2e/zz-audit.spec.ts --project=chromium`.
`document.scrollWidth - clientWidth` is the single best regression signal: it
should be **0 on every route**. A full-page screenshot wider than 375px means
something escaped the shell.

Two measurement traps:

- **`getBoundingClientRect()` is not the tap target.** `Switch` and
  `RadioGroupItem` render small but extend their hit area with
  `after:-inset-x-3 after:-inset-y-2`, so a 32×18 switch is really 56×34. Judge
  a target by clicking at an offset, not by its box.
- **`document.elementFromPoint()` does not report pseudo-element hits** in
  Chromium — it returns whatever sits underneath, so a probe built on it will
  report those extended hit areas as failures. Real pointer events *do* dispatch
  to the originating element; confirm with `page.mouse.click()` and assert the
  state changed.

Remember to **delete the spec** (and `test-results/`) when you're done, and undo
any state the audit toggled on the test user.

## Verifying a single widget without auth

When you only need to measure one component's spacing/sizes:

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
- [ ] Any `overflow-x` rail is `relative`, has `py-*` room, and no negative
      vertical margin.
- [ ] Interactive controls are ≥36px on phones (`size-9`); where a control is
      denser on desktop, step it *up* for mobile (`size-9 sm:size-8`), never
      down. Icon-only links need padding — a bare `size-5` mark is a 20px tap
      target.
- [ ] Checked the page at 375px wide and `document.scrollWidth === 375`.
- [ ] Measured the result in the browser; threw away the test route.
- [ ] If the type scale itself changed, update `docs/TYPOGRAPHY.md` in the same commit.
