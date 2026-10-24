import { Fragment } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * The way back from a page under the hub: Sports › Padel › Kuwait P1 2026.
 * The last step is the page itself, cut short on a phone rather than wrapped.
 */
export function SportsBreadcrumbs({
  trail,
  current,
}: {
  trail: { label: string; href: string }[];
  current: string;
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {trail.map((step) => (
          <Fragment key={step.href}>
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink asChild>
                <Link href={step.href}>{step.label}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
