import type { Metadata } from "next";
import Link from "next/link";

import { sendMagicLink, signInWithGitHub, signInWithGoogle } from "@/lib/auth/actions";
import { validateServerEnv } from "@/lib/env/schema";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-email": "That doesn't look like an email address.",
  "rate-limited": "Too many attempts. Try again in a little while.",
  "send-failed": "Couldn't send the link. Check the address and try again.",
  "oauth-failed": "Sign-in with that provider failed. Try another method.",
  "auth-failed": "That link is invalid or expired. Request a fresh one.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = typeof params.error === "string" ? ERROR_MESSAGES[params.error] : undefined;
  const configured = validateServerEnv(process.env).ok;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-10 flex items-center justify-center gap-2 text-sm font-medium tracking-wide text-muted"
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-accent" />
          FORGE SITES
        </Link>

        <div className="rounded-xl border border-border bg-surface p-6">
          {!configured ? (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-strong"
            >
              This deployment isn&apos;t configured yet — sign-in is disabled
              until the environment variables are set (see{" "}
              <code className="font-mono text-xs">apps/web/.env.example</code>).
            </div>
          ) : null}
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            New here? Signing in creates your account.
          </p>

          {sent ? (
            <div
              role="status"
              className="mt-6 rounded-lg border border-border bg-accent-soft px-4 py-3 text-sm text-accent-strong"
            >
              Check your email — your sign-in link is on the way.
            </div>
          ) : (
            <>
              {error ? (
                <div
                  role="alert"
                  className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  {error}
                </div>
              ) : null}

              <form action={sendMagicLink} className="mt-6 flex flex-col gap-3">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm placeholder:text-muted/60"
                />
                <button
                  type="submit"
                  className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black transition-colors duration-200 hover:bg-accent-strong"
                >
                  Send magic link
                </button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs text-muted">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-col gap-2">
                <form action={signInWithGoogle}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-border-strong"
                  >
                    Continue with Google
                  </button>
                </form>
                <form action={signInWithGitHub}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-border-strong"
                  >
                    Continue with GitHub
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
