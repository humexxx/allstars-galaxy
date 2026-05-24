# Allstars Galaxy

Personal finance and productivity web app. Plan and confirm monthly cashflow,
track a real investment portfolio, run a kanban board and long-term goals, and
plan trips with shareable itineraries — all behind a single Supabase auth.

Built with **Next.js 16 (App Router)**, **React 19** (Server Components),
**Tailwind v4**, **shadcn/ui**, **Drizzle ORM**, **Supabase**, and **Zod**.

## Modules

| Module | What it does | Doc |
| --- | --- | --- |
| Finance | Plans (incomes / expenses / debts) with monthly confirmation & health scoring | [docs/modules/finance.md](docs/modules/finance.md) |
| Portfolio | Real portfolio: transactions, snapshots, investment methods | [docs/modules/portfolio.md](docs/modules/portfolio.md) |
| Productivity | Personal kanban board + long-term road paths with milestones | [docs/modules/productivity.md](docs/modules/productivity.md) |
| Entertainment / Travel | Trip planner with public share links | [docs/modules/entertainment.md](docs/modules/entertainment.md) |
| Admin | User management, transaction approvals, impersonation | [docs/modules/admin.md](docs/modules/admin.md) |
| Auth | Supabase email auth + server action wrappers | [docs/modules/auth.md](docs/modules/auth.md) |

## Quick start

```bash
git clone https://github.com/humexxx/allstars-galaxy.git
cd allstars-galaxy
cp .env.example .env   # fill in Supabase URL, keys, and DATABASE_URL / DIRECT_URL
npm install            # also wires the husky commit-msg hook
npm run db:migrate     # apply migrations against your DB
npm run dev            # http://localhost:3010
```

Requires **Node 22+** and **npm 11+**.

## Scripts

```bash
npm run dev          # dev server (http://localhost:3010)
npm run build        # production build
npm run start        # production server
npm run lint         # ESLint
npm run db:generate  # generate Drizzle migration from db/schema.ts
npm run db:migrate   # apply pending migrations (stop dev server first for type changes)
npm run db:studio    # Drizzle Studio (http://localhost:4983)
npm run db:seed      # seed the database
```

## Environment

See [`.env.example`](.env.example) for the full template. Minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `DATABASE_URL` — Supabase transaction pooler (port `6543`), used by the app
- `DIRECT_URL` — Supabase session pooler (port `5432`), used by `drizzle-kit`
- `CRON_SECRET` — protects `/api/cron/daily`

## Releases

This repo uses **Conventional Commits** + **release-please**. Push to `develop`
with messages like `feat(finance): …` or `fix(travel): …` and release-please
opens a Release PR that bumps `package.json`, updates `CHANGELOG.md`, and tags
the release. The version label in the sidebar reads `NEXT_PUBLIC_APP_VERSION`
which is injected from `package.json` at build time — every release rebuild
surfaces the new version automatically.

Full format and scope rules: [CLAUDE.md → Commit messages & releases](CLAUDE.md#commit-messages--releases).

## Documentation

- [CLAUDE.md](CLAUDE.md) — architecture, conventions, env, workflows (the source
  of truth for contributors and agents).
- [docs/modules/](docs/modules/) — one short doc per product module.
- [docs/TYPOGRAPHY.md](docs/TYPOGRAPHY.md) — Geist + UI typography primitives
  (required reading before touching UI).
- [docs/AGENTS.md](docs/AGENTS.md) — **rules for agents** on how to keep this
  documentation in sync as code changes (segmented updates, no rewrites).
- [.github/skills/](.github/skills/) — reusable agent playbooks (DB migration,
  service creation, server action creation).

## License

Private and confidential.
