# Portfolio

> **Status:** Active (page redesigned to mirror plan-editor layout)
> **Last reviewed:** 2026-08-15

## Overview
Tracks the user's real portfolio: transactions (buys/withdrawals), historical
snapshots, and the catalog of investment methods (vehicles) with risk/ROI
metadata. Interest math is shared with [Finance](./finance.md).

## Routes
- `/portal/portfolio` — main portfolio view
- `/portal/investment-methods` — investment method catalog

## Server actions — `/app/actions/`
- `transactions.ts` — `createTransactionAction` (replaces the legacy `/api/transactions` route)
- `portfolio-snapshots.ts` — create manual snapshots of portfolio value
- `admin-transactions.ts` — admin-only approve/reject of transactions (see [Admin](./admin.md))
- `holdings.ts` — `upsertHoldingAction`, `deleteHoldingAction`, `createPriceAssetAction`, `setManualPriceAction`; gated on **owning the method**, not merely on being an admin

## Services — `/lib/services/`
- `portfolio-service.ts` — portfolio state and composition
- `transaction-service.ts` — transaction CRUD and filtering
- `snapshot-service.ts` — snapshot persistence/queries
- `interest-service.ts` — ROI math (shared with [Finance](./finance.md))
- `chart-service.ts` — chart data shaping (shared utility)
- `price-service.ts` — quote storage + provider dispatch (`refreshPrices`, `getLatestPrices`, `listPriceAssets`)
- `price-providers/` — one module per source: `massive.ts`, `coingecko.ts`, shared `types.ts`
- `margin-service.ts` — `getMarginOverview(ownerUserId)`, `getMethodHoldings(methodId)`

## Schemas — `/schemas/`
- `transaction.ts`
- `snapshot.ts`
- `holdings.ts` — holding upsert/delete, price-asset creation, manual quotes

## Types — `/types/`
- `portfolio.ts`
- `snapshot.ts`

## Components
- `components/portal/portfolio-client.tsx` — page shell: plan-style header (Heading h3 + muted Text), 4-card KPI grid (Total value with eye toggle, All-time profit, Cost basis, Active positions), Overview/Transactions tabs. Registers `Show charts`, `Hide values`, and admin `Manual snapshot` / `Clear manual snapshots` into the global dev drawer via `useRegisterDevTool` from `components/dev-tools/`.
- `components/portfolio/investment-methods-view.tsx` — `/portal/investment-methods` view: plan-style header, 4-card KPI grid (Methods, Authors, Avg monthly ROI, Best monthly ROI), inline Risk-profile breakdown bar, grouped-by-author method cards with risk-tinted badges. Registers a `Show disabled methods` toggle in the dev drawer that hot-reveals methods normally filtered out.
- `components/portfolio/` — supporting pieces: transactions table, performance chart (lazy-loaded), add-transaction dialog, manual-snapshot dialog, asset/allocation views. *Removed in the redesign:* `portfolio-header.tsx`, `stats-cards.tsx` (their concerns moved into `portfolio-client.tsx` and the dev drawer).

## DB tables — `db/schema.ts`
- `portfolios` — user's portfolio account
- `transactions` — buy/withdrawal transactions with approval workflow
- `portfolio_snapshots` — historical portfolio value
- `investment_methods` — investment vehicles with risk/ROI metadata
- `price_assets` — catalogue of quotable assets (`symbol`, `external_id`, `source`)
- `price_quotes` — append-only price history, one row per fetch
- `method_holdings` — what each method's pooled capital is deployed in (quantity + cost basis)
- `app_state` — global key-value (cron state, etc.) — also touched by other modules

## Notes
- **Methods have an owner.** `investment_methods.owner_user_id` (nullable, FK
  SET NULL) is the admin who runs the method; other users invest through them.
  NULL keeps the old global-catalogue behaviour. `author` is unrelated — it is
  free-text display credit and predates ownership.
- **`getMethodInvestors(ownerUserId)`** aggregates who holds money in an admin's
  methods, mirroring `getPortfolioAssets` maths exactly so the owner sees the
  same figure the investor sees. Surfaced as an **Investors** tab that only
  appears for users who own methods.
- **Third-party capital never touches net worth.** It is a read-only aggregate,
  computed on the fly, deliberately outside the KPI grid — folding it in would
  inflate the owner's patrimony with money that isn't theirs. Same reason the
  planned chart toggle keeps it on its own series (see the design memo).
- **Investment Methods lives inside Portfolio** (Methods tab), not its own
  route. `/portal/investment-methods` is a permanent redirect — the landing
  page links there from two places — and the sidebar entry is gone. The page
  fetches ALL methods (enabled + disabled) because `InvestmentMethodsView`
  filters to enabled itself and has a dev toggle for the rest; the transaction
  form gets the enabled subset. The tabs render **even without a portfolio**,
  so the catalogue stays browsable before you own anything.
