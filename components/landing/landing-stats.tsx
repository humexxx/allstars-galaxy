import { Text } from "@/components/ui/typography";

// Proof strip — quiet sentence on the left, the actual module surface area
// on the right. Labels match the live modules in app/portal/* so the strip
// doubles as a one-line product map.
export function LandingStats() {
  return (
    <section className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-12 sm:flex-row sm:justify-between">
        <Text variant="muted">
          Built for people who think in systems, not in spreadsheets
        </Text>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground">
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
