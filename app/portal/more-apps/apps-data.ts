/**
 * Config + types for the "More apps" page.
 *
 * Two sources combine into the final list:
 * 1. `MANUAL_APPS` — apps we maintain by hand (Firebase, others, WIP).
 *    Edit this array to add/remove/update these entries.
 * 2. Vercel API — auto-fetched via `listVercelProjects()` when
 *    `VERCEL_API_TOKEN` is set. Use `VERCEL_OVERRIDES` to override
 *    descriptions or other fields for specific Vercel projects, and
 *    `VERCEL_EXCLUDE` to hide ones you don't want listed.
 *
 * Screenshots: if `screenshot` is null and `url` is set, the page falls
 * back to a microlink-generated preview (24h cached). Set `screenshot`
 * to a path like `/apps/<slug>.png` to use a manual asset from /public.
 */

export type AppProvider = "vercel" | "firebase" | "other";

export type AppListing = {
  slug: string;
  name: string;
  description: string;
  url: string | null;
  provider: AppProvider;
  screenshot: string | null;
  updatedAt: string | null;
  status: "live" | "coming-soon";
  // Direct link to the provider's console/dashboard for this project.
  // Populated automatically for Vercel apps (via API) and Firebase apps
  // (derived from the *.web.app / *.firebaseapp.com URL). Leave undefined
  // for manual apps to fall back to URL-based derivation.
  consoleUrl?: string | null;
};

// Apps NOT on Vercel — edit freely. Vercel apps are auto-discovered.
export const MANUAL_APPS: AppListing[] = [
  {
    slug: "padel-galaxy",
    name: "Padel Galaxy",
    description: "Padel pozos: timer, brackets and rankings.",
    url: "https://padel-galaxy-1c7a2.web.app/",
    provider: "firebase",
    screenshot: null,
    updatedAt: null,
    status: "live",
  },
  {
    slug: "trim-success",
    name: "Trim Success",
    description: "Inventory and sales analytics workspace.",
    url: "https://trim-success.web.app",
    provider: "firebase",
    screenshot: null,
    updatedAt: null,
    status: "live",
  },
  {
    slug: "lixcore",
    name: "Lixcore",
    description: "Coming soon.",
    url: null,
    provider: "other",
    screenshot: null,
    updatedAt: null,
    status: "coming-soon",
  },
];

// Override fields on auto-discovered Vercel projects (keyed by Vercel
// project name = the slug). Use this to add a description, fix a name,
// or pin a manual screenshot. Anything not overridden uses Vercel's data.
export const VERCEL_OVERRIDES: Record<string, Partial<AppListing>> = {
  "cv-galaxy": {
    name: "CV Galaxy",
    description: "Personal CV / portfolio site.",
  },
};

// Vercel project names that should NEVER appear in the list, no matter
// what the user does in the UI. Use this for things like the app itself
// or projects you genuinely don't want to expose. For run-of-the-mill
// hiding/showing, use the eye-off button on each card — that persists
// per-browser via localStorage and is fully reversible from the UI.
export const VERCEL_EXCLUDE: string[] = ["allstars-galaxy"];

/**
 * Best-effort console URL for an app. Returns the app's pre-set
 * `consoleUrl` if present, otherwise derives one from the URL pattern
 * for known providers.
 *
 * - Firebase: any `<project-id>.web.app` or `<project-id>.firebaseapp.com`
 *   URL maps to `https://console.firebase.google.com/project/<id>/overview`.
 * - Vercel: populated by the vercel-service from API data — we can't
 *   derive it from a custom domain reliably.
 * - Other: null.
 */
export function deriveConsoleUrl(app: AppListing): string | null {
  if (app.consoleUrl !== undefined) return app.consoleUrl;
  if (!app.url) return null;

  if (app.provider === "firebase") {
    try {
      const host = new URL(app.url).hostname;
      const match = host.match(/^(.+?)\.(web\.app|firebaseapp\.com)$/);
      if (match) {
        return `https://console.firebase.google.com/project/${match[1]}/overview`;
      }
    } catch {
      // fall through to null
    }
  }
  return null;
}
