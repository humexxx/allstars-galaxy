"use client";

import Image from "next/image";
import Link from "next/link";
import { Newspaper } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import type { F1NewsImage } from "@/db/schema";
import type { F1NewsArticle } from "@/types/sports";

import { useMatchTime } from "./time-zone-context";

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

/**
 * The wire with one story leading it (`leadStory`), big — its picture, its
 * headline, more of its standfirst — so the page is not a pile of cards all
 * the same size. The rest follow as before.
 */
export function NewsList({ lead, items }: { lead?: F1NewsArticle | null; items: F1NewsArticle[] }) {
  const format = useMatchTime();
  if (!lead && items.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="No news yet"
        description="Stories land here once the daily refresh has run."
      />
    );
  }

  const leadImage = lead ? thumbnail(lead.images) : null;
  return (
    <div className="@container flex flex-col gap-3">
      {lead && (
        <Link
          href={`/news/f1/${lead.id}`}
          className="group grid overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/25 @2xl:grid-cols-5"
        >
          {leadImage?.url && (
            <div className="relative aspect-video bg-muted @2xl:col-span-3">
              <Image
                src={leadImage.url}
                alt={leadImage.alt ?? lead.headline}
                fill
                sizes="(min-width: 1024px) 40rem, 100vw"
                className="object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-2 p-4 @2xl:col-span-2 @2xl:p-6">
            <Eyebrow size="sm" as="span">
              Top story
            </Eyebrow>
            <Heading level="h3" as="h3" className="leading-snug">
              {lead.headline}
            </Heading>
            {lead.description && (
              <Text variant="muted" className="line-clamp-4">
                {lead.description}
              </Text>
            )}
            <Mono className="mt-auto text-2xs text-muted-foreground">{format.day(lead.firstSeenAt)}</Mono>
          </div>
        </Link>
      )}
      <div className="grid gap-3 @xl:grid-cols-2">
        {items.map((item) => {
          const image = thumbnail(item.images);
          return (
            // Our own page, not the source: it is shareable, it carries the
            // rest of the wire underneath, and the way out to the original is
            // on it.
            <Link
              key={item.id}
              href={`/news/f1/${item.id}`}
              className="group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/25"
            >
              {image?.url && (
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image
                    src={image.url}
                    alt={image.alt ?? item.headline}
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
                <Text as="span" weight="medium" className="leading-snug">
                  {item.headline}
                </Text>
                {item.description && (
                  <Text variant="small" className="line-clamp-2">
                    {item.description}
                  </Text>
                )}
                <Mono className="mt-auto text-2xs text-muted-foreground">
                  {format.day(item.firstSeenAt)}
                </Mono>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
