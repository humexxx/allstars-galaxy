---
name: data-density-ui
description: Polymarket-inspired patterns for dense, scannable data UIs in Allstars Galaxy. Use when designing or refreshing a page that surfaces lots of small data units (markets, plans, holdings, tasks, matches), needs a hero/featured slot + browseable grid, when a chart should "breathe" instead of sitting in a heavy card, or whenever a screen "feels empty/airy" and we want trader-grade density without losing shadcn discipline. Encodes how information presents (KPI rails, delta indicators, multi-outcome rows, chart anatomy, two-up selectors) — NOT new components.
---

# Data-Density UI

This skill encodes the patterns we lifted from polymarket.com and adapted to
Allstars Galaxy.

**Two non-negotiables:**

1. **Reuse the shadcn primitives we already have.** Don't invent new
   components or wrappers. `Card`, `Button`, `Badge`, `Tabs`, `Separator`,
   `Table`, `ChartContainer` — that's the kit. The skill is about how to
   *compose* and *populate* them, not what to add to `components/ui/`.
2. **We keep the OKLch palette.** Light/dark tokens stay. Semantic accents
   (emerald / rose) are imported from Tailwind directly, used at low alpha,
   layered on top of our tokens — never replacing `--primary` / `--background`.

What we copy from Polymarket is **information presentation**: density,
hierarchy, where numbers go, where deltas go, how charts breathe, how a row
collapses to its essentials.

Read [`docs/TYPOGRAPHY.md`](../../../docs/TYPOGRAPHY.md) and
[`.github/skills/responsive-ui/SKILL.md`](../responsive-ui/SKILL.md) first —
those still own typography and the mobile-first breakpoint rules. This skill
adds the **composition layer** on top.

> Source captures: `screenshots/polymarket-*.jpeg` referenced in
> [`docs/design/polymarket-inspiration.md`](../../../docs/design/polymarket-inspiration.md)
> if you need to look at the originals.

---

## The core idea

Polymarket packs huge amounts of data into a calm grid by being **disciplined
about four things**:

1. **One card = one decision.** Every card carries enough context to act on
   without opening it (title + a couple of rows of state + outcome controls
   inline + footer metadata).
2. **Numerics are the hero.** Big tabular-num figures dominate; labels are
   small and muted. No decorative chrome around numbers.
3. **Grid + featured slot.** A 2/3 hero featured item + 1/3 sidebar list on
   desktop; both collapse cleanly on mobile.
4. **Persistent navigation rails, never modal.** Category nav stays visible
   on the left at sm+; on detail pages a sticky right-rail holds the primary
   action so the user never scrolls to commit.

All four are mobile-first: every desktop layout has a stacked equivalent.

---

## The pattern library

### 1. Data card (the workhorse)

The unit you'll use most. Replaces our mixed bag of `Card` + ad-hoc layouts
with one canonical anatomy.

```
┌─ icon ─ title ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                                       │
│  row label                                metric pill │
│  row label                                metric pill │
│                                                       │
├───────────────────────────────────────────────────────┤
│  footer meta · meta · meta              … actions     │
└───────────────────────────────────────────────────────┘
```

Compose with shadcn primitives only:

```tsx
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heading, Mono, Text } from "@/components/ui/typography";

<Card className="group/card transition-colors hover:border-foreground/20">
  <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
    <Avatar className="size-6 rounded-md">{/* icon/logo */}</Avatar>
    <Heading level="h6" as="h3" className="line-clamp-2 min-w-0 flex-1">
      {title}
    </Heading>
  </CardHeader>

  <CardContent className="space-y-2 py-2">
    {rows.map(r => (
      <div key={r.label} className="flex items-center justify-between gap-3">
        <Text variant="small" className="truncate">{r.label}</Text>
        <Mono className="text-sm font-semibold tabular-nums">{r.value}</Mono>
      </div>
    ))}
  </CardContent>

  <CardFooter className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
    <span className="font-mono tabular-nums">{footerMeta}</span>
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
      {/* secondary actions */}
    </div>
  </CardFooter>
</Card>
```

