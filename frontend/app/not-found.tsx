import Link from "next/link";

import { Navbar } from "@/components/layout/Navbar";

/**
 * Clean 404 page with a short message and home link.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
          404
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary">
          Page not found
        </h1>
        <div aria-hidden="true" className="mt-5 h-0.5 w-10 bg-text-primary" />
        <p className="mt-6 text-base leading-relaxed text-text-secondary">
          That page doesn&apos;t exist or the link may be outdated.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-text-primary underline-offset-4 hover:underline"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
