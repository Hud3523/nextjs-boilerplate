/**
 * Forge's structured output contract: a product listing as validated JSON.
 * Guardrail #8 — invalid output is never acted on.
 */
export interface Listing {
  title: string;
  description: string;
  tags: string[];
}

export interface Validation {
  valid: boolean;
  value?: Listing;
  errors: string[];
}

export function validateListing(raw: unknown): Validation {
  const errors: string[] = [];
  let obj: unknown = raw;
  if (typeof raw === "string") {
    // tolerate ```json fences and surrounding prose
    const match = raw.match(/\{[\s\S]*\}/);
    try {
      obj = JSON.parse(match ? match[0] : raw);
    } catch {
      return { valid: false, errors: ["Output is not valid JSON."] };
    }
  }
  if (typeof obj !== "object" || obj === null) return { valid: false, errors: ["Output is not an object."] };
  const o = obj as Record<string, unknown>;
  if (typeof o.title !== "string" || o.title.trim().length < 3) errors.push("`title` must be a string ≥ 3 chars.");
  if (typeof o.description !== "string" || o.description.trim().length < 20) errors.push("`description` must be a string ≥ 20 chars.");
  if (!Array.isArray(o.tags) || o.tags.some((t) => typeof t !== "string")) errors.push("`tags` must be a string array.");
  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    value: { title: (o.title as string).trim(), description: (o.description as string).trim(), tags: (o.tags as string[]).map((t) => t.trim()) },
    errors: [],
  };
}

/** JSON schema handed to Claude (live mode) via output_config.format. */
export const LISTING_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description", "tags"],
  additionalProperties: false,
} as const;

/** A deterministic, valid dry-run listing derived from the product brief. */
export function simulateListing(productBrief: string): Listing {
  const name = productBrief.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join(" ") || "Product";
  return {
    title: `${titleCase(name)} — Premium Edition`,
    description:
      `[Dry-run draft] ${titleCase(name)} is built for everyday use with a focus on quality and value. ` +
      `This is a simulated, schema-valid listing so you can see Forge's end-to-end loop without spending. ` +
      `Arm live mode to generate a real, ready-to-edit listing from: "${productBrief.slice(0, 120)}".`,
    tags: ["new", titleCase(name).toLowerCase().split(" ")[0] || "product", "premium", "bestseller", "gift"],
  };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
