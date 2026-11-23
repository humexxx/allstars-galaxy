"use client";

import { Newspaper } from "lucide-react";
import { useId } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Eyebrow, Heading, Text } from "@/components/ui/typography";
import { leadStory, teamInterest, type NewsInterest } from "@/lib/sports/news";
import { cn } from "@/lib/utils";
import type { NewsStory, Team } from "@/types/sports";

import { ShowMoreRows, useShownRows } from "./show-more";
import { StoryFoot, StoryImage, StoryLink } from "./story-parts";
import { useSavedTeamFilter } from "./team-filter-context";
import { useMatchTime } from "./time-zone-context";

const CARD =
  "flex rounded-lg border bg-card transition-colors focus-visible:outline-hidden hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring";

/** Stories set beside the lead with their pictures, before the list. */
const SECONDARY = 2;

/**
 * A sport's wire as a front page: one story leading it (`leadStory`), big;
 * two more beside it with their pictures (the first of the rest that have
 * one); then everything else as a dense list — headline, source, day and a
 * small picture — ten at a time, in two columns where there is room. Three
 * sizes, so the tab reads as an edition rather than a pile of cards the same.
 */
export function NewsList({
  lead,
  items,
}: {
  lead?: NewsStory | null;
  items: NewsStory[];
}): React.ReactElement {
  const format = useMatchTime();
  const moreId = useId();
  const withPicture = items.filter((s) => s.image).slice(0, SECONDARY);
  const secondary = withPicture.length > 0 ? withPicture : items.slice(0, SECONDARY);
  const rest = items.filter((s) => !secondary.includes(s));
  const rows = useShownRows(rest);
  // Beside a lead with no picture the two would stand far taller than it:
  // they go under it instead, side by side.
  const beside = !!lead?.image;
  if (!lead && items.length === 0) {
    return (
      <EmptyState icon={Newspaper} title="No news yet" description="Stories land here as the wire brings them." />
    );
  }

  return (
    <div className="@container flex flex-col gap-6">
      {(lead || secondary.length > 0) && (
        <div className={cn("grid gap-3", beside && "@3xl:grid-cols-3")}>
          {lead && (
            <StoryLink
              story={lead}
              className={cn(CARD, "flex-col overflow-hidden rounded-xl", beside && "@3xl:col-span-2")}
            >
              <StoryImage
                story={lead}
                sizes="(min-width: 1024px) 50rem, 100vw"
                className="aspect-video w-full"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 @2xl:p-6">
                <Eyebrow size="sm" as="span">
                  Top story
                </Eyebrow>
                <Heading level="h3" as="h2" className="leading-snug">
                  {lead.headline}
                </Heading>
                {tells(lead) && (
                  <Text variant="muted" className="line-clamp-3">
                    {lead.description}
                  </Text>
                )}
                <StoryFoot story={lead} day={format.shortDay(lead.at)} source />
              </div>
            </StoryLink>
          )}
          {secondary.length > 0 && (
            // Side by side under the lead on a phone and a tablet, stacked
            // beside it once there are three columns.
            <div className={cn("grid grid-cols-2 gap-3", beside && "@3xl:grid-cols-1 @3xl:grid-rows-2")}>
              {secondary.map((story) => (
                <StoryLink key={story.id} story={story} className={cn(CARD, "flex-col overflow-hidden")}>
                  <StoryImage story={story} sizes="(min-width: 1024px) 24rem, 50vw" className="aspect-video w-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                    <Text asChild weight="medium" className="line-clamp-3 leading-snug @3xl:line-clamp-2">
                      <h2>{story.headline}</h2>
                    </Text>
                    {tells(story) && (
                      // Not on a phone: two columns there leave the headline room enough.
                      <div className="hidden @2xl:block">
                        <Text variant="small" className="line-clamp-2 @3xl:line-clamp-1">
                          {story.description}
                        </Text>
                      </div>
                    )}
                    <StoryFoot story={story} day={format.shortDay(story.at)} />
                  </div>
                </StoryLink>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.total > 0 && (
        <section aria-labelledby={moreId} className="flex flex-col gap-2">
          <Eyebrow size="sm" asChild>
            <h2 id={moreId} className="py-1">
              More stories
            </h2>
          </Eyebrow>
          {/* Rules between the rows rather than a card each: the list is
              for scanning, and forty borders made it read as one grey block. */}
          <ul role="list" className="grid gap-x-8 @3xl:grid-cols-2">
            {rows.shown.map((story) => (
              <li key={story.id} className="border-b">
                <StoryLink
                  story={story}
                  className="group flex items-start gap-3 rounded-md py-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Text asChild weight="medium" className="line-clamp-2 leading-snug group-hover:underline">
                      <h3>{story.headline}</h3>
                    </Text>
                    <StoryFoot story={story} day={format.shortDay(story.at)} source />
                  </div>
                  <StoryImage story={story} sizes="96px" className="aspect-video w-20 shrink-0 rounded-md sm:w-24" />
                </StoryLink>
              </li>
            ))}
          </ul>
          <ShowMoreRows rows={rows} />
        </section>
      )}
    </div>
  );
}

/** Whether a story's standfirst says more than its headline: some wires send the headline twice. */
function tells(story: NewsStory): boolean {
  return !!story.description && story.description.trim() !== story.headline.trim();
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
