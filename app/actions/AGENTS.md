# Server Actions - Agent Instructions

## Authentication Patterns

**Always check authentication using utilities from `@/lib/services/auth-server`:**
- Review available functions in the auth-server module
- Use appropriate authentication utility for the action (user or admin level)
- Never skip authentication checks in server actions

```typescript
import { /* use appropriate auth utility */ } from "@/lib/services/auth-server";

export async function myAction() {
  const user = await /* appropriate auth function */();
  // user.id is now available and guaranteed to exist
}
```

## Validation Pattern

**Always validate input using Zod schemas from `/schemas` directory:**
- Check if a schema exists for the data type
- If not, create one following the project conventions
- Parse data before using it

There are two acceptable shapes — pick based on who is calling the action:

### User-facing actions (preferred)

Use `.safeParse()` + the `safe()` wrapper from `@/lib/actions/safe`. Validation
failures become `{ success: false, error: "Invalid input" }` so the UI's toast
handler can surface them. Service errors are caught by `safe()` and become a
generic `"Action failed"` — without leaking PG / Drizzle internals to the
client.

```typescript
import { safe } from "@/lib/actions/safe";
import { someSchema } from "@/schemas/my-schema";

export async function createSomethingAction(data: SomeInput) {
  return safe("my-feature", async () => {
    const user = await requireAuth();
    const parsed = someSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid input" };
    }
    const result = await createSomething(user.id, parsed.data);
    revalidatePath("/portal/my-feature");
    return { success: true as const, data: result };
  });
}
```

### Admin-only actions

Admin actions that should bubble exceptions to the Next.js error boundary
(e.g. cron / maintenance endpoints) may keep `.parse()` and let it throw —
`safe()` is intentionally NOT used for these. The return type usually has no
error envelope.

```typescript
export async function adminMaintenanceAction(
  data: MaintenanceInput,
): Promise<{ success: true; processed: number }> {
  await requireAdmin();
  const validated = maintenanceSchema.parse(data); // throws → error boundary
  const { processed } = await runMaintenance(validated);
  revalidatePath("/portal/admin");
  return { success: true, processed };
}
```

**Don't mix the two shapes inside a single file** — pick one per action based
on the caller.

## Service Layer Pattern

**Actions should call service functions from `/lib/services`, not query database directly:**
- Review available services in `/lib/services` directory
- Use existing service functions when available
- If service doesn't exist, create it first following project patterns

```typescript
// ❌ DON'T do this in actions
const result = await db.query.table.findMany(...);

// ✅ DO call services
const result = await /* appropriate service function */(user.id);
```

## Response Format

**Return consistent response objects:**
```typescript
// Success response
return { success: true, data: result };

// With message
return { success: true, data: result, message: "Created successfully" };

// Errors throw, they're caught by React/Next.js
throw new Error("Not found");
```

## Cache Revalidation

**Always revalidate paths after mutations using Next.js utilities:**
```typescript
import { revalidatePath } from "next/cache";

export async function updateSomethingAction(data: UpdateData) {
  const user = await /* auth utility */();
  const result = await /* service function */(user.id, data);
  
  revalidatePath("/portal/my-feature"); // or specific path that should refresh
  
  return { success: true, data: result };
}
```

## File Structure

```
app/actions/
  ├── feature-name.ts       # Main CRUD operations
  ├── feature-utils.ts      # Helper actions
  └── AGENTS.md            # This file
```

## Action Naming Convention

- `get*Action()` - Read operations
- `create*Action()` - Create operations
- `update*Action()` - Update operations
- `delete*Action()` - Delete operations
- `*Action()` - Custom operations

## Security Checklist

Before completing any server action, verify:

- [ ] Uses appropriate authentication utility from `/lib/services/auth-server`
- [ ] Validates input with Zod schema from `/schemas`
- [ ] Calls service layer functions from `/lib/services` (not direct DB queries)
- [ ] Checks ownership (userId matches for user-specific resources)
- [ ] Revalidates cache with `revalidatePath()` after mutations
- [ ] Returns consistent response format
- [ ] Throws errors for exceptional cases (don't return error objects)

## Example Template

**Review existing actions in this directory for reference, then adapt this template:**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { /* auth utility */ } from "@/lib/services/auth-server";
import { /* service functions */ } from "@/lib/services/thing-service";
import { /* schema and type */ } from "@/schemas/thing";

export async function getThingsAction() {
  const user = await /* auth utility */();
  const things = await /* service function */(user.id);
  return { success: true, data: things };
}

export async function createThingAction(data: /* Type */) {
  const user = await /* auth utility */();
  const validated = /* schema */.parse(data);
  const thing = await /* service function */(user.id, validated);
  
  revalidatePath("/portal/things");
  
  return { success: true, data: thing };
}
```

## Discovery Process

When creating new actions:

1. **Check `/lib/services/auth-server.ts`** - Find appropriate auth functions
2. **Check `/schemas`** - Look for existing schemas or create new ones
3. **Check `/lib/services`** - Find or create service functions
4. **Check existing actions** - Follow established patterns in this directory
5. **Review project conventions** - Check `AGENTS.md` and `.github/copilot-instructions.md`

## Common Patterns

### Update with ID extraction
```typescript
export async function updateThingAction(data: /* UpdateType */) {
  const user = await /* auth utility */();
  const validated = /* schema */.parse(data);
  const { id, ...updateData } = validated; // Extract ID from data
  
  const thing = await /* service function */(id, user.id, updateData);
  revalidatePath("/portal/things");
  
  return { success: true, data: thing };
}
```

### With optional parameters
```typescript
export async function getProgressAction(
  thingId: string,
  startDate?: Date,
  endDate?: Date
) {
  const user = await /* auth utility */();
  const progress = await /* service function */(thingId, user.id, startDate, endDate);
  return { success: true, data: progress };
}
```

### Batch operations
```typescript
export async function processBatchAction() {
  const user = await /* auth utility */();
  const results = await /* service function */(user.id);
  
  revalidatePath("/portal/things");
  
  return {
    success: true,
    data: results,
    message: `${results.length} items processed`,
  };
}
```
