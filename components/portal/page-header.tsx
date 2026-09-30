import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type PageHeaderBack =
  | { href: string; label: string }
  | { onClick: () => void; label: string };

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Small caps line above the title ("Formula 1"). */
  eyebrow?: ReactNode;
  /** Inline after the title: a status badge, a "Syncing" indicator. */
  badge?: ReactNode;
  /** A muted line under the description: a period, a date. */
  meta?: ReactNode;
  /** The one "back" pattern: a ghost link above the title. */
  back?: PageHeaderBack;
  actions?: ReactNode;
  /**
   * `compact` is for dense data surfaces (plan editor, portfolio), where the
   * page title is one step down the scale so the data starts higher.
   */
  size?: "default" | "compact";
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  badge,
  meta,
  back,
  actions,
  size = "default",
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {back && <PageHeaderBackButton back={back} />}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          {eyebrow && <Eyebrow as="div">{eyebrow}</Eyebrow>}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <Heading level={size === "compact" ? "h3" : "h1"} as="h1">
              {title}
            </Heading>
            {badge}
          </div>
          {description && (
            <Text variant="muted" as="div">
              {description}
            </Text>
          )}
          {meta && (
            <Text variant="small" as="div" className="tabular-nums">
              {meta}
            </Text>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}

function PageHeaderBackButton({ back }: { back: PageHeaderBack }) {
  const content = (
    <>
      <ArrowLeft aria-hidden />
      {back.label}
    </>
  );
  if ("href" in back) {
    return (
      <Button variant="ghost" size="sm" className="-ml-2 self-start" asChild>
        <Link href={back.href}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={back.onClick}>
      {content}
    </Button>
  );
}
