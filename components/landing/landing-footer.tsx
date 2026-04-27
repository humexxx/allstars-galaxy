import Link from "next/link";
import { Github, Twitter, Linkedin } from "lucide-react";
import { GalaxyLogo } from "./galaxy-logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Portfolio", href: "/portal/portfolio" },
      { label: "Investment Methods", href: "/portal/investment-methods" },
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

export function LandingFooter(): React.ReactElement {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-6">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-bold">
              <GalaxyLogo />
              <span className="text-lg tracking-tight">Capital Galaxy</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              One workspace for your money, your time, and the goals that connect them.
            </p>
            <div className="mt-6 flex gap-2">
              <Link href="#" aria-label="Twitter" className="grid size-9 place-items-center rounded-full border hover:bg-muted">
                <Twitter className="size-4" />
              </Link>
              <Link href="#" aria-label="GitHub" className="grid size-9 place-items-center rounded-full border hover:bg-muted">
                <Github className="size-4" />
              </Link>
              <Link href="#" aria-label="LinkedIn" className="grid size-9 place-items-center rounded-full border hover:bg-muted">
                <Linkedin className="size-4" />
              </Link>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground transition hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Capital Galaxy. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built for people who think in systems, not in spreadsheets.
          </p>
        </div>
      </div>
    </footer>
  );
}
