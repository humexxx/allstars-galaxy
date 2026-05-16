import type { Metadata } from "next";
import { PageHeader } from "@/components/portal/page-header";

export const metadata: Metadata = {
  title: "Dashboard | Capital Galaxy",
  description: "Your investment dashboard",
};

export default function PortalPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your workspace modules."
      />
      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted/50" aria-hidden="true" />
        ))}
      </div>
    </section>
  );
}
