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
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          >
            <GalaxyLogo variant="light" className="size-6" />
            Allstars Galaxy
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition-colors hover:text-neutral-900"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-8 items-center justify-center rounded-full bg-neutral-900 px-4 text-[13px] font-medium text-white transition hover:bg-neutral-800"
          >
            Get started
            <ArrowRight className="ml-1 size-3" />
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-full text-neutral-900 hover:bg-neutral-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-white md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-center text-sm font-medium text-neutral-900"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-full bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white"
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
