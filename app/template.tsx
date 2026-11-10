// Template (not layout) — Next.js remounts this on every navigation, so the
// CSS animation classes from tw-animate-css re-trigger and we get a subtle
// fade-in between routes. Layout would persist and never replay.
//
// `motion-safe:` ensures the animation only runs when the user has not opted
// into `prefers-reduced-motion`. Users with that preference see an instant
// transition instead of the fade/slide.
//
// The outer element clips the slide: a page that is exactly one screen tall
// (login, signup) starts 4px lower, and for those 300ms the document was 4px
// taller than the window — a scrollbar that came and went.
export default function Template({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="overflow-y-clip">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:ease-out">
        {children}
      </div>
    </div>
  );
}
