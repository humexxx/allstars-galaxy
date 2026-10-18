import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";

import { PageHeader } from "@/components/portal/page-header";
import { PortalPageContainer } from "@/components/portal/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminOrRedirect } from "@/lib/services/auth-server";
import { MoreAppsList } from "@/components/more-apps/more-apps-list";
import { getScreenshotUrl } from "@/lib/services/screenshot-service";
import { listVercelProjects } from "@/lib/services/vercel-service";
import type { AppListing } from "@/types/apps";
import { MANUAL_APPS, VERCEL_EXCLUDE, VERCEL_OVERRIDES } from "./apps-data";

export const metadata: Metadata = {
  title: "More Apps",
  description: "Quick links to my other apps and projects.",
};

// No page-level `revalidate`: the admin gate reads cookies, so this page is
// dynamic anyway. The caching lives in the services (Vercel 10 min,
// screenshots 24h).

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
    <PortalPageContainer>
      <PageHeader
        title="More apps"
        description="Quick links to my other apps and projects."
      />
      {apps.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No apps to show yet"
          description="Apps appear here once they are listed in the catalogue."
        />
      ) : (
        <MoreAppsList
          items={apps.map((app, i) => ({ app, screenshotUrl: screenshots[i] }))}
        />
      )}
    </PortalPageContainer>
  );
}
