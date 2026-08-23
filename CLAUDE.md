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
| [`docs/SPACING.md`](docs/SPACING.md) | Spacing/padding/margin scale + app-shell offsets (required for UI work) |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Environment failures that look like app bugs (DNS/`ENOTFOUND`, iCloud Private Relay) |
| [`/app/actions/AGENTS.md`](app/actions/AGENTS.md) | Server-action patterns (the *how*) |
| [`/lib/services/AGENTS.md`](lib/services/AGENTS.md) | Service-layer patterns (the *how*) |
| [`.github/skills/`](.github/skills/) | Reusable playbooks: DB migration, service creation, server action creation, responsive UI, data-density UI patterns |

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
**Read [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md) and
[`docs/SPACING.md`](docs/SPACING.md) before writing or modifying any UI.** The
app uses **Geist Sans** (UI/body) and **Geist Mono** (code, numerics,
identifiers). Prefer the primitives in `@/components/ui/typography` (`Heading`,
`Text`, `Eyebrow`, `Code`, `Mono`) over raw `text-* font-* tracking-*` chains.
Never introduce another font family. The smallest sanctioned size is `text-2xs`
(10px); never use arbitrary `text-[Npx]`. For spacing, reuse the Tailwind scale —
never arbitrary `[...]` padding/margin/gap (see SPACING.md).

### Chart colours
`--chart-1..5` in [`app/globals.css`](app/globals.css) are a **categorical**
series palette — five distinct hues in a fixed order, encoding *identity* (which
plan, which trip). They are deliberately **not** a light-to-dark ramp of one hue:
that encodes magnitude, and it made two adjacent plans indistinguishable
(ΔE 7.1 in normal vision, against a ≥15 floor).

Assign slots in order, never cycle them, and never hand-pick a replacement:
the palette is validated (lightness band, chroma floor, colour-vision
separation, contrast). Re-run the validator from the `dataviz` skill before
changing any slot, in **both** modes — the dark steps are chosen for the dark
surface, not derived from the light ones.

### Roles
Three, and the role answers exactly one question — may this account create
investment methods? `user` (client) no, `provider` yes, `admin` yes plus
impersonation and the admin area. **Which** methods somebody runs is NOT in the
role: that is `investment_methods.owner_user_id`. `UserRole` in
[`types/user.ts`](types/user.ts) is the single definition — the union was once
spelled out by hand in ten files, which is how a role ends up half-added.

### UI gotchas that only show up on screen
Both live in [`docs/SPACING.md`](docs/SPACING.md) and both read as perfectly
sensible markup:
- `Card` already supplies vertical padding. Adding `pt-6` to `CardContent`
  *doubles* the top gap instead of setting it.
- `Card` clips its children. A badge meant to straddle its edge must be a
  sibling, not a child, or it renders sliced in half.
- To line figures up across a row of cards, pin them to the bottom
  (`mt-auto`); never try to equalise header heights, and keep variable content
  *above* the figures.

### Environment troubleshooting
`sh ~/.claude/scripts/diagnose-dns.sh` — machine-level, kept outside the repo
because the fault is not this project's. See
[`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

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
- Every server action opens with an auth gate — never trust the caller:
  - **User-scoped actions** → `requireEffectiveContext()` from
    `@/lib/services/impersonation`, then scope every query to
    `ctx.effectiveUserId` (this is what honours an active impersonation
    session).
  - **Method-owner actions** → `requireProvider()` from
    `@/lib/services/auth-server` gates the *creation* of investment methods.
    Everything about a method that already exists is gated on OWNERSHIP
    (`investment_methods.owner_user_id`), not on the role — see
    [`docs/modules/auth.md`](docs/modules/auth.md) for why the role answers
    only that one question.
  - **Admin-only actions** → `requireAdmin()` / `requireAdminCached()` from
    `@/lib/services/auth-server`.
  - **Plain "is signed in" checks** → `requireAuth()` / `requireAuthCached()`
    from the same module.
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

**Versioning is automated, and it happens on `main`.** `develop` is where work
lands and where nothing is versioned — a feature merged there is not a release.
Merging `develop` → `main` is the release gesture: `release-please` opens a
Release PR that bumps `package.json` + the manifest and writes `CHANGELOG.md`
from the Conventional Commits since the last tag. Merging **that** PR tags the
commit and cuts the GitHub release, so a tag always points at a commit that is
on `main`. A follow-up PR carries the bump back to `develop`, or the next
release would be computed from a version that is no longer true. See
[.github/workflows/release-please.yml](.github/workflows/release-please.yml).

The bump comes from the commit types — `feat` minor, `fix`/`perf` patch, `!` or
a `BREAKING CHANGE:` footer major. Nobody edits `package.json` by hand.

The sidebar footer shows the running version. It reads
`NEXT_PUBLIC_APP_VERSION`, injected from `package.json` at build time via
[next.config.ts](next.config.ts), so every release rebuild surfaces the new
number without anyone editing a string.

## Environment Variables

Required in `.env` (see `.env.example` for full template):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
DATABASE_URL    # Supabase transaction pooler (:6543) — used by the app at runtime
DIRECT_URL      # Supabase session pooler (:5432) — used by drizzle-kit only
CRON_SECRET
ALLOW_SIGNUPS  # "true" opens new accounts; anything else (incl. unset) closes them
```

**`ALLOW_SIGNUPS` is fail-closed and app-side only.** It gates `/signup`, the
login page's sign-up link, and the OAuth callback (which rejects an account
created by that very sign-in — OAuth is a signup path too). It does **not** stop
a direct `auth.signUp` call: that runs in the browser against Supabase with the
publishable key. Pair it with Supabase's own *Allow new users to sign up*
toggle, which is the actual enforcement. See [`lib/auth/signups.ts`](lib/auth/signups.ts).

Optional (feature-gated, each sport falls back to mock when unset):
```
# football / soccer
FOOTBALL_DATA_API_KEY   # EPL, La Liga, Bundesliga, Serie A, Ligue 1, UCL,
                        # World Cup, Euro. Free: 10 req/min, X-Auth-Token header.
                        # https://www.football-data.org/client/register

# NBA
BALLDONTLIE_API_KEY     # NBA only (free tier = single sport). 5 req/min.
                        # https://app.balldontlie.io

# market data — prices the assets backing investment methods (margin maths)
MASSIVE_API_KEY         # Massive, formerly Polygon.io (rebranded early 2026).
                        # Crypto, indices, stocks, ETFs, forex from one key.
                        # Free "Basic" tier per asset class: end-of-day data,
                        # 5 req/min, no card. Sent as Authorization: Bearer.
                        # Host is still api.polygon.io-compatible; override with
                        # MASSIVE_API_BASE_URL. https://massive.com
                        # Unset = only keyless CoinGecko (crypto) still quotes.

# padel
PADEL_API_KEY           # Premier Padel + FIP tournaments, last 6 months of
                        # matches free. 50K req/mo. https://padelapi.org

# DORMANT — kept for reference, not used by any service today:
API_SPORTS_KEY          # Free tier hard-locked to seasons 2022-2024, unusable
                        # for current data. ~$100/mo for the All Sports paid
                        # plan if we ever upgrade. https://dashboard.api-sports.io
```

F1 (Jolpica), LoL (Lolesports) and TheSportsDB are key-less — nothing to
configure in `.env`. NFL and tennis stay on mock fixtures (no decent free
provider with current data).

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
- Open with the auth gate — `requireEffectiveContext()` for user-scoped work,
  `requireAdmin()` for admin-only (see **Security** above)
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
