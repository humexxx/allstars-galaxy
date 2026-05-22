# CLAUDE.md

This file provides guidance for Claude Code when working on Capital Galaxy.

## Project Overview

Capital Galaxy is a personal finance and productivity web app built with Next.js 16 (App Router), React 19, Supabase (Auth + PostgreSQL), and Drizzle ORM.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3010)
npm run build        # Production build
npm run lint         # ESLint
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply pending migrations
npm run db:studio    # Drizzle Studio (http://localhost:4983)
npm run db:seed      # Seed database
```

## Architecture

```
app/actions/         Server actions (mutations, authenticated)
app/api/             API routes + webhooks
app/portal/          Authenticated pages
components/ui/       shadcn/ui primitives
components/          Feature components
lib/services/        Business logic & data access
types/               Shared TypeScript types
schemas/             Zod validation schemas
db/schema.ts         Drizzle schema (single source of truth)
db/index.ts          Database client
migrations/          Auto-generated SQL migrations
```

## Tech Stack

- **Platform**: Windows / PowerShell
- **Runtime**: Node 22+
- **Framework**: Next.js 16 (App Router), React 19 (Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI**: shadcn/ui, Lucide React
- **Auth/DB**: Supabase (Auth + PostgreSQL)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Forms**: React Hook Form + Zod

## Code Conventions

### Typography
**Read [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md) before writing or modifying
any UI.** The app uses **Geist Sans** (UI/body) and **Geist Mono** (code,
numerics, identifiers). Prefer the primitives in `@/components/ui/typography`
(`Heading`, `Text`, `Eyebrow`, `Code`, `Mono`) over raw
`text-* font-* tracking-*` chains. Never introduce another font family.

### Language
All code, comments, and documentation in **English**.

### Types
- Shared types → `/types` (export from `/types/index.ts`)
- Validation types → same file as Zod schema in `/schemas`
- Database types: `typeof table.$inferSelect`
- Validation types: `z.infer<typeof schema>`
- Always explicit return types on functions

### Schemas
- Location: `/schemas` folder
- Naming: `[name]Schema` + `[Name]Data`
- Export both schema and inferred type

### Database Changes
1. Edit `db/schema.ts`
2. `npm run db:generate`
3. `npm run db:migrate` (see "Running migrations" below for caveats)
4. Commit schema + migrations together

### Running migrations
`drizzle-kit` uses `DIRECT_URL` (session pooler, port 5432). The Next.js app at
runtime uses `DATABASE_URL` (transaction pooler, port 6543). Both URLs differ
**only in the port number**. See `.env.example`.

**Before running migrations that change column types or add foreign keys, stop
the dev server.** Active queries from `npm run dev` take `AccessShareLock` on
tables and block `ALTER COLUMN SET DATA TYPE` (which needs `AccessExclusiveLock`).
Symptom: `drizzle-kit migrate` appears to hang on a spinner — it is actually
waiting on a lock with no timeout. Index-only migrations (`CREATE INDEX
IF NOT EXISTS`) are safe to run with the dev server up.

For DDL that rewrites tables, prefix the generated SQL with raised timeouts:
```sql
SET statement_timeout = 0;
SET lock_timeout = '30s';
```
Supabase caps `statement_timeout` at ~8s by default on pooled connections, which
will cancel a long-running `ALTER COLUMN ... USING (...)` mid-flight.

The pre-flight check in `drizzle.config.ts` will refuse to run if `DIRECT_URL`
is missing and `DATABASE_URL` points at the transaction pooler.

### Security
- All server actions use `authenticatedAction` or `adminAction` from `@/lib/services/auth-server`
- All service queries filter by `userId` for ownership
- Always validate input with Zod
- No secrets in client code

### Patterns
- Drizzle ORM for all DB operations
- Transactions for multi-table changes
- Foreign keys with cascade rules
- Timestamps (createdAt, updatedAt) on all tables
- Use shadcn/ui components from `/components/ui`
- Avoid `any` — use `unknown` with type guards
- Minimal comments (only complex logic)

## Environment Variables

Required in `.env` (see `.env.example` for full template):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
DATABASE_URL    # Supabase transaction pooler (:6543) — used by the app at runtime
DIRECT_URL      # Supabase session pooler (:5432) — used by drizzle-kit only
CRON_SECRET
```

## Common Workflows

### New Feature
1. Types in `/types/[feature].ts`
2. Schema in `/schemas/[feature].ts`
3. DB schema in `db/schema.ts` → generate → migrate
4. Service in `/lib/services/[feature]-service.ts`
5. Actions in `/app/actions/[feature].ts`
6. UI in `/components/[feature]/`
7. Page in `/app/portal/[feature]/page.tsx`

### New Server Action
- Import `authenticatedAction` from `@/lib/services/auth-server`
- Define Zod schema, call service, revalidate paths

### Adding UI Components
```bash
npx shadcn@latest add [component]
```
