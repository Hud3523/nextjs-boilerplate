import Link from "next/link";
import { UpgradeButton } from "@/app/components/UpgradeButton";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold">
          FBA Profit Calculator
        </Link>
        <Link href="/calculator" className="text-sm hover:underline">
          Open Calculator
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-12">
        <h1 className="text-center text-3xl font-bold tracking-tight">Simple pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-neutral-600 dark:text-neutral-400">
          Start free. Upgrade when you&apos;re evaluating more than one product at a time.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-8 dark:border-neutral-800">
            <h2 className="text-xl font-semibold">Free</h2>
            <p className="mt-1 text-3xl font-bold">$0</p>
            <ul className="mt-6 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li>Unlimited profit calculations</li>
              <li>Full fee breakdown</li>
              <li>Save up to 1 product</li>
            </ul>
            <Link
              href="/calculator"
              className="mt-8 block rounded-md border border-neutral-300 py-2 text-center font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Get started
            </Link>
          </div>

          <div className="rounded-lg border border-neutral-900 p-8 dark:border-white">
            <h2 className="text-xl font-semibold">Pro</h2>
            <p className="mt-1 text-3xl font-bold">
              $19<span className="text-base font-normal text-neutral-500">/mo</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <li>Everything in Free</li>
              <li>Unlimited saved products</li>
              <li>Side-by-side comparison</li>
              <li>CSV export</li>
            </ul>
            <UpgradeButton />
          </div>
        </div>
      </main>
    </div>
  );
}
