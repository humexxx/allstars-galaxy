// Proof strip — quiet sentence on the left, the actual module surface area
// on the right. Labels match the live modules in app/portal/* so the strip
// doubles as a one-line product map.
export function LandingStats() {
  return (
    <section className="border-b border-neutral-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
        <p className="text-sm text-neutral-500">
          Built for people who think in systems, not in spreadsheets
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-neutral-400">
          <span>Portfolio</span>
          <span>·</span>
          <span>Methods</span>
          <span>·</span>
          <span>Plans</span>
          <span>·</span>
          <span>Board</span>
          <span>·</span>
          <span>Road Paths</span>
          <span>·</span>
          <span>Travel</span>
        </div>
      </div>
    </section>
  );
}
