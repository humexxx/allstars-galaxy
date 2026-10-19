import { CalendarCheck, LineChart, Plane, Wallet } from "lucide-react"

import { Logo } from "@/components/logo"
import { Heading, Text } from "@/components/ui/typography"

const MODULES = [
  { icon: Wallet, title: "Portfolio", body: "Every buy and withdrawal, valued today." },
  { icon: LineChart, title: "Plans", body: "Income, debts and net worth, projected." },
  { icon: CalendarCheck, title: "Board & road paths", body: "This week, and the long goals behind it." },
  { icon: Plane, title: "Travel", body: "Trips, costs and who owes what." },
] as const

/**
 * The right half of the auth pages from `lg` up. It used to be shadcn's stock
 * placeholder image — on the first screen a visitor sees, that read as a page
 * nobody finished. Purely decorative, so it is hidden from assistive tech.
 */
export function AuthAside() {
  return (
    <aside
      aria-hidden="true"
      className="relative hidden overflow-hidden bg-muted lg:flex lg:flex-col lg:justify-center lg:p-16"
    >
      <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-chart-2/10 blur-3xl" />

      <div className="relative flex max-w-md flex-col gap-8">
        <Logo className="size-10" decorative />
        <div className="flex flex-col gap-3">
          <Heading level="h2" as="p">
            Money and time, in one orbit.
          </Heading>
          <Text variant="muted">
            The calm command center for your portfolio, your plans, your week and
            the trips you take along the way.
          </Text>
        </div>
        <ul className="flex flex-col gap-4">
          {MODULES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-xs ring-1 ring-foreground/5">
                <Icon className="size-4" />
              </span>
              <div className="flex flex-col">
                <Text weight="medium">{title}</Text>
                <Text variant="small">{body}</Text>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
