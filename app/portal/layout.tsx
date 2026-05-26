import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalPageContainer } from "@/components/portal/page-container";
import { DevToolsProvider } from "@/components/dev-tools/dev-tools-context";
import { DevToolsDrawer } from "@/components/dev-tools/dev-tools-drawer";
import { getEffectiveContext } from "@/lib/services/impersonation";

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
  const ctx = await getEffectiveContext();

  if (!ctx) {
    redirect("/login");
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <DevToolsProvider>
        <div className="flex h-svh w-full flex-col">
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
            <SidebarInset>
              <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
                <PortalPageContainer>{children}</PortalPageContainer>
              </main>
            </SidebarInset>
          </div>
        </div>
        <DevToolsDrawer />
      </DevToolsProvider>
    </SidebarProvider>
  );
}
