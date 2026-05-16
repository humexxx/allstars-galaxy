import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalPageContainer } from "@/components/portal/page-container";
import { getEffectiveContext } from "@/lib/services/impersonation";

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
      <AppSidebar
        role={ctx.realRole ?? "user"}
        isImpersonating={ctx.isImpersonating}
      />
      <SidebarInset>
        <AppHeader
          realUser={ctx.realUser}
          impersonatedUser={ctx.impersonatedUser}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PortalPageContainer>{children}</PortalPageContainer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
