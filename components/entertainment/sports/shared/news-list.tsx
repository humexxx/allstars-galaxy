"use client";

import { Newspaper } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import { leadStory, teamInterest, type NewsInterest } from "@/lib/sports/news";
import { cn } from "@/lib/utils";
import type { NewsStory, Team } from "@/types/sports";

import { StoryFoot, StoryImage, StoryLink } from "./story-parts";
import { useSavedTeamFilter } from "./team-filter-context";
import { useMatchTime } from "./time-zone-context";

const CARD = "flex rounded-lg border bg-card transition-colors hover:border-foreground/25";

/**
 * A sport's wire with one story leading it (`leadStory`), big — its picture,
 * its headline, more of its standfirst — so the tab is not a pile of cards
 * all the same size. The rest follow as cards.
 */
export function NewsList({
  lead,
  items,
}: {
  lead?: NewsStory | null;
  items: NewsStory[];
}): React.ReactElement {
  const format = useMatchTime();
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
            <Heading level="h3" className="leading-snug">
              {lead.headline}
            </Heading>
            {lead.description && (
              <Text variant="muted" className="line-clamp-4">
                {lead.description}
              </Text>
            )}
            <StoryFoot story={lead} day={format.day(lead.at)} />
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
              <StoryFoot story={story} day={format.day(story.at)} />
            </div>
          </StoryLink>
        ))}
      </div>
    </div>
  );
}

/** A sport's News tab: its wire, led by the story most worth its reader's time. */
export function NewsTab({ stories, interest }: { stories: NewsStory[]; interest: NewsInterest }): React.ReactElement {
  const wire = leadStory(stories, interest);
  return <NewsList lead={wire.lead} items={wire.rest} />;
}

/** A team sport's News tab: led by stories naming the teams picked in its match list or `leaders`, a point each. */
export function TeamNewsTab({
  stories,
  teams,
  leaders,
}: {
  stories: NewsStory[];
  teams: ReadonlyMap<string, Team>;
  leaders: readonly string[];
}): React.ReactElement {
  const saved = useSavedTeamFilter();
  return <NewsTab stories={stories} interest={teamInterest(teams, saved?.teamIds ?? [], leaders)} />;
}
