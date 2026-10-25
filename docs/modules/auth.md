# Auth

> **Status:** Active
> **Last reviewed:** 2026-10-18

## Overview
Supabase-backed authentication: email/password login, signup, password reset,
and SSR-friendly session management. Every server action opens with one of the
gates in `lib/services/auth-server.ts` / `lib/services/impersonation.ts`.

## Routes
- `/login`
- `/signup`
- `/forgot-password`
- `/update-password` — where the reset email lands (through `/auth/callback`,
  which signs the user in) to choose the new password. Without a session it
  sends the user back to `/forgot-password`. The reset link used to point at
  `/portal/profile/update-password`, a route that never existed, so a reset
  could not be completed.
- `/auth/callback` — OAuth / email confirmation callback. Surfaces failures
  instead of bouncing silently: provider `error`/`error_description` params, a
  missing `code`, and `exchangeCodeForSession` errors all redirect to
  `/login?error=<message>`, which the login form renders in its alert box.
  (Previously a failed exchange still redirected to `/portal`, whose layout
  bounced back to `/login` with no explanation.)

## Server actions — `/app/actions/`
- `auth.ts` — `signOutAction` (clears the impersonation cookie, server-side sign-out, redirect to `/login`). Login / signup / password reset still use the Supabase client directly because they depend on `window.location.origin` for redirect URLs.

## Services
- `lib/auth/auth-client.ts` — `AuthService`, the **browser** calls (password
  and Google sign-in, sign-up, reset email, `updatePassword`). It lives outside
  `lib/services` because everything there is `server-only`.
- `lib/services/auth-server.ts` — `requireAuth[Cached]`, `requireAdmin[Cached]`,
  `requireProvider`, `requireAdminOrRedirect` (redirects only on an
  unauthorized/forbidden error; a database failure is rethrown, not disguised
  as a bounce to the dashboard).

## Schemas — `/schemas/`
- `user.ts`
- `auth.ts` — `loginSchema`, `signupSchema`, `forgotPasswordSchema`, `updatePasswordSchema` (+ `Data` types) backing the RHF auth forms. New passwords need 8+ characters — the sign-up form already said so while the schema accepted one.

## Types — `/types/`
- `user.ts`

## Components
- `components/login-form.tsx`
- `components/signup-form.tsx`
- `components/forgot-password-form.tsx`
- `components/update-password-form.tsx`

All four use `Alert` for form-level errors and `Field` + `FieldError` with
`aria-invalid` for field errors.

## DB tables
- `auth.users` (Supabase managed) — referenced by `users` via FK

## Notes
- **Three roles, and the role answers exactly one question**: may this account
  create investment methods? `user` (client) → no, `provider` → yes, `admin` →
  yes, plus impersonation and the admin area. **Which** methods somebody runs
  is NOT in the role — that is `investment_methods.owner_user_id`, and every
  ownership check reads it. Restating ownership in the role would give two
  sources of truth that can disagree.
- `UserRole` in [`types/user.ts`](../../types/user.ts) is the single definition,
  derived from the `USER_ROLES` tuple there; `schemas/user.ts`'s `userRoleEnum`
  is `z.enum(USER_ROLES)` and re-exports the type rather than redefining it (a
  second two-value copy there is what had made `provider` unreachable). The
  union was previously spelled out by hand in ten files, which is how a new
  role ends up half-added; `nav-config`'s `Role` is now an alias of it.
- **Impersonation refuses admin targets in both directions.** The action blocks
  starting one, and `loadEffectiveContext` re-checks on every read — a role can
  change while a session is live, and without the second check a promotion
  would leave the cookie granting admin-as-admin access for the rest of its
  30-minute life.
- **Signing out ends impersonation.** `signOutAction` deletes `cg_impersonating`
  itself: Supabase's `signOut` clears only its own cookies, so an admin who
  signed back in within the cookie's 30 minutes silently resumed impersonating.
- **Route handlers don't use the `require*` gates.** Their throw reaches the
  client as a 500, and the proxy only redirects signed-out requests off
  `/portal`. A handler calls `getEffectiveContext()` and answers 401 itself, as
  `GET /api/portfolio/export` does.
- Conventional Commits scope: `auth`
- **Every `?next=` goes through `safeNextPath`** ([`lib/auth/safe-next.ts`](../../lib/auth/safe-next.ts)) — the OAuth callback, the login form and the sign-up form. "Starts with `/`, not `//`" was not enough: URL parsers read a backslash as a slash and drop tabs, so `/\evil.com` and `/<tab>/evil.com` resolved to evil.com. The helper refuses backslashes and control characters and requires the resolved URL to stay on the same origin. The proxy also bounces a signed-in user off `/forgot-password` and matches `/portal` exactly. The login page renders the sign-up hand-off `?message=`.
- **Every** server action across the app must wrap its handler in
  `authenticatedAction` or `adminAction`. If you add a new module, follow this
  pattern.
- See [`/app/actions/AGENTS.md`](../../app/actions/AGENTS.md) and
  [`/lib/services/AGENTS.md`](../../lib/services/AGENTS.md) for the canonical
  patterns.
- The three auth forms use react-hook-form + `zodResolver` with schemas from
  `/schemas/auth.ts`; submit buttons disable on `isSubmitting`.
- **Google OAuth requires Supabase dashboard config** (not in this repo):
  Auth → URL Configuration must allow-list every `redirect_to` origin —
  `http://localhost:3000/auth/callback` for dev (`pnpm dev`'s port) and
  `https://allstars-galaxy.vercel.app/auth/callback` for prod. A `redirect_to`
  missing from the allow-list makes Supabase fall back to the Site URL after
  the Google handshake, dropping the code exchange (symptom: Google login
  "does nothing" / lands logged-out).
