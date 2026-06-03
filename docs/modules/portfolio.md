# Portfolio

> **Status:** Active (page redesigned to mirror plan-editor layout)
> **Last reviewed:** 2026-06-03

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

## Services — `/lib/services/`
- `portfolio-service.ts` — portfolio state and composition
- `transaction-service.ts` — transaction CRUD and filtering
- `snapshot-service.ts` — snapshot persistence/queries
- `interest-service.ts` — ROI math (shared with [Finance](./finance.md))
- `chart-service.ts` — chart data shaping (shared utility)

## Schemas — `/schemas/`
- `transaction.ts`
- `snapshot.ts`

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
- `app_state` — global key-value (cron state, etc.) — also touched by other modules

## Notes
- Conventional Commits scope: `portfolio` *(not in commitlint allowlist — add it to [`commitlint.config.mjs`](../../commitlint.config.mjs) if you start committing here often, or use `finance` if the change is on shared math)*
- Daily cron at `/api/cron/daily` writes snapshots and applies monthly compound interest on the 1st.
- `createDailySnapshots` must use `inArray(...)` for the "latest snapshot per portfolio" lookup — a raw ``sql`... = ANY(${ids})` `` makes Drizzle emit `ANY(($1, $2))` (a row tuple), which Postgres rejects once there's more than one portfolio. That bug silently broke every daily portfolio snapshot from 2026-05-26 until the `inArray` fix.
- Transactions are created via `createTransactionAction` (server action). The previous `/api/transactions` route handler is gone; cron and webhook routes are the only remaining API routes.
- `PerformanceChart` and the projection charts in [Finance](./finance.md) are lazy-loaded with `next/dynamic({ ssr: false })` to keep recharts out of the initial portal bundle.
- `app/portal/portfolio/loading.tsx` and `app/portal/admin/loading.tsx` stream skeletons for the heavy data fetches.
- The **Dev Tools drawer** (`components/dev-tools/`, mounted in `app/portal/layout.tsx`) is a portal-wide foundation: any page can call `useRegisterDevTool({ id, kind: "toggle" | "action" | "custom", ... })` and the helper shows up in the right-side `Sheet`. The floating wrench trigger only renders in `process.env.NODE_ENV === "development"` — registrations made by pages mounted in production are silently ignored. Context is split (`useDevToolsCommands` for stable register/unregister, `useDevToolsState` for the changing helpers/open) so consumer effects don't re-fire on every registration.
