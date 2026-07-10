"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { supabaseServer } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function sendMagicLink(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=invalid-email");

  const ip = await clientIp();
  const [byIp, byEmail] = await Promise.all([
    rateLimit("magic-link-ip", ip, { tokens: 10, windowSeconds: 3600 }),
    rateLimit("magic-link-email", parsed.data, { tokens: 5, windowSeconds: 3600 }),
  ]);
  if (!byIp.success || !byEmail.success) redirect("/login?error=rate-limited");

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${env.APP_URL}/auth/confirm` },
  });

  if (error) redirect("/login?error=send-failed");
  redirect("/login?sent=1");
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithProvider("google");
}

export async function signInWithGitHub(): Promise<void> {
  await signInWithProvider("github");
}

async function signInWithProvider(provider: "google" | "github"): Promise<void> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${env.APP_URL}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth-failed");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
