export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function money(n: number | null | undefined, digits = 2) {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function ago(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function countdown(ts: number | null | undefined) {
  if (ts == null) return "—";
  const s = Math.floor((ts - Date.now()) / 1000);
  if (s <= 0) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export const STATUS_COLOR: Record<string, string> = {
  idle: "var(--color-jade)",
  ready: "var(--color-jade)",
  working: "var(--color-cyan)",
  blocked: "var(--color-danger)",
  unknown: "#7c89a8",
};

const ACCENTS = ["#ff2bd6", "#22e6ff", "#8b5cff", "#21f3a3", "#ffb020", "#ff6ec7"];
/** Stable neon accent per agency so each ship looks different. */
export function agencyAccent(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function shortModel(m: string): string {
  return m.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

export const GRADE_COLOR: Record<string, string> = {
  A: "#21f3a3", "A-": "#5ef0b6", "B+": "#9be37a", B: "#cfe06a",
  C: "#ffb020", D: "#ff8a3b", F: "#ff3b5c",
};
