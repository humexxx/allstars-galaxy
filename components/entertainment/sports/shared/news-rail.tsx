import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Eyebrow, Mono } from "@/components/ui/typography";
import type { NewsStory } from "@/types/sports";

import type { MatchTimeFormat } from "./match-time";

/**
 * A dashboard card's "Latest news": a rail of small cards, picture over
 * headline. Scroll-snap rather than a carousel library — the card is narrow,
 * a swipe is the gesture people already use here, and it adds no
 * dependency. A story opens on our own page (F1's wire) or at the source in
 * a new tab (ESPN's).
 */
export function NewsRail({ stories, format }: { stories: NewsStory[]; format: MatchTimeFormat }) {
  if (stories.length === 0) return null;
  const card =
    "group flex w-44 shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-2 transition-colors hover:border-foreground/25";
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow size="sm">Latest news</Eyebrow>
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {stories.map((story) => {
          const body = (
            <>
              {story.image && (
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                  <Image
                    src={story.image.url}
                    alt={story.image.alt ?? story.headline}
                    fill
                    sizes="176px"
                    className="object-cover"
                    // The wire's CDN is whatever ESPN is using that week; an
                    // allowlist would break the day it changes.
                    unoptimized
                  />
                </div>
              )}
              <span className="line-clamp-3 text-xs font-medium leading-snug">{story.headline}</span>
              <span className="mt-auto flex items-center gap-1 text-muted-foreground">
                <Mono className="text-2xs">{format.shortDay(story.at)}</Mono>
                {story.external && (
                  <>
                    <ExternalLink aria-hidden className="size-3" />
                    <span className="sr-only">(opens ESPN in a new tab)</span>
                  </>
                )}
              </span>
            </>
          );
          return story.external ? (
            <a key={story.id} href={story.href} target="_blank" rel="noopener noreferrer" className={card}>
              {body}
            </a>
          ) : (
            <Link key={story.id} href={story.href} className={card}>
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
