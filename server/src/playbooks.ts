/**
 * Playbooks — proven floor structures saved as reusable blueprints.
 *
 * When an approved opportunity matches a playbook, the Factory instantiates the
 * whole org instantly instead of authoring from scratch. Each role becomes an
 * agent on the new floor. Tools are validated against the registry at spawn.
 */

export interface PlaybookRole {
  callsign: string;
  role: string;
  bay: string;
  trigger: "cycle" | "event";
  allowedTools: string[];
  systemPrompt: string;
}

export interface Playbook {
  key: string;
  label: string;
  description: string;
  /** keywords matched against an opportunity title/thesis to auto-suggest. */
  match: string[];
  roles: PlaybookRole[];
}

const ventureLead = (mission: string): PlaybookRole => ({
  callsign: "Lead",
  role: "Venture Lead",
  bay: "Bridge",
  trigger: "cycle",
  allowedTools: ["plan", "run_analysis"],
  systemPrompt:
    `You are the Venture Lead for this floor. Mission: ${mission}. You coordinate your floor's agents via the shared ` +
    `board, drive toward the definition-of-done, and report progress up to Floor 1. You never act externally.`,
});

export const PLAYBOOKS: Playbook[] = [
  {
    key: "dropshipping",
    label: "Dropshipping Launch",
    description: "Lead + product researcher + listing builder + marketer + fulfillment.",
    match: ["dropship", "store", "ecommerce", "product", "sell", "shopify", "merch"],
    roles: [
      ventureLead("launch a dropshipping store"),
      { callsign: "Scout", role: "Product Researcher", bay: "Research Lab", trigger: "event", allowedTools: ["web_research", "run_analysis"], systemPrompt: "You research winning products and suppliers. Output ranked product picks with margins and rationale." },
      { callsign: "Builder", role: "Listing Builder", bay: "Revenue Bay", trigger: "event", allowedTools: ["draft_listing", "shopify"], systemPrompt: "You draft review-ready store listings (title, description, bullets, price, tags). You never publish." },
      { callsign: "Promoter", role: "Marketer", bay: "Comms Array", trigger: "event", allowedTools: ["draft_copy", "draft_message", "tiktok"], systemPrompt: "You draft launch marketing and outreach. Flag target platforms; nothing ships without approval." },
      { callsign: "Handler", role: "Fulfillment", bay: "Factory", trigger: "event", allowedTools: ["draft_message", "email"], systemPrompt: "You draft order handling and customer replies for approval." },
    ],
  },
  {
    key: "content_channel",
    label: "Content Channel",
    description: "Lead + researcher + scriptwriter + editor/QA + distributor.",
    match: ["content", "channel", "youtube", "tiktok", "audience", "video", "newsletter", "blog"],
    roles: [
      ventureLead("grow a content channel"),
      { callsign: "Scout", role: "Topic Researcher", bay: "Research Lab", trigger: "event", allowedTools: ["web_research"], systemPrompt: "You research high-potential content topics and angles. Output ranked topics with hooks." },
      { callsign: "Writer", role: "Scriptwriter", bay: "Media Lab", trigger: "event", allowedTools: ["draft_copy"], systemPrompt: "You draft scripts and captions in a distinctive voice. Offer variations." },
      { callsign: "Distributor", role: "Distribution", bay: "Comms Array", trigger: "event", allowedTools: ["draft_message", "youtube", "tiktok", "x"], systemPrompt: "You draft posting + scheduling plans per platform. Nothing publishes without approval." },
    ],
  },
  {
    key: "digital_product",
    label: "Digital Product",
    description: "Lead + researcher + builder + marketer.",
    match: ["digital", "ebook", "course", "template", "saas", "app", "tool", "guide"],
    roles: [
      ventureLead("create and sell a digital product"),
      { callsign: "Scout", role: "Market Researcher", bay: "Research Lab", trigger: "event", allowedTools: ["web_research", "run_analysis"], systemPrompt: "You validate demand and define the product. Output a concise product spec and pricing." },
      { callsign: "Builder", role: "Product Builder", bay: "Revenue Bay", trigger: "event", allowedTools: ["draft_listing", "draft_copy"], systemPrompt: "You draft the product outline, sales page, and listing. Review-ready, never published." },
      { callsign: "Promoter", role: "Marketer", bay: "Comms Array", trigger: "event", allowedTools: ["draft_copy", "draft_message"], systemPrompt: "You draft launch marketing for approval." },
    ],
  },
  {
    key: "service_business",
    label: "Service Business",
    description: "Lead + lead-gen + offer builder + outreach.",
    match: ["service", "agency", "freelance", "consulting", "client", "outreach", "fiverr"],
    roles: [
      ventureLead("launch a productized service"),
      { callsign: "Scout", role: "Lead-Gen Researcher", bay: "Research Lab", trigger: "event", allowedTools: ["web_research"], systemPrompt: "You identify target niches and ideal clients. Output a ranked prospect profile." },
      { callsign: "Builder", role: "Offer Builder", bay: "Revenue Bay", trigger: "event", allowedTools: ["draft_listing", "run_analysis"], systemPrompt: "You draft a productized service offer and pricing tiers. Review-ready." },
      { callsign: "Closer", role: "Outreach", bay: "Comms Array", trigger: "event", allowedTools: ["draft_message", "email"], systemPrompt: "You draft outreach sequences for approval. Nothing sends without sign-off." },
    ],
  },
];

export function matchPlaybook(text: string): Playbook | undefined {
  const lower = text.toLowerCase();
  let best: { pb: Playbook; score: number } | undefined;
  for (const pb of PLAYBOOKS) {
    const score = pb.match.reduce((n, kw) => (lower.includes(kw) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { pb, score };
  }
  return best?.pb;
}

export function getPlaybook(key: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.key === key);
}
