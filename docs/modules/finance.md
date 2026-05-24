# Finance

> **Status:** Active
> **Last reviewed:** 2026-05-24

## Overview
Personal financial planning: users build *plans* (scenarios) with incomes,
expenses, and debts, then confirm monthly actuals so projections stay
calibrated. Health scoring and scenario comparison are part of this module.

## Routes
- `/portal/plans` — list of plans
- `/portal/plans/new` — create plan
- `/portal/plans/[id]` — plan detail + editor
- `/portal/plans/compare` — side-by-side scenario comparison

## Server actions — `/app/actions/`
- `finance-plans.ts` — CRUD + lifecycle for finance plans (create, update, delete, clone) and projection calculations
- `finance-confirmations.ts` — save monthly confirmation snapshots and per-debt balance confirmations

## Services — `/lib/services/`
- `finance-plan-service.ts`
- `finance-confirmation-service.ts`
- `finance-snapshot-service.ts`
- `interest-service.ts` — interest/ROI math (shared with [Portfolio](./portfolio.md))

## Schemas — `/schemas/`
- `finance.ts`
- `finance-snapshot.ts`

## Types — `/types/`
- `finance.ts`
- `snapshot.ts`

## Components
`components/finance/` — plan editors, projection charts, confirmation dialogs,
strategy comparisons, [`FinancialHealthGauge`](../../components/finance/financial-health-gauge.tsx).

## DB tables — `db/schema.ts`
- `finance_plans` — user's financial scenarios
- `finance_plan_incomes` — income line items
- `finance_plan_expenses` — expense line items
- `finance_plan_debts` — tracked debts within a plan
- `finance_plan_snapshots` — historical plan position snapshots
- `finance_plan_confirmations` — user-confirmed monthly actuals
- `finance_plan_debt_confirmations` — per-debt balance confirmations

## Notes
- Conventional Commits scope: `finance`
- Cron job `/api/cron/daily` may write snapshots into this module — keep in sync with [Portfolio](./portfolio.md).
- All actions wrap their handler in `safe()` from `@/lib/actions/safe` so service errors translate to `{ success: false, error: "Action failed" }` for the client.
- `getPlanWithLines` is wrapped in `React.cache()` so `generateMetadata` and the page body share one DB hit per request.
- `ProjectionChart` and `ComparePlansChart` are lazy-loaded via `next/dynamic({ ssr: false })` to keep recharts out of the initial bundle.
- `app/portal/plans/loading.tsx` and `app/portal/plans/[id]/not-found.tsx` give the routes a proper skeleton / 404 experience.
