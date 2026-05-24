import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { PublicTripViewRenderer } from "@/components/travel/public-trip-view";
import { ShareCta } from "@/components/travel/share-cta";
import { getBaseUrl } from "@/lib/env";
import { getCurrentUser } from "@/lib/services/auth-server";
import { getPublicTripByToken } from "@/lib/services/travel-service";

export const dynamic = "force-dynamic";

type Params = { token: string };

function describeTrip(trip: { destination: string | null; startDate: string; endDate: string | null }): string {
  const [y, m, d] = trip.startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = trip.endDate
    ? (() => {
        const [ey, em, ed] = trip.endDate!.split("-").map(Number);
        return new Date(ey, em - 1, ed);
      })()
    : null;
  const dateLabel = end
    ? `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`
    : format(start, "MMM d, yyyy");
  return trip.destination ? `${trip.destination} · ${dateLabel}` : dateLabel;
}

// generateMetadata is what makes link previews render on WhatsApp, X, Slack,
// Telegram, iMessage and Instagram DMs. Crawlers fetch the URL anonymously,
// so this route MUST be reachable without auth and MUST emit OpenGraph +
// Twitter tags on the very first server render (no client hydration needed).
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { token } = await params;
  const view = await getPublicTripByToken(token);
  if (!view) {
    return {
      title: "Trip not found | Allstars Galaxy",
      description: "This share link is no longer available.",
    };
  }
  const { trip } = view;
  const title = trip.title;
  const description = trip.description?.trim()
    ? trip.description.trim().slice(0, 200)
    : `Trip plan — ${describeTrip(trip)}`;
  const baseUrl = getBaseUrl();
  const url = `${baseUrl.replace(/\/$/, "")}/trips/${token}`;
  const images = trip.coverPhotoUrl
    ? [
        {
          url: trip.coverPhotoUrl,
          alt: `${title} cover photo`,
        },
      ]
    : undefined;

  return {
    metadataBase: new URL(baseUrl),
    title: `${title} | Allstars Galaxy`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Allstars Galaxy",
      type: "article",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublicTripPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const view = await getPublicTripByToken(token);
  if (!view) notFound();

  const currentUser = await getCurrentUser();

  return (
    <div className="space-y-6">
      <ShareCta
        inviteeEmail={view.share.inviteeEmail}
        currentUserEmail={currentUser?.email ?? null}
        shareToken={token}
      />
      <PublicTripViewRenderer view={view} />
    </div>
  );
}
