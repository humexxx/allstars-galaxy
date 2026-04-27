import { AppHeader } from "@/components/app-header";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentUserCached, getUserRoleCached } from "@/lib/services/auth-server";
import { PortalPageContainer } from "@/components/portal/page-container";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserCached();

  if (!user) {
    redirect("/login");
  }

  const role = await getUserRoleCached(user.id) || "user";

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar role={role} />
      <SidebarInset>
        <AppHeader user={user} />
        <div className="flex min-h-0 flex-1 flex-col min-w-0">
          <PortalPageContainer>
            {children}
          </PortalPageContainer>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
