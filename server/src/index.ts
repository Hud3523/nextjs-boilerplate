import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { api } from "./routes/api.js";
import { sseHandler } from "./routes/sse.js";
import { authEnabled, requireAuth, checkPassword, issueToken, setSessionCookie, clearSessionCookie, verifyToken, getSession } from "./auth.js";
import { seedIfEmpty } from "./seed.js";
import { startScheduler } from "./scheduler.js";
import { logActivity } from "./bus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Seed the DB (idempotent) and arm the scheduler.
seedIfEmpty();
startScheduler();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── Public routes (no auth) ───────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/auth", (req, res) =>
  res.json({ authEnabled: authEnabled(), authed: authEnabled() ? verifyToken(getSession(req)) : true }),
);
app.post("/api/login", (req, res) => {
  if (!authEnabled()) return res.json({ ok: true });
  if (checkPassword(req.body?.password)) {
    setSessionCookie(res, issueToken());
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Wrong password" });
});
app.post("/api/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ── Protected routes (operator login required when DASHBOARD_PASSWORD set) ──
app.get("/events", requireAuth, sseHandler);
app.use("/api", requireAuth, api);

// Serve the built client in production (npm run build then npm start).
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(config.port, () => {
  logActivity("system", `MISSION CONTROL backend listening on :${config.port}.`);
  // eslint-disable-next-line no-console
  console.log(`\n🛰️  MISSION CONTROL backend → http://localhost:${config.port}`);
  if (!authEnabled()) {
    // eslint-disable-next-line no-console
    console.log("⚠️  AUTH DISABLED — set DASHBOARD_PASSWORD in .env before exposing this publicly.\n");
  } else {
    // eslint-disable-next-line no-console
    console.log("🔒 Operator login required (DASHBOARD_PASSWORD set).\n");
  }
});
