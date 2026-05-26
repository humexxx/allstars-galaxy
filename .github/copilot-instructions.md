# GitHub Copilot Instructions

These instructions guide GitHub Copilot's inline code suggestions, completions, and quick coding assistance.

## Language

Write all code, comments, and documentation in English.

## Type System

### Type Organization
- Shared types → `/types` folder (export from `/types/index.ts`)
- Validation types → same file as Zod schema in `/schemas`
- Component-specific types → only in file if not used elsewhere

### Type Categories
1. **Database**: `typeof table.$inferSelect` (Drizzle ORM)
2. **Validation**: `z.infer<typeof schema>` (Zod)
3. **Business**: Domain models in `/types`

### Return Types
Always explicit for functions:
- GET (nullable): `Promise<Type | null>`
- GET (always): `Promise<Type>` or `Promise<Type[]>`
- CREATE/UPDATE: `Promise<Type>`
- DELETE: `Promise<void>`

## Validation Schemas

- Location: `/schemas` folder
- Pattern: Define schema, infer type
- Naming: `[name]Schema` and `[Name]Data`
- Export both schema and type

## Database

### Schema Changes
1. Modify `db/schema.ts`
2. Run `npm run db:generate`
3. Run `npm run db:migrate`
4. Commit schema + migrations together

### Patterns
- Use Drizzle ORM for all operations
- Transactions for multi-table operations
- Foreign key constraints with cascade rules
- Timestamps (createdAt, updatedAt) on all tables

## UI Components

- Use shadcn/ui components from `/components/ui`
- Follow shadcn patterns: composable, accessible
- Style with Tailwind CSS utilities and CSS variables
- Minimalist design philosophy

## Code Quality

- Simple functions (extract complex logic)
- Meaningful, descriptive names
- Avoid `any` type (use `unknown` with type guards)
- Consult official docs for libraries
- Minimal comments (only for complex logic)

## Project Structure

```
/app/actions     - Server actions
/app/api         - API routes
/components      - React components
/components/ui   - shadcn/ui primitives
/lib/services    - Business logic
/types           - Shared TypeScript types
/schemas         - Zod validation schemas
/db              - Database schema & migrations
```

## Commit Messages

This repo enforces **Conventional Commits** via a `commit-msg` husky hook
(`commitlint` + `@commitlint/config-conventional`). A commit that violates
the rules below is rejected — there is no bypass except `--no-verify`, which
should never be used.

### Header format

```
<type>(<scope>): <subject>
```

- **Type** (required, lower-case): `feat`, `fix`, `perf`, `refactor`, `docs`,
  `style`, `test`, `build`, `ci`, `chore`, `revert`.
- **Scope** (optional, but if present must be from this allowlist — see
  [`commitlint.config.mjs`](../commitlint.config.mjs)): `auth`, `db`,
  `finance`, `travel`, `sports`, `entertainment`, `landing`, `portal`, `ui`,
  `deps`, `release`, `ci`, `docs`, `config`, `types`, `schemas`. Add a new
  scope to `commitlint.config.mjs` **first** if you need one — don't invent
  scopes inline.
- **Subject**: imperative mood ("add", not "added"/"adds"), starts
  lower-case, **no trailing period**.
- **Total header length ≤ 100 characters** (this includes `type(scope): `).
  Long descriptions belong in the body — keep the header focused.

### Body (optional)

- Separate from the header by a blank line.
- Wrap at ~72 columns.
- Use bullets (`- …`) for multiple changes. Each bullet is one sentence.

### Breaking changes

Append `!` after the type/scope (`feat(db)!: drop legacy column`) **or**
include a `BREAKING CHANGE:` footer paragraph.

### Common pitfalls (rejected by commitlint)

| Mistake | Rule violated |
| --- | --- |
| Header over 100 chars | `header-max-length` |
| `feat(tests): …` (`tests` not in scope-enum) | `scope-enum` |
| `Feat: add x` (capitalised type) | `type-case` |
| `feat: Add x` (capitalised subject) | `subject-case` |
| `feat: add x.` (trailing period) | `subject-full-stop` |

### Examples that pass

```
feat(finance): add monthly income forecast
fix(travel): correct timezone offset on trip dates
refactor(portal): extract plan editor into hook
feat(db)!: rename plans.user_id to plans.owner_id
chore: bump dev dependencies
```

### When the change spans many files

Don't try to cram every detail into the header. Either:
- Pick a single dominant scope (the one users would search for), or
- Drop the scope entirely and use a generic header, putting the per-area
  details in the body bullets.

Example for a large refactor with mixed scopes:

```
feat: add full service + action test coverage and ci workflow

- add Vitest suites for every service in lib/services/
- add Vitest suites for every action in app/actions/
- add Playwright smoke specs (auth, portal, trips, plans, board, admin)
- add .github/workflows/ci.yml to run lint + tsc + tests on every PR
- introduce per-module e2e cleanup fixtures
```

If you can't honestly summarise it in 100 chars, the commit is probably
doing too many things — split it.
