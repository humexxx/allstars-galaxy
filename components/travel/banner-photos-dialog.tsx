"use client";

import { useRef, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addTripPhotoAction, deleteTripPhotoAction } from "@/app/actions/travel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/typography";
import type { TripWithRelations } from "@/types/travel";

import { PhotoPicker } from "./photo-picker";
import { TripPhoto } from "./trip-photo";

/**
 * The photos that take turns on the trip's banner. The cover leads and is
 * changed from the trip's own form; the rest are added and removed here, and
 * each change is saved as it is made.
 *
 * A trip has no gallery of its own any more: a photo of something you did
 * belongs on that activity, and the banner is the trip's only picture.
 */
export function BannerPhotosDialog({
  trip,
  onClose,
}: {
  trip: TripWithRelations;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  /** Focus lands here after a delete: the button that had it is gone. */
  const titleRef = useRef<HTMLHeadingElement>(null);

  const add = async ({
    url,
    storagePath,
    source,
  }: {
    url: string;
    storagePath: string | null;
    source: "upload" | "url";
  }): Promise<void> => {
    const res = await addTripPhotoAction(trip.id, {
      url,
      storagePath,
      source,
      sortOrder: trip.photos.length,
    });
    if (res.success) toast.success("Photo added to the banner");
    else toast.error(res.error);
  };

  const remove = (photoId: string): void => {
    startTransition(async () => {
      const res = await deleteTripPhotoAction(trip.id, photoId);
      if (res.success) {
        toast.success("Photo removed");
        titleRef.current?.focus();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
            Banner photos
          </DialogTitle>
          <DialogDescription>
            They take turns on the banner every five seconds, the cover first.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {trip.coverPhotoUrl && (
            <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
              <TripPhoto src={trip.coverPhotoUrl} alt={`${trip.title} cover photo`} sizes="128px" />
              <Badge variant="secondary" className="absolute bottom-1 left-1 text-2xs">
                Cover
              </Badge>
            </div>
          )}
          {trip.photos.map((photo, i) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
            >
              <TripPhoto
                src={photo.url}
                alt={photo.caption ?? `${trip.title} photo ${i + 1}`}
                sizes="128px"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                className="absolute top-1 right-1 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                onClick={() => remove(photo.id)}
                disabled={isPending}
                aria-label={`Remove photo ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
        {!trip.coverPhotoUrl && trip.photos.length === 0 && (
          <Text variant="muted">No photos yet. The trip&apos;s colour fills the banner until you add one.</Text>
        )}
        {trip.coverPhotoUrl === null && trip.photos.length > 0 && (
          <Text variant="small">Set a cover from Edit to choose which one leads.</Text>
        )}

        <PhotoPicker variant="compact" folder={trip.id} onPick={add} disabled={isPending} />
      </DialogContent>
    </Dialog>
  );
}
