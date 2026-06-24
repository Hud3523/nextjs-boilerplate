import { seedSettings } from "./db.js";
import { logActivity } from "./bus.js";

/** The dashboard seeds only its own settings — agent data lives in Hermes. */
export function seedIfEmpty() {
  seedSettings();
  logActivity("system", "Dashboard online. Dry-run by default — arm real actions when ready.");
}
