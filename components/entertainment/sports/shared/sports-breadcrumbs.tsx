import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SPORTS_BY_ID } from "@/lib/data/sports/registry";
import { SPORTS_PATH, sportPath } from "@/lib/sports/paths";
import type { SportId } from "@/types/sports";

/**
 * The way back from a page under the hub: Sports › Padel › Kuwait P1 2026.
 * The page's own name is last, cut short on a phone rather than wrapped.
 */
export function SportsBreadcrumbs({ sport, current }: { sport: SportId; current: string }): React.ReactElement {
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink asChild>
            <Link href={SPORTS_PATH}>Sports</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink asChild>
            <Link href={sportPath(sport)}>{SPORTS_BY_ID.get(sport)?.label ?? sport}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
