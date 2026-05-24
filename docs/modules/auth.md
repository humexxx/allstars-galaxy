# Auth

> **Status:** Active
> **Last reviewed:** 2026-05-23

## Overview
Supabase-backed authentication: email/password login, signup, password reset,
and SSR-friendly session management. Server-side action wrappers
(`authenticatedAction`, `adminAction`) enforce auth on every mutation.

## Routes
- `/login`
- `/signup`
- `/forgot-password`
- `/auth/callback` — OAuth / email confirmation callback

## Server actions — `/app/actions/`
None. Forms post directly via Supabase client; sessions are managed by
middleware.

## Services — `/lib/services/`
- `auth-service.ts` — Supabase client setup
- `auth-server.ts` — `authenticatedAction`, `adminAction` wrappers (used by every mutation in the app)

## Schemas — `/schemas/`
- `user.ts`

## Types — `/types/`
- `user.ts`

## Components
- `components/login-form.tsx`
- `components/signup-form.tsx`
- `components/forgot-password-form.tsx`

## DB tables
- `auth.users` (Supabase managed) — referenced by `users` via FK

## Notes
- Conventional Commits scope: `auth`
- **Every** server action across the app must wrap its handler in
  `authenticatedAction` or `adminAction`. If you add a new module, follow this
  pattern.
- See [`/app/actions/AGENTS.md`](../../app/actions/AGENTS.md) and
  [`/lib/services/AGENTS.md`](../../lib/services/AGENTS.md) for the canonical
  patterns.
