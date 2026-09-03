import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

/** Road paths read at the default width. */
export default function RoadPathsLayout({ children }: { children: ReactNode }) {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
