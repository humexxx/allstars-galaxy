"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Images,
  List as ListIcon,
  MapPin,
  Pencil,
  Share2,
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
import { Spinner } from "@/components/ui/spinner";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Which reading of the plan is on screen. */
type TripView = "list" | "calendar";
import { bannerSlides, type BannerSlide } from "@/lib/travel/banner-slides";
import { BannerDots, BannerSlides, useBannerCarousel } from "./banner-photos";
import { TripPayments } from "./trip-payments";
import {
  PendingBadge,
  PendingMarks,
  reviveTrip,
  useTripPreview,
} from "./assistant/pending-preview";
import { cn } from "@/lib/utils";
import { tripCost } from "@/lib/travel/pricing";
import { TravellerBar } from "@/components/travel/traveller-bar";
// Behind a dialog nobody opens on most visits, and it carries the QR encoder.
const TripSharePanel = dynamic(
  () => import("./trip-share-panel").then((m) => m.TripSharePanel),
  { loading: () => <Skeleton className="h-64 w-full" /> }
);

const BannerPhotosDialog = dynamic(() =>
  import("./banner-photos-dialog").then((m) => ({ default: m.BannerPhotosDialog }))
);

/**
 * The banner's buttons: dark glass with white text, whatever the photo. The
 * theme's `secondary` is a pale grey with blue text, and over a photograph it
 * read as a stray light patch.
 */
