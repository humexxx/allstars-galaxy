"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  CalendarDays,
  List as ListIcon,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Heading, Mono } from "@/components/ui/typography";
import { Skeleton } from "@/components/ui/skeleton";

import { deleteTripAction } from "@/app/actions/travel";
import {
  formatDateRange,
} from "@/lib/travel/format";
import type { TripWithRelations } from "@/types/travel";

/**
 * The edit form ships only when the dialog opens.
 *
 * It is the heaviest thing on the page — react-hook-form, the resolver, the
 * photo picker — and it sits behind a button most visits never press. Loading
 * it eagerly put all of that in the bundle of a page whose job is to be read.
 */
const TripForm = dynamic(
  () => import("./trip-form").then((m) => ({ default: m.TripForm })),
  { loading: () => <Skeleton className="h-96 w-full" /> }
);
import { TripItinerary } from "./trip-itinerary";
import type { ItineraryViewer } from "@/lib/travel/viewer";
import { TripCalendar } from "./trip-calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Which reading of the plan is on screen. */
type TripView = "list" | "calendar";
import { TripGallery } from "./trip-gallery";
import { TripPayments } from "./trip-payments";
import { TripSharePanel } from "./trip-share-panel";
import { tripCost } from "@/lib/travel/pricing";
import { TravellerBar } from "@/components/travel/traveller-bar";
const MembersDialog = dynamic(
  () => import("@/components/travel/members-dialog").then((m) => ({
    default: m.MembersDialog,
  }))
);
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
  /** Whose money the page is showing. Null is the trip itself. Lives here
   *  rather than in the banner because it re-costs the itinerary too. */
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<TripView>("list");

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

  /**
   * The selected traveller's own view of the plan, item by item.
   *
   * Built from `shares` rather than re-split here: the banner's pill and every
   * day subtotal have to be the same arithmetic, or one of them is lying.
   */
  const viewer = useMemo((): ItineraryViewer | null => {
    if (selected === null) return null;
    const share = shares.find((s) => s.memberId === selected);
    if (!share) return null;
    return {
      name: share.name,
      isYou: share.memberId === youId,
      lines: new Map(share.lines.map((l) => [l.itemId, { low: l.low, high: l.high }])),
    };
  }, [selected, shares, youId]);

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
    <section className="flex flex-col gap-6 ">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portal/entertainment/travel-planner">
            <ArrowLeft className="mr-1 size-4" /> All trips
          </Link>
        </Button>

        {/* Two readings of the same plan. The list answers "what is the
            plan"; the calendar answers "what does the week look like" —
            where the free days are, how long the cruise really runs. */}
        <Tabs value={view} onValueChange={(v) => setView(v as TripView)}>
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <ListIcon className="size-3.5" />
              <span className="hidden sm:inline">List</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <header className="overflow-hidden rounded-xl border">
        <div
          // 21/9 leaves 167px on a 390px phone, and the pill, the buttons and
          // the title all landed on top of each other. The floor wins on a
          // phone, the ratio wins from tablet up.
          className="relative min-h-72 w-full bg-muted sm:aspect-[21/9] sm:min-h-0"
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
          {/* One flow rather than three overlays pinned to three corners:
              justify-between keeps the controls and the title apart at any
              height, instead of letting them meet in the middle. */}
          <div className="absolute inset-0 flex flex-col justify-between gap-4 p-4 text-white sm:p-6">
            <div className="flex items-start justify-between gap-2">
            <TravellerBar
              travellers={shares.map((s) => ({
                id: s.memberId,
                name: s.name,
                owedLow: s.owedLow,
                owedHigh: s.owedHigh,
                isYou: s.memberId === youId,
              }))}
              total={estimate.low}
              totalHigh={estimate.high}
              currency={trip.currency}
              selected={selected}
              onSelect={setSelected}
              onManage={() => setMembersOpen(true)}
            />
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1 size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-destructive/90 text-destructive-foreground hover:bg-destructive"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete trip"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Heading level="h1" className="text-white">{trip.title}</Heading>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                {trip.destination && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" /> {trip.destination}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  <Mono>{formatDateRange(trip.startDate, trip.endDate)}</Mono>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>


      {/* min-w-0 on both columns: a grid track sized in `fr` still takes an
          automatic minimum from its content, so the gallery's photo rail was
          widening its own column and crushing the itinerary to a word per
          line. The rail scrolls; the column must be allowed to be narrower
          than it. */}
      <div className="grid gap-6 lg:grid-cols-[5fr_3fr]">
        <div className="flex flex-col gap-6 min-w-0">
          {view === "list" ? (
            <TripItinerary trip={trip} partySize={partySize} viewer={viewer} />
          ) : (
            <TripCalendar trip={trip} partySize={partySize} viewer={viewer} />
          )}
        </div>
        <div className="flex flex-col gap-6 min-w-0">
          <TripPayments
            tripId={trip.id}
            currency={trip.currency}
            travellers={shares.map((s) => ({
              id: s.memberId,
              name: s.name,
              isYou: s.memberId === youId,
              owedLow: s.owedLow,
              owedHigh: s.owedHigh,
            }))}
            contributions={trip.contributions}
            selected={selected}
          />
          <TripGallery trip={trip} />
          <TripSharePanel
            trip={trip}
            baseUrl={baseUrl}
            // A link inherits whoever is in focus, so "share this with Bruno"
            // is the same gesture as "show me Bruno's numbers".
            scopeToMemberId={selected}
            scopeName={viewer?.name ?? null}
          />
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
