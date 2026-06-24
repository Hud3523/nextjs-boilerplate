import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { api } from "./routes/api.js";
import { sseHandler } from "./routes/sse.js";
import { seedIfEmpty } from "./seed.js";
import { hermes } from "./hermes/index.js";
import { logActivity } from "./bus.js";
import { authEnabled, requireAuth, checkPassword, issueToken, setSessionCookie, clearSessionCookie, verifyToken, getSession } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Public
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/auth", (req, res) => res.json({ authEnabled: authEnabled(), authed: authEnabled() ? verifyToken(getSession(req)) : true }));
app.post("/api/login", (req, res) => {
  if (!authEnabled()) return res.json({ ok: true });
  if (checkPassword(req.body?.password)) { setSessionCookie(res, issueToken()); return res.json({ ok: true }); }
  res.status(401).json({ error: "Wrong password" });
});
app.post("/api/logout", (_req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

// Protected
app.get("/events", requireAuth, sseHandler);
app.use("/api", requireAuth, api);

// Serve the built client in production
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(config.port, async () => {
  const h = await hermes().health();
  logActivity("system", `Dashboard backend on :${config.port}. Hermes(${hermes().mode}): ${h.ok ? "reachable" : "not reachable"}.`);
  // eslint-disable-next-line no-console
  console.log(`\n🛰️  MISSION CONTROL (Hermes dashboard) → http://localhost:${config.port}`);
  console.log(`    Hermes adapter: ${hermes().mode} — ${h.detail}`);
  if (!authEnabled()) console.log("⚠️  AUTH DISABLED — set DASHBOARD_PASSWORD before exposing publicly.");
  console.log();
});
