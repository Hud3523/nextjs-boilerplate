"use client";

import { CATEGORIES, Category, SIZE_TIERS, SizeTier, CalculatorInput } from "@/lib/fbaFees";

interface Props {
  value: CalculatorInput;
  onChange: (value: CalculatorInput) => void;
}

function NumberField({
  label,
  value,
  onChange,
  step = "0.01",
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

export function CalculatorForm({ value, onChange }: Props) {
  function set<K extends keyof CalculatorInput>(key: K, val: CalculatorInput[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <NumberField label="Selling price ($)" value={value.sellingPrice} onChange={(v) => set("sellingPrice", v)} />
      <NumberField label="Product cost ($)" value={value.productCost} onChange={(v) => set("productCost", v)} />
      <NumberField
        label="Inbound shipping per unit ($)"
        value={value.inboundShippingPerUnit}
        onChange={(v) => set("inboundShippingPerUnit", v)}
      />
      <NumberField
        label="Expected units sold / month"
        value={value.monthlyUnitsSold}
        step="1"
        min={0}
        onChange={(v) => set("monthlyUnitsSold", v)}
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Category</span>
        <select
          value={value.category}
          onChange={(e) => set("category", e.target.value as Category)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Size tier</span>
        <select
          value={value.sizeTier}
          onChange={(e) => set("sizeTier", e.target.value as SizeTier)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {SIZE_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <NumberField label="Weight (oz)" value={value.weightOz} onChange={(v) => set("weightOz", v)} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Storage season</span>
        <select
          value={value.storageSeason}
          onChange={(e) => set("storageSeason", e.target.value as CalculatorInput["storageSeason"])}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="offPeak">Jan–Sep (off-peak)</option>
          <option value="peak">Oct–Dec (peak)</option>
        </select>
      </label>

      <NumberField label="Length (in)" value={value.lengthIn} onChange={(v) => set("lengthIn", v)} />
      <NumberField label="Width (in)" value={value.widthIn} onChange={(v) => set("widthIn", v)} />
      <NumberField label="Height (in)" value={value.heightIn} onChange={(v) => set("heightIn", v)} />
    </div>
  );
}
