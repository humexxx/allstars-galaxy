import { Suspense, type ReactNode } from "react";

import { ModuleMascot } from "@/components/portal/module-mascot";
import { PortalPageContainer } from "@/components/portal/page-container";

export default function RoadPathsLayout({ children }: { children: ReactNode }) {
  return (
    <PortalPageContainer>
      {children}
      <Suspense fallback={null}>
        <ModuleMascot variant="road-paths" />
      </Suspense>
    </PortalPageContainer>
  );
}
