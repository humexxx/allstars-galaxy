import { toast } from "sonner";

/**
 * The client half of the `{ success, error }` envelope in `safe.ts`.
 *
 * Server actions report failure in their return value; only an unhandled
 * exception throws. Awaiting one and then announcing success — the pattern
 * this replaces — makes a rejected mutation look like it worked: a green
 * toast, a closed dialog, and nothing saved. The user finds out on reload.
 *
 * Returns whether the action succeeded so the caller can decide what to close.
 */
export async function runAction<T>(
  call: Promise<{ success: boolean; data?: T; error?: string }>,
  messages: { success?: string; failure: string }
): Promise<{ ok: boolean; data?: T }> {
  try {
    const result = await call;
    if (!result.success) {
      toast.error(result.error || messages.failure);
      return { ok: false };
    }
    if (messages.success) toast.success(messages.success);
    return { ok: true, data: result.data };
  } catch {
    toast.error(messages.failure);
    return { ok: false };
  }
}
