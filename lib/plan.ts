// Client-side plan gating for the MVP. There is no backend user account yet,
// so "pro" status lives in localStorage and is unlocked by the Stripe success
// redirect. Good enough to ship and validate demand; swap for a real
// auth + subscription-status lookup before relying on it for revenue.

const PRO_KEY = "fba-calc:pro";
const SAVED_PRODUCTS_KEY = "fba-calc:saved-products";
export const FREE_TIER_SAVE_LIMIT = 1;

export function isPro(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PRO_KEY) === "true";
}

export function setPro(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRO_KEY, value ? "true" : "false");
}

export interface SavedProduct {
  id: string;
  name: string;
  createdAt: number;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}

export function loadSavedProducts(): SavedProduct[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(SAVED_PRODUCTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedProduct[];
  } catch {
    return [];
  }
}

export function saveSavedProducts(products: SavedProduct[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(products));
}
