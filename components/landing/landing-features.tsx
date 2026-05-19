const STEPS = [
  {
    n: "01",
    title: "Connect your world",
    description:
      "Add accounts, goals, methods and projects in minutes. Everything in one place — no more tab juggling.",
  },
  {
    n: "02",
    title: "Define the system",
    description:
      "Set rules for how money moves, how time gets spent and what counts as progress this quarter.",
  },
  {
    n: "03",
    title: "Watch it compound",
    description:
      "Capital Galaxy quietly tracks the orbit. You make decisions; it shows you whether they're working.",
  },
];

export function LandingFeatures() {
  return (
    <section id="how" className="bg-white">
      <div className="mx-auto w-full max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            How it works
          </p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-neutral-900 text-balance sm:text-5xl">
            From scattered to systematic — in three moves.
          </h2>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-white p-8 lg:p-10">
              <span className="font-mono text-xs font-semibold text-neutral-400">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {s.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
