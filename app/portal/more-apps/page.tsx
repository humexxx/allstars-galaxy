import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/page-header";
import { requireAdminOrRedirect } from "@/lib/services/auth-server";
import { MoreAppsList } from "@/components/more-apps/more-apps-list";
import { getScreenshotUrl } from "@/lib/services/screenshot-service";
import { listVercelProjects } from "@/lib/services/vercel-service";
import {
  MANUAL_APPS,
  VERCEL_EXCLUDE,
  VERCEL_OVERRIDES,
  type AppListing,
} from "./apps-data";

export const metadata: Metadata = {
  title: "More Apps | Allstars Galaxy",
  description: "Quick links to my other apps and projects.",
};

// Page-level cache: Vercel data refreshes every 10 min inside the
// service. We re-render the shell at most hourly so manual edits to
// apps-data.ts surface promptly on navigation.
export const revalidate = 3_600;

async function buildAppList(): Promise<AppListing[]> {
  const vercelProjects = await listVercelProjects();
  const manualSlugs = new Set(MANUAL_APPS.map((a) => a.slug));

  const enriched = vercelProjects
    .filter((app) => !VERCEL_EXCLUDE.includes(app.slug))
    // Manual entries win over Vercel auto-discovery: lets the user pin
    // an app's provider/description even if it also exists on Vercel.
    .filter((app) => !manualSlugs.has(app.slug))
    .map((app) => ({ ...app, ...(VERCEL_OVERRIDES[app.slug] ?? {}) }));

  // Live apps first, then coming-soon, then alphabetical within each
  // group for a stable order independent of API response order.
  return [...enriched, ...MANUAL_APPS].sort((a, b) => {
    if (a.status !== b.status) return a.status === "live" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export default async function MoreAppsPage() {
  await requireAdminOrRedirect();

  const apps = await buildAppList();

  // Resolve screenshots in parallel. Falls back to gradient placeholder
  // if microlink fails or the app has no URL.
  const screenshots = await Promise.all(
    apps.map((app) =>
      app.screenshot
        ? Promise.resolve(app.screenshot)
        : app.url
          ? getScreenshotUrl(app.url)
          : Promise.resolve(null)
    )
  );

  return (
    <section className="space-y-6">
      <PageHeader
        title="More apps"
        description="Quick links to my other apps and projects."
      />
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No apps to show yet.</p>
      ) : (
        <MoreAppsList
          items={apps.map((app, i) => ({ app, screenshotUrl: screenshots[i] }))}
        />
      )}
    </section>
  );
}
