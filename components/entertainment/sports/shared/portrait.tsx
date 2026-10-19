"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { readableInk } from "./team-badge";

/** Whatever pictures a driver, player or team has; every field is optional but the name. */
export type PortraitSubject = {
  name: string;
  /** A face. */
  imageUrl?: string;
  /** The face's country, as an image. */
  flagUrl?: string;
  /** The country as an emoji, where no flag image is published. */
  flagEmoji?: string;
  /** A team's logo, drawn instead of a face. */
  logoUrl?: string;
  /** A team's livery colour and short code, for the disc when it has no logo. */
  color?: string;
  code?: string;
};

const SIZES = {
  sm: { disc: "size-6", flag: "size-2.5", px: "24px" },
  md: { disc: "size-7", flag: "size-3", px: "28px" },
  // A standings table on a 375px phone has no width to spare: the full disc
  // pushed its last column past the card's edge.
  table: { disc: "size-6 sm:size-7", flag: "size-2.5 sm:size-3", px: "28px" },
} as const;

/**
 * A driver's or player's face, or a team's logo, in a disc.
 *
 * The flag is the disc's sibling rather than its child: the disc clips to a
 * circle, and a badge inside it was shaved along the curve.
 *
 * Without a picture — none published, or the one published fails to load —
 * it draws `fallback` in a disc-sized slot, so a column of rows still lines
 * up; with no `fallback`, the team's livery.
 */
export function Portrait({
  subject,
  size = "md",
  fallback,
  className,
}: {
  subject: PortraitSubject;
  size?: keyof typeof SIZES;
  fallback?: ReactNode;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const { disc, flag, px } = SIZES[size];
  const logo = subject.logoUrl;
  const src = logo ?? subject.imageUrl;

  if (!src || failed === src) {
    if (fallback !== undefined) {
      return (
        <span aria-hidden className={cn("grid shrink-0 place-items-center", disc, className)}>
          {fallback}
        </span>
      );
    }
    // A team with no logo published yet — the livery does the work.
    return (
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-2xs font-semibold ring-1 ring-black/10",
          disc,
          className
        )}
        style={{ backgroundColor: subject.color ?? "#666", color: readableInk(subject.color) }}
      >
        {(subject.code ?? subject.name).slice(0, 3).toUpperCase()}
      </span>
    );
  }

  // Vendored logos go through the optimizer. Faces come off provider CDNs
  // whose paths derive from an athlete id or a name — an allowlist would
  // break the day either changes — and arrive already sized.
  const remote = /^https?:\/\//.test(src);

  return (
    <span aria-hidden className={cn("relative shrink-0", disc, className)}>
      {/* Filled with `muted` rather than white so it reads as part of the
          card instead of a lit disc; the logos are unplated, so the fill is a
          real choice. */}
      <span className="relative block size-full overflow-hidden rounded-full bg-muted ring-1 ring-border">
        <Image
          src={src}
          alt=""
          fill
          sizes={px}
          className={logo ? "object-contain p-0.5" : "object-cover object-top"}
          unoptimized={remote}
          onError={() => setFailed(src)}
        />
      </span>
      {!logo && subject.flagUrl ? (
        // Filled, because the flag is a band across a transparent square and
        // the face would show through above and below it.
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 overflow-hidden rounded-full bg-background ring-1 ring-background",
            flag
          )}
        >
          <Image src={subject.flagUrl} alt="" fill sizes="12px" className="object-cover" unoptimized />
        </span>
      ) : !logo && subject.flagEmoji ? (
        <span className="absolute -right-1 -bottom-1 text-xs leading-none">{subject.flagEmoji}</span>
      ) : null}
    </span>
  );
}
