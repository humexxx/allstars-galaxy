export type AppProvider = "vercel" | "firebase" | "other";

/** One entry on the "More apps" page — a manual app or a Vercel project. */
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
