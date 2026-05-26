"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const FAVICON_LIGHT = "/favicon-light.svg";
const FAVICON_DARK = "/favicon-dark.svg";
const LINK_ID = "app-dynamic-favicon";

/**
 * Swaps the browser favicon when the in-app theme flips. Without this the
 * favicon only tracks the OS `prefers-color-scheme` (via the media query
 * inside /app/icon.svg) and stays out of sync when the user picks a theme
 * explicitly from the header toggle.
 *
 * Browsers honour the **last** `link[rel=icon]` in document order, and Next's
 * file-based `app/icon.svg` keeps re-appending its own link. So we move ours
 * to the end of <head> on every theme change to keep precedence.
 */
export function DynamicFavicon() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const href = resolvedTheme === "dark" ? FAVICON_DARK : FAVICON_LIGHT;
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = LINK_ID;
      link.rel = "icon";
      link.type = "image/svg+xml";
    }
    link.href = href;
    // appendChild on a node already in the tree moves it to the last position,
    // which is what we want for favicon precedence.
    document.head.appendChild(link);
  }, [resolvedTheme]);

  return null;
}
