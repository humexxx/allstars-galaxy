import Link from "next/link";

import { GalaxyLogo } from "./galaxy-logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Portfolio", href: "/portal/portfolio" },
      { label: "Investment Methods", href: "/portal/investment-methods" },
      { label: "Plans", href: "/portal/plans" },
      { label: "Productivity Board", href: "/portal/productivity/board" },
      { label: "Road Paths", href: "/portal/productivity/road-paths" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Roadmap", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help center", href: "#" },
      { label: "Guides", href: "#" },
      { label: "Changelog", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Security", href: "#" },
      { label: "Cookies", href: "#" },
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
              <span className="text-base font-semibold tracking-tight">Capital Galaxy</span>
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
            © {new Date().getFullYear()} Capital Galaxy. All rights reserved.
          </p>
          <p className="text-xs text-neutral-500">
            Built for people who think in systems, not in spreadsheets.
          </p>
        </div>
      </div>
    </footer>
  );
}
