"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No photos yet — pick a few to show in the shared view.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {trip.photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? "Trip photo"}
                  fill
                  sizes="(max-width: 768px) 33vw, 200px"
                  className="object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => handleDelete(photo.id)}
                  disabled={isPending}
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-3 w-3" />
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
