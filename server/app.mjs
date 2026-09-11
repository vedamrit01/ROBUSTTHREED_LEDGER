import express from "express";
import { z } from "zod";
import { entrySchema } from "../lib/ledger.ts";
import { createToken, digest, loginLimiter, verifyPassword } from "./auth.mjs";

const versionSchema = z.number().int().min(1).max(4294967294);
const deleteSchema = z.object({ id: z.string().uuid(), version: versionSchema });
const sessionMs = 12 * 60 * 60 * 1000;
export function createApp({ store, config, checkLogin = loginLimiter() }) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxyHops) app.set("trust proxy", config.trustProxyHops);
  app.use((req, res, next) => {
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Vary": "Origin" });
    const origin = req.get("origin");
    if (origin && !config.origins.includes(origin)) return res.status(403).json({ error: "This website is not allowed to access your ledger." });
    if (origin) res.set("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") {
      res.set({ "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "600" });
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: "20kb", strict: true }));
  app.get("/api/health", async (_req, res) => {
    await store.health(); res.json({ ok: true });
  });
  const authVersion = digest(config.passwordHash);
  let activeLogins = 0;
  app.post("/api/login", async (req, res) => {
    if (!checkLogin(req.ip || "unknown") || activeLogins >= 4) return res.status(429).set("Retry-After", "900").json({ error: "Too many sign-in attempts. Please try again in 15 minutes." });
    activeLogins++;
    let valid;
    try { valid = await verifyPassword(req.body?.password, config.passwordHash); } finally { activeLogins--; }
    if (!valid) return res.status(401).json({ error: "Incorrect owner password." });
    const token = createToken(), expiresAt = Date.now() + sessionMs;
    await store.createSession(digest(token), authVersion, expiresAt);
    res.json({ token, expiresAt });
  });
  app.use("/api", async (req, res, next) => {
    const token = req.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token || !await store.hasSession(digest(token), authVersion)) return res.status(401).json({ error: "Sign in to open your ledger." });
    res.locals.tokenHash = digest(token); next();
  });
  app.post("/api/logout", async (_req, res) => {
    await store.deleteSession(res.locals.tokenHash); res.json({ ok: true });
  });
  app.get("/api/entries", async (req, res) => {
    const raw = req.query.page ?? "0";
    if (typeof raw !== "string" || !/^\d{1,5}$/.test(raw) || Number(raw) > 10000) return res.status(400).json({ error: "Invalid page." });
    res.json(await store.list(Number(raw)));
  });
  for (const method of ["post", "put"]) app[method]("/api/entries", async (req, res) => {
    const parsed = entrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Check your entry." });
    const editing = method === "put";
    if (editing && !versionSchema.safeParse(req.body.version).success) return res.status(400).json({ error: "Refresh this entry before editing." });
    const entry = editing ? await store.update(parsed.data, req.body.version) : await store.create(parsed.data);
    if (!entry) return res.status(409).json({ error: "This entry was already saved, changed, or deleted. Close the form and refresh your ledger before trying again." });
    res.status(editing ? 200 : 201).json({ entry });
  });
  app.delete("/api/entries", async (req, res) => {
    const parsed = deleteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid entry." });
    if (!await store.remove(parsed.data.id, parsed.data.version)) return res.status(409).json({ error: "This entry changed or was deleted. Refresh your ledger." });
    res.json({ ok: true });
  });
  app.use((_req, res) => res.status(404).json({ error: "Not found." }));
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Entry is too large." });
    if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "Invalid JSON." });
    // Do not log raw SQL parameters, passwords, tokens, or ledger contents.
    console.error("Ledger operation failed:", /^[A-Z0-9_]+$/.test(err.code || "") ? err.code : "SERVER_ERROR");
    res.status(503).json({ error: "Your ledger is temporarily unavailable. Your input is still here. Please try again." });
  });
  return app;
}
