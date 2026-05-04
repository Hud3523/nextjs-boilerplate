import type { Agent } from "./types";

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

export function speak(role: Agent["role"], goal: string, ctx?: string): string {
  const g = goal.trim() || "the project";
  switch (role) {
    case "planner":
      return [
        `Okay, let's break "${truncate(g, 50)}" into bite-sized steps.`,
        `Step 1 — clarify the win condition. What does done look like?`,
        `Then milestones, owners, and a tight feedback loop. Sending the plan to Marcus.`,
      ].join(" ");
    case "manager":
      return [
        `Plan received. Assigning owners now.`,
        `Penny: drop me a clean spec. Devon: prep to build. Riley: be ready to QA.`,
        `Sage will keep an eye out for opportunities along the way.`,
      ].join(" ");
    case "prompter":
      return [
        `Spec drafted. Devon — here's exactly what to produce, in what format, and the tone to use.`,
        ctx ? `Context: ${ctx}` : `Keeping it concrete and easy to verify.`,
      ].join(" ");
    case "developer":
      return developerOutput(g);
    case "reviewer":
      return [
        `Reviewed. Strengths: clear structure, on-goal, actionable.`,
        `Nits: tighten the hook, add a CTA, double-check pricing logic.`,
        `Verdict: ✅ ship-ready after small edits.`,
      ].join(" ");
    case "suggester":
      return suggesterPing(g);
    case "agentmaker":
      return `New hire onboarded. Desk assigned, role briefed, they're ready to take work.`;
    case "custom":
      return `On it — ${ctx || "doing my part"}. Will hand off when done.`;
  }
}

export function suggesterPing(goal: string): string {
  const g = goal.toLowerCase();
  const pool: string[] = [];

  if (g.includes("sell") || g.includes("store") || g.includes("shop") || g.includes("ecom")) {
    pool.push(
      "💰 Try a 3-tier price test: $9 / $19 / $39 — let the market vote.",
      "📦 Bundle two slow movers as a 'starter kit' — instant AOV bump.",
      "📣 First 50 customers: ask for a 1-line review in exchange for 15% off next order.",
    );
  }
  if (g.includes("content") || g.includes("blog") || g.includes("post") || g.includes("social")) {
    pool.push(
      "📱 Repurpose 1 long post into 5 short ones — same idea, different hooks.",
      "🎯 Pick ONE niche keyword and own it for 30 days before expanding.",
    );
  }
  if (g.includes("app") || g.includes("site") || g.includes("web") || g.includes("build")) {
    pool.push(
      "🚀 Ship a 'coming soon' page first and collect emails — validate before building.",
      "🧪 Add a free tool that solves 5% of the problem — funnel into the paid product.",
    );
  }
  if (pool.length === 0) {
    pool.push(
      "💡 What's the single smallest version of this you could finish today?",
      "📊 Pick one metric to win this week — clarity beats activity.",
      "💵 Charge sooner than feels comfortable. Free users ≠ paying users.",
    );
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function developerOutput(goal: string): string {
  const g = goal.toLowerCase();
  if (g.includes("sell") || g.includes("store") || g.includes("shop")) {
    return [
      `Draft listing ready:`,
      `• Title: "${titleCase(goal)} — Built for Real Use"`,
      `• Hook: One-line benefit, not features.`,
      `• Bullets: 3 outcomes a buyer cares about.`,
      `• Price anchor: compare to a familiar alternative.`,
      `• CTA: "Add to cart" + scarcity badge if honest.`,
    ].join("\n");
  }
  if (g.includes("post") || g.includes("blog") || g.includes("content")) {
    return [
      `First draft outline:`,
      `1. Hook — a sharp question or surprising stat`,
      `2. Promise — what the reader walks away with`,
      `3. Proof — one example or mini-story`,
      `4. Payoff — the 3 takeaways`,
      `5. Ask — comment, share, or click`,
    ].join("\n");
  }
  return [
    `First build complete:`,
    `• Scope locked to the smallest valuable version`,
    `• Inputs validated, outputs structured`,
    `• Ready for Riley's review`,
  ].join("\n");
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
