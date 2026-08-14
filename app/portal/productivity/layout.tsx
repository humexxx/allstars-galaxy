import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

/** Every route under /portal/productivity reads at the default width. */
export default function ProductivityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
