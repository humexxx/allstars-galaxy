import type { ReactNode } from "react";

/**
 * No container here: the board and the road paths want different widths, so
 * each child segment declares its own `PortalPageContainer`.
 */
export default function ProductivityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
