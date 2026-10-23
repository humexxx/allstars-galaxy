import type { ReactNode } from "react";

/**
 * No container here: each child segment declares its own
 * `PortalPageContainer`, and `productivity/error.tsx` renders one too —
 * a container in this layout would wrap it a second time.
 */
export default function ProductivityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
