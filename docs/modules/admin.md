# Admin

> **Status:** Active
> **Last reviewed:** 2026-05-24

## Overview
Admin-only operations: user management, transaction approval queue, and
impersonation (with audit trail).

## Routes
- `/portal/admin/users` — user management
- `/portal/admin/transactions` — transaction approval queue

## Server actions — `/app/actions/`
- `admin-users.ts` — update user roles (throws on validation / self-demote)
- `admin-transactions.ts` — approve/reject transactions (delegates to `transaction-service`)
- `portfolio-snapshots.ts` — admin-only manual snapshot tools (delegates to `snapshot-service`)
- `impersonation.ts` — start/stop admin impersonation (writes to audit log)

## Services — `/lib/services/`
- `admin-service.ts` — user/transaction queries and mutations
- `user-service.ts` — user profile and auth state
- `transaction-service.ts` — `approveTransactionById` / `rejectTransactionById`
- `snapshot-service.ts` — `createManualSnapshotsForAllPortfolios` / `deleteManualSnapshotsForAllPortfolios`
- `impersonation.ts`

## Schemas — `/schemas/`
- `user.ts`
- `transaction.ts`

## Types — `/types/`
- `user.ts`
- `transaction.ts`

## Components
`components/admin/` — user tables, role editors, impersonation banner.

## DB tables — `db/schema.ts`
- `users` — user profiles (FK to Supabase `auth.users`)
- `impersonation_logs` — audit trail of admin actions while impersonating

## Notes
- Conventional Commits scope: *(no dedicated scope — use `auth` for role changes, `portfolio` for transaction approvals, or add `admin` to [`commitlint.config.mjs`](../../commitlint.config.mjs))*
- All actions in this module **must** use `adminAction` from `@/lib/services/auth-server` (not `authenticatedAction`).
- Impersonation must always write to `impersonation_logs` — never bypass.
- Admin actions throw on error (caught by `app/portal/error.tsx`); they do **not** return `{ success: false, error }`.
- `app/portal/admin/loading.tsx` provides a table skeleton for the admin pages.
