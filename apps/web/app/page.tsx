import Link from "next/link";

/** Placeholder landing — the real marketing site is Phase 8. */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />
          FORGE SITES
        </div>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Describe your business.
          <br />
          <span className="text-accent">Get a real website.</span>
        </h1>
        <p className="max-w-md text-pretty text-base leading-relaxed text-muted">
          Live in under a minute. Editable down to every word. Exportable as
          clean code you actually own.
        </p>
        <Link
          href="/login"
          className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition-colors duration-200 hover:bg-accent-strong"
        >
          Start building
        </Link>
      </div>
    </main>
  );
}
