// Template (not layout) — Next.js remounts this on every navigation, so the
// CSS animation classes from tw-animate-css re-trigger and we get a subtle
// fade-in between routes. Layout would persist and never replay.
//
// `motion-safe:` ensures the animation only runs when the user has not opted
// into `prefers-reduced-motion`. Users with that preference see an instant
// transition instead of the fade/slide.
export default function Template({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:ease-out">
      {children}
    </div>
  );
}
