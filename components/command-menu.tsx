"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  visibleSections,
  type Role,
} from "@/components/portal/nav-config";

type CommandMenuProps = {
  role?: Role;
  isImpersonating?: boolean;
};

/**
 * Header search à la the shadcn docs: a faux-input button that opens a ⌘K
 * command palette over the portal's pages. Navigation comes straight from
 * `PORTAL_NAV`, so it always matches the sidebar and header.
 */
export function CommandMenu({
  role,
  isImpersonating = false,
}: CommandMenuProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Skip disabled sections/items — there's nothing to navigate to.
  const sections = React.useMemo(
    () =>
      visibleSections(role, isImpersonating)
        .filter((section) => !section.disabled)
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => !item.disabled),
        }))
        .filter((section) => section.items.length > 0),
    [role, isImpersonating]
  );

  const go = React.useCallback(
    (url: string) => {
      setOpen(false);
      router.push(url);
    },
    [router]
  );

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className={cn(
          "relative h-8 w-8 justify-center rounded-md bg-muted/50 px-0 text-sm font-normal text-muted-foreground shadow-none",
          "sm:w-44 sm:justify-start sm:px-3 md:w-56 lg:w-64"
        )}
      >
        <SearchIcon className="size-4 sm:hidden" />
        <span className="hidden sm:inline-flex">Search…</span>
        <kbd className="pointer-events-none absolute top-1/2 right-1.5 hidden h-5 -translate-y-1/2 items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-2xs font-medium text-muted-foreground select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search the portal and jump to a page"
      >
        <Command>
          <CommandInput placeholder="Search pages…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {sections.map((section, idx) => (
              <CommandGroup
                key={section.label ?? `section-${idx}`}
                heading={section.label ?? "General"}
              >
                {section.items.map((item) => (
                  <CommandItem
                    key={item.url}
                    value={`${section.label ?? ""} ${item.title}`}
                    onSelect={() => go(item.url)}
                  >
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
