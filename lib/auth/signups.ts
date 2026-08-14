import "server-only";

/**
 * Whether the app currently accepts new accounts.
 *
 * **Fail-closed on purpose.** Anything other than a literal `"true"` — unset,
 * empty, a typo — means closed. This is an access gate: a misconfigured deploy
 * should refuse signups, not silently open them.
 *
 * Read this on the server only. Gating the UI is not a gate: signup runs in the
 * browser against Supabase with the publishable key, so anyone can call
 * `auth.signUp` directly regardless of what this app renders.
 *
 * **The authoritative switch is Supabase's own setting**
 * (Dashboard → Authentication → Sign In / Providers → "Allow new users to sign
 * up"). Turn that off too. What this flag buys you is the app-side experience —
 * a closed signup page, no dead link on login, and rejecting a brand-new OAuth
 * account at the callback — not the enforcement itself.
 */
export function signupsAllowed(): boolean {
  return process.env.ALLOW_SIGNUPS === "true";
}

/**
 * How fresh an account has to be for an OAuth callback to count as "this login
 * just created the account". The callback fires seconds after Supabase inserts
 * the user, so a minute is comfortably wide without catching returning users.
 */
export const NEW_ACCOUNT_WINDOW_MS = 60_000;
