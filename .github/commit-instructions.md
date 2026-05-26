# Commit Message Instructions

This repository enforces [Conventional Commits](https://www.conventionalcommits.org/)
via [commitlint](../commitlint.config.js) running in a Husky `commit-msg`
hook. **Any message that doesn't follow this format will be rejected.**

Generated commit messages MUST conform to the rules below.

## Format

```
<type>(<scope>): <subject>

[optional body — wrap at ~72 chars]

[optional footers]
```

- `type` and `scope` are both **required**.
- `subject` is a short, present-tense description of the change.
- Leave a blank line between header / body / footer.

## Rules enforced by commitlint

| Rule | Value |
|---|---|
| Header max length | **100 chars** |
| Subject case | NOT `Upper-Case`, `Pascal-Case`, or `Start-Case` (use lowercase or sentence-case) |
| Allowed types | `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` |

## Allowed scopes (enforced — no others permitted)

| Scope | What it covers |
|---|---|
| `auth` | login, signup, OAuth, sessions, impersonation |
| `db` | drizzle schema, migrations, seeds |
| `finance` | portfolio, plans, investment methods, finance services |
| `travel` | trip planner |
| `sports` | sports module |
| `entertainment` | entertainment-area shell or shared bits |
| `landing` | public landing page (`/`) |
| `portal` | authenticated portal shell (sidebar, layout, dashboard) |
| `ui` | generic UI primitives in `components/ui/*` |
| `deps` | `package.json` / lockfile changes |
| `release` | version bumps, changelog updates |
| `ci` | GitHub Actions, workflows, husky |
| `docs` | documentation (README, CLAUDE.md, this file, etc.) |
| `config` | tooling config (eslint, tsconfig, drizzle.config, next.config) |
| `types` | shared TypeScript types in `/types` |
| `schemas` | Zod validation schemas in `/schemas` |

If a change spans multiple scopes, pick the **dominant** one. Use `chore`
+ the closest scope (often `config` or `deps`) for catch-all
maintenance work.

## Examples

✅ **Good**

```
feat(finance): day-aware interest accrual using calendar's payment day
fix(portal): admin sidebar hidden while impersonating
chore(deps): bump framer-motion to 12.40.0
docs(config): document VSCode commit instructions
refactor(auth): collapse three Supabase client variants into one helper
```

❌ **Will be rejected**

```
Added new feature                  # missing type + scope, Start-Case
feat: new finance thing            # missing scope
feat(billing): add invoices        # "billing" is not in the scope enum
FEAT(finance): big change          # type must be lowercase
feat(finance): Adds new thing      # subject in Start-Case
```

## How to choose `type`

| Type | When |
|---|---|
| `feat` | New user-facing feature or capability |
| `fix` | Bug fix (broken behavior, not visual polish) |
| `style` | Visual / formatting polish that doesn't change behavior |
| `refactor` | Internal code change with no behavior or visual change |
| `perf` | Performance improvement |
| `test` | Adds or fixes tests only |
| `docs` | Documentation only |
| `build` | Build system, bundler, output |
| `ci` | CI configuration (workflows, hooks, etc.) |
| `chore` | Tooling, dependencies, housekeeping |
| `revert` | Reverts a previous commit |

## Tips for AI-generated messages

- Read the diff before choosing the type and scope.
- Prefer a precise scope over a vague one.
- Keep the subject under ~72 characters where possible (the 100-char
  cap exists for edge cases, not as a target).
- Use the body to explain **why**, not what. The diff already shows what.
- Don't append `Co-Authored-By` unless you actually had a coauthor.
