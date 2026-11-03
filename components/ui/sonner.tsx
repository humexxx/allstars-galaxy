"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Sonner does not read the `.dark` class on its own: without the theme prop
 * it renders light toasts on the dark surface. Following `next-themes` here
 * keeps every toast in the app on the active palette.
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      className="toaster group"
      richColors
      closeButton
      // Sonner's own 24px / 16px margins, kept clear of the home indicator and,
      // with the phone on its side, of the notch.
      offset={{
        bottom: "max(24px, env(safe-area-inset-bottom))",
        left: "max(24px, env(safe-area-inset-left))",
        right: "max(24px, env(safe-area-inset-right))",
      }}
      mobileOffset={{
        bottom: "max(16px, env(safe-area-inset-bottom))",
        left: "max(16px, env(safe-area-inset-left))",
        right: "max(16px, env(safe-area-inset-right))",
      }}
      toastOptions={{
        classNames: {
          toast: "font-sans rounded-2xl! shadow-lg!",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
