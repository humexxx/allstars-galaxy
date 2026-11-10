# Admin

> **Status:** Active
> **Last reviewed:** 2026-11-10

## Overview
Admin-only operations: user management (roles and which modules each account
may use), transaction approval queue, and impersonation (with audit trail).

## Routes
- `/portal/admin/users` — user management
- `/portal/admin/transactions` — transaction approval queue

## Server actions — `/app/actions/`
- `admin-users.ts` — update user roles; returns `{ success: false, error }` for invalid input, a self-demote or an unknown user. `setUserModuleAction` turns one module on or off for an account
- `admin-transactions.ts` — approve/reject transactions (delegates to `transaction-service`)
- `portfolio-snapshots.ts` — admin-only manual snapshot tools (delegates to `snapshot-service`)
- `impersonation.ts` — start/stop admin impersonation (writes to audit log); these two redirect, so they are the only actions that may throw

## Services — `/lib/services/`
- `admin-service.ts` — user/transaction queries and mutations
- `user-service.ts` — user profile and auth state
- `transaction-service.ts` — `approveTransactionById` / `rejectTransactionById`
- `snapshot-service.ts` — `createManualSnapshotsForAllPortfolios` / `deleteManualSnapshotsForAllPortfolios`
- `impersonation.ts`
- `module-access-service.ts` — `getDisabledModules` (request-cached), `isModuleEnabled`, `requireModulePage(module)` (a module page's gate: redirects to `/portal`), `requireModuleContext(module)` (a module action's gate: throws `ModuleDisabledError`), `setModuleEnabled` (one `array_remove` / `array_append` statement, so two toggles at once both land)

## Schemas — `/schemas/`
- `user.ts`
- `transaction.ts`
- `admin.ts` — `updateUserRoleSchema`, `setUserModuleSchema`, `adminTransactionIdSchema`, `adminTransactionFiltersSchema` (the transactions page's search params)
- `impersonation.ts` — `impersonationSchema`

## Types — `/types/`
- `user.ts`
- `transaction.ts`

## Components
`components/admin/` — user tables, role editors, impersonation banner. `users/user-modules-dialog.tsx`: a switch per module, each saving on its own; the table shows "N off" beside the role.

## DB tables — `db/schema.ts`
- `users` — user profiles (FK to Supabase `auth.users`). `disabled_modules text[]` (migration 0065) — the modules turned OFF for the account; empty means everything on
- `impersonation_logs` — audit trail of admin actions while impersonating

## Notes
- **Module access.** `lib/access/modules.ts` lists the modules (Plans, Portfolio, Trading Journal, Board, Road Paths, Travel Planner, Sports). A module an admin turns off for an account stays in that account's nav, greyed out (`visibleSections(role, impersonating, disabledModules)` marks it `locked`), and leaves the ⌘K menu; its pages redirect to the dashboard, its actions and assistant route refuse it (403), its dashboard card is not drawn, and the plans leave its money out (no portfolio, no trading). It follows the EFFECTIVE account, so an admin impersonating someone sees what they see. Stored as the OFF list so a module added later starts on for everyone.
- Conventional Commits scope: *(no dedicated scope — use `auth` for role changes, `portfolio` for transaction approvals, or add `admin` to [`commitlint.config.mjs`](../../commitlint.config.mjs))*
- All actions in this module open with `requireAdmin()` from `@/lib/services/auth-server`.
- Impersonation must always write to `impersonation_logs` — never bypass.
- Impersonation ends on *Stop impersonating*, when the 30-minute cookie expires, or on sign-out (`signOutAction` clears the cookie — see [Auth](./auth.md)).
- Admin actions return `ActionResult` like every other action: a thrown message is hidden by Next.js in production, so "You cannot demote yourself" never reached the admin. The UI calls them through `runAction`, and both confirm dialogs stay open with a pending label until the action settles.
- `app/portal/admin/users/loading.tsx` and `admin/transactions/loading.tsx` draw their page (search / filter row + table card, via `components/admin/admin-table-skeleton.tsx`); `app/portal/admin/error.tsx` is the module error boundary.
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
