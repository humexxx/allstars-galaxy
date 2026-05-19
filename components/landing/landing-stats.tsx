const STATS = [
  { kpi: "1", label: "Workspace for money + time" },
  { kpi: "5", label: "Modules that talk to each other" },
  { kpi: "0", label: "Ads, ever" },
  { kpi: "100%", label: "You stay in control" },
];

export function LandingStats() {
  return (
    <section className="border-y border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-y-10 px-5 py-14 sm:grid-cols-4 sm:px-8">
        {STATS.map((s) => (
          <div key={s.label} className="text-center sm:text-left">
            <p className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
              {s.kpi}
            </p>
            <p className="mt-2 text-sm text-neutral-600">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
