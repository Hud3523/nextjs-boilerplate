import type { Agent, Grade } from "./types";

export interface PlanStep {
  title: string;
  ownerRole: Agent["role"];
}

export function planSteps(goal: string): PlanStep[] {
  const g = goal.trim() || "your project";
  return [
    { title: `Clarify the goal: "${truncate(g, 60)}"`, ownerRole: "planner" },
    { title: "Break the goal into milestones", ownerRole: "planner" },
    { title: "Assign owners to each milestone", ownerRole: "manager" },
    { title: "Write working prompts/specs", ownerRole: "prompter" },
    { title: "Produce the first draft / build", ownerRole: "developer" },
    { title: "Review & polish the output", ownerRole: "reviewer" },
    { title: "Surface ideas & next moves", ownerRole: "suggester" },
  ];
}

type SkillTier = "rookie" | "solid" | "ace";

function tierOf(skill: number): SkillTier {
  if (skill >= 75) return "ace";
  if (skill >= 50) return "solid";
  return "rookie";
}

export function speak(
  role: Agent["role"],
  goal: string,
  skill = 35,
  ctx?: string,
): string {
  const g = goal.trim() || "the project";
  const tier = tierOf(skill);
  switch (role) {
    case "planner":
      return plannerOutput(g, tier);
    case "manager":
      return managerOutput(g, tier);
    case "prompter":
      return prompterOutput(g, tier, ctx);
    case "developer":
      return developerOutput(g, tier);
    case "reviewer":
      return reviewerOutput(tier);
    case "suggester":
      return suggesterPing(g, tier);
    case "agentmaker":
      return `New hire onboarded. Desk assigned, role briefed, they're ready to take work.`;
    case "custom":
      return `On it — ${ctx || "doing my part"}. Aiming to nail it on the first try.`;
  }
}

function plannerOutput(g: string, tier: SkillTier): string {
  if (tier === "ace") {
    return [
      `🎯 Plan locked for "${truncate(g, 50)}":`,
      `1. Define the win condition (one measurable outcome).`,
      `2. Identify the smallest valuable slice we can finish today.`,
      `3. Ordered milestones with owners and acceptance checks.`,
      `4. Risk list + a 'kill criteria' so we don't over-invest.`,
      `Handing off to Marcus — clean spec attached.`,
    ].join("\n");
  }
  if (tier === "solid") {
    return [
      `Plan for "${truncate(g, 50)}":`,
      `1. Clarify the goal & success metric.`,
      `2. Milestone list with rough order.`,
      `3. Assign owners. Sending to Marcus.`,
    ].join("\n");
  }
  return [
    `Okay, breaking "${truncate(g, 50)}" into steps.`,
    `Step 1 — define done. Then milestones, then owners. Sending to Marcus.`,
  ].join(" ");
}

function managerOutput(_g: string, tier: SkillTier): string {
  if (tier === "ace") {
    return [
      `📋 Assignments out:`,
      `• Penny → spec doc (concrete, testable, due in this run)`,
      `• Devon → deliverable per spec, output format pinned`,
      `• Riley → reviews against acceptance criteria`,
      `• Sage → watches for monetization angles throughout`,
      `Cadence: tight handoffs, no drift.`,
    ].join("\n");
  }
  if (tier === "solid") {
    return [
      `Plan received. Assigning:`,
      `• Penny — write the spec.`,
      `• Devon — produce the build/draft.`,
      `• Riley — QA the output.`,
      `Sage will chime in with ideas.`,
    ].join("\n");
  }
  return [
    `Plan received. Assigning owners now.`,
    `Penny: drop me a spec. Devon: prep to build. Riley: ready to QA.`,
  ].join(" ");
}

function prompterOutput(_g: string, tier: SkillTier, ctx?: string): string {
  if (tier === "ace") {
    return [
      `📝 Spec for Devon:`,
      `• Audience: clear & specific`,
      `• Format: structured output (numbered, headed)`,
      `• Tone: confident, plain-spoken, zero filler`,
      `• Must include: hook, proof, payoff, CTA`,
      `• Done = passes Riley's checklist on the first pass`,
      ctx ? `Context: ${ctx}` : "",
    ].filter(Boolean).join("\n");
  }
  if (tier === "solid") {
    return [
      `Spec drafted for Devon:`,
      `• Format: structured & easy to scan`,
      `• Include: clear hook + 3 takeaways + CTA`,
      `• Tone: tight, no fluff`,
      ctx ? `Context: ${ctx}` : "",
    ].filter(Boolean).join("\n");
  }
  return [
    `Spec drafted. Devon — produce the output, keep it concrete and easy to verify.`,
    ctx ? `Context: ${ctx}` : "",
  ].filter(Boolean).join(" ");
}

