# Agent instructions

Documentation in this repo is **segmented**. This file is just an entry point —
the actual instructions live elsewhere. Read them in this order:

1. **[CLAUDE.md](./CLAUDE.md)** — architecture, conventions, env, workflows,
   tech stack, release tooling. The source of truth for *how* this project is
   built.
2. **[docs/AGENTS.md](./docs/AGENTS.md)** — **rules for keeping docs in sync
   with code.** Read every task before closing. Defines which doc segment owns
   which change.
3. **[docs/modules/](./docs/modules/)** — one file per product module (finance,
   portfolio, productivity, entertainment, admin, auth). Where the *what lives
   where* lives.
4. **[docs/TYPOGRAPHY.md](./docs/TYPOGRAPHY.md)** — required reading before any
   UI work.
5. **Layer patterns** (the *how*, not the *what*):
   - [`/app/actions/AGENTS.md`](./app/actions/AGENTS.md) — server actions
   - [`/lib/services/AGENTS.md`](./lib/services/AGENTS.md) — services
6. **[.github/skills/](./.github/skills/)** — reusable playbooks (DB migration,
   service creation, server action creation).

## Don't put content here

This file stays a pointer. New rules go in `CLAUDE.md` or `docs/`. New module
facts go in `docs/modules/<module>.md`. New layer patterns go in the layer's
`AGENTS.md`. See [`docs/AGENTS.md`](./docs/AGENTS.md) for the full map.
