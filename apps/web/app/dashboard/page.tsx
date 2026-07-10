import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth/actions";
import { buyCreditPack, openBillingPortal, startCheckout } from "@/lib/billing/actions";
import { quotaFor, UNLIMITED } from "@/lib/entitlements/matrix";
import { getCreditBalance, getUsage } from "@/lib/entitlements/usage";
import { canManageBilling, getWorkspaceCtx } from "@/lib/workspaces/server";

export const metadata: Metadata = { title: "Dashboard" };

const BANNERS: Record<string, { tone: "success" | "error"; text: string }> = {
  success: { tone: "success", text: "You're upgraded. Welcome aboard." },
  "credits-added": { tone: "success", text: "Credit pack added to your balance." },
  canceled: { tone: "error", text: "Checkout canceled — nothing was charged." },
};

const ERRORS: Record<string, string> = {
  "not-billing-admin": "Only workspace owners and admins can manage billing.",
  "invalid-plan": "That plan isn't available.",
  "billing-unavailable": "Billing isn't configured yet. Try again later.",
  "no-billing-account": "No billing account exists for this workspace yet.",
};

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  studio: "Studio",
  agency: "Agency",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/login");

  const params = await searchParams;
  const banner =
    typeof params.billing === "string" ? BANNERS[params.billing] : undefined;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  const [used, credits] = await Promise.all([
    getUsage(ctx.workspaceId, "ai_generations"),
    getCreditBalance(ctx.workspaceId),
  ]);
  const quota = quotaFor(ctx.tier, "ai_generations");
  const pct = quota === UNLIMITED ? 0 : Math.min(100, Math.round((used / quota) * 100));
  const inGrace =
    ctx.subscriptionStatus === "past_due" &&
    ctx.graceUntil !== null &&
    ctx.graceUntil > new Date();

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />
          <span className="text-sm font-medium tracking-wide text-muted">FORGE SITES</span>
          <span className="text-muted/50">/</span>
          <span className="text-sm font-medium">{ctx.workspaceName}</span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors duration-200 hover:border-border-strong hover:text-text"
          >
            Sign out
          </button>
        </form>
      </header>

      {banner ? (
        <div
          role="status"
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            banner.tone === "success"
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-surface text-muted"
          }`}
        >
          {banner.text}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}
      {inGrace ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Your last payment failed. Update your card before{" "}
          {ctx.graceUntil?.toLocaleDateString()} to keep your {TIER_LABELS[ctx.tier]} plan.
        </div>
      ) : null}

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* Plan */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">Plan</h2>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
              {TIER_LABELS[ctx.tier]}
            </span>
          </div>

          {canManageBilling(ctx) ? (
            <div className="mt-5 flex flex-col gap-2">
              {ctx.tier === "free" ? (
                <>
                  <UpgradeButton tier="pro" label="Upgrade to Pro — $19/mo" />
                  <UpgradeButton tier="studio" label="Upgrade to Studio — $49/mo" />
                  <UpgradeButton tier="agency" label="Upgrade to Agency — $149/mo" />
                  <p className="mt-1 text-xs text-muted">
                    Annual billing (2 months free) is available at checkout.
                  </p>
                </>
              ) : (
                <form action={openBillingPortal}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-border-strong"
                  >
                    Manage billing
                  </button>
                </form>
              )}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted">
              Ask a workspace owner to change the plan.
            </p>
          )}
        </section>

        {/* Usage */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-medium text-muted">AI generations this month</h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">{used}</span>
            <span className="text-sm text-muted">
              / {quota === UNLIMITED ? "unlimited" : quota}
            </span>
          </div>
          {quota !== UNLIMITED ? (
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">Credit balance: {credits}</span>
            {canManageBilling(ctx) ? (
              <form action={buyCreditPack}>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-border-strong hover:text-text"
                >
                  Buy credits
                </button>
              </form>
            ) : null}
          </div>
        </section>

        {/* Sites — empty state designed, populated in Phase 2+ */}
        <section className="rounded-xl border border-dashed border-border bg-surface/50 p-6 sm:col-span-2">
          <h2 className="text-sm font-medium text-muted">Sites</h2>
          <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
            <div aria-hidden className="h-10 w-10 rounded-lg bg-accent-soft" />
            <p className="text-sm font-medium">No sites yet</p>
            <p className="max-w-xs text-sm text-muted">
              The generator arrives with the next milestone. Your plan and
              usage are already live.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function UpgradeButton({ tier, label }: { tier: "pro" | "studio" | "agency"; label: string }) {
  return (
    <form action={startCheckout}>
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="interval" value="monthly" />
      <button
        type="submit"
        className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-left text-sm font-medium transition-colors duration-200 hover:border-border-strong"
      >
        {label}
      </button>
    </form>
  );
}