function developerOutput(goal: string, tier: SkillTier): string {
  const g = goal.toLowerCase();
  if (g.includes("sell") || g.includes("store") || g.includes("shop")) {
    if (tier === "ace") {
      return [
        `🛠️ Listing v3 (polished):`,
        `• Title: "${titleCase(goal)} — built for daily use"`,
        `• Hook: lead with the buyer's outcome, not features`,
        `• Bullets: 3 outcomes, 2 specs, 1 social proof line`,
        `• Anchor price vs a familiar alternative; offer a 2-pack bundle`,
        `• CTA: "Add to cart" + honest scarcity (e.g. "ships in 24h")`,
        `• SEO: 3 long-tail keywords woven in naturally`,
      ].join("\n");
    }
    if (tier === "solid") {
      return [
        `Listing draft:`,
        `• Title: "${titleCase(goal)} — Built for Real Use"`,
        `• One-line benefit hook`,
        `• 3 outcome bullets + price anchor`,
        `• CTA: "Add to cart"`,
      ].join("\n");
    }
    return [
      `First draft listing:`,
      `• Title: "${titleCase(goal)}"`,
      `• Bullets: features (will refine)`,
      `• Price + CTA`,
    ].join("\n");
  }

  if (g.includes("post") || g.includes("blog") || g.includes("content") || g.includes("tweet")) {
    if (tier === "ace") {
      return [
        `📝 Draft v3 (sharp):`,
        `1. Hook — surprising stat or contrarian claim`,
        `2. Promise — exactly what the reader walks away with`,
        `3. Proof — one example with specifics (numbers, names)`,
        `4. Payoff — 3 takeaways framed as "do this"`,
        `5. Ask — clear, single CTA`,
        `Tightened: cut 28% of words, kept every concrete detail.`,
      ].join("\n");
    }
    if (tier === "solid") {
      return [
        `Draft outline:`,
        `1. Hook — sharp question`,
        `2. Promise — one-line value`,
        `3. Proof — example or stat`,
        `4. Payoff — 3 takeaways`,
        `5. CTA`,
      ].join("\n");
    }
    return [
      `First draft outline:`,
      `1. Hook 2. Promise 3. Proof 4. Payoff 5. CTA`,
    ].join("\n");
  }

  if (tier === "ace") {
    return [
      `🛠️ Build v3 — polished:`,
      `• Smallest valuable slice locked`,
      `• Inputs validated, outputs structured`,
      `• Edge cases handled, error states friendly`,
      `• Ready for Riley — confident this passes first pass`,
    ].join("\n");
  }
  if (tier === "solid") {
    return [
      `Build complete:`,
      `• Scope kept tight`,
      `• Inputs validated, outputs structured`,
      `• Ready for Riley`,
    ].join("\n");
  }
  return [
    `First build done:`,
    `• Smallest valuable version`,
    `• Ready for review`,
  ].join("\n");
}

function reviewerOutput(tier: SkillTier): string {
  if (tier === "ace") {
    return [
      `🔎 Review:`,
      `Strengths: on-goal, concrete, clean structure, strong CTA.`,
      `Polish: 2 micro-edits — tighten the hook, sharpen the close.`,
      `Verdict: ✅ ship-ready. A-tier work.`,
    ].join("\n");
  }
  if (tier === "solid") {
    return [
      `Review: clear, on-goal, actionable.`,
      `Nits: tighten hook, add CTA, double-check pricing.`,
      `Verdict: ✅ ship-ready after small edits.`,
    ].join("\n");
  }
  return [
    `Reviewed.`,
    `Strengths: structure is there.`,
    `Fixes: hook is generic, missing CTA, examples too vague.`,
    `Verdict: ⚠ needs another pass.`,
  ].join("\n");
}

export function suggesterPing(goal: string, tier: SkillTier = "solid"): string {
  const g = goal.toLowerCase();
  const pool: string[] = [];

  if (g.includes("sell") || g.includes("store") || g.includes("shop") || g.includes("ecom")) {
    pool.push(
      "💰 Three-tier price test: $9 / $19 / $39 — let buyers vote with carts.",
      "📦 Bundle two slow movers as a 'starter kit' — instant AOV bump.",
      "📣 First 50 customers: 1-line review for 15% off the next order.",
    );
    if (tier === "ace") pool.push(
      "🎯 Pixel + UTM every channel from day 1; you'll thank yourself month two.",
      "📈 Run a 7-day Meta Advantage+ test at $10/day before scaling spend.",
    );
  }
  if (g.includes("content") || g.includes("blog") || g.includes("post") || g.includes("social") || g.includes("tweet")) {
    pool.push(
      "📱 Repurpose 1 long post into 5 short ones — same idea, different hooks.",
      "🎯 Pick ONE niche keyword and own it for 30 days before expanding.",
    );
    if (tier === "ace") pool.push(
      "🪝 Open with a contrarian line — engagement spikes 2-3x vs neutral hooks.",
    );
  }
  if (g.includes("app") || g.includes("site") || g.includes("web") || g.includes("build")) {
    pool.push(
      "🚀 Ship a 'coming soon' page first — collect emails, validate before building.",
      "🧪 Add a free tool that solves 5% of the problem — funnel into the paid product.",
    );
  }
  if (pool.length === 0) {
    pool.push(
      "💡 What's the smallest version of this you could finish today?",
      "📊 Pick one metric to win this week — clarity beats activity.",
      "💵 Charge sooner than feels comfortable. Free users ≠ paying users.",
    );
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------- Grading ----------------

export function gradeOutput(skill: number): { grade: Grade; score: number } {
  const noise = (Math.random() - 0.5) * 12;
  let score = clamp(skill + noise + 30, 30, 100);
  if (Math.random() < 0.05) score = clamp(score + 10, 30, 100); // lucky day
  return { grade: scoreToGrade(score), score: Math.round(score) };
}

function scoreToGrade(s: number): Grade {
  if (s >= 96) return "A+";
  if (s >= 90) return "A";
  if (s >= 86) return "A-";
  if (s >= 82) return "B+";
  if (s >= 76) return "B";
  if (s >= 70) return "B-";
  if (s >= 60) return "C";
  return "D";
}

export function applyLearning(skill: number, score: number): number {
  // Small bump from each task — bigger when score is high relative to skill.
  const overshoot = Math.max(0, score - skill);
  const base = 1.2;
  const bonus = overshoot * 0.05;
  const next = clamp(skill + base + bonus, 0, 100);
  return Math.round(next * 10) / 10;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
