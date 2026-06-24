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
   page is wrapped by [`PortalPageContainer`](../components/portal/page-container.tsx),
   which owns the outer padding and max-width. Put page content inside it; don't
   add your own outer `px-*`/`py-*` shell on a page.

## Page content container

[`components/portal/page-container.tsx`](../components/portal/page-container.tsx)
is the single source of truth for page-level padding and width:

```
mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-8 sm:px-8 lg:px-12
```

- **Horizontal:** `px-6 sm:px-8 lg:px-12` (24 → 32 → 48px gutters).
- **Vertical:** `py-8` (32px top/bottom).
- **Section rhythm:** `gap-6` (24px) between direct children.
- **Width:** `max-w-5xl` by default, `max-w-7xl` for the wide finance/plans
  surfaces, `max-w-none` when `fullWidth`.

If a page needs different width, pass `fullWidth`/rely on the route check inside
the container — don't fork the padding string.

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
