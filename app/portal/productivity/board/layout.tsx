import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

/** A kanban is a data surface: four columns need the wide layout. */
export default function BoardLayout({ children }: { children: ReactNode }) {
  return <PortalPageContainer width="wide">{children}</PortalPageContainer>;
}
