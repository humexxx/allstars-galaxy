"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";

import {
  addTripPhotoAction,
  deleteTripPhotoAction,
} from "@/app/actions/travel";
import type { TripWithRelations } from "@/types/travel";

import { PhotoPicker } from "./photo-picker";

type TripGalleryProps = {
  trip: TripWithRelations;
};

export function TripGallery({ trip }: TripGalleryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAdd = async ({
    url,
    storagePath,
    source,
  }: {
    url: string;
    storagePath: string | null;
    source: "upload" | "url";
  }) => {
    const res = await addTripPhotoAction(trip.id, {
      url,
      storagePath,
      source,
      sortOrder: trip.photos.length,
    });
    if (res.success) {
      toast.success("Photo added");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = (photoId: string) => {
    startTransition(async () => {
      const res = await deleteTripPhotoAction(trip.id, photoId);
      if (res.success) {
        toast.success("Photo removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gallery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {trip.photos.length === 0 ? (
          <Text
            variant="small"
            className="rounded-md border border-dashed p-4 text-center"
          >
            No photos yet — pick a few to show in the shared view.
          </Text>
        ) : (
          // One row that scrolls sideways. A grid grew a new row for every
          // three photos and pushed everything below it down the page; a rail
          // costs the same height whether the trip has four photos or forty.
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
            {trip.photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square w-28 shrink-0 snap-start overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? "Trip photo"}
                  fill
                  sizes="112px"
                  className="object-cover"
                  // Gallery photos may be external URLs (see schema:
                  // `tripPhotoSourceEnum`). `unoptimized` sidesteps
                  // `images.remotePatterns` so legacy external URLs render.
                  unoptimized
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  // 24px was below any comfortable touch target, and this one is
                  // destructive AND always visible on a phone. 36/28 is the
                  // size the itinerary rows already use.
                  className="absolute right-1 top-1 size-9 transition-opacity focus-visible:opacity-100 sm:size-7 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => handleDelete(photo.id)}
                  disabled={isPending}
                  aria-label="Delete photo"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <PhotoPicker
          variant="compact"
          folder={trip.id}
          onPick={handleAdd}
          disabled={isPending}
        />
      </CardContent>
    </Card>
  );
}
