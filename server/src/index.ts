import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { api } from "./routes/api.js";
import { sseHandler } from "./routes/sse.js";
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

app.get("/events", sseHandler);
app.use("/api", api);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve the built client in production (npm run build then npm start).
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.listen(config.port, () => {
  logActivity("system", `MISSION CONTROL backend listening on :${config.port}.`);
  // eslint-disable-next-line no-console
  console.log(`\n🛰️  MISSION CONTROL backend → http://localhost:${config.port}\n`);
});
