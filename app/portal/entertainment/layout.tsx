import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

export default function EntertainmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
