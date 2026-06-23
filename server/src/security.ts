/**
 * Warden — command safety screen. A deterministic, low-level gate (NOT a prompt
 * an agent can reason around) that inspects every proposed shell command before
 * it can reach the operator's approval queue, and again before execution.
 *
 *   block → never offered for approval, never executes (destructive/irreversible)
 *   flag  → may be approved, but loudly marked with the reason
 *   allow → normal approval
 *
 * Pattern matching can't catch everything, so it is paired with per-command
 * human approval — defence in depth, not a silver bullet.
 */
export type Verdict = "allow" | "flag" | "block";
export interface Screen {
  verdict: Verdict;
  reasons: string[];
}

// Destructive / irreversible / privilege-escalating / self-exfiltrating.
const BLOCK: { re: RegExp; why: string }[] = [
  { re: /\brm\s+(-[a-z]*\s+)*-?[a-z]*r[a-z]*f|\brm\s+(-[a-z]*\s+)*-?[a-z]*f[a-z]*r/i, why: "recursive force delete (rm -rf)" },
  { re: /\b(rm|unlink)\s+(-\S+\s+)*(\/|~|\$HOME)(\s|$)/i, why: "deleting a root/home path" },
  { re: /\bdd\b[^\n]*\bof=/i, why: "raw disk write (dd of=)" },
  { re: /\bmkfs|\bfdisk|\bparted\b/i, why: "formatting / partitioning a disk" },
  { re: />\s*\/dev\/(sd|nvme|disk|hd)/i, why: "writing to a raw disk device" },
  { re: /:\s*\(\s*\)\s*\{.*\}\s*;?\s*:/s, why: "fork bomb" },
  { re: /\b(shutdown|reboot|halt|poweroff|init\s+0|init\s+6)\b/i, why: "shutting down/rebooting the machine" },
  { re: /\b(sudo|su|doas)\b/i, why: "privilege escalation (sudo/su)" },
  { re: /\b(curl|wget|fetch)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|python\d?|node|perl|ruby)\b/i, why: "piping a download straight into a shell/interpreter" },
  { re: /\bbase64\b[^|]*-d[^|]*\|\s*(sh|bash|zsh|python)/i, why: "decoding and executing a payload" },
  { re: /\b(nc|ncat|netcat)\b[^\n]*-e\b/i, why: "reverse shell (netcat -e)" },
  { re: /\bchmod\s+(-R\s+)?0?777\s+\//i, why: "world-writable on a root path" },
  { re: /\b(mv|cp)\b[^\n]*\s\/(etc|usr|bin|sbin|boot|sys|lib)\b/i, why: "overwriting a system directory" },
];

// Risky but sometimes legitimate — allowed only with explicit approval + warning.
const FLAG: { re: RegExp; why: string }[] = [
  { re: /\brm\b|\bunlink\b|\brmdir\b/i, why: "deletes files" },
  { re: /\b(curl|wget|fetch|scp|rsync|ftp)\b[^\n]*(-d\b|--data|-F\b|-T\b|--upload-file|@)/i, why: "sends data off the machine (possible exfiltration)" },
  { re: /(\.env|id_rsa|id_ed25519|\.ssh|\.aws|credentials|secrets?|\.pem|\.key)\b/i, why: "touches credentials/secrets" },
  { re: /\b(printenv|env)\b(?!\s+\w+=)|\bset\b\s*$/i, why: "dumps environment variables" },
  { re: /\bgit\s+push\b|\bgit\s+reset\s+--hard\b|\bgit\s+clean\b/i, why: "irreversible/external git operation" },
  { re: /\b(npm|pnpm|yarn)\b[^\n]*(-g\b|--global)|\bpip\d?\s+install\b|\bbrew\s+install\b/i, why: "installs software" },
  { re: /\b(kill|killall|pkill)\b/i, why: "terminates processes" },
  { re: /\bchmod\b|\bchown\b/i, why: "changes permissions/ownership" },
  { re: /[>|]\s*\/(etc|usr|bin|sbin|boot|sys|lib|var)\b/i, why: "writes into a system directory" },
  { re: /\bmv\b|\bcp\s+-[a-z]*r/i, why: "moves/overwrites files" },
];

export function screenCommand(cmd: string): Screen {
  const reasons: string[] = [];
  for (const r of BLOCK) if (r.re.test(cmd)) reasons.push(r.why);
  if (reasons.length) return { verdict: "block", reasons };
  for (const r of FLAG) if (r.re.test(cmd)) reasons.push(r.why);
  if (reasons.length) return { verdict: "flag", reasons };
  return { verdict: "allow", reasons: [] };
}
