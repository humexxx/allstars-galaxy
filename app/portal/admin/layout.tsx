import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
