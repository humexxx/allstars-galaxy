"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DashboardProfile, DrawVariant, Team } from "@/types/sports";

import { PairFaces } from "./shared/draw-match-card";
import { Portrait } from "./shared/portrait";
import { TeamBadge } from "./shared/team-badge";

/** What a face on a card is: a player, a padel pair, or a team's crest. */
export type FaceKind = DrawVariant | "team";

/**
 * A face on a dashboard card's lead event — a player's (the flag where there
 * is no photo), a pair's two, or a team's crest — and for a player or a pair
 * its tooltip: the photo large, who it is, and what the card knows of them
 * (the seed, the tour's ranking, how far they got here). A team's crest has
 * none: the line beside it already names the team.
 *
 * A client component given data, for the reason `BracketTie` is one.
 */
export function EventFace({
  entry,
  variant,
  profile,
}: {
  entry: Team;
  variant: FaceKind;
  profile?: DashboardProfile;
}): React.ReactElement {
  if (variant === "team") return <TeamBadge team={entry} size="sm" />;
  const pair = variant === "pair";
  const photos = pair ? (entry.photos ?? []) : [entry.logoUrl ?? null];
  const seeded = /^\d+$/.test(entry.code.trim());
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex">
          {pair ? (
            <PairFaces pair={entry} />
          ) : (
            <Portrait
              size="md"
              subject={{ name: entry.shortName, imageUrl: entry.logoUrl }}
              fallback={<span className="text-base leading-none">{entry.name}</span>}
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-3 px-3 py-2.5">
        {photos.some(Boolean) && (
          <span className="flex shrink-0">
            {photos.map((src, i) =>
              src ? (
                // eslint-disable-next-line @next/next/no-img-element -- ESPN's and the padel API's CDNs; an allowlist breaks the day either moves.
                <img
                  key={i}
                  src={src}
                  alt=""
                  className={cn("size-14 rounded-full bg-background/10 object-cover object-top", i > 0 && "-ml-3")}
                />
              ) : null
            )}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">
            {!pair && entry.name ? `${entry.name} ` : ""}
            {pair ? entry.name : entry.shortName}
          </span>
          {seeded && <span className="opacity-70">Seed {entry.code}</span>}
          {profile?.ranking && <span className="opacity-70">Ranking {profile.ranking}</span>}
          {profile?.result && <span>{profile.result}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
