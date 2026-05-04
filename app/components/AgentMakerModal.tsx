"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; job: string }) => void;
}

const JOB_PRESETS = [
  "Sells products online and writes listings",
  "Runs paid ads and tracks ROI",
  "Designs logos and product visuals",
  "Researches trending niches",
  "Writes daily social media posts",
  "Handles customer support replies",
];

export default function AgentMakerModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [job, setJob] = useState("");

  if (!open) return null;

  const submit = () => {
    if (!job.trim()) return;
    onCreate({ name: name.trim(), job: job.trim() });
    setName("");
    setJob("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl">🧬</span>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Hire a new agent</h2>
            <p className="text-xs text-zinc-400">Hugo will onboard them into the office.</p>
          </div>
        </div>

        <label className="block text-xs font-medium text-zinc-300">Name (optional)</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sam the Seller"
          className="mt-1 mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500 focus:outline-none"
        />

        <label className="block text-xs font-medium text-zinc-300">What should they do?</label>
        <textarea
          value={job}
          onChange={(e) => setJob(e.target.value)}
          rows={3}
          placeholder="e.g. Find products to dropship and write the listings"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500 focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-1.5">
          {JOB_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setJob(p)}
              className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-cyan-500/60 hover:text-cyan-200"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!job.trim()}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hire
          </button>
        </div>
      </div>
    </div>
  );
}
