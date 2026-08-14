import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

/** Every route under /portal/admin reads at the default width. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
