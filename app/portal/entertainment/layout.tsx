import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

/** Every route under /portal/entertainment reads at the default width. */
export default function EntertainmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
