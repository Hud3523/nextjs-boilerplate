import "dotenv/config";
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Minimal operator authentication — no extra dependencies.
 *
 * - Auth is OFF until you set DASHBOARD_PASSWORD (so local dev stays
 *   frictionless). Set it before exposing the app publicly.
 * - Login issues a stateless HMAC-signed session token stored in an httpOnly
 *   cookie, so it survives restarts and works for both fetch and SSE.
 * - Set COOKIE_SECURE=true when serving over HTTPS.
 */
const PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const SECRET = process.env.SESSION_SECRET || PASSWORD || crypto.randomBytes(32).toString("hex");
const COOKIE = "mc_session";
const MAXAGE_MS = 7 * 24 * 60 * 60 * 1000;

export function authEnabled(): boolean {
  return Boolean(PASSWORD);
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function issueToken(): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAXAGE_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

export function checkPassword(input: unknown): boolean {
  if (!PASSWORD) return false;
  const a = Buffer.from(String(input ?? "")), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  (header || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function getSession(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[COOKIE];
}

export function setSessionCookie(res: Response, token: string) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(MAXAGE_MS / 1000)}${secure}`);
}

export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!authEnabled()) return next();
  if (verifyToken(getSession(req))) return next();
  res.status(401).json({ error: "auth required" });
}
