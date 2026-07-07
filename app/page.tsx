import Link from "next/link";

const FEATURES = [
  {
    title: "Instant fee breakdown",
    body: "Referral fee, FBA fulfillment fee, and storage cost for any product, calculated the moment you enter it.",
  },
  {
    title: "Real profit & ROI",
    body: "See net profit per unit, margin %, ROI %, and break-even units before you commit to inventory.",
  },
  {
    title: "Save & compare",
    body: "Keep a shortlist of products you're evaluating and compare their margins side by side.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold">FBA Profit Calculator</span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing" className="hover:underline">
            Pricing
          </Link>
          <Link
            href="/calculator"
            className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Open Calculator
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <section className="text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Know your Amazon FBA profit before you buy the inventory.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
            Enter a product&apos;s cost, price, weight, and size. Get referral fees, fulfillment fees,
            storage costs, margin, and ROI in seconds — no spreadsheet required.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/calculator"
              className="rounded-md bg-neutral-900 px-6 py-3 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Try it free
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-neutral-300 px-6 py-3 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              See pricing
            </Link>
          </div>
        </section>

        <section className="mt-24 grid gap-8 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{feature.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
