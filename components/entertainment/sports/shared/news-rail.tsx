import { Eyebrow, Text } from "@/components/ui/typography";
import type { NewsStory } from "@/types/sports";

import type { MatchTimeFormat } from "./match-time";
import { StoryFoot, StoryImage, StoryLink } from "./story-parts";

const CARD =
  "flex w-44 shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-2 transition-colors hover:border-foreground/25";

/**
 * A dashboard card's "Latest news": a rail of small cards, picture over
 * headline. Scroll-snap rather than a carousel library — the card is narrow,
 * a swipe is the gesture people already use here, and it adds no
 * dependency. A story opens on our own page (F1's wire) or at the source in
 * a new tab (ESPN's).
 */
export function NewsRail({
  stories,
  format,
}: {
  stories: NewsStory[];
  format: MatchTimeFormat;
}): React.ReactElement | null {
  if (stories.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow size="sm">Latest news</Eyebrow>
      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {stories.map((story) => (
          <StoryLink key={story.id} story={story} className={CARD}>
            <StoryImage story={story} sizes="176px" className="aspect-video w-full rounded-md" />
            <Text as="span" variant="small" weight="medium" className="line-clamp-3 leading-snug text-foreground">
              {story.headline}
            </Text>
            <StoryFoot story={story} day={format.shortDay(story.at)} />
          </StoryLink>
        ))}
      </div>
    </div>
  );
}
