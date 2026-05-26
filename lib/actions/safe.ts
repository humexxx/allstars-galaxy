/**
 * Shared wrapper for server actions that need to swallow service-layer
 * exceptions and translate them into the `{ success, error }` envelope the
 * client expects. Without this, a raw thrown error reaches the client as an
 * unhandled rejection.
 *
 * By default the user-facing error is the generic `"Action failed"` — this
 * matches the pre-existing pattern and avoids leaking internal error
 * messages (e.g. PG constraint names, drizzle SQL fragments) to the client.
 *
 * Note: actions that simply rethrow (admin-only actions that bubble to the
 * Next.js error boundary) do NOT need this wrapper.
 */
export type ActionResult<T = void> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string }

export async function safe<T>(
  label: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[${label}] action failed:`, err)
    return { success: false, error: "Action failed" }
  }
}
