"use client";

import Link from "next/link";
import { SavedProduct } from "@/lib/plan";

function money(value: unknown): string {
  const n = typeof value === "number" ? value : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface Props {
  products: SavedProduct[];
  isPro: boolean;
  freeLimit: number;
  onSave: () => void;
  onRemove: (id: string) => void;
  onExportCsv: () => void;
  canSaveMore: boolean;
}

export function SavedProductsPanel({ products, isPro, freeLimit, onSave, onRemove, onExportCsv, canSaveMore }: Props) {
  return (
    <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Saved products</h2>
        {isPro && products.length > 0 && (
          <button onClick={onExportCsv} className="text-sm underline">
            Export CSV
          </button>
        )}
      </div>

      {!isPro && (
        <p className="mt-1 text-xs text-neutral-500">
          Free plan: save up to {freeLimit} product{freeLimit === 1 ? "" : "s"}.{" "}
          <Link href="/pricing" className="underline">
            Upgrade for unlimited
          </Link>
          .
        </p>
      )}

      <button
        onClick={onSave}
        disabled={!canSaveMore}
        className="mt-4 w-full rounded-md border border-neutral-300 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Save this calculation
      </button>

      <ul className="mt-4 space-y-2">
        {products.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-md border border-neutral-100 px-3 py-2 text-sm dark:border-neutral-800"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-neutral-500">
                Profit/unit: {money(p.result.netProfitPerUnit)} · Margin:{" "}
                {typeof p.result.marginPct === "number" ? p.result.marginPct.toFixed(1) : "0"}%
              </p>
            </div>
            <button onClick={() => onRemove(p.id)} className="text-xs text-red-600 hover:underline dark:text-red-400">
              Remove
            </button>
          </li>
        ))}
        {products.length === 0 && <li className="text-sm text-neutral-500">No products saved yet.</li>}
      </ul>
    </div>
  );
}