Rules:

- Title uses `Heading level="h6"` (14→16) and clamps to 2 lines (`line-clamp-2`).
- Body rows are `flex items-center justify-between` — label on the left
  (`Text variant="small"`, muted, truncates), value on the right
  (`Mono` + `tabular-nums` + `font-semibold`).
- Footer text is **always** mono (volumes, ids, timestamps) and uses
  `text-xs text-muted-foreground`.
- Hover surfaces actions: keep them `opacity-0` and reveal with
  `group-hover/card:opacity-100`. Use the `/card` group label so nested
  groups (button, row) don't collide.
- Padding: lean on shadcn defaults (`p-6` total). For a denser variant pass
  `className="[&>*]:px-4 [&>*]:py-3"`.

### 2. Two-up outcome selector

The signature Polymarket affordance: two equal pills with semantic tint.
Replaces our previous "stacked buttons + label" patterns.

Use it whenever the user picks between two mutually-exclusive options
(Yes/No, Buy/Sell, Pay debt / Invest, Pass / Fail, Won / Lost).

```tsx
import { Button } from "@/components/ui/button";

<div className="grid grid-cols-2 gap-2">
  <Button
    variant="outline"
    className="h-12 justify-between border-emerald-500/30 bg-emerald-500/10 px-4 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
    onClick={onPickYes}
  >
    <span className="font-semibold">Yes</span>
    <span className="font-mono tabular-nums text-sm opacity-80">{yesValue}</span>
  </Button>

  <Button
    variant="outline"
    className="h-12 justify-between border-rose-500/30 bg-rose-500/10 px-4 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
    onClick={onPickNo}
  >
    <span className="font-semibold">No</span>
    <span className="font-mono tabular-nums text-sm opacity-80">{noValue}</span>
  </Button>
</div>
```

- **Always semantic.** Green = positive/Yes/buy/up. Rose = negative/No/sell/down.
  Don't tint a non-binary choice — fall back to two `outline` buttons in
  `bg-muted/50`.
- Height is `h-12` — chunky enough to feel like a primary action without
  becoming the dominant element on the card.
- Right-side number is the secondary affordance (price / probability /
  payoff). Mono, tabular, slightly muted (`opacity-80`).

### 3. KPI rail

The horizontal strip of stats above a main content area. We have several
ad-hoc versions; this is the canonical one.

```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  {kpis.map(k => (
    <Card key={k.label} className="gap-1 py-3">
      <CardHeader className="pb-0">
        <Text variant="small" className="uppercase tracking-wide">
          {k.label}
        </Text>
      </CardHeader>
      <CardContent className="pt-0">
        <Mono className="text-xl font-semibold tabular-nums sm:text-2xl">
          {k.value}
        </Mono>
        {k.delta && (
          <Text
            variant="small"
            className={k.delta.positive ? "text-emerald-600" : "text-rose-600"}
          >
            {k.delta.positive ? "↑" : "↓"} {k.delta.label}
          </Text>
        )}
      </CardContent>
    </Card>
  ))}
</div>
```

- **2 cols on mobile, 4 on `sm+`.** Don't go to 3 — odd column counts produce
  orphan rows on tablets.
- Label is `Text variant="small"` uppercase with `tracking-wide`. **Not** an
  `Eyebrow` — eyebrows belong above section headings, not on tiles.
- Value is `Mono`, `text-xl sm:text-2xl`, `font-semibold` — applies the
  mobile-first stat pattern from `responsive-ui`.
