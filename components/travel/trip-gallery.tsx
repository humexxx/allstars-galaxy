"use client";

import { useRef, useTransition } from "react";
import { Images, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import {
  addTripPhotoAction,
  deleteTripPhotoAction,
} from "@/app/actions/travel";
import type { TripWithRelations } from "@/types/travel";

import { PhotoPicker } from "./photo-picker";
import { TripPhoto } from "./trip-photo";
import { cn } from "@/lib/utils";
import { PendingBadge, pendingDelay, usePendingMark, usePendingTrip } from "./assistant/pending-preview";

type TripGalleryProps = {
  trip: TripWithRelations;
};

export function TripGallery({ trip }: TripGalleryProps) {
  // Photos a previewed proposal takes out stay in the row, crossed out.
  const removed = (usePendingTrip()?.removed.photos ?? []).filter((p) => !p.itemId);
  const photos = [...trip.photos, ...removed];
  const [isPending, startTransition] = useTransition();
  /** Focus lands here after a delete: the button that had it is gone. */
  const titleRef = useRef<HTMLHeadingElement>(null);

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
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = (photoId: string) => {
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
    <Card>
      <CardHeader>
        <CardTitle as="h2" ref={titleRef} tabIndex={-1} className="outline-none">
          Gallery
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {photos.length === 0 ? (
          <EmptyState
            icon={Images}
            title="No photos yet"
            description="Pick a few to show in the shared view."
          />
        ) : (
          // One row that scrolls sideways. A grid grew a new row for every
          // three photos and pushed everything below it down the page; a rail
          // costs the same height whether the trip has four photos or forty.
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
            {photos.map((photo, i) => (
              <PendingPhoto key={photo.id} id={photo.id} index={i}>
              <div
                className="group relative aspect-square w-28 shrink-0 snap-start overflow-hidden rounded-md border bg-muted"
              >
                <TripPhoto
                  src={photo.url}
                  alt={photo.caption ?? `${trip.title} photo ${i + 1}`}
                  sizes="112px"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  // The standard row-action size: 24px was below any
                  // comfortable touch target, and this one is destructive AND
                  // always visible on a phone.
                  className="absolute right-1 top-1 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => handleDelete(photo.id)}
                  disabled={isPending}
                  aria-label={`Delete photo ${i + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
              </PendingPhoto>
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

/** A photo the previewed proposal adds (ringed) or removes (faded, struck). */
function PendingPhoto({ id, index, children }: { id: string; index: number; children: React.ReactNode }) {
  const pending = usePendingMark(id);
  if (!pending) return <>{children}</>;
  return (
    <div
      className={cn(
        "relative shrink-0 animate-in fade-in fill-mode-both zoom-in-90 rounded-lg ring-2 ring-offset-2 ring-offset-card duration-500",
        pending.mark === "remove" ? "opacity-50 ring-destructive grayscale" : "ring-primary"
      )}
      style={pendingDelay(index)}
    >
      {children}
      <PendingBadge mark={pending.mark} className="absolute bottom-1 left-1" />
    </div>
  );
}
