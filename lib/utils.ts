import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// `text-2xs` is a custom size (globals.css @utility). Without registering it,
// tailwind-merge files it under text COLOUR, so `cn("text-xs", "text-2xs")`
// keeps both and the winner depends on stylesheet order.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["2xs"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