- Delta line uses emerald/rose for positive/negative — never the destructive
  token (that's for irreversible actions, not "you lost money this week").

### 4. Featured + list hero

The home/dashboard top section: a big featured item on the left, a stacked
list on the right.

```tsx
<div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
  <Card className="overflow-hidden">{/* featured */}</Card>

  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
      <Heading level="h5">Breaking news</Heading>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/news"><ChevronRight className="size-4" /></Link>
      </Button>
    </CardHeader>
    <Separator />
    <CardContent className="divide-y p-0">
      {items.map((it, i) => (
        <Link
          key={it.id}
          href={it.href}
          className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50"
        >
          <Mono className="w-4 text-xs text-muted-foreground tabular-nums">
            {i + 1}
          </Mono>
          <Text variant="small" className="line-clamp-2 flex-1 font-medium">
            {it.title}
          </Text>
          <Mono className="text-xs text-muted-foreground tabular-nums">
            {it.value}
          </Mono>
        </Link>
      ))}
    </CardContent>
  </Card>
</div>
```

Rules:

- On mobile the right list **stacks below** the featured card. Don't try to
  squeeze it into a sidebar on small screens.
- Each row: index (mono), title (truncate to 2 lines), trailing metric (mono).
  No avatars on this list pattern — the featured card is the visual anchor.
- Divide rows with `divide-y` (shadcn `border-border`), not gaps. Whitespace
  is reserved for the outer grid.

### 5. Sticky right rail (commit panel)

On detail pages where the user takes a single primary action (save plan, log
a transaction, claim a task), pin the action panel to a sticky right rail at
`lg+`. On smaller screens it stacks at the bottom or collapses to a
bottom-fixed bar.

```tsx
<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
  <main>{/* main content */}</main>

  <aside className="lg:sticky lg:top-20 lg:self-start">
    <Card>
      <CardHeader>
        <Heading level="h5">{action.title}</Heading>
        <Text variant="muted">{action.subtitle}</Text>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* primary control(s) */}
      </CardContent>
      <CardFooter>
        <Button size="lg" className="w-full">{action.cta}</Button>
      </CardFooter>
    </Card>
  </aside>
</div>
```

- **Width is fixed at 320px** on `lg+`. Don't use `fr` — the rail must be
  predictable so the main column doesn't reflow as content changes.
- **Top offset = `top-20`** to clear the sticky AppHeader (currently ~64px).
  If the header changes, update the token and grep this skill for users.
- Below `lg`, the rail flows in normal grid order (after the main column).
  If the action is critical, render an additional fixed bottom bar on `sm`
  and below — see the existing pattern in `components/finance/plan-editor.tsx`.

### 6. Category nav strip

Horizontal scroll tabs (like Polymarket's Trending / Politics / Sports
strip). Use it for **filter taxonomies**, not for primary nav (primary nav
stays in the sidebar).

```tsx
<div className="-mx-1 overflow-x-auto px-1">
  <div className="flex items-center gap-1">
    {categories.map(c => (
      <Button
        key={c.key}
        variant="ghost"
        size="sm"
        data-active={active === c.key}
        className="shrink-0 rounded-full data-[active=true]:bg-foreground/5 data-[active=true]:text-foreground"
        onClick={() => setActive(c.key)}
      >
        {c.label}
      </Button>
    ))}
  </div>
</div>
```

- Pills, not underlined tabs. Underlined tabs (shadcn `Tabs`) are for
  **page-mode switches** (Market / Player Stats / Standings). Pills are for
  **filter chips** (All / Sports / Politics / Crypto).
- Active state uses `data-active` + Tailwind variant rather than conditional
  classes — easier to scan in JSX.
- Outer wrapper has `-mx-1 px-1` so the focus ring isn't clipped by
  `overflow-x-auto` (see `responsive-ui` gotcha #2).

### 7. Delta indicator (the change-vs-prior pill)

The tiny inline trend marker on every Polymarket outcome row. Use it whenever
you show a metric alongside its change since a prior period — portfolio
positions, plan net worth vs. last month, debt remaining vs. starting balance,
sports standings delta.

```tsx
import { TrendingDown, TrendingUp } from "lucide-react";
import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

function Delta({ value, format = "percent" }: { value: number; format?: "percent" | "currency" }) {
  if (value === 0) return null;
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const formatted =
    format === "percent"
      ? `${Math.abs(value).toFixed(1)}%`
      : `$${Math.abs(value).toLocaleString()}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      <Icon className="size-3" />
      <Mono className="tabular-nums">{formatted}</Mono>
    </span>
  );
}

