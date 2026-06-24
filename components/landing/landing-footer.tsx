import Link from "next/link";

import { Eyebrow, Text } from "@/components/ui/typography";

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
    <footer className="border-t bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
              <GalaxyLogo variant="light" />
              <span className="text-base font-semibold tracking-tight">Allstars Galaxy</span>
            </Link>
            <Text variant="muted" className="mt-4 max-w-sm leading-relaxed">
              One workspace for your money, your time, and the goals that connect them.
            </Text>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <Eyebrow as="div">{col.title}</Eyebrow>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t pt-8 sm:flex-row sm:items-center">
          <Text variant="small">
            © {new Date().getFullYear()} Allstars Galaxy. All rights reserved.
          </Text>
          <Text variant="small">
            Built for people who think in systems, not in spreadsheets.
          </Text>
        </div>
      </div>
    </footer>
  );
}
