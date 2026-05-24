# Typography

> Single source of truth for typography in Allstars Galaxy. If you change
> anything about how text looks across the app, change it here and update the
> primitives in [`components/ui/typography.tsx`](../components/ui/typography.tsx)
> in the same commit.

The system is modeled on Vercel's Geist Design System: **Geist Sans** for UI
and body, **Geist Mono** for code, numerics, and identifiers, with tight
negative letter-spacing on large headings and tabular numerals on data.

---

## TL;DR for agents

When writing or modifying UI:

1. **Default font is already Geist Sans** — applied to `<body>` in
   [`app/globals.css`](../app/globals.css). Do not add `font-sans` to every
   element; only use it to override `font-mono`.
2. **Use the primitives in [`@/components/ui/typography`](../components/ui/typography.tsx)**
   (`Heading`, `Text`, `Eyebrow`, `Code`, `Mono`) instead of writing raw
   `text-* font-* tracking-*` chains. They encode the scale below.
3. **For numbers, IDs, hashes, timestamps, code → `font-mono tabular-nums`**
   (or the `<Mono>` / `<Code>` components). Mixing proportional digits in
   columns of numbers misaligns them.
4. **Never set a font family.** No `font-serif`, no inline `style={{ fontFamily }}`,
   no custom `@font-face`. The two families above are the only allowed families.
5. **Never load another font** via `next/font/google` or `<link>`. If you think
   you need one, ask the user first.

---

## Font families

| Family       | CSS variable           | Tailwind utility | When to use                                  |
| ------------ | ---------------------- | ---------------- | -------------------------------------------- |
| Geist Sans   | `--font-geist-sans`    | `font-sans`      | Everything by default — headings, UI, body   |
| Geist Mono   | `--font-geist-mono`    | `font-mono`      | Code, IDs, hashes, deployment URLs, numerics |

Both are loaded via the `geist` package in [`app/layout.tsx`](../app/layout.tsx)
and exposed through the Tailwind `@theme` block in
[`app/globals.css`](../app/globals.css) as `--font-sans` and `--font-mono`
(which fall back to the system stack if the Geist files fail to load).

OpenType features enabled globally on `<body>`:

- `rlig`, `calt` — required & contextual ligatures
- `ss01`, `cv11` — Geist's stylistic alternate for a single-storey `a` and
  disambiguated `1`/`I`/`l` (matches vercel.com)

`font-variant-numeric: tabular-nums` is applied to `code`, `kbd`, `samp`,
`pre`, and any element with the `.tabular-nums` class or `font-mono` utility.

---

## The scale

### Headings — use `<Heading level="…">`

| Level     | Size (mobile → desktop) | Weight | Tracking  | Leading | Default tag | Use it for                          |
| --------- | ----------------------- | ------ | --------- | ------- | ----------- | ----------------------------------- |
| `display` | 48 → 60 → 72 px         | 700    | -0.04em   | 1.05    | `h1`        | Landing hero only                   |
| `h1`      | 36 → 48 px              | 700    | -0.03em   | 1.10    | `h1`        | Page titles                         |
| `h2`      | 30 → 36 px              | 600    | -0.025em  | 1.15    | `h2`        | Major section headings              |
| `h3`      | 24 px                   | 600    | -0.02em   | 1.20    | `h3`        | Subsection headings                 |
| `h4`      | 20 px                   | 600    | -0.015em  | 1.30    | `h4`        | Card titles                         |
| `h5`      | 18 px                   | 600    | -0.01em   | 1.40    | `h5`        | Small card titles, dialog titles    |
| `h6`      | 16 px                   | 600    | normal    | 1.50    | `h6`        | List-item headings, table captions  |

```tsx
import { Heading } from "@/components/ui/typography";

<Heading level="display">Allstars Galaxy</Heading>
<Heading level="h1">Deployments</Heading>
<Heading level="h2">Recent activity</Heading>
<Heading level="h4" as="div">Card title</Heading>   // change the rendered tag
```

The `level` prop controls visual style; `as` controls the rendered HTML tag
(so a card title styled as `h4` can still be rendered as a `div` for semantic
correctness inside an interactive card).

### Body & supporting text — use `<Text variant="…">`

| Variant   | Size  | Weight | Color              | Use it for                                |
| --------- | ----- | ------ | ------------------ | ----------------------------------------- |
| `lead`    | 18→20 | 400    | `muted-foreground` | Lead paragraph under a page title         |
| `body-lg` | 16    | 400    | `foreground`       | Long-form reading paragraphs              |
| `body`    | 14    | 400    | `foreground`       | **Default body text in the portal**       |
| `muted`   | 14    | 400    | `muted-foreground` | Secondary body, descriptions, hints       |
| `small`   | 12    | 400    | `muted-foreground` | Captions, helper text, table footnotes    |

