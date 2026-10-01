"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A trip photograph that fills its (relative, sized) parent, and says so when
 * it cannot load.
 *
 * Photos are pasted links as often as uploads, and a pasted link dies: the
 * host moves it, the CDN expires it. The browser's own broken-image glyph,
 * pinned to the top-left corner of an otherwise blank tile, read as a layout
 * bug rather than as a dead link. A muted tile with an icon reads as what it
 * is, and the alt text stays available to a screen reader.
 *
 * `unoptimized` because covers and gallery photos may be external URLs (see
 * `tripPhotoSourceEnum`): it sidesteps `images.remotePatterns` so a link from
 * any host still renders.
 */
export function TripPhoto({
  src,
  alt,
  sizes,
  priority = false,
  className,
  fallbackClassName,
  fallback = "tile",
}: {
  /**
   * "tile" paints a muted square with an icon; "none" leaves the parent's own
   * background showing — a cover's trip colour is a better stand-in than a
   * grey box under the title.
   */
  fallback?: "tile" | "none";
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Size the fallback icon for the tile it sits in. */
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  // Keyed on the URL: a new link gets a fresh attempt instead of inheriting
  // the last one's failure.
  if (failed === src) {
    if (fallback === "none") return null;
    return (
      <div
        role="img"
        aria-label={`${alt} (could not be loaded)`}
        className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground"
      >
        <ImageOff className={cn("size-5", fallbackClassName)} aria-hidden />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      unoptimized
      onError={() => setFailed(src)}
    />
  );
}
