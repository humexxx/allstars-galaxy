# CLAUDE.md

This file provides guidance for Claude Code (and any other AI coding agent)
when working on Allstars Galaxy.

> **Heads-up for agents:** docs in this repo are **segmented**. Don't dump
> module-specific knowledge here — put it in `docs/modules/<module>.md`. Don't
> rewrite this file when fixing a typo in a route. The rules and the
> change-to-doc map are in [`docs/AGENTS.md`](docs/AGENTS.md). Read it before
> closing any task that touched code.

## Project Overview

Allstars Galaxy is a personal finance and productivity web app built with
Next.js 16 (App Router), React 19, Supabase (Auth + PostgreSQL), and Drizzle
ORM. Six product modules — Finance, Portfolio, Productivity, Entertainment
(Travel), Admin, Auth — share a single Supabase auth and the same patterns
for actions / services / schemas / types.

Per-module reference docs live in [`docs/modules/`](docs/modules/).

## Documentation map

| File | Owns |
| --- | --- |
| [`README.md`](README.md) | Public-facing overview, quick start, env, links out |
| [`CLAUDE.md`](CLAUDE.md) *(this file)* | Architecture, conventions, env, workflows, release tooling |
| [`docs/AGENTS.md`](docs/AGENTS.md) | **Rules for agents** on segmented doc updates — read every task |
| [`docs/modules/<module>.md`](docs/modules/) | One file per product module: routes, actions, services, schemas, tables |
| [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md) | Font system + UI typography primitives (required for UI work) |
| [`/app/actions/AGENTS.md`](app/actions/AGENTS.md) | Server-action patterns (the *how*) |
| [`/lib/services/AGENTS.md`](lib/services/AGENTS.md) | Service-layer patterns (the *how*) |
| [`.github/skills/`](.github/skills/) | Reusable playbooks: DB migration, service creation, server action creation |

Each segment owns its scope. Linking between docs is preferred over
duplicating content. When you make a change, edit **only** the segment that
owns the thing you changed — see [`docs/AGENTS.md`](docs/AGENTS.md) for the
exact change-to-doc map.

## Commands

```bash
pnpm dev            # Start dev server (http://localhost:3010)
pnpm build          # Production build
pnpm lint           # ESLint
pnpm test           # Vitest — unit + integration (mocked DB)
pnpm test:watch     # Vitest watch mode
pnpm test:coverage  # Vitest with v8 coverage report
pnpm test:e2e       # Playwright — needs .env.test + running dev server
pnpm test:e2e:ui    # Playwright UI mode
pnpm db:generate    # Generate migration from schema changes
pnpm db:migrate     # Apply pending migrations
pnpm db:studio      # Drizzle Studio (http://localhost:4983)
pnpm db:seed        # Seed database
```

### Testing

- **Vitest** (`*.test.ts(x)` co-located with source) runs in Node by default
  and mocks `@/db` at the import boundary — no real Supabase needed. See
  [`vitest.config.ts`](vitest.config.ts) and [`vitest.setup.ts`](vitest.setup.ts)
  (the setup stubs the `server-only` marker so server modules can be imported
  from the test runner).