const ON_PHOTO = "bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/75 hover:text-white dark:hover:bg-black/75";

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
  trip: saved,
  baseUrl,
  currentUserEmail,
  currentUserName,
}: TripDetailProps) {
  const router = useRouter();
  // A proposal from the assistant waiting on this trip: the page draws the
  // trip as it would be, and every row the proposal touches lights up.
  const preview = useTripPreview(saved.id);
  const trip = useMemo(
    () => (preview?.trip ? reviveTrip(preview.trip) : saved),
    [preview, saved]
  );
  const tripMark = preview?.marks[saved.id];
  const deleting = tripMark === "remove";
  const tripFields = preview?.fields[saved.id] ?? [];
  // A trip with nobody on it is still planned for one.
  const partySize = Math.max(1, trip.members.length);
  const [membersOpen, setMembersOpen] = useState(false);
  /** Whose money the page is showing. Null is the trip itself. Lives here
   *  rather than in the banner because it re-costs the itinerary too. */
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<TripView>("list");
  const [shareOpen, setShareOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  /** The banner's photos, each with what the open proposal does to it. */
  const slides = useMemo((): BannerSlide[] => {
    // A trip the proposal creates is new all over; marking each slide too
    // would only narrow the rotation to all of them.
    const marks = tripMark === "add" ? {} : (preview?.marks ?? {});
    const coverChanged = tripMark === "change" && Boolean(preview?.fields[saved.id]?.includes("coverPhotoUrl"));
    const removed = (preview?.removed.photos ?? []).filter((p) => !p.itemId);
    return [
      ...bannerSlides(trip).map((slide) => ({
        ...slide,
        mark:
          slide.id === "cover" ? (coverChanged ? ("change" as const) : undefined) : marks[slide.id],
      })),
      ...removed.map((p) => ({
        id: p.id,
        url: p.url,
        alt: p.caption ?? `${trip.title} photo`,
        mark: "remove" as const,
      })),
    ];
  }, [trip, preview, tripMark, saved.id]);
  const carousel = useBannerCarousel(slides);
  const slide = slides[carousel.index];

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
          payerIds: i.payerIds,
          attendeeIds: i.attendeeIds,
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
  /** What the trip comes to today, while a proposal shows another figure. */
  const estimateBefore = useMemo(
    () =>
      preview?.before && !preview.isNew
        ? tripCost(preview.before.items, Math.max(1, preview.before.members.length))
        : null,
    [preview]
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
      memberId: share.memberId,
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
        setConfirmDelete(false);
        router.push("/portal/entertainment/travel-planner");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <PendingMarks preview={preview}>
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        {/* The same back link as \`PageHeader\`'s — this page has a photo hero
            instead of a header, but the way out should look the same. */}
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/portal/entertainment/travel-planner">
            <ArrowLeft /> All trips
          </Link>
        </Button>

        {/* Two readings of the same plan. The list answers "what is the
            plan"; the calendar answers "what does the week look like" —
            where the free days are, how long the cruise really runs. */}
        {/* A segmented control, not Tabs: both readings render into the same
            column below, so there are no tab panels for the triggers to own. */}
        <ToggleGroup
          type="single"
          size="sm"
          value={view}
          // Radix lets the pressed segment be pressed off; a view switcher
          // always has one view on.
          onValueChange={(v) => v && setView(v as TripView)}
          aria-label="View"
        >
          {/* Named even where the word is hidden: below `sm` the label is
              `hidden`, which left the control with no accessible name. */}
          {/* `flex-none`: the group splits its width equally, and "Calendar"
              got the same 74px as "List" — its label ran into the track's
              edge with no padding left on the right. */}
          <ToggleGroupItem value="list" aria-label="List" className="flex-none">
            <ListIcon />
            <span className="hidden sm:inline">List</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar" aria-label="Calendar" className="flex-none">
            <CalendarDays />
            <span className="hidden sm:inline">Calendar</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Full bleed on a phone. The page container's 16px gutters were
          cropping the cover on both sides for no gain — a photograph wants the
          screen. `-mx-4` cancels exactly that padding; from `sm` up the card
          sits back inside it with its border and corners. */}
      {/* Read-only while a proposal waits — the header and the content, not
          the way out or the view switch: its rows do not exist yet, and an
          edit underneath would be decided against a picture about to change.
          The review bar is the way forward. */}
      <header
        inert={preview !== null}
        className={cn(
          "-mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-xl sm:border",
          tripMark === "add" && "animate-in fade-in zoom-in-95 duration-500",
          (tripMark === "add" || tripMark === "change") &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background",
          deleting && "opacity-60 ring-2 ring-destructive ring-offset-2 ring-offset-background grayscale"
        )}
      >
        <div
          // 21/9 leaves 167px on a 390px phone, and the pill, the buttons and
          // the title all landed on top of each other. The floor wins on a
          // phone, the ratio wins from tablet up.
          className="relative flex min-h-72 w-full flex-col bg-muted sm:aspect-21/9 sm:min-h-auto"
          // The trip colour under the photo too: it is what shows if the
          // cover link has died.
          style={{ backgroundColor: trip.color }}
        >
          <BannerSlides slides={slides} index={carousel.index} />
          {/* Deeper through the middle than it was (/20): a long name runs
              two or three lines up into the photo, and over a snowfield its
              top line was white on pale grey. The controls up top carry
              their own solid surfaces, so the top can stay clear. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          {/* One flow rather than three overlays pinned to three corners:
              justify-between keeps the controls and the title apart at any
              height, instead of letting them meet in the middle. */}
          {/* In flow, not `absolute inset-0`: pinned over a box of fixed
              height, a long name ("Islandia, Finlandia & Tomorrowland
              Winter: the long way round") pushed the dates out of the bottom
              of the banner on a phone, and the 21/9 box clipped it at
              tablet width. The ratio and the floor are minimums now — the
              banner grows when its words need it. */}
          <div className="relative flex flex-1 flex-col justify-between gap-4 p-4 text-white sm:p-6">
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
              totalBefore={
                estimateBefore &&
                (estimateBefore.low !== estimate.low || estimateBefore.high !== estimate.high)
                  ? estimateBefore
                  : null
              }
              ghosts={preview?.removed.members.map((m) => ({ id: m.id, name: m.name })) ?? []}
              currency={trip.currency}
              selected={selected}
              onSelect={setSelected}
              onManage={() => setMembersOpen(true)}
            />
              {/* A column on a phone. Side by side they took a third of a
                  326px banner, and the row they shared with the total and the
                  faces had no width left — the manage-travellers button was
                  wrapping onto a line of its own. */}
              {/* Labelled and in a row only from `lg`: at tablet width the
                  sidebar leaves the banner ~450px, and the pill plus three
                  labelled buttons ran the delete button off its right edge. */}
              <div className="flex shrink-0 flex-col gap-2 lg:flex-row">
                {/* Sharing sits with the trip, not in a card down the page:
                    it is something you do to the whole thing, and which
                    traveller is selected changes what the link will show. */}
                {/* The label is the first thing to go on a phone: three
                    labelled buttons crowd a banner that also carries the
                    total, the faces and the title. The icon is unambiguous
                    and the name comes back from `sm` up. */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={ON_PHOTO}
                  onClick={() => setShareOpen(true)}
                  aria-label="Share this trip"
                >
                  <Share2 />
                  <span className="hidden lg:inline">Share</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={ON_PHOTO}
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit this trip"
                >
                  <Pencil />
                  <span className="hidden lg:inline">Edit</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={ON_PHOTO}
                  onClick={() => setPhotosOpen(true)}
                  aria-label="Banner photos"
                >
                  <Images />
                </Button>
                {/* Same surface as its neighbours, red only on hover: the
                    tinted \`destructive\` variant is translucent, and over an
                    unknown photograph it disappears. */}
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(ON_PHOTO, "hover:bg-destructive dark:hover:bg-destructive")}
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete trip"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {/* \`hero\`, not \`h1\`: a trip name is long by nature ("Islandia,
                  Finlandia & Tomorrowland Winter"), and at the h1's 30px it ran
                  to two lines and owned the banner on a phone. */}
              {(tripMark || slide?.mark) && (
                <div className="flex flex-wrap gap-2">
                  {tripMark && (
                    <PendingBadge mark={tripMark} className="bg-background/90 backdrop-blur-sm" />
                  )}
                  {slide?.mark && (
                    <PendingBadge
                      mark={slide.mark}
                      label={
                        slide.id === "cover"
                          ? "New cover"
                          : slide.mark === "remove"
                            ? "Removing photo"
                            : "New photo"
                      }
                      className="bg-background/90 backdrop-blur-sm"
                    />
                  )}
                </div>
              )}
              <Heading
                level="hero"
                className={cn("text-white text-shadow-sm", deleting && "line-through")}
              >
                {trip.title}
              </Heading>
              {tripFields.includes("title") && preview?.before && (
                <span className="text-sm text-white/70 line-through">{preview.before.title}</span>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                {trip.destination && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 shrink-0" /> {trip.destination}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 shrink-0" />
                  <Mono
                    className={cn(
                      (tripFields.includes("startDate") || tripFields.includes("endDate")) &&
                        "rounded bg-primary px-1 text-primary-foreground"
                    )}
                  >
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </Mono>
                  {(tripFields.includes("startDate") || tripFields.includes("endDate")) &&
                    preview?.before && (
                      <Mono className="text-white/60 line-through">
                        {formatDateRange(preview.before.startDate, preview.before.endDate)}
                      </Mono>
                    )}
                </span>
              </div>
            </div>
          </div>
          <BannerDots slides={slides} index={carousel.index} onShow={carousel.show} />
        </div>
      </header>


      {/* min-w-0 on both columns: a grid track sized in `fr` still takes an
          automatic minimum from its content, and a wide row in either column
          would otherwise crush the other one to a word per line. */}
      <div className="grid gap-6 lg:grid-cols-[5fr_3fr]" inert={preview !== null}>
        <div className="flex flex-col gap-6 min-w-0">
          {view === "list" ? (
            <TripItinerary trip={trip} partySize={partySize} viewer={viewer} />
          ) : (
            <TripCalendar trip={trip} partySize={partySize} viewer={viewer} />
          )}
        </div>
        {/* Sticky beside the itinerary: the money stays in view while the
            days scroll past. `self-start`, or the grid stretches the column
            to the itinerary's height and there is nothing left to stick. */}
        <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
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
        </div>
      </div>

      {photosOpen && <BannerPhotosDialog trip={saved} onClose={() => setPhotosOpen(false)} />}

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

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share this trip</DialogTitle>
            <DialogDescription>
              A private link anyone can open — no account needed. Revoke it and
              it stops working.
            </DialogDescription>
          </DialogHeader>
          <TripSharePanel
            trip={trip}
            baseUrl={baseUrl}
            // Only where the picker starts: the dialog asks for itself now.
            scopeToMemberId={selected}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit trip</DialogTitle>
            <DialogDescription>
              Update the basics, dates, or cover photo. Items and photos stay where they are.
            </DialogDescription>
          </DialogHeader>
          <Suspense>
            <TripForm
              trip={trip}
              onCancel={() => setEditOpen(false)}
              onSaved={() => setEditOpen(false)}
            />
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
              variant="destructive"
              // Radix closes the dialog on click; held open so the pending
              // label shows and a failure has somewhere to land.
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting && <Spinner />}
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
    </PendingMarks>
  );
}
