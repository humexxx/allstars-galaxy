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
import {
  visibleSections,
  isNavLeafActive,
  type Role,
} from "@/components/portal/nav-config"

export function AppSidebar({
  role,
  isImpersonating = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role?: Role
  isImpersonating?: boolean
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  // Topology + data come straight from the shared `PORTAL_NAV` so the sidebar,
  // header, and ⌘K menu never drift apart. Disabled sections (e.g. Wellness)
  // are kept here as "Coming soon" placeholders.
  const sections = React.useMemo(
    () => visibleSections(role, isImpersonating),
    [role, isImpersonating]
  )

  const isActive = (href: string) => isNavLeafActive(pathname, href)

  return (
    // The `top-14` / matching height override pin the sidebar below the sticky
    // AppHeader (see app-header.tsx). Keep this in sync with the header's
    // `h-14` if you change either.
    <Sidebar
      collapsible="offExamples"
      className="top-14 h-[calc(100svh-3.5rem)]"
      {...props}
    >
      <SidebarContent className="gap-0 px-2 pt-18">
        {sections.map((section, idx) => (
          <SidebarGroup key={section.label ?? `section-${idx}`} className="py-1">
            {section.label && (
              // Docs-style section heading: muted + light, so the section
              // titles recede and the page links read as the primary text.
              <SidebarGroupLabel className="text-muted-foreground">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const disabled = item.disabled || section.disabled
                  const active = !disabled && isActive(item.url)
                  return (
                    <SidebarMenuItem key={item.url}>
                      {disabled ? (
                        <SidebarMenuButton
                          disabled
                          className="w-fit cursor-not-allowed opacity-60"
                        >
                          {item.title}
                        </SidebarMenuButton>
                      ) : (
                        // Body/`<p>` size (text-sm, the portal's default body
                        // size); full-strength text idle, accent fill + medium
                        // weight when active. `w-fit` so the hover/active fill
                        // hugs the label instead of spanning the whole sidebar.
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          className="w-fit max-w-full"
                        >
                          <Link href={item.url} onClick={handleNavClick}>
                            {item.title}
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
