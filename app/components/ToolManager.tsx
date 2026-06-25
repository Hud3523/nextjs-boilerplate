"use client";

import { useCallback, useEffect, useState } from "react";
import { connectors, connectorCategoryLabels, liveConnectorIds } from "../lib/connectors";
import type { Connector, ConnectorHealth } from "../lib/types";

const healthStyle: Record<ConnectorHealth, { dot: string; label: string }> = {
  healthy: { dot: "#34d399", label: "Healthy" },
  degraded: { dot: "#fbbf24", label: "Degraded" },
  offline: { dot: "#f87171", label: "Offline" },
  unconfigured: { dot: "#64748b", label: "Needs setup" },
};

const integrationLabel: Record<Connector["integration"], string> = {
  "in-process": "In-process module",
  "external-service": "External service",
  reference: "Reference / schema",
};

type LiveHealth = {
  status: ConnectorHealth;
  detail?: string;
  latencyMs?: number;
};
type LiveEntry = { configured: boolean; health: LiveHealth };
type TestState = {
  loading: boolean;
  ok?: boolean;
  data?: unknown;
  error?: string;
  latencyMs?: number;
};

export default function ToolManager() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveEntry>>({});
  const [liveLoading, setLiveLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const refreshHealth = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await fetch("/api/connectors", { cache: "no-store" });
      const json = await res.json();
      const map: Record<string, LiveEntry> = {};
      for (const c of json.connectors ?? []) map[c.id] = { configured: c.configured, health: c.health };
      setLive(map);
      setCheckedAt(json.checkedAt ?? null);
    } catch {
      /* leave static fallback in place */
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const runTest = useCallback(async (id: string) => {
    setTests((t) => ({ ...t, [id]: { loading: true } }));
    try {
      const res = await fetch(`/api/connectors/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json();
      setTests((t) => ({
        ...t,
        [id]: { loading: false, ok: json.ok, data: json.data, error: json.error, latencyMs: json.latencyMs },
      }));
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { loading: false, ok: false, error: String(e) } }));
    }
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold holo-text">Tool Manager</h2>
          <p className="text-sm text-slate-400">
            Every external capability is a connector. Agents request tools through here —
            nothing is hardcoded. Credentials live in env/secret storage and never reach the client.
          </p>
        </div>
        <button
          onClick={refreshHealth}
          disabled={liveLoading}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
        >
          {liveLoading ? "Checking…" : "↻ Refresh health"}
        </button>
      </header>
      {checkedAt && (
        <p className="text-[0.7rem] text-slate-500">
          Live health checked {new Date(checkedAt).toLocaleTimeString()} · 4 connectors wired
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connectors.map((c) => {
          const isLive = liveConnectorIds.includes(c.id);
          const liveEntry = live[c.id];
          // Live status overrides the static placeholder when available.
          const status: ConnectorHealth = liveEntry?.health.status ?? c.health;
          const h = healthStyle[status];
          const open = openId === c.id;
          const test = tests[c.id];

          return (
            <div key={c.id} className={`glass rounded-xl p-4 ${isLive ? "ring-1 ring-sky-400/30" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 font-medium">
                    {c.name}
                    {isLive && (
                      <span className="rounded-full bg-sky-400/15 px-1.5 py-0.5 text-[0.55rem] text-sky-200">
                        LIVE
                      </span>
                    )}
                  </h3>
                  <p className="text-[0.7rem] text-slate-500">
                    {connectorCategoryLabels[c.category]} · v{c.version}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[0.7rem] text-slate-400">
                  <span
                    className={`h-2 w-2 rounded-full ${isLive && liveLoading ? "pulse-glow" : ""}`}
                    style={{ background: h.dot }}
                  />
                  {h.label}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-300">{c.description}</p>

              {isLive && liveEntry?.health.detail && (
                <p className="mt-2 truncate text-[0.7rem] text-slate-400" title={liveEntry.health.detail}>
                  {liveEntry.health.detail}
                  {liveEntry.health.latencyMs != null && (
                    <span className="text-slate-500"> · {liveEntry.health.latencyMs}ms</span>
                  )}
                </p>
              )}

              {c.repo && <p className="mt-2 font-mono text-[0.7rem] text-sky-300/80">{c.repo}</p>}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag>{integrationLabel[c.integration]}</Tag>
                {isLive && liveEntry && (
                  <Tag tone={liveEntry.configured ? "ok" : "warn"}>
                    {liveEntry.configured ? "Configured" : "Add credentials"}
                  </Tag>
                )}
                {!isLive && c.requiredCredentials.some((r) => r.required) && (
                  <Tag tone="warn">Credentials required</Tag>
                )}
              </div>

              {isLive && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => runTest(c.id)}
                    disabled={test?.loading}
                    className="w-full rounded-lg border border-sky-400/50 bg-sky-400/10 py-1.5 text-sm text-sky-200 hover:bg-sky-400/20 disabled:opacity-50"
                  >
                    {test?.loading ? "Running…" : "▶ Run test call"}
                  </button>
                  {test && !test.loading && (
                    <div
                      className={`rounded-lg border p-2 text-[0.7rem] ${
                        test.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
                      }`}
                    >
                      <div className="mb-1 flex justify-between">
                        <span className={test.ok ? "text-emerald-300" : "text-red-300"}>
                          {test.ok ? "✓ Success" : "✕ Failed"}
                        </span>
                        {test.latencyMs != null && <span className="text-slate-500">{test.latencyMs}ms</span>}
                      </div>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-slate-400">
                        {test.ok ? JSON.stringify(test.data, null, 2) : test.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setOpenId(open ? null : c.id)}
                className="mt-3 w-full rounded-lg border border-[var(--border)] py-1.5 text-sm text-slate-200 hover:bg-white/5"
              >
                {open ? "Hide configuration" : "Configuration & credentials"}
              </button>

              {open && (
                <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                  <Field label="Permissions">
                    <div className="flex flex-wrap gap-1.5">
                      {c.permissions.map((p) => (
                        <code key={p} className="rounded bg-white/5 px-1.5 py-0.5 text-[0.65rem] text-slate-300">
                          {p}
                        </code>
                      ))}
                    </div>
                  </Field>
                  <Field label="Required credentials (set as env vars)">
                    <ul className="space-y-1">
                      {c.requiredCredentials.map((cred) => (
                        <li key={cred.key} className="flex items-center justify-between text-[0.75rem]">
                          <span className="text-slate-300">
                            {cred.label} <code className="text-slate-500">({cred.key})</code>
                          </span>
                          <span className="text-slate-500">
                            {cred.secret ? "🔒 secret" : "public"}
                            {cred.required ? " · required" : " · optional"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Field>
                  {!isLive && (
                    <p className="text-[0.7rem] text-slate-500">
                      Adapter not yet wired — see docs/CONNECTORS.md to add it.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "warn" | "ok" }) {
  const styles =
    tone === "warn"
      ? { background: "rgba(251,191,36,0.15)", color: "#fcd34d" }
      : tone === "ok"
        ? { background: "rgba(52,211,153,0.15)", color: "#6ee7b7" }
        : { background: "rgba(120,160,255,0.12)", color: "#bcd3ff" };
  return (
    <span className="rounded-full px-2 py-0.5 text-[0.65rem]" style={styles}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[0.65rem] uppercase tracking-wide text-slate-500">{label}</div>
      {children}
    </div>
  );
}
