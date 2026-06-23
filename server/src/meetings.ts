import { logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { gov } from "./governance.js";
import { getAgent } from "./agents.js";
import { oneShot, hasApiKey } from "./engine.js";
import { remember } from "./memory.js";
import { postToBoard } from "./board.js";
import { raiseAttention } from "./attention.js";
import { runTraining } from "./academy.js";
import { reportCard } from "./academy.js";

function simulating() {
  return gov.dryRun() || !hasApiKey();
}

export interface ConveneResult {
  mode: "meeting" | "training" | "coaching";
  transcript?: { speaker: string; line: string }[];
  takeaway?: string;
  grades?: { callsign: string; avg: number; letter: string }[];
  tips?: { callsign: string; tip: string }[];
}

/** Run a meeting / training / coaching session over a set of agents. */
export async function convene(mode: ConveneResult["mode"], agentIds: string[], topic?: string): Promise<ConveneResult> {
  const agents = agentIds.map(getAgent).filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (!agents.length) return { mode };
  const names = agents.map((a) => a.callsign).join(", ");

  if (mode === "training") {
    const grades: { callsign: string; avg: number; letter: string }[] = [];
    for (const a of agents) {
      const r = await runTraining(a.id, "dry-run");
      if (!("error" in r)) grades.push({ callsign: a.callsign, avg: r.avg, letter: r.letter });
    }
    audit("operator", "convene_training", { agents: agentIds });
    logActivity("system", `🎓 Training session for ${names} complete.`);
    return { mode, grades };
  }

  if (mode === "coaching") {
    let tips: { callsign: string; tip: string }[] = [];
    if (simulating()) {
      tips = agents.map((a) => ({ callsign: a.callsign, tip: `Coach (dry-run): ${a.callsign}, tighten your ${a.role.toLowerCase()} output — be more specific and lead with the result. Run a training cycle to confirm the grade rises.` }));
    } else {
      const ctx = agents.map((a) => `${a.callsign} (${a.role}) — grade ${reportCard(a.reputation_key ?? a.id).letter ?? "n/a"}`).join("\n");
      const out = await oneShot(
        "You are FOREMAN, performance coach. For each agent below, give ONE specific, encouraging, actionable coaching tip. Respond as JSON: {\"tips\":[{\"callsign\":string,\"tip\":string}]}.",
        `Coach these agents${topic ? ` on: ${topic}` : ""}:\n${ctx}`,
      );
      try { tips = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "{}").tips ?? []; } catch { tips = [{ callsign: names, tip: out.slice(0, 400) }]; }
    }
    for (const t of tips) remember({ kind: "lesson", title: `Coaching: ${t.callsign}`, content: t.tip });
    raiseAttention({ kind: "escalation", severity: "info", title: `🧑‍🏫 Coaching notes for ${names}`, body: tips.map((t) => `${t.callsign}: ${t.tip}`).join("\n") });
    audit("foreman", "convene_coaching", { agents: agentIds });
    logActivity("system", `🧑‍🏫 Foreman coached ${names}.`);
    return { mode, tips };
  }

  // meeting — the crew talks and learns; Chair synthesises a takeaway.
  let transcript: { speaker: string; line: string }[] = [];
  let takeaway = "";
  const subject = topic || "how to make the agency more effective";
  if (simulating()) {
    transcript = agents.map((a) => ({ speaker: a.callsign, line: `[dry-run] As ${a.role}, my take on "${subject}": here's one concrete thing we should try from my corner.` }));
    transcript.push({ speaker: "Chair", line: `Synthesis: aligned on a plan for "${subject}". Logged a lesson for everyone.` });
    takeaway = `The crew aligned on "${subject}" and captured a shared lesson (dry-run).`;
  } else {
    const roster = agents.map((a) => `${a.callsign} (${a.role})`).join(", ");
    const out = await oneShot(
      "You are CHAIR facilitating a short crew roundtable. Produce a concise, realistic discussion among the named agents, then a synthesis. Respond as JSON: {\"transcript\":[{\"speaker\":string,\"line\":string}], \"takeaway\":string}. Keep each line to one or two sentences.",
      `Agents: ${roster}\nTopic: ${subject}`,
      1400,
    );
    try {
      const p = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      transcript = p.transcript ?? [];
      takeaway = p.takeaway ?? "";
    } catch {
      transcript = [{ speaker: "Chair", line: out.slice(0, 600) }];
    }
  }
  if (takeaway) remember({ kind: "lesson", title: `Meeting: ${subject}`, content: takeaway });
  for (const a of agents) postToBoard({ floorId: a.floor_id, agentId: a.id, type: "message", content: `Attended meeting on "${subject}".` });
  raiseAttention({ kind: "escalation", severity: "info", title: `📋 Meeting digest: ${subject}`, body: takeaway || "See transcript.", payload: { kind: "meeting", transcript } });
  audit("chair", "convene_meeting", { agents: agentIds, topic: subject });
  logActivity("system", `🗣️ Meeting held with ${names} on "${subject}". Takeaway saved to the Lattice.`);
  return { mode, transcript, takeaway };
}
