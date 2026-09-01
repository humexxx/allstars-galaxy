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
/** Enough to be worth a card, few enough to stay one. */
const SHOWN = 3;

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

  const news = await getF1News(SHOWN);
  if (news.length === 0) return null;

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
              All news <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {news.map((item) => {
            const image = thumbnail(item.images);
            const Wrapper = item.link ? "a" : "div";
            return (
              <Wrapper
                key={item.id}
                {...(item.link
                  ? { href: item.link, target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="group flex h-full flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-primary/60"
              >
                {image?.url && (
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md bg-muted">
                    <Image
                      src={image.url}
                      alt={image.alt ?? ""}
                      fill
                      sizes="(max-width: 640px) 100vw, 320px"
                      className="object-cover"
                      // The provider's CDN is whatever ESPN is using that week;
                      // an allowlist would break silently the day it changes.
                      unoptimized
                    />
                  </div>
                )}
                <span className="text-sm font-medium leading-snug">{item.headline}</span>
                <Mono className="mt-auto text-2xs text-muted-foreground">
                  {item.firstSeenAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Mono>
              </Wrapper>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
