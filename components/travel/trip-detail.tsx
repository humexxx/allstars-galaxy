"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eyebrow, Heading, Mono, Text } from "@/components/ui/typography";

import { deleteTripAction } from "@/app/actions/travel";
import {
  formatDateRange,
} from "@/lib/travel/format";
import type { TripWithRelations } from "@/types/travel";

import { TripForm } from "./trip-form";
import { TripItinerary } from "./trip-itinerary";
import { TripGallery } from "./trip-gallery";
import { TripSharePanel } from "./trip-share-panel";
import { tripCost } from "@/lib/travel/pricing";
import { TravellerBar } from "@/components/travel/traveller-bar";
import { MembersDialog } from "@/components/travel/members-dialog";
import { splitTrip } from "@/lib/travel/split";

type TripDetailProps = {
  trip: TripWithRelations;
  baseUrl: string;
  /** Who is looking, so their own face can be marked on the traveller list. */
  currentUserEmail?: string | null;
  currentUserName?: string | null;
};

export function TripDetail({
  trip,
  baseUrl,
  currentUserEmail,
  currentUserName,
}: TripDetailProps) {
  const router = useRouter();
  // A trip with nobody on it is still planned for one.
  const partySize = Math.max(1, trip.members.length);
  const [membersOpen, setMembersOpen] = useState(false);

  /** The traveller who is the signed-in owner, matched by name or email. */
  const youId = useMemo(() => {
    const email = currentUserEmail?.toLowerCase();
    const name = currentUserName?.toLowerCase();
    return (
      trip.members.find((m) => email && m.email?.toLowerCase() === email)?.id ??
      trip.members.find((m) => name && m.name.toLowerCase() === name)?.id ??
      null
    );
  }, [trip.members, currentUserEmail, currentUserName]);

  /** What each traveller owes, from who actually pays each item. */
  const shares = useMemo(
    () =>
      splitTrip(
        trip.items.map((i) => ({
          id: i.id,
          title: i.title,
          price: i.price,
          priceMax: i.priceMax,
          priceUnit: i.priceUnit,
          scheduledOn: i.scheduledOn,
          endsOn: i.endsOn,
          // Per-item payers have no UI yet; until they do every item follows
          // the trip's own split, which is what an empty list means.
          payerIds: [],
        })),
        trip.members.map((m) => ({
          id: m.id,
          name: m.name,
          sharePercent: m.sharePercent,
        }))
      ),
    [trip.items, trip.members]
  );

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  /**
   * The trip's cost as a range, with each item's unit applied.
   *
   * A nightly rate times its nights, a per-person fare times the party. Summing
   * the raw figures would quietly report a two-night hotel at one night's price
   * — wrong, and wrong in the direction that makes a trip look affordable.
   */
  const estimate = useMemo(
    () => tripCost(trip.items, partySize),
    [trip.items, partySize]
  );

  const handleDelete = () => {
    startDelete(async () => {
      const res = await deleteTripAction(trip.id);
      if (res.success) {
        toast.success("Trip deleted");
        router.push("/portal/entertainment/travel-planner");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portal/entertainment/travel-planner">
            <ArrowLeft className="mr-1 h-4 w-4" /> All trips
          </Link>
        </Button>
      </div>

      <header className="overflow-hidden rounded-xl border">
        <div
          className="relative aspect-[21/9] w-full bg-muted"
          style={trip.coverPhotoUrl ? undefined : { backgroundColor: trip.color }}
        >
          {trip.coverPhotoUrl && (
            <Image
              src={trip.coverPhotoUrl}
              alt={`${trip.title} cover photo`}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
              // Trip covers can be uploaded to Supabase Storage OR pasted as
              // an external URL (see `tripPhotoSourceEnum`). `unoptimized`
              // sidesteps `images.remotePatterns` so legacy external URLs
              // still render — same forgiving behavior as the previous
              // CSS-background implementation.
              unoptimized
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 text-white">
            <Heading level="h1" className="text-white">{trip.title}</Heading>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              {trip.destination && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {trip.destination}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <Mono>{formatDateRange(trip.startDate, trip.endDate)}</Mono>
              </span>
            </div>

          </div>
          <div className="absolute left-4 top-4">
            <TravellerBar
              travellers={shares.map((s) => ({
                id: s.memberId,
                name: s.name,
                owed: s.owed,
                isYou: s.memberId === youId,
              }))}
              total={estimate.low}
              totalHigh={estimate.high}
              currency={trip.currency}
              onManage={() => setMembersOpen(true)}
            />
          </div>
          <div className="absolute right-4 top-4 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-destructive/90 text-destructive-foreground hover:bg-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete trip"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>


      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <TripItinerary trip={trip} partySize={partySize} />
        </div>
        <div className="space-y-6">
          {trip.description && (
            <Card>
              <CardContent>
                <Eyebrow className="mb-2 block">About this trip</Eyebrow>
                <Text className="whitespace-pre-wrap text-foreground/90">
                  {trip.description}
                </Text>
              </CardContent>
            </Card>
          )}
          <TripGallery trip={trip} />
          <TripSharePanel trip={trip} baseUrl={baseUrl} />
        </div>
      </div>

      {membersOpen && (
        <MembersDialog
          tripId={trip.id}
          members={trip.members.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email ?? "",
            sharePercent: m.sharePercent === null ? "" : String(m.sharePercent),
          }))}
          onClose={() => setMembersOpen(false)}
        />
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit trip</DialogTitle>
            <DialogDescription>
              Update the basics, dates, or cover photo. Items and photos stay where they are.
            </DialogDescription>
          </DialogHeader>
          <Suspense>
            <TripForm trip={trip} />
          </Suspense>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{trip.title}</strong> and all its items, photos and share links will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
