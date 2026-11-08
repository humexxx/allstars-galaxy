import type { ReactNode } from "react";

import { PortalPageContainer } from "@/components/portal/page-container";

export default function TradingLayout({ children }: { children: ReactNode }): React.ReactElement {
  return <PortalPageContainer>{children}</PortalPageContainer>;
}
