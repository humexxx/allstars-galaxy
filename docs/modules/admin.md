# Admin

> **Status:** Active
> **Last reviewed:** 2026-10-01

## Overview
Admin-only operations: user management, transaction approval queue, and
impersonation (with audit trail).

## Routes
- `/portal/admin/users` — user management
- `/portal/admin/transactions` — transaction approval queue

## Server actions — `/app/actions/`
- `admin-users.ts` — update user roles; returns `{ success: false, error }` for invalid input, a self-demote or an unknown user
- `admin-transactions.ts` — approve/reject transactions (delegates to `transaction-service`)
- `portfolio-snapshots.ts` — admin-only manual snapshot tools (delegates to `snapshot-service`)
- `impersonation.ts` — start/stop admin impersonation (writes to audit log); these two redirect, so they are the only actions that may throw

## Services — `/lib/services/`
- `admin-service.ts` — user/transaction queries and mutations
- `user-service.ts` — user profile and auth state
- `transaction-service.ts` — `approveTransactionById` / `rejectTransactionById`
- `snapshot-service.ts` — `createManualSnapshotsForAllPortfolios` / `deleteManualSnapshotsForAllPortfolios`
- `impersonation.ts`

## Schemas — `/schemas/`
- `user.ts`
- `transaction.ts`
- `admin.ts` — `updateUserRoleSchema`, `adminTransactionIdSchema`, `adminTransactionFiltersSchema` (the transactions page's search params)
- `impersonation.ts` — `impersonationSchema`

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
- All actions in this module open with `requireAdmin()` from `@/lib/services/auth-server`.
- Impersonation must always write to `impersonation_logs` — never bypass.
- Admin actions return `ActionResult` like every other action: a thrown message is hidden by Next.js in production, so "You cannot demote yourself" never reached the admin. The UI calls them through `runAction`, and both confirm dialogs stay open with a pending label until the action settles.
- `app/portal/admin/loading.tsx` and `admin/transactions/loading.tsx` draw their page (search / filter row + table card, via `components/admin/admin-table-skeleton.tsx`); `app/portal/admin/error.tsx` is the module error boundary.
- The role-change dialog's copy is driven by `ROLE_META[nextRole]`, so promoting to provider no longer reads "Demote to user?".
- **The users table sets any of the three roles** (`USER_ROLES` from `types/user.ts` drives the menu). It used to toggle admin↔user only, which made `provider` unreachable and demoted a provider to admin by accident.
- **The approvals queue filters by a user picker** (`UserSelector` with
  `clearLabel="All users"`), not a free-text user-id box — nobody copies a
  UUID to filter a list. The page loads `getAllUsers()` for it.
- **Queue rows name the method** (column and confirm dialog: "Approve this
  $500.00 withdrawal from Crypto Momentum…"), and an admin's own entry —
  approved on save with no approver — reads "Auto-approved" instead of a dash.
- **Phone layouts.** The queue is a list below a 48rem card (labelled Approve
  / Reject buttons beside the amount); the users table moves the role badge
  under the name below `sm` and truncates long emails, so the actions menu
  stays on screen. The role menu closes before its confirm opens
  (`DropdownMenu modal={false}`, no `preventDefault`) — held open, it stayed
  painted under the dialog and left the page inert after Cancel.