// usage
<div className="flex items-baseline gap-2">
  <Mono className="text-2xl font-semibold tabular-nums">95%</Mono>
  <Delta value={9} />
</div>
```

Rules:

- Always `inline-flex` next to the metric — never a separate row, never a
  badge with chrome.
- The icon is `lucide-react`'s `TrendingUp` / `TrendingDown` at `size-3`. No
  bullets, no triangles, no arrows.
- **Sign goes in the icon, not the value.** Format the value as absolute
  (`9%`, not `+9%` or `-9%`) and let the icon + color carry direction.
- Zero deltas render nothing — don't show "0%" or "no change". A missing
  delta is itself information ("steady").
- For tables and dense lists, use `text-xs`. For KPI tiles where the delta
  is the secondary line under a hero number, scale to `text-sm`.

### 8. Multi-outcome row (the candidate / option list pattern)

The Polymarket "Abiy Ahmed 95% ▲ 9% [Buy Yes 99.8¢] [Buy No 10.1¢]" row.
We use it for any list where each row is one item with: identity (avatar +
label + sub-meta), a hero metric with delta, and one or two trailing
actions.

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mono, Text } from "@/components/ui/typography";

<div className="divide-y">
  {items.map(item => (
    <div key={item.id} className="flex items-center gap-3 py-3">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={item.image} alt="" />
        <AvatarFallback>{item.initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <Text className="truncate font-medium">{item.name}</Text>
        <Mono className="text-xs text-muted-foreground tabular-nums">
          {item.subMeta}
        </Mono>
      </div>

      <div className="flex items-baseline gap-2">
        <Mono className="text-xl font-semibold tabular-nums">{item.value}</Mono>
        <Delta value={item.delta} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/* Two-up outcome selector at button-sm scale, see §2 */}
      </div>
    </div>
  ))}
</div>
```

Rules:

- Avatar is `size-10` (40px) — bigger than the §9 compact-list avatar
  (`size-6`) because this row is the primary scan unit on the page.
- `divide-y` (no card, no border per row) — the row is the visual unit, the
  divider its separator. Don't wrap each row in a Card.
- Sub-meta (volume, last-update, ticker, etc.) is always Mono and muted,
  one size smaller than the name. This is where Polymarket puts "$5,715 Vol."
- Hero metric is `text-xl sm:text-2xl` Mono semibold — same scale as KPI
  tiles. The delta sits to its right at `text-xs`.
- On mobile (< sm), the trailing buttons stack below the row — wrap the
  identity block + metric in one row, the buttons in a second:
  `<div className="flex flex-col gap-2 sm:flex-row sm:items-center">`.

### 9. Compact list row (the "comments / recent activity" pattern)

```tsx
<div className="flex items-start gap-3 py-2">
  <Avatar className="size-6 shrink-0" />
  <div className="min-w-0 flex-1">
    <div className="flex items-baseline gap-2">
      <Text className="font-medium">{author}</Text>
      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
        {tag}
      </Badge>
      <Text variant="small" className="ml-auto shrink-0">{when}</Text>
    </div>
    <Text variant="small" className="line-clamp-2">{body}</Text>
  </div>
</div>
```

- Avatars are `size-6` (24px). Larger feels chatty; smaller disappears.
- The trailing timestamp uses `ml-auto` to push to the right of the metadata
  row — never use a separate column for it.

---

### 10. Chart anatomy

