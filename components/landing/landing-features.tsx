import { Heading } from "@/components/ui/typography";

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
    <section
      id="how"
      className="border-b border-neutral-200/80 bg-white py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            How it works
          </span>
          <Heading level="h2" className="mt-3 text-neutral-900">
            Three moves. One orbit.
          </Heading>
          <p className="mt-4 text-neutral-500">
            No onboarding course, no twelve-step wizard. Add, codify, compound.
          </p>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-white p-8 lg:p-10">
              <span className="font-mono text-xs font-semibold text-neutral-400">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {s.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
