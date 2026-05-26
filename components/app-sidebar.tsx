"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  disabled?: boolean
}

type NavGroup = {
  /** Label rendered above the items. Undefined → no heading, flat list. */
  label?: string
  items: NavItem[]
  /** Adds the muted "Coming soon" treatment to the whole group. */
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

  // Sidebar topology mirrors the shadcn docs page: a tiny ungrouped "home"
  // link at the very top, followed by one labelled group per product area.
  // Each group is flat (no nested submenus) — the label IS the heading.
  const navGroups: NavGroup[] = React.useMemo(() => {
    const groups: NavGroup[] = [
      {
        // Standalone group (no label) for the dashboard root link.
        items: [{ title: "Dashboard", url: "/portal" }],
      },
      {
        label: "Finance",
        items: [
          { title: "Portfolio", url: "/portal/portfolio" },
          { title: "Investment Methods", url: "/portal/investment-methods" },
          { title: "Plans", url: "/portal/plans" },
        ],
      },
      {
        label: "Productivity",
        items: [
          { title: "Board", url: "/portal/productivity/board" },
          { title: "Road Paths", url: "/portal/productivity/road-paths" },
        ],
      },
      {
        label: "Entertainment",
        items: [
          { title: "Travel Planner", url: "/portal/entertainment/travel-planner" },
          { title: "Sports", url: "/portal/entertainment/sports" },
        ],
      },
      {
        label: "Wellness",
        disabled: true,
        items: [{ title: "Coming soon", url: "#", disabled: true }],
      },
    ]

    // Admin-only nav is hidden during impersonation so the active session
    // doesn't appear privileged on someone else's behalf. "More apps" is an
    // admin convenience for jumping to sibling projects, grouped here.
    if (role === "admin" && !isImpersonating) {
      groups.push({
        label: "Admin",
        items: [
          { title: "More apps", url: "/portal/more-apps" },
          { title: "Users", url: "/portal/admin/users" },
          { title: "Transactions", url: "/portal/admin/transactions" },
        ],
      })
    }

    return groups
  }, [role, isImpersonating])

  const isActive = (href: string) => pathname === href

  return (
    // The `top-14` / matching height override pin the sidebar below the
    // sticky AppHeader (see app-header.tsx). Keep this in sync with the
    // header's `h-14` if you change either.
    <Sidebar
      collapsible="offExamples"
      className="top-14 h-[calc(100svh-3.5rem)]"
      {...props}
    >
      <SidebarContent>
        {navGroups.map((group, idx) => (
          <SidebarGroup key={group.label ?? `group-${idx}`}>
            {group.label && (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.disabled || group.disabled ? (
                      <SidebarMenuButton disabled className="cursor-not-allowed opacity-60">
                        {item.title}
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link href={item.url} onClick={handleNavClick}>
                          {item.title}
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
