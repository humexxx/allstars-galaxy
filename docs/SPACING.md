# Spacing & layout

The companion to [`TYPOGRAPHY.md`](./TYPOGRAPHY.md): how padding, margin, gap and
the app-shell offsets are standardized. **Read this before adding spacing to any
UI.**

## TL;DR

1. **Reuse the Tailwind scale. Never use arbitrary `[...]` spacing.** No
   `p-[13px]`, no `mt-[22px]`, no `gap-[10px]`. The base unit is **4px** (`1` =
   `0.25rem`); every spacing utility is a multiple of it. If a one-off value
   feels necessary, you're almost always reaching for the wrong step — pick the
   nearest scale step instead.
2. **The portal rhythm is the `*-6` (24px) / `*-2` (8px) family.** `gap-6` /
   `space-y-6` separate sections; `gap-2`–`gap-4` separate items within a row or
   list; `p-4`–`p-6` pad cards. Prefer the common steps **`1 2 3 4 6 8 12`**;
   reach for larger steps (**`16 24`**) only on the marketing landing, which
   breathes at a bigger rhythm than the dense portal.
3. **Page padding is centralized — don't reinvent it per page.** Every portal
   route renders [`PortalPageContainer`](../components/portal/page-container.tsx),
   which owns the outer padding and max-width. Put page content inside it; don't
   add your own outer `px-*`/`py-*` shell on a page.

## Page content container

[`components/portal/page-container.tsx`](../components/portal/page-container.tsx)
is the single source of truth for page-level padding and width:

```
mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-12
```

- **Horizontal:** `px-4 sm:px-8 lg:px-12` (16 → 32 → 48px gutters).
- **Vertical:** `py-6 sm:py-8` (24 → 32px top/bottom).
- **Section rhythm:** `gap-6` (24px) between direct children.
- **Width:** set by the `width` prop — `"default"` = `max-w-5xl` (reading width),
  `"wide"` = `max-w-7xl` (data surfaces), `"full"` = `max-w-none`.

The string is **mobile-first**: the unprefixed step is the phone value and `sm:`
pins the desktop one. If you ever retune it, step the base down from desktop —
don't leave a single unprefixed value that phones inherit (see the
[responsive-ui skill](../.github/skills/responsive-ui/SKILL.md)).

### Where to render it

**Each route renders its own container and declares its width.** It used to sit
in `app/portal/layout.tsx` and sniff `usePathname()` to widen `/portal/plans`,
which buried a list of special-cased routes inside the shared shell and forced
the whole container to be a client component. Now:

- Several routes under one segment share a width → put it in that segment's
  `layout.tsx` (see `app/portal/{entertainment,productivity,admin}/layout.tsx`,
  and `app/portal/plans/layout.tsx` for `width="wide"`).
- A one-off route → wrap the page's own return.

Exactly one container per route: nesting two would double the padding.
Never fork the padding string — change the width, not the gutters.

## App-shell offsets (header + sidebar)

These three values are coupled — change one, change the others:

| Piece | Value | Where |
| --- | --- | --- |
| Header height | `h-14` (56px) | [`app-header.tsx`](../components/app-header.tsx) |
| Sidebar top offset | `top-14` + `h-[calc(100svh-3.5rem)]` | [`app-sidebar.tsx`](../components/app-sidebar.tsx) |
| Sidebar content top breathing | `pt-18` (72px) | [`app-sidebar.tsx`](../components/app-sidebar.tsx) |
| Sidebar left inset | `px-2` (8px) | [`app-sidebar.tsx`](../components/app-sidebar.tsx) |
| Sidebar nav row height / gap | `h-8` / `gap-0.5` | [`app-sidebar.tsx`](../components/app-sidebar.tsx) |

The header has **no bottom border** and the sidebar has **no right border** — the
shell reads as one flat surface (the shadcn-docs look), separated only by space.
The `h-[calc(...)]` on the sidebar is the one sanctioned arbitrary value: it's a
computed height, not a spacing step.

## Cards & sections

- Card padding comes from the shadcn `Card`/`CardHeader`/`CardContent`
  primitives — don't override it with custom `p-*` unless a design genuinely
  needs it.
- Stack related blocks with `space-y-4`/`space-y-6`; lay rows out with
  `gap-2`/`gap-3`/`gap-4`.

## Adding a new step

Don't. Use the nearest existing scale step. If a recurring need is real (e.g. a
new shell offset), add it as a documented value here and in the owning component
— never as a scattered arbitrary `[...]` value.
