import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

const limiters = new Map<string, Ratelimit>();
let warned = false;

/**
 * Sliding-window rate limit, keyed per user AND per IP by callers.
 * Production requires Upstash (enforced by env validation); development
 * without it fails open with one loud warning.
 */
export async function rateLimit(
  name: string,
  key: string,
  opts: { tokens: number; windowSeconds: number },
): Promise<{ success: boolean; remaining: number }> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) {
      console.warn("[ratelimit] Upstash not configured — failing open (dev only).");
      warned = true;
    }
    return { success: true, remaining: opts.tokens };
  }

  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(opts.tokens, `${opts.windowSeconds} s`),
      prefix: `rl:${name}`,
    });
    limiters.set(name, limiter);
  }

  const result = await limiter.limit(key);
  return { success: result.success, remaining: result.remaining };
}