- **Playwright** (`e2e/*.spec.ts`) drives the real app at `http://localhost:3010`.
  Requires a dedicated Supabase test user — copy [`.env.test.example`](.env.test.example)
  to `.env.test` and fill `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. The auth
  fixture logs in once and persists `storageState` to `playwright/.auth/user.json`
  (gitignored). Per-test cleanup goes through `DATABASE_URL` from `.env` and is
  exposed as **per-module fixtures** in [`e2e/fixtures.ts`](e2e/fixtures.ts):
  `cleanFavorites`, `cleanTrips`, `cleanFinancePlans`, `cleanBoard`,
  `cleanRoadPaths`, plus a `resetUserData` catch-all. Opt into the helpers
  your spec needs in `test.beforeEach`/`afterAll`.
- Specs run with `workers: 1` because they share one Supabase user; parallel
  runs would race on shared tables.
- Coverage: `pnpm test:coverage` (powered by `@vitest/coverage-v8`). The
  service + action layers sit above 80% statements / 85% lines as of the last
  audit.

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

- **Platform**: cross-platform (developed on Windows / PowerShell + macOS); shell scripts in `.husky/` use POSIX `sh` and require Git Bash on Windows
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
2. `pnpm db:generate`
3. `pnpm db:migrate` (see "Running migrations" below for caveats)
4. Commit schema + migrations together

### Running migrations
`drizzle-kit` uses `DIRECT_URL` (session pooler, port 5432). The Next.js app at
runtime uses `DATABASE_URL` (transaction pooler, port 6543). Both URLs differ
**only in the port number**. See `.env.example`.

**Before running migrations that change column types or add foreign keys, stop
the dev server.** Active queries from `pnpm dev` take `AccessShareLock` on
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

### Commit messages & releases
This repo uses **Conventional Commits** ([spec](https://www.conventionalcommits.org/)),
enforced by `commitlint` via a `husky` `commit-msg` hook. Format:

```
<type>(<scope>): <subject>
```

- **type** (required): `feat`, `fix`, `perf`, `refactor`, `docs`, `style`,
  `test`, `build`, `ci`, `chore`, `revert`
- **scope** (optional, but constrained): `auth`, `db`, `finance`, `travel`,
  `entertainment`, `landing`, `portal`, `ui`, `deps`, `release`, `ci`, `docs`,
  `config`, `types`, `schemas` — extend the list in [`commitlint.config.mjs`](commitlint.config.mjs) if needed.
- **subject**: imperative, lower-case start, no trailing period, ≤100 chars total header.
- **Breaking change**: append `!` after type/scope (e.g. `feat(db)!: drop legacy column`)
  or include a `BREAKING CHANGE:` footer.

Examples:
- `feat(finance): add monthly income forecast`
- `fix(travel): correct timezone offset on trip dates`
- `refactor(portal): extract plan editor into hook`
- `feat(db)!: rename plans.user_id to plans.owner_id`

**Versioning is automated.** `release-please` watches `develop` and opens a
Release PR that bumps `package.json` + the manifest and updates `CHANGELOG.md`
based on commits since the last tag. Merging that PR creates the GitHub
release and the tag — see [.github/workflows/release-please.yml](.github/workflows/release-please.yml).

The UI version label (sidebar) reads `NEXT_PUBLIC_APP_VERSION`, injected from
`package.json` at build time via [next.config.ts](next.config.ts), so every
release rebuild surfaces the new version automatically.

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

### New Feature (existing module)
1. Types in `/types/[feature].ts`
2. Schema in `/schemas/[feature].ts`
3. DB schema in `db/schema.ts` → generate → migrate
4. Service in `/lib/services/[feature]-service.ts`
5. Actions in `/app/actions/[feature].ts`
6. UI in `/components/[feature]/`
7. Page in `/app/portal/[feature]/page.tsx`
8. **Update the module doc** — bump *Last reviewed*, add a bullet for the new
   route / action / service / schema / type / table in
   [`docs/modules/<module>.md`](docs/modules/).

### New Module
1. Steps 1–7 above, scoped to the new module.
2. Copy [`docs/modules/_TEMPLATE.md`](docs/modules/_TEMPLATE.md) →
   `docs/modules/<module>.md` and fill it.
3. Register the module in [`docs/modules/README.md`](docs/modules/README.md)
   and in the change-to-doc map inside [`docs/AGENTS.md`](docs/AGENTS.md).
4. Add the module's scope (if new) to
   [`commitlint.config.mjs`](commitlint.config.mjs) `scope-enum`.

### New Server Action
- Import `authenticatedAction` from `@/lib/services/auth-server`
- Define Zod schema, call service, revalidate paths
- See [`/app/actions/AGENTS.md`](app/actions/AGENTS.md) for the canonical
  pattern.

### Adding UI Components
```bash
pnpm dlx shadcn@latest add [component]
```

### Closing any task (checklist)
Before considering a code change complete:

- [ ] Did I add / remove / rename a route, action, service, schema, type, or
      DB table? → update the relevant
      [`docs/modules/<module>.md`](docs/modules/) (bullet + *Last reviewed*).
- [ ] Did I introduce a new Conventional Commits scope? → add it to
      [`commitlint.config.mjs`](commitlint.config.mjs) **and** mention it in
      the module doc's *Notes*.
- [ ] Did I change env vars, scripts, or platform requirements? → update this
      file and (if user-facing) [`README.md`](README.md).
- [ ] Did I touch a public surface (landing, signup, public trip share)?
      → update [`README.md`](README.md).

Full rules: [`docs/AGENTS.md`](docs/AGENTS.md).
