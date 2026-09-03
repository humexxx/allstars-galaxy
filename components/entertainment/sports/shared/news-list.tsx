import Image from "next/image";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { Mono, Text } from "@/components/ui/typography";
import type { F1NewsImage } from "@/db/schema";

export type NewsItem = {
  id: string;
  headline: string;
  description: string | null;
  link: string | null;
  images: F1NewsImage[];
  firstSeenAt: Date;
};

/**
 * A wire of articles, newest first.
 *
 * The thumbnail is the widest image the provider sent — its list runs from
 * small crops to full-bleed and the first one is not reliably the best.
 */
function thumbnail(images: F1NewsImage[]): F1NewsImage | null {
  if (images.length === 0) return null;
  return images.reduce((best, i) => ((i.width ?? 0) > (best.width ?? 0) ? i : best));
}

export function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No news yet"
        description="Stories land here once the daily refresh has run."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const image = thumbnail(item.images);
        return (
          // Our own page, not the source: it is shareable, it carries the
          // rest of the wire underneath, and the way out to the original is
          // on it.
          <Link
            key={item.id}
            href={`/news/f1/${item.id}`}
            className="group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50"
          >
            {image?.url && (
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                <Image
                  src={image.url}
                  alt={image.alt ?? ""}
                  fill
                  sizes="80px"
                  className="object-cover"
                  // Provider images come from whatever CDN ESPN is using that
                  // week; `unoptimized` avoids a remotePatterns allowlist that
                  // would silently break the day it changes.
                  unoptimized
                />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-medium leading-snug">
                {item.headline}
              </span>
              {item.description && (
                <Text variant="small" className="line-clamp-2">
                  {item.description}
                </Text>
              )}
              <Mono className="mt-auto text-2xs text-muted-foreground">
                {item.firstSeenAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Mono>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