Polymarket charts breathe because they are **stripped of chrome**. We use
Recharts via shadcn's `ChartContainer` — same primitive — but we configure
it to follow the same minimal pattern.

**Shape (from top to bottom):**

```
┌─ Inline legend strip ──────────────────────────────────────┐
│  ● Series A 99%   ● Series B 1%   ● Series C 1%             │
│                                                             │
│  [chart body — no card border, just sits on page bg]        │
│                                                            100%
│                                                                
│                                                             75%
│                                                                
│        ─────────────────────────────────────                50%
│                                                                
│                                                             25%
│                                                                
│   ────────────────────────────────────────────●  0%        0%
│                                                                
│  May 3              May 17              May 31              │
├────────────────────────────────────────────────────────────┤
│  🏆 $19,417 Vol. · 📅 Jun 1                  1H 6H 1D 1W 1M ALL │
└────────────────────────────────────────────────────────────┘
```

**Implementation rules:**

```tsx
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

<ChartContainer config={chartConfig} className="h-72 w-full">
  <AreaChart data={data} margin={{ left: 0, right: 48, top: 8, bottom: 0 }}>
    <CartesianGrid
      vertical={false}
      stroke="var(--border)"
      strokeDasharray="3 3"
      strokeOpacity={0.4}
    />
    <XAxis
      dataKey="date"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={48}
      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
    />
    <YAxis
      orientation="right"
      tickLine={false}
      axisLine={false}
      tickMargin={4}
      width={40}
      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
      tickFormatter={(v) => `${v}%`}   // or formatCurrency
    />
    <ChartTooltip
      cursor={{ stroke: "var(--foreground)", strokeWidth: 1, strokeOpacity: 0.3 }}
      content={<ChartTooltipContent indicator="line" />}
    />
    <Area
      dataKey="value"
      type="monotone"
      fill="var(--color-value)"
      fillOpacity={0.15}
      stroke="var(--color-value)"
      strokeWidth={2}
      activeDot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
    />
  </AreaChart>
</ChartContainer>
```

Non-obvious settings (each one matters):

- **`orientation="right"` on Y axis.** Polymarket puts price/percent labels
  on the right because the chart's most-recent value lives at the right
  edge — labels next to where the eye lands. This is THE single change that
  makes our charts look like theirs.
- **`vertical={false}` on CartesianGrid.** Only horizontal gridlines. Vertical
  lines clutter time-series; the X-axis ticks are enough.
- **`fillOpacity={0.15}`** for area charts — Polymarket-light. Our previous
  default (0.4) reads as a solid filled block.
- **`activeDot` with `fill: "var(--background)"` and a colored stroke** —
  hollow dot at the cursor position, not a solid filled circle. Matches the
  data point endpoint look.
- **`margin.right: 48`** to leave room for the right-side Y-axis labels.
  Without it, the rightmost data point clips the "100%" / "$1,234" label.
- **`minTickGap` on X axis (48px)** prevents date label collisions on dense
  series. Don't fight it with `interval` — let Recharts skip naturally.
- **Tick fontSize 11** for both axes. Bigger labels make a chart feel
  juvenile; 11px feels like a Bloomberg terminal in the right way.

**Heading / chrome around the chart:**

- **No card border around the chart itself.** The chart is a hero element;
  it sits on the page background. Surrounding chrome (border, shadow, card
  header with title + icon) makes it feel boxed-in and small.
- If the chart needs context (title, legend, time-range pills), render those
  as **separate flex rows above and below the chart**, not inside a
  `<Card>` shell.
- Legend strip is inline above the chart: `flex items-center gap-4 text-sm`
  with color dots (`size-2 rounded-full`) preceding each label.

**Time-range pills:**

