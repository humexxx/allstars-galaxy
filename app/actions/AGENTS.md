# Server Actions - Agent Instructions

One shape for every action. The previous version of this file described two
(throwing vs. returning) and contradicted itself; the codebase now follows the
one below, and new actions must too.

## The pattern

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { safe, type ActionResult } from "@/lib/actions/safe";
import { requireEffectiveContext } from "@/lib/services/impersonation";
import { createThing } from "@/lib/services/thing-service";
import { idSchema } from "@/schemas/common";
import { createThingSchema, type CreateThingInput } from "@/schemas/thing";
import type { Thing } from "@/types/thing";

export async function createThingAction(
  input: CreateThingInput,
): Promise<ActionResult<Thing>> {
  return safe("things", async () => {
    const ctx = await requireEffectiveContext();

    const parsed = createThingSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const thing = await createThing(ctx.effectiveUserId, parsed.data);
    revalidatePath("/portal/things");
    return { success: true, data: thing };
  });
}

export async function deleteThingAction(id: string): Promise<ActionResult> {
  return safe("things", async () => {
    const ctx = await requireEffectiveContext();
    if (!idSchema.safeParse(id).success) {
      return { success: false, error: "Thing not found" };
    }
    await deleteThing(id, ctx.effectiveUserId);
    revalidatePath("/portal/things");
    return { success: true };
  });
}
```

Rules, each for a reason:

- **Explicit `Promise<ActionResult<X>>` return type.** `ActionResult<X>` makes
  `data` required on success (none for `ActionResult<void>`), so callers read
  `result.data` after checking `success` without a `!`. It is also what lets
  `safe()` infer `X`.
- **Wrap the body in `safe(label, …)`.** Next.js replaces a thrown message with
  a generic one in production, so a thrown "You cannot demote yourself" never
  reaches the user. `safe()` turns anything unexpected into
  `{ success: false, error: "Action failed" }` and logs the real error
  server-side — no PG constraint names or SQL reach the browser.
- **Expected failures are returned, never thrown**: invalid input, not found,
  not allowed, business-rule refusals. Use the message the user should see.
- **Auth gate first, inside `safe()`** (see CLAUDE.md → Security):
  `requireEffectiveContext()` for user-scoped work (then scope every query to
  `ctx.effectiveUserId`), `requireAdmin()` for admin-only, `requireProvider()`
  to create investment methods. Ownership of existing rows is checked in the
  service against `userId`.
- **Validate everything with Zod.** Objects with a schema from `/schemas`;
  bare id arguments with `idSchema` from `@/schemas/common` (never
  `z.string().uuid()` inline). Use `safeParse`, not `parse`.
- **No `db` in actions.** Call a service in `/lib/services`; create it if it
  does not exist (see `lib/services/AGENTS.md`).
- **Revalidate what changed** — the page, and the dashboard (`/portal`) when
  its cards show this data. A client that calls a revalidating action does not
  also need `router.refresh()`.

The only exceptions are actions whose job *is* to navigate
(`signOutAction`, impersonation start/stop): they `redirect()` and may throw.

## Calling actions from the client

Use `runAction` from `@/lib/actions/run` — it awaits the action, toasts the
error (or your success message) and hands back `{ ok, data }`:

```typescript
const result = await runAction(createThingAction(values), {
  success: "Thing created",
  error: "Failed to create the thing",
});
if (result.ok) onCreated(result.data);
```

Toast copy: terse past tense on success ("Plan deleted"), "Failed to …" on
error, no "successfully".

## Naming

- `get*Action` read, `create*Action`, `update*Action`, `delete*Action`, and
  `*Action` for anything else.
- Input types: `[Name]Input` (`z.input<>`) where the schema transforms or
  defaults, otherwise `[Name]Data` (`z.infer<>`); see CLAUDE.md → Schemas.

## Checklist

- [ ] `Promise<ActionResult<X>>` return type, body inside `safe()`
- [ ] Auth gate first; every query scoped to the effective user
- [ ] Input validated with `safeParse`; ids with `idSchema`
- [ ] Service call, no direct `db`
- [ ] Expected failures returned with a user-facing message
- [ ] `revalidatePath()` for every page that shows the changed data
- [ ] A test in the co-located `*.test.ts` for the success and failure paths
