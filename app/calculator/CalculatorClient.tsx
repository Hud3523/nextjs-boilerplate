"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalculatorForm } from "@/app/components/CalculatorForm";
import { ResultsPanel } from "@/app/components/ResultsPanel";
import { SavedProductsPanel } from "@/app/components/SavedProductsPanel";
import { CalculatorInput, calculateFbaEconomics } from "@/lib/fbaFees";
import { FREE_TIER_SAVE_LIMIT, SavedProduct, isPro, loadSavedProducts, saveSavedProducts, setPro } from "@/lib/plan";

const DEFAULT_INPUT: CalculatorInput = {
  sellingPrice: 24.99,
  productCost: 6,
  category: "home_kitchen",
  sizeTier: "small_standard",
  weightOz: 8,
  lengthIn: 8,
  widthIn: 6,
  heightIn: 2,
  inboundShippingPerUnit: 0.5,
  monthlyUnitsSold: 100,
  storageSeason: "offPeak",
};

function toCsv(products: SavedProduct[]): string {
  const header = ["name", "sellingPrice", "productCost", "netProfitPerUnit", "marginPct", "roiPct"];
  const rows = products.map((p) => [
    p.name,
    p.input.sellingPrice,
    p.input.productCost,
    p.result.netProfitPerUnit,
    p.result.marginPct,
    p.result.roiPct,
  ]);
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}

export function CalculatorClient() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState<CalculatorInput>(DEFAULT_INPUT);
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [pro, setProState] = useState(false);
  const [productName, setProductName] = useState("New product");

  useEffect(() => {
    // Reads localStorage (an external system, unavailable during SSR) after
    // hydration to avoid a server/client markup mismatch.
    if (searchParams.get("upgraded") === "true") {
      setPro(true);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProState(isPro());
    setProducts(loadSavedProducts());
  }, [searchParams]);

  const result = useMemo(() => calculateFbaEconomics(input), [input]);

  const canSaveMore = pro || products.length < FREE_TIER_SAVE_LIMIT;

  function handleSave() {
    if (!canSaveMore) return;
    const next: SavedProduct[] = [
      ...products,
      {
        id: crypto.randomUUID(),
        name: productName || "Untitled product",
        createdAt: Date.now(),
        input: { ...input },
        result: { ...result },
      },
    ];
    setProducts(next);
    saveSavedProducts(next);
  }

  function handleRemove(id: string) {
    const next = products.filter((p) => p.id !== id);
    setProducts(next);
    saveSavedProducts(next);
  }

  function handleExportCsv() {
    const csv = toCsv(products);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fba-products.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold">
          FBA Profit Calculator
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {pro ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Pro
            </span>
          ) : (
            <Link href="/pricing" className="hover:underline">
              Upgrade
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <h1 className="text-2xl font-bold">Calculate your FBA profit</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-neutral-600 dark:text-neutral-400">Product name</span>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <div className="mt-4">
                <CalculatorForm value={input} onChange={setInput} />
              </div>
            </div>
            <ResultsPanel result={result} />
          </div>

          <SavedProductsPanel
            products={products}
            isPro={pro}
            freeLimit={FREE_TIER_SAVE_LIMIT}
            onSave={handleSave}
            onRemove={handleRemove}
            onExportCsv={handleExportCsv}
            canSaveMore={canSaveMore}
          />
        </div>
      </main>
    </div>
  );
}
