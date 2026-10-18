import Link from "next/link";

import { Eyebrow, Text } from "@/components/ui/typography";

import { GalaxyLogo } from "./galaxy-logo";
import { LIVE_MODULES } from "./modules";

type FooterColumn = { title: string; links: { label: string; href: string }[] };

// Every link here points at a real portal or auth route. No placeholder pages
// (About, Blog, Help center, etc.) — they would 404 today. One product column
// per portal section, straight from the landing's module list.
function footerColumns(signupsOpen: boolean): FooterColumn[] {
  const areas = [...new Set(LIVE_MODULES.map((module) => module.area))];

  return [
    ...areas.map((area) => ({
      title: area,
      links: LIVE_MODULES.filter((module) => module.area === area).map((module) => ({
        label: module.name,
        href: module.href,
      })),
    })),
    {
      title: "Account",
      links: [
        { label: "Log in", href: "/login" },
        ...(signupsOpen ? [{ label: "Get started", href: "/signup" }] : []),
        { label: "Forgot password", href: "/forgot-password" },
      ],
    },
  ];
}

export function LandingFooter({ signupsOpen }: { signupsOpen: boolean }) {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-6">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
              <GalaxyLogo />
              <span className="text-base font-semibold tracking-tight">Allstars Galaxy</span>
            </Link>
            <Text variant="muted" className="mt-4 max-w-sm leading-relaxed">
              One workspace for your money, your time, and the goals that connect them.
            </Text>
          </div>

          {footerColumns(signupsOpen).map((col) => (
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
