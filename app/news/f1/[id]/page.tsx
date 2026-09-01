import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";
import { getF1Article, getOtherF1News } from "@/lib/services/rapidapi-f1-news-service";
import type { F1NewsImage } from "@/db/schema";

export const dynamic = "force-dynamic";

/** The widest image the provider sent — its list runs small crops to full bleed. */
function hero(images: F1NewsImage[]): F1NewsImage | null {
  if (images.length === 0) return null;
  return images.reduce((best, i) => ((i.width ?? 0) > (best.width ?? 0) ? i : best));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await getF1Article(id);
  if (!article) return { title: "F1 news" };

  const image = hero(article.images);
  return {
    title: article.headline,
    description: article.description ?? undefined,
    // The link is meant to be shared, so it has to unfurl properly.
    openGraph: {
      title: article.headline,
      description: article.description ?? undefined,
      type: "article",
      images: image?.url ? [{ url: image.url }] : undefined,
    },
  };
}

export default async function F1ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getF1Article(id);
  if (!article) notFound();

  const [image, others] = [hero(article.images), await getOtherF1News(id)];

  return (
    <article className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Eyebrow>Formula 1</Eyebrow>
        <Heading level="h1" className="text-2xl sm:text-4xl">
          {article.headline}
        </Heading>
        <Mono className="text-xs text-muted-foreground">
          {article.firstSeenAt.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </Mono>
      </div>

      {image?.url && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
          <Image
            src={image.url}
            alt={image.alt ?? ""}
            fill
            priority
            sizes="(max-width: 896px) 100vw, 896px"
            className="object-cover"
            // The provider's CDN changes; an allowlist would break silently.
            unoptimized
          />
        </div>
      )}
      {image?.caption && (
        <Text variant="small" className="-mt-4">
          {image.caption}
        </Text>
      )}

      {article.description && (
        <Text variant="body-lg" className="max-w-2xl">
          {article.description}
        </Text>
      )}

      {/* The summary is all the provider sends. The story itself belongs to
          whoever wrote it, so the page points at it rather than reproducing
          something it does not have. */}
      {article.link && (
        <div className="flex flex-col gap-2">
          <Button asChild className="self-start">
            <a href={article.link} target="_blank" rel="noopener noreferrer">
              Read the full story <ExternalLink className="ml-1.5 size-3.5" />
            </a>
          </Button>
          <Text variant="small">Opens the original report at the source.</Text>
        </div>
      )}

      {others.length > 0 && (
        <section className="flex flex-col gap-3 border-t pt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading level="h5" as="h2">
              More F1 news
            </Heading>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/entertainment/sports?sport=f1">
                All news <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((other) => {
              const thumb = hero(other.images);
              return (
                <Link
                  key={other.id}
                  href={`/news/f1/${other.id}`}
                  className="group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50"
                >
                  {thumb?.url && (
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={thumb.url}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium leading-snug">
                      {other.headline}
                    </span>
                    <Mono className="mt-auto text-2xs text-muted-foreground">
                      {other.firstSeenAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Mono>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
