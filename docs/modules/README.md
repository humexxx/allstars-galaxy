# Module docs

One file per product module. Each file follows the **exact** section order in
[`_TEMPLATE.md`](./_TEMPLATE.md) so agents can update fields in place without
restructuring.

| Module | Doc | Conventional Commits scope |
| --- | --- | --- |
| Finance (plans, confirmations, projections) | [finance.md](./finance.md) | `finance` |
| Portfolio (transactions, snapshots, methods) | [portfolio.md](./portfolio.md) | `portfolio`¹ |
| Productivity (board, road paths) | [productivity.md](./productivity.md) | `productivity`¹ |
| Entertainment / Travel | [entertainment.md](./entertainment.md) | `travel`, `entertainment` |
| Admin (users, transactions, impersonation) | [admin.md](./admin.md) | `admin`¹ / `auth` |
| Auth | [auth.md](./auth.md) | `auth` |

¹ Scope not yet in [`commitlint.config.mjs`](../../commitlint.config.mjs) —
add it the first time you commit there.

See [`docs/AGENTS.md`](../AGENTS.md) for the **rules** that govern when and how
to update these files.
