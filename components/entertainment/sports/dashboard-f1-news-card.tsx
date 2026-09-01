import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Heading, Mono, Text } from "@/components/ui/typography";
import { getF1News } from "@/lib/services/rapidapi-f1-news-service";
import { listUserFavoriteSportIds } from "@/lib/services/sports-service";
import type { F1NewsImage } from "@/db/schema";

const F1_PATH = "/portal/entertainment/sports?sport=f1";

/** The widest image the provider sent — its list runs small crops to full bleed. */
function thumbnail(images: F1NewsImage[]): F1NewsImage | null {
  if (images.length === 0) return null;
  return images.reduce((best, i) => ((i.width ?? 0) > (best.width ?? 0) ? i : best));
}

/**
 * The latest F1 headlines, for people who follow F1.
 *
 * Gated on the favourite rather than shown to everyone: the dashboard's other
 * sports surface already works that way, and a motorsport wire on the desk of
 * somebody who does not watch it is noise.
 */
export async function DashboardF1NewsCard({ userId }: { userId: string }) {
  const favorites = await listUserFavoriteSportIds(userId);
  if (!favorites.includes("f1")) return null;

  // One story. A dashboard card is a glance, and the wire is one click away.
  const [latest] = await getF1News(1);
  if (!latest) return null;

  const image = thumbnail(latest.images);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h5" as="h2" className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              F1 news
            </Heading>
            <Text variant="muted" className="mt-1">
              The latest from the paddock
            </Text>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={F1_PATH}>
              More news <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Link
          href={`/news/f1/${latest.id}`}
          className="group flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/60 sm:flex-row"
        >
          {image?.url && (
            <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-md bg-muted sm:aspect-square sm:size-28">
              <Image
                src={image.url}
                alt={image.alt ?? ""}
                fill
                sizes="(max-width: 640px) 100vw, 112px"
                className="object-cover"
                // The provider's CDN is whatever ESPN is using that week; an
                // allowlist would break silently the day it changes.
                unoptimized
              />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium leading-snug">{latest.headline}</span>
            {latest.description && (
              <Text variant="small" className="line-clamp-2">
                {latest.description}
              </Text>
            )}
            <Mono className="mt-auto text-2xs text-muted-foreground">
              {latest.firstSeenAt.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Mono>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