- **CSV export** of the transaction history: `GET /api/portfolio/export`,
  gated by `requireEffectiveContext` so an impersonating admin exports what
  they see. Cells starting with `=`, `+`, `-` or `@` are prefixed with a quote
  — Excel and Sheets execute those as formulas.
- **Margin is the owner's private view.** Investors are sold a *fixed* return;
  the owner deploys the pooled capital elsewhere and keeps the difference.
  `margin = assets - liability`, where liability is the investors' compounded
  `currentValue` and assets is `quantity x latest price`. A **negative** margin
  matters most — the promise is outrunning the real return and the owner is
  covering it — so it is never clamped or hidden. Surfaced as a **Margin** tab
  that only exists for method owners.
- **The owner's own stake is capital, not liability** (`splitLiability` in
  [`lib/finance/margin.ts`](../../lib/finance/margin.ts)). You cannot owe
  yourself a fixed return; counting it as debt would understate the margin by
  exactly that stake. It is carried separately as `ownPosition`.
- **Holdings are quantities, never percentages.** A percentage drifts the
  moment a price moves and would need recomputing on every quote.
- **Prices refresh daily** at 00:30 via `/api/cron/prices` — 30 minutes after
  `/api/cron/daily` so the two don't contend for pooled connections. Providers:
  **Massive** (ex-Polygon.io, rebranded early 2026 — crypto, indices, stocks,
  ETFs, forex; needs `MASSIVE_API_KEY`; free Basic tier is end-of-day at 5
  req/min) and keyless **CoinGecko** (crypto only). `source = "manual"` is the
  escape hatch for anything neither covers — the cron never touches those.
- **Everything is on Massive, deliberately.** CoinGecko returns live spot and
  Massive returns the previous close; mixing them would value some holdings at
  one instant and the rest at another, making the margin a blend of two
  different moments. The CoinGecko fetcher stays for coins Massive doesn't
  list, but nothing uses it today.
- **Licensed indices are 403 on the free tier** — verified: `I:SPX` is refused,
  `I:NDX` is not. The ETF tracking the same index is free, so the catalogue
  lists **SPY** (S&P 500) and **QQQ** (Nasdaq-100) rather than the indices.
- **The 5 req/min free tier shapes the fetch strategy.** All crypto comes back
  in ONE grouped daily-bar call; everything else is quoted per ticker via
  `/prev` (which resolves the last *trading* day itself, so weekends aren't a
  hole). Assets are ordered stalest-first, and anything past the per-run budget
  is reported in `skipped` rather than dropped silently.
- Conventional Commits scope: `portfolio` *(not in commitlint allowlist — add it to [`commitlint.config.mjs`](../../commitlint.config.mjs) if you start committing here often, or use `finance` if the change is on shared math)*
- Daily cron at `/api/cron/daily` writes snapshots and applies monthly compound interest on the 1st.
- `createDailySnapshots` must use `inArray(...)` for the "latest snapshot per portfolio" lookup — a raw ``sql`... = ANY(${ids})` `` makes Drizzle emit `ANY(($1, $2))` (a row tuple), which Postgres rejects once there's more than one portfolio. That bug silently broke every daily portfolio snapshot from 2026-05-26 until the `inArray` fix.
- Transactions are created via `createTransactionAction` (server action). The previous `/api/transactions` route handler is gone; cron and webhook routes are the only remaining API routes.
- `PerformanceChart` and the projection charts in [Finance](./finance.md) are lazy-loaded with `next/dynamic({ ssr: false })` to keep recharts out of the initial portal bundle.
- `app/portal/portfolio/loading.tsx`, `app/portal/investment-methods/loading.tsx`, and `app/portal/admin/loading.tsx` stream skeletons for the heavy data fetches; `app/portal/portfolio/error.tsx` is the module error boundary.
- The KPI grid renders `StatCard` from `components/ui/stat-card.tsx` (shared house primitive: `Eyebrow` label + `Mono` value + tone-colored sublabel).
- The **Dev Tools drawer** (`components/dev-tools/`, mounted in `app/portal/layout.tsx`) is a portal-wide foundation: any page can call `useRegisterDevTool({ id, kind: "toggle" | "action" | "custom", ... })` and the helper shows up in the right-side `Sheet`. The floating wrench trigger only renders in `process.env.NODE_ENV === "development"` — registrations made by pages mounted in production are silently ignored. Context is split (`useDevToolsCommands` for stable register/unregister, `useDevToolsState` for the changing helpers/open) so consumer effects don't re-fire on every registration.
