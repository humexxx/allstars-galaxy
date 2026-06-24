import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";

// Three-step "How it works" — anchored in what the app actually does today.
// Step 1 maps to /portal/portfolio (add accounts), step 2 maps to
// /portal/investment-methods + /portal/plans (codify), step 3 maps to the
// dashboard + road paths (watch progress).
const STEPS = [
  {
    n: "01",
    title: "Add your accounts",
    description:
      "Start a portfolio, log transactions and pick the investment methods you actually follow. Everything sits in one workspace from day one.",
  },
  {
    n: "02",
    title: "Codify the plan",
    description:
      "Build finance plans for income, expenses, debts and net worth. Stack the methods you trust and compare scenarios side by side.",
  },
  {
    n: "03",
    title: "Watch it compound",
    description:
      "Track road paths across quarters, run the board for the week, and let the dashboard surface the snapshot of where you stand.",
  },
];

export function LandingFeatures() {
  return (
    <section id="how" className="border-b bg-background py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <Heading level="h2" className="mt-3">
            Three moves. One orbit.
          </Heading>
          <Text variant="muted" className="mt-4">
            No onboarding course, no twelve-step wizard. Add, codify, compound.
          </Text>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-card p-8 lg:p-10">
              <Mono className="text-xs font-semibold text-muted-foreground">
                {s.n}
              </Mono>
              <Heading level="h3" className="mt-4 text-xl sm:text-xl">
                {s.title}
              </Heading>
              <Text variant="muted" className="mt-2 leading-relaxed">
                {s.description}
              </Text>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
