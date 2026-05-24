// Template (not layout) — Next.js remounts this on every navigation, so the
// CSS animation classes from tw-animate-css re-trigger and we get a subtle
// fade-in between routes. Layout would persist and never replay.
export default function Template({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out">
      {children}
    </div>
  );
}
