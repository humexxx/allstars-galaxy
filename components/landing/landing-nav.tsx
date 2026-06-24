"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

import { GalaxyLogo } from "./galaxy-logo";

const NAV_LINKS = [
  { href: "#modules", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#galaxy", label: "Manifesto" },
];

// Sticky translucent nav with backdrop blur — same treatment as trim-success
// so the landing reads as part of the same product family.
export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <GalaxyLogo variant="light" className="size-6" />
            Allstars Galaxy
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-8 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90"
          >
            Get started
            <ArrowRight className="ml-1 size-3" />
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-full text-foreground hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-full border px-4 py-2 text-center text-sm font-medium text-foreground"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-full bg-foreground px-4 py-2 text-center text-sm font-medium text-background"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