```tsx
const RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;

<div className="flex items-center gap-1">
  {RANGES.map(r => (
    <Button
      key={r}
      variant="ghost"
      size="sm"
      data-active={range === r}
      className="h-7 rounded-full px-2.5 text-xs font-mono tabular-nums text-muted-foreground data-[active=true]:bg-foreground/5 data-[active=true]:text-foreground"
      onClick={() => setRange(r)}
    >
      {r}
    </Button>
  ))}
</div>
```

- Pills not tabs (see §6). Mono numerics — `1H`/`6H`/`1D` reads as a unit,
  not text.
- Active state is the same `data-active` + `bg-foreground/5` pattern as the
  category nav strip.
- **`ALL` always last.** It's the default-ish "everything" view; putting it
  first hides the time-scoped options.

**Footer meta strip** (below the chart, opposite the time pills):

```tsx
<div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
  <div className="flex items-center gap-3 font-mono tabular-nums">
    <span className="inline-flex items-center gap-1">
      <Wallet className="size-3" /> ${volume.toLocaleString()} Vol.
    </span>
    <span className="inline-flex items-center gap-1">
      <Calendar className="size-3" /> {format(date, "MMM d, yyyy")}
    </span>
  </div>
  {/* time-range pills go here on the right */}
</div>
```

**Sparkline variant** (the dashboard mini-chart, fits inside a card):

When the chart is a *supporting* element inside another card (e.g. the
12-month preview on the dashboard finance card), drop the legend, axes,
gridlines, and tooltip. Just the line:

```tsx
<ChartContainer config={config} className="h-24 w-full">
  <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
    <XAxis hide />
    <YAxis hide />
    <Area
      dataKey="value"
      type="monotone"
      fill="var(--color-value)"
      fillOpacity={0.2}
      stroke="var(--color-value)"
      strokeWidth={1.5}
    />
  </AreaChart>
</ChartContainer>
```

- Height 24 (96px) for dashboard sparklines, 18 (72px) for inline-row
  sparklines.
- Stroke 1.5px (not 2) — at small height a 2px stroke dominates.
- No tooltip — the surrounding card already says what the line means.

## Cross-cutting rules

### Density

- **Card padding**: prefer shadcn defaults (`p-6` outer, `p-6 pt-0` body).
  For dense grids (4+ per row), drop to `p-4` / `p-3`.
- **Row padding**: `py-2` for normal rows, `py-3` for clickable rows.
- **Grid gap**: `gap-3` for cards in a grid, `gap-4` for sections, `gap-6`
  for major page regions. Never less than `gap-2` (becomes a list, not a
  grid).

### Color (we keep the OKLch blue palette)

- **Semantic accents** use Tailwind's emerald / rose direct utilities with
  `/10` (background) and `/30` (border) alphas — never override the OKLch
  token system for chart/state colors.
- **Primary CTAs** stay on `--primary` (OKLch blue). The "Trade"-style big
  blue button is already `<Button>` default.
- **Subtle dividers** use `border-border` (token). `Separator` for explicit
  breaks; `divide-y` for stacked rows.
- **Hover surface** uses `bg-muted/50`. Never `bg-gray-*` or `bg-neutral-*`.

### Numerics

- Every number in a data context is `font-mono tabular-nums`. Use `<Mono>`.
- Currency: `$1,234.56` (en-US, two decimals for amounts, integer for
  counts). The Intl formatter is in `lib/utils/format.ts`.
- Percentages and deltas: include the sign for negatives (`−2.4%`) and the
  arrow glyph (`↑ 12%` / `↓ 4%`). Color encodes direction (emerald / rose).

### Iconography

- Use `lucide-react` only. Inline at `size-4` next to text, `size-5` as
  primary affordances, `size-6` for card-header logos.
- Status dots: a `size-2 rounded-full` span — green for active/live, amber
  for warning, rose for error/closed.

### Breakpoints

Defer to `responsive-ui`. The shape of this skill's patterns:

- `< sm` (mobile): everything stacks. Featured-list grid becomes one column,
  KPI rail goes 2 cols, right rail flows after main.
