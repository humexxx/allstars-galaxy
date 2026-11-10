import { Suspense, type ReactNode } from "react";

import { ModuleMascot } from "@/components/portal/module-mascot";
import { PortalPageContainer } from "@/components/portal/page-container";

export default function BoardLayout({ children }: { children: ReactNode }) {
  return (
    <PortalPageContainer>
      {children}
      <Suspense fallback={null}>
        <ModuleMascot variant="board" />
      </Suspense>
    </PortalPageContainer>
  );
}
