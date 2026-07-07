"use client";

import { CalculatorResult } from "@/lib/fbaFees";

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-neutral-600 dark:text-neutral-400"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ResultsPanel({ result }: { result: CalculatorResult }) {
  const profitColor =
    result.netProfitPerUnit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="font-semibold">Profit breakdown</h2>

      <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
        <Row label="Referral fee" value={money(result.referralFee)} />
        <Row label="FBA fulfillment fee" value={money(result.fulfillmentFee)} />
        <Row label="Storage fee (per unit)" value={money(result.storageFeePerUnit)} />
        {result.closingFee > 0 && <Row label="Closing fee" value={money(result.closingFee)} />}
        <Row label="Total fees" value={money(result.totalFees)} strong />
      </div>

      <div className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-200 dark:border-neutral-800">
        <Row label="Total cost per unit" value={money(result.totalCostPerUnit)} />
        <Row
          label="Net profit per unit"
          value={money(result.netProfitPerUnit)}
        />
        <Row label="Margin" value={`${result.marginPct.toFixed(1)}%`} />
        <Row label="ROI" value={`${result.roiPct.toFixed(1)}%`} />
        <Row
          label="Break-even units"
          value={result.breakEvenUnits > 0 ? result.breakEvenUnits.toLocaleString() : "—"}
        />
      </div>

      <p className={`mt-4 text-lg font-bold ${profitColor}`}>{money(result.netProfitPerUnit)} profit / unit</p>
    </div>
  );
}
