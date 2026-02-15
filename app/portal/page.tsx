import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Capital Galaxy",
  description: "Your investment dashboard",
};
export default async function PortalPage() {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your workspace modules.</p>
      </header>
      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted/50" aria-hidden="true" />
        ))}
      </div>
    </section>
  );
}
