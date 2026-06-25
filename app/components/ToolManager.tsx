"use client";

import { useState } from "react";
import { connectors, connectorCategoryLabels } from "../lib/connectors";
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

export default function ToolManager() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold holo-text">Tool Manager</h2>
        <p className="text-sm text-slate-400">
          Every external capability is a connector. Agents request tools through here —
          nothing is hardcoded. Credentials are stored as secrets and never exposed to
          agents that don&apos;t need them.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {connectors.map((c) => {
          const h = healthStyle[c.health];
          const open = openId === c.id;
          return (
            <div key={c.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{c.name}</h3>
                  <p className="text-[0.7rem] text-slate-500">
                    {connectorCategoryLabels[c.category]} · v{c.version}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[0.7rem] text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: h.dot }} />
                  {h.label}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-300">{c.description}</p>

              {c.repo && (
                <p className="mt-2 font-mono text-[0.7rem] text-sky-300/80">{c.repo}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag>{integrationLabel[c.integration]}</Tag>
                {c.requiredCredentials.some((r) => r.required) && (
                  <Tag tone="warn">Credentials required</Tag>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[0.7rem]">
                <div className="rounded-lg bg-white/[0.03] py-1.5">
                  <div className="text-sm font-semibold">{c.callsToday}</div>
                  <div className="text-slate-500">calls today</div>
                </div>
                <div className="rounded-lg bg-white/[0.03] py-1.5">
                  <div className="text-sm font-semibold">{(c.errorRate * 100).toFixed(1)}%</div>
                  <div className="text-slate-500">error rate</div>
                </div>
              </div>

              <button
                onClick={() => setOpenId(open ? null : c.id)}
                className="mt-3 w-full rounded-lg border border-[var(--border)] py-1.5 text-sm text-slate-200 hover:bg-white/5"
              >
                {open ? "Hide configuration" : "Configure connector"}
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
                  <Field label="Required credentials">
                    <ul className="space-y-1">
                      {c.requiredCredentials.map((cred) => (
                        <li key={cred.key} className="flex items-center justify-between text-[0.75rem]">
                          <span className="text-slate-300">
                            {cred.label}{" "}
                            <code className="text-slate-500">({cred.key})</code>
                          </span>
                          <span className="text-slate-500">
                            {cred.secret ? "🔒 secret" : "public"}
                            {cred.required ? " · required" : " · optional"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Field>
                  <p className="text-[0.7rem] text-slate-500">
                    Setup is mocked in this build. Wiring the live adapter is the next phase.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[0.65rem]"
      style={
        tone === "warn"
          ? { background: "rgba(251,191,36,0.15)", color: "#fcd34d" }
          : { background: "rgba(120,160,255,0.12)", color: "#bcd3ff" }
      }
    >
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
