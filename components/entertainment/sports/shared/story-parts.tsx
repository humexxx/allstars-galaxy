import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Play } from "lucide-react";
import type { ReactNode } from "react";

import { Mono } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { NewsStory } from "@/types/sports";

/**
 * A story's way in: our own page for F1's stored wire — shareable, with the
 * rest of the wire under it and the source one tap away — or the source
 * itself, in a new tab, for the rest.
 */
export function StoryLink({
  story,
  className,
  children,
}: {
  story: NewsStory;
  className: string;
  children: ReactNode;
}): React.ReactElement {
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

export function StoryImage({
  story,
  sizes,
  className,
}: {
  story: NewsStory;
  sizes: string;
  className: string;
}): React.ReactElement | null {
  if (!story.image) return null;
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* The headline is the link's own text: an alt repeating it is read twice. */}
      <Image
        src={story.image.url}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        // The wire's CDN is whatever the provider uses that week; an
        // allowlist would break the day it changes.
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
export function StoryFoot({ story, day }: { story: NewsStory; day: string }): React.ReactElement {
  return (
    <span className="mt-auto flex items-center gap-1 text-muted-foreground">
      <Mono className="text-2xs">{day}</Mono>
      {story.external && (
        <>
          <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">(opens {sourceName(story.href)} in a new tab)</span>
        </>
      )}
    </span>
  );
}

/** "espn.com", "lolesports.com": the site a story leaves for. */
function sourceName(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "the source";
  }
}
