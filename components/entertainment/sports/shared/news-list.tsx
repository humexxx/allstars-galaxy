"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Newspaper, Play } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { leadStory, type NewsInterest } from "@/lib/sports/news";
import { cn } from "@/lib/utils";
import type { NewsStory } from "@/types/sports";

import { useMatchTime } from "./time-zone-context";

/**
 * A story's way in: our own page for F1's stored wire — shareable, with the
 * rest of the wire under it and the source one tap away — or the source
 * itself, in a new tab, for ESPN's.
 */
function StoryLink({
  story,
  className,
  children,
}: {
  story: NewsStory;
  className: string;
  children: ReactNode;
}) {
  if (story.external) {
    return (
      <a href={story.href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={story.href} className={className}>
      {children}
    </Link>
  );
}

/** A picture, unoptimized: provider images come off whatever CDN the wire uses that week. */
function StoryImage({ story, sizes, className }: { story: NewsStory; sizes: string; className: string }) {
  if (!story.image) return null;
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={story.image.url}
        alt={story.image.alt ?? story.headline}
        fill
        sizes={sizes}
        className="object-cover"
        unoptimized
      />
      {story.kind === "video" && (
        <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-sm bg-black/70 px-1 text-2xs font-medium text-white">
          <Play aria-hidden className="size-2.5 fill-current" />
          Video
        </span>
      )}
    </div>
  );
}

/** When, and — for a story opened at the source — that it leaves the page. */
function StoryFoot({ story }: { story: NewsStory }) {
  const format = useMatchTime();
  return (
    <span className="mt-auto flex items-center gap-1 text-muted-foreground">
      <Mono className="text-2xs">{format.day(story.at)}</Mono>
      {story.external && (
        <>
          <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">(opens ESPN in a new tab)</span>
        </>
      )}
    </span>
  );
}

const CARD = "group flex rounded-lg border bg-card transition-colors hover:border-foreground/25";

/**
 * A sport's wire with one story leading it (`leadStory`), big — its picture,
 * its headline, more of its standfirst — so the tab is not a pile of cards
 * all the same size. The rest follow as cards.
 */
export function NewsList({ lead, items }: { lead?: NewsStory | null; items: NewsStory[] }) {
  if (!lead && items.length === 0) {
    return (
      <EmptyState icon={Newspaper} title="No news yet" description="Stories land here as the wire brings them." />
    );
  }

  return (
    <div className="@container flex flex-col gap-3">
      {lead && (
        <StoryLink
          story={lead}
          className={cn(CARD, "grid overflow-hidden rounded-xl @2xl:grid-cols-5")}
        >
          <StoryImage
            story={lead}
            sizes="(min-width: 1024px) 40rem, 100vw"
            className="aspect-video @2xl:col-span-3"
          />
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
            <StoryFoot story={lead} />
          </div>
        </StoryLink>
      )}
      <div className="grid gap-3 @xl:grid-cols-2">
        {items.map((story) => (
          <StoryLink key={story.id} story={story} className={cn(CARD, "gap-3 p-3")}>
            <StoryImage story={story} sizes="80px" className="size-20 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Text as="span" weight="medium" className="leading-snug">
                {story.headline}
              </Text>
              {story.description && (
                <Text variant="small" className="line-clamp-2">
                  {story.description}
                </Text>
              )}
              <StoryFoot story={story} />
            </div>
          </StoryLink>
        ))}
      </div>
    </div>
  );
}

/** A sport's News tab: its wire, led by the story most worth its reader's time. */
export function NewsTab({ stories, interest }: { stories: NewsStory[]; interest: NewsInterest }) {
  const wire = useMemo(() => leadStory(stories, interest), [stories, interest]);
  return <NewsList lead={wire.lead} items={wire.rest} />;
}
