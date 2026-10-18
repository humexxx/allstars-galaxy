import type { Metadata } from "next";

import { SkipLink } from "@/components/skip-link";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStats } from "@/components/landing/landing-stats";
import { LandingModules } from "@/components/landing/landing-modules";
import { LandingSplit } from "@/components/landing/landing-split";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { signupsAllowed } from "@/lib/auth/signups";

export const metadata: Metadata = {
  title: { absolute: "Allstars Galaxy — Money and time, in one orbit" },
  description:
    "The calm command center for your finances, your week and the goals that connect them.",
};

export default function LandingPage() {
  // While signups are closed every "Get started" would land on the closed
  // notice at /signup, so the calls to action point at /login instead.
  const signupsOpen = signupsAllowed();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <SkipLink />
      <LandingNav signupsOpen={signupsOpen} />
      <main id="main-content" tabIndex={-1} className="outline-none">
        <LandingHero signupsOpen={signupsOpen} />
        <LandingStats />
        <LandingModules />
        <LandingSplit />
        <LandingFeatures />
        <LandingCta signupsOpen={signupsOpen} />
      </main>
      <LandingFooter signupsOpen={signupsOpen} />
    </div>
  );
}
