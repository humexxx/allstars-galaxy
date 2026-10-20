import type { TravelMark } from "@/types/travel-assistant";

export type BannerSlide = {
  id: string;
  url: string;
  alt: string;
  /** What an open proposal does to it, if anything. */
  mark?: TravelMark;
};

/**
 * The cover first, then the trip's own photos — the ones not on an activity.
 *
 * A plain module, not the carousel's: the shared page is a server component,
 * and it cannot call a function exported from a client one.
 */
export function bannerSlides(trip: {
  title: string;
  coverPhotoUrl: string | null;
  photos: { id: string; url: string; caption: string | null; itemId?: string | null }[];
}): BannerSlide[] {
  return [
    ...(trip.coverPhotoUrl
      ? [{ id: "cover", url: trip.coverPhotoUrl, alt: `${trip.title} cover photo` }]
      : []),
    ...trip.photos
      .filter((p) => !p.itemId)
      .map((p, i) => ({ id: p.id, url: p.url, alt: p.caption ?? `${trip.title} photo ${i + 1}` })),
  ];
}
