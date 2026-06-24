/**
 * Phase 1 proof: read Hermes status + agents, send one instruction, print the
 * result. Run with `npm run hermes:check` (uses HERMES_MODE; mock by default).
 */
import { hermes } from "./index.js";

async function main() {
  const h = hermes();
  console.log(`\n🔌 Hermes adapter mode: ${h.mode}\n`);

  const health = await h.health();
  console.log(`health: ${health.ok ? "✅" : "❌"} ${health.detail}\n`);

  const agents = await h.listAgents();
  console.log(`agents (${agents.length}):`);
  for (const a of agents) console.log(`  • ${a.name} [${a.id}] — ${a.role ?? ""} · ${a.status} · ${a.model ?? "?"}`);
  console.log();

  if (!agents.length) {
    console.log("No agents returned. If you expected some, check HERMES_MODE / HERMES_BASE_URL / the endpoint config in hermes/index.ts.\n");
    return;
  }

  const target = agents[0].id;
  const instruction = process.argv[2] || "Say hello and confirm you are reachable.";
  console.log(`→ sending to "${target}": ${instruction}`);
  process.stdout.write("← ");
  const result = await h.sendInstruction(target, instruction, (t) => process.stdout.write(t));
  console.log(`\n\nresult: status=${result.status}${result.costUsd != null ? ` cost=$${result.costUsd}` : ""}${result.model ? ` model=${result.model}` : ""}\n`);
  console.log(health.ok ? "✅ Round-trip OK.\n" : "⚠️  Round-trip ran against the mock — point HERMES_MODE at your real Hermes to go live.\n");
}

main().catch((e) => { console.error("hermes:check failed —", e); process.exit(1); });
