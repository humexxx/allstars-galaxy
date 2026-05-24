"use client"

import * as React from "react"
import { GalleryVerticalEnd } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  disabled?: boolean
}

type NavSection = {
  title: string
  url: string
  items: NavItem[]
  disabled?: boolean
}

export function AppSidebar({
  role,
  isImpersonating = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role?: "admin" | "user"
  isImpersonating?: boolean
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  // General categories; sections not yet available surface a single non-clickable placeholder.
  const navSections: NavSection[] = React.useMemo(() => {
    const financeItems: NavItem[] = [
      {
        title: "Portfolio",
        url: "/portal/portfolio",
      },
      {
        title: "Investment Methods",
        url: "/portal/investment-methods",
      },
      {
        title: "Plans",
        url: "/portal/plans",
      },
    ]

    const sections: NavSection[] = [
      {
        title: "Dashboard",
        url: "/portal",
        items: [],
      },
      {
        title: "Finance",
        url: "/portal/portfolio",
        items: financeItems,
      },
      {
        title: "Productivity",
        url: "/portal/productivity/board",
        items: [
          {
            title: "Board",
            url: "/portal/productivity/board",
          },
          {
            title: "Road Paths",
            url: "/portal/productivity/road-paths",
          },
        ],
      },
      {
        title: "Wellness",
        url: "#",
        disabled: true,
        items: [
          { title: "Coming soon", url: "#", disabled: true },
        ],
      },
      {
        title: "Healthy Entertainment",
        url: "#",
        disabled: true,
        items: [
          { title: "Coming soon", url: "#", disabled: true },
        ],
      },
    ]

    // Admin section is its own top-level group (impersonation affects all app
    // modules, not just finance). Hidden while impersonating to avoid confusion —
    // the active session is browsing as the impersonated (non-admin) user.
    if (role === "admin" && !isImpersonating) {
      sections.push({
        title: "Admin",
        url: "/portal/admin/users",
        items: [
          {
            title: "Users",
            url: "/portal/admin/users",
          },
          {
            title: "Transactions",
            url: "/portal/admin/transactions",
          },
        ],
      })
    }

    return sections
  }, [role, isImpersonating])

  const isActive = (href: string) => pathname === href

  return (
    <Sidebar collapsible="offExamples" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/portal" onClick={handleNavClick}>
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Allstars Galaxy</span>
                  <span className="text-xs text-sidebar-foreground/70">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navSections.map((section) => {
              const sectionActive = section.title === "Dashboard" && isActive(section.url)

              return (
                <SidebarMenuItem key={section.title}>
                  {section.disabled ? (
                    <SidebarMenuButton isActive={sectionActive} disabled>
                      <span className="opacity-60">{section.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild isActive={sectionActive}>
                      <Link href={section.url} className="font-medium" onClick={handleNavClick}>
                        {section.title}
                      </Link>
                    </SidebarMenuButton>
                  )}
                  {section.items.length ? (
                    <SidebarMenuSub>
                      {section.items.map((item) => (
                        <SidebarMenuSubItem key={item.title}>
                          {item.disabled ? (
                            <SidebarMenuSubButton asChild>
                              <span className="cursor-not-allowed opacity-60" aria-disabled="true">
                                {item.title}
                              </span>
                            </SidebarMenuSubButton>
                          ) : (
                            <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                              <Link href={item.url} onClick={handleNavClick}>{item.title}</Link>
                            </SidebarMenuSubButton>
                          )}
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
