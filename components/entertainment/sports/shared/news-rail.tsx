import { Eyebrow, Text } from "@/components/ui/typography";
import type { NewsStory } from "@/types/sports";

import type { MatchTimeFormat } from "./match-time";
import { NewsRailTrack } from "./news-rail-track";
import { StoryFoot, StoryImage, StoryLink } from "./story-parts";

const CARD =
  "flex w-44 shrink-0 snap-start flex-col gap-2 rounded-lg border bg-card p-2 transition-colors focus-visible:outline-hidden hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

/**
 * A dashboard card's "Latest news": a rail of small cards, picture over
 * headline. Scroll-snap rather than a carousel library — the card is narrow,
 * a swipe is the gesture people already use here, and it adds no
 * dependency. It steps on by itself (`NewsRailTrack`). A story opens on our own page (F1's wire) or at the source in
 * a new tab (ESPN's).
 */
export function NewsRail({
  sport,
  stories,
  format,
}: {
  /** Names the region: "NBA news". */
  sport: string;
  stories: NewsStory[];
  format: MatchTimeFormat;
}): React.ReactElement | null {
  if (stories.length === 0) return null;
  return (
    <NewsRailTrack
      label={`${sport} news`}
      heading={
        <Eyebrow size="sm" asChild>
          <h3>Latest news</h3>
        </Eyebrow>
      }
    >
      {stories.map((story) => (
        <StoryLink key={story.id} story={story} className={CARD}>
          <StoryImage story={story} sizes="176px" className="aspect-video w-full rounded-md" />
          <Text as="span" variant="small" weight="medium" className="line-clamp-3 leading-snug text-foreground">
            {story.headline}
          </Text>
          <StoryFoot story={story} day={format.shortDay(story.at)} />
        </StoryLink>
      ))}
    </NewsRailTrack>
  );
}
