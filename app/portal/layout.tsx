import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SkipLink } from "@/components/skip-link";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DevToolsProvider } from "@/components/dev-tools/dev-tools-context";
import { DevToolsDrawer } from "@/components/dev-tools/dev-tools-drawer";
import { ReaderTimeZoneProvider } from "@/components/reader-time-zone";
import { AiKeyExpiryNotice } from "@/components/portal/ai-key-expiry-notice";
import { keyExpiryWarning, type KeyExpiryWarning } from "@/lib/ai/key-expiry";
import { getAiSettings } from "@/lib/services/ai-service";
import { getEffectiveContext } from "@/lib/services/impersonation";
import { getRequestTimeZone, getRequestTodayIso } from "@/lib/utils/request-today";

/**
 * Topology matches the shadcn docs site: sticky full-width header on top,
 * sidebar below offset by the header height, content fills the rest.
 *
 * SidebarProvider has to wrap the WHOLE tree (not just the row beneath the
 * header) because AppHeader contains a `SidebarTrigger` that needs the
 * context. The Sidebar + SidebarInset still live as flex siblings inside
 * the row below the header — their `peer-data-*` relationship is preserved.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ctx, timeZone] = await Promise.all([
    getEffectiveContext(),
    getRequestTimeZone(),
  ]);

  if (!ctx) {
    redirect("/login");
  }

  // Admins only, and only once the key's date has been entered in Settings.
  const keyExpiry = ctx.realRole === "admin" ? await aiKeyExpiry() : null;

  return (
    <ReaderTimeZoneProvider timeZone={timeZone}>
      {/* 12rem, not shadcn's 16rem: the labels are short, and every rem the
          sidebar gives back pulls the page's centred column towards the
          middle of the window. */}
      <SidebarProvider
        defaultOpen={true}
        style={{ "--sidebar-width": "12rem" } as React.CSSProperties}
      >
        <DevToolsProvider>
          {/* On a phone the DOCUMENT scrolls, so the browser's own pull-to-refresh
            works — it only fires when the root scroller is overscrolled at the
            top, and a shell pinned to `h-svh` with the content in an inner
            `overflow-auto` never gives it the chance. From `md` up the shell
            goes back to filling the viewport with its own scrolling pane,
            which is what keeps the sidebar and header fixed. */}
          <div className="flex min-h-svh w-full flex-col md:h-svh">
            <SkipLink />
            <AppHeader
              realUser={ctx.realUser}
              impersonatedUser={ctx.impersonatedUser}
              role={ctx.realRole ?? "user"}
              isImpersonating={ctx.isImpersonating}
            />
            <div className="flex min-h-0 flex-1">
              <AppSidebar
                role={ctx.realRole ?? "user"}
                isImpersonating={ctx.isImpersonating}
              />
              {/* `min-w-0`: a flex child never shrinks below its content's
                min-content width by default, so from `lg` (sidebar showing) a
                wide board or table pushed the whole page sideways by the
                sidebar's width instead of scrolling inside its own card. */}
              <SidebarInset className="min-w-0">
                {/* No container here: each route renders its own
                  `PortalPageContainer`. `relative`: an absolutely placed
                  descendant with nothing positioned nearer (every `sr-only`
                  label) otherwise sits outside this scroller, unclipped, and
                  lengthened the document into a second scroll. */}
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="relative flex min-h-0 min-w-0 flex-1 flex-col outline-none md:overflow-auto"
                >
                  {children}
                </main>
              </SidebarInset>
            </div>
          </div>
          <DevToolsDrawer />
          {keyExpiry && <AiKeyExpiryNotice {...keyExpiry} />}
        </DevToolsProvider>
      </SidebarProvider>
    </ReaderTimeZoneProvider>
  );
}

/** The reminder an admin is due, if any. */
async function aiKeyExpiry(): Promise<{ warning: KeyExpiryWarning; expiresOn: string } | null> {
  const [{ apiKeyExpiresOn }, today] = await Promise.all([getAiSettings(), getRequestTodayIso()]);
  const warning = keyExpiryWarning(apiKeyExpiresOn, today);
  return warning && apiKeyExpiresOn ? { warning, expiresOn: apiKeyExpiresOn } : null;
}
