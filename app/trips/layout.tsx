import Link from "next/link";

/**
 * Page shell only — no header.
 *
 * The bar lives one level down, in `[token]/layout.tsx`, because what it
 * offers a reader depends on the link they arrived on: the sign-up prefills
 * the address the link was labelled with and returns them here afterwards.
 */
export default function PublicTripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {children}
      <footer className="mt-auto border-t py-6 text-center text-xs text-muted-foreground">
        Shared via{" "}
        <Link href="/" className="font-medium hover:text-foreground">
          Allstars Galaxy
        </Link>
      </footer>
    </div>
  );
}
