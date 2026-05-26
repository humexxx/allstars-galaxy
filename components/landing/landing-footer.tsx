import Link from "next/link";

import { GalaxyLogo } from "./galaxy-logo";

// Every link here either points at a real portal route or at an in-page
// anchor of the landing. No placeholder pages (About, Blog, Help center,
// etc.) — they would 404 today.
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Finance",
    links: [
      { label: "Portfolio", href: "/portal/portfolio" },
      { label: "Investment Methods", href: "/portal/investment-methods" },
      { label: "Finance Plans", href: "/portal/plans" },
    ],
  },
  {
    title: "Productivity",
    links: [
      { label: "Board", href: "/portal/productivity/board" },
      { label: "Road Paths", href: "/portal/productivity/road-paths" },
    ],
  },
  {
    title: "Entertainment",
    links: [
      { label: "Travel Planner", href: "/portal/entertainment/travel-planner" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Get started", href: "/signup" },
      { label: "Forgot password", href: "/forgot-password" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 text-neutral-900">
              <GalaxyLogo variant="light" />
              <span className="text-base font-semibold tracking-tight">Allstars Galaxy</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-600">
              One workspace for your money, your time, and the goals that connect them.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-700 transition hover:text-neutral-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-neutral-200 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-neutral-500">
            © {new Date().getFullYear()} Allstars Galaxy. All rights reserved.
          </p>
          <p className="text-xs text-neutral-500">
            Built for people who think in systems, not in spreadsheets.
          </p>
        </div>
      </div>
    </footer>
  );
}
