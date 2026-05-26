# Portfolio

> **Status:** Active
> **Last reviewed:** 2026-05-24

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
`components/portfolio/` — portfolio summaries, transaction tables, charts.

## DB tables — `db/schema.ts`
- `portfolios` — user's portfolio account
- `transactions` — buy/withdrawal transactions with approval workflow
- `portfolio_snapshots` — historical portfolio value
- `investment_methods` — investment vehicles with risk/ROI metadata
- `app_state` — global key-value (cron state, etc.) — also touched by other modules

## Notes
- Conventional Commits scope: `portfolio` *(not in commitlint allowlist — add it to [`commitlint.config.mjs`](../../commitlint.config.mjs) if you start committing here often, or use `finance` if the change is on shared math)*
- Daily cron at `/api/cron/daily` writes snapshots and applies monthly compound interest on the 1st.
- Transactions are created via `createTransactionAction` (server action). The previous `/api/transactions` route handler is gone; cron and webhook routes are the only remaining API routes.
- `PerformanceChart` and the projection charts in [Finance](./finance.md) are lazy-loaded with `next/dynamic({ ssr: false })` to keep recharts out of the initial portal bundle.
- `app/portal/portfolio/loading.tsx` and `app/portal/admin/loading.tsx` stream skeletons for the heavy data fetches.