- `sm` (≥640): KPI rail 4 cols, cards 2 cols.
- `lg` (≥1024): card grids 4 cols, sticky right rail appears.

---

## Per-module application map

Where each pattern goes in our codebase. When you refresh a module, follow
this map and link back to the relevant section above.

| Module / Surface | Apply | Notes |
|---|---|---|
| **Portal dashboard** (`app/portal/page.tsx`) | KPI rail (§3) + Featured-list hero (§4) | Top: KPIs for total balance / net change / open plans / favorite count. Hero: featured plan or active trip; list: upcoming items |
| **Finance — Plans list** (`app/portal/plans/page.tsx`) | Data card grid (§1) | Each plan card: monthly cashflow row, debt row, savings row, footer = updated date + horizon |
| **Finance — Plan editor** (`components/finance/plan-editor.tsx`) | KPI rail (§3) for projection summary + Sticky right rail (§5) for strategy picker + dense projection table + **Chart §10** for projection | Projection chart drops its Card chrome and uses right-side Y-axis |
| **Finance — Compare** (`app/portal/plans/compare/page.tsx`) | Side-by-side data cards (§1) with synced row labels + Delta indicator (§7) for plan-to-plan diff | Use a CSS Grid with shared row tracks so labels align across cards |
| **Portfolio** (`components/portal/portfolio-client.tsx`) | KPI rail (§3) + Multi-outcome row (§8) for holdings + Compact list row (§9) for transactions + **Chart §10** for performance | Holdings = §8 (logo + symbol + price + delta + value). Performance chart strips its Card wrapper and moves Y-axis right |
| **Productivity — Board** (`components/productivity/board/`) | Data card (§1) anatomy for task cards, Category nav strip (§6) for filters | Column header gets a small count badge (`size-5 rounded-full bg-muted text-[10px]`) |
| **Productivity — Road paths** | Featured-list hero (§4) + Delta indicator (§7) for milestone progress | Featured = current path; list = milestones with progress numbers and delta vs prior week |
| **Travel — Trips overview** | Data card (§1) with hero image + Category nav strip (§6) for status filter | Card body rows: dates, location count, estimated cost. Footer: share status |
| **Travel — Trip detail** | Sticky right rail (§5) for share/export panel + dense itinerary list | Itinerary days use Compact list row (§9) per booking |
| **Entertainment — Sports hub** | Multi-outcome row (§8) for standings / odds + Two-up outcome selector (§2) for picks + Category nav strip (§6) for sport filter | Standings table = §8; per-sport views are the closest to Polymarket — leverage §8 heavily |
| **Admin — Users / Transactions** | KPI rail (§3) summary header + dense table (existing shadcn `Table`) + Delta indicator (§7) in summary tiles | Don't refresh the table; just wrap it in a KPI rail header |
| **Auth** (login / signup / forgot) | Out of scope — keep current centered layout | The patterns here are for data-dense surfaces; auth stays minimal |

---

## Checklist before closing a refresh task

- [ ] Reused shadcn primitives only — no raw `<div>` with hand-rolled styles
      where `Card`/`Button`/`Badge`/`Separator` would do.
- [ ] Every number is `<Mono>` + `tabular-nums`, semantic green/rose for
      direction (never `destructive` for "loss").
- [ ] KPI rail = 2 cols mobile / 4 cols `sm+`. No 3-col grids.
- [ ] Featured-list hero stacks cleanly on `< lg` (right list moves below).
- [ ] Sticky right rail is `top-20` and `lg+`-only; mobile flows in order
      or has a fixed bottom bar.
- [ ] Hover actions revealed via `group-hover/card:opacity-100`, not via
      always-visible chrome.
- [ ] Updated the per-module map above if you added/changed a surface.
- [ ] Captured a desktop **and** mobile (`< 640`) screenshot via the dev
      server before reporting done — see `responsive-ui` §"Verifying layout".