```tsx
import { Text } from "@/components/ui/typography";

<Text variant="lead">Track every deployment in one place.</Text>
<Text>Default 14px body copy.</Text>
<Text variant="muted">Created 15m ago by Jason.</Text>
<Text variant="small" weight="medium">3 recommendations</Text>
```

### Eyebrows — use `<Eyebrow>`

Small uppercase labels above section headings (e.g., the "FINANCE",
"PRODUCTIVITY" labels on the landing page).

```tsx
<Eyebrow>Finance</Eyebrow>
<Heading level="h2">Track your portfolio</Heading>
```

Equivalent classes: `text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground`.

### Code, IDs, and numerics — use `<Code>` / `<Mono>`

| Component | Renders | Use it for                                                   |
| --------- | ------- | ------------------------------------------------------------ |
| `<Code>`  | `<code>` with subtle background | Inline code, env-var names, short identifiers |
| `<Mono>`  | `<span>` with `font-mono tabular-nums`, no background | Numbers in tables, hashes, durations, timestamps, deploy URLs |

```tsx
<Code>DATABASE_URL</Code>
<Mono>5c6ae72</Mono>
<Mono>$1,234.56</Mono>
```

For tables of numbers, prefer adding `tabular-nums` to the `<td>` rather than
wrapping each cell.

---

## Common patterns

### Page header

```tsx
<div>
  <Heading level="h1">Deployments</Heading>
  <Text variant="muted" className="mt-2">
    History of every production build.
  </Text>
</div>
```

### Card

```tsx
<Card>
  <CardHeader>
    <Heading level="h4" as="h3">Total balance</Heading>
    <Text variant="small">Updated 2 minutes ago</Text>
  </CardHeader>
  <CardContent>
    <Mono className="text-3xl font-semibold tracking-tight">
      $12,480.55
    </Mono>
  </CardContent>
</Card>
```

### Section on a marketing page

```tsx
<section>
  <Eyebrow>Finance</Eyebrow>
  <Heading level="h2" className="mt-3">
    Everything in one snapshot
  </Heading>
  <Text variant="lead" className="mt-4 max-w-xl">
    Portfolios, cash, and obligations consolidated nightly.
  </Text>
</section>
```

### Table row with numeric data

```tsx
<tr className="tabular-nums">
  <td>Vercel</td>
  <td className="font-mono">vcl_abc123</td>
  <td className="text-right">$420.00</td>
</tr>
```

---

## Do's and don'ts

### Do

- Reach for `<Heading>` and `<Text>` first. If they don't cover the case,
  extend them — don't write a one-off.
- Use `text-balance` on headings shorter than ~3 lines (already on by
  default in `<Heading>`).
- Use `text-muted-foreground` (or `<Text variant="muted">`) for any
  secondary text; don't reach for `text-gray-500` or `text-neutral-600`.
- Apply `tabular-nums` to any column of numbers — totals, durations, dates,
  prices, percentages.

### Don't

- ❌ Don't use the old `text-neutral-900` / `text-neutral-600` color tokens
  hard-coded in landing components. Migrate them to `text-foreground` /
  `text-muted-foreground` so dark mode works.
- ❌ Don't introduce new font families. The system is Geist Sans + Geist Mono.
- ❌ Don't use arbitrary tracking values like `tracking-[-0.027em]` outside
  the scale above. If you genuinely need a new step, add it to the
  `headingVariants` table here and document it.
- ❌ Don't mix `font-bold` with the `display` or `h1` levels — they're
  already 700.
- ❌ Don't use `text-base` for body copy in the portal — the default is
  `text-sm` (14px). `text-base` is reserved for `body-lg` / marketing pages.

---

## Where things live

| File                                         | Role                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| [`app/layout.tsx`](../app/layout.tsx)        | Loads Geist Sans + Mono, applies CSS variables          |
| [`app/globals.css`](../app/globals.css)      | Maps `--font-sans` / `--font-mono` into Tailwind theme, sets base body styles & OpenType features |
| [`components/ui/typography.tsx`](../components/ui/typography.tsx) | `Heading`, `Text`, `Eyebrow`, `Code`, `Mono` primitives — the scale lives here in CVA variants |
| [`docs/TYPOGRAPHY.md`](./TYPOGRAPHY.md)      | This file — the human-readable spec                     |

---

## Changing the system

1. Edit the relevant `cva` variant in
   [`components/ui/typography.tsx`](../components/ui/typography.tsx).
2. Update the matching row in the **Scale** table above.
3. If you add a new variant, add a row, a code example, and a do/don't note.
4. Commit code + docs in the same change.

If you're rewriting the system from scratch (new font, new scale), do it
behind a single PR that updates: `app/layout.tsx`, `app/globals.css`,
`components/ui/typography.tsx`, and this file.
