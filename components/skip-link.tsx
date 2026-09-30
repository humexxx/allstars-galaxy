/**
 * First tabbable element on the page. Invisible until focused, then sits over
 * the header so a keyboard user can jump past the navigation on every route
 * instead of tabbing through the whole sidebar first.
 */
export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}
