import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { createToken, digest, hashPassword, loginLimiter, verifyPassword } from "../server/auth.mjs";
import { databaseName, serverConfig } from "../server/config.mjs";
import { todayIST } from "../lib/ledger.ts";

const password = "fixture-only-owner-password";
const passwordHash = await hashPassword(password);
const entry = extra => ({ id: randomUUID(), kind: "payment", title: "Amazon settlement", amount: 100025, channel: "Amazon", category: "Settlement", status: "settled", date: todayIST(), method: "Bank transfer", reference: "", notes: "", ...extra });
function memoryStore() {
  const entries = new Map(), sessions = new Map();
  return {
    entries, sessions, fail: false,
    async health() { if (this.fail) throw new Error("simulated database outage"); },
    async list(page) { await this.health(); const all = [...entries.values()]; return { entries: all.slice(page * 1000, (page + 1) * 1000), hasMore: all.length > (page + 1) * 1000 }; },
    async create(d) { const old = entries.get(d.id); if (old) return Object.entries(d).every(([k,v]) => old[k] === v) ? old : null; const saved = { ...d, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; entries.set(d.id, saved); return saved; },
    async update(d, version) { const old = entries.get(d.id); if (!old || old.version !== version) return null; const saved = { ...old, ...d, version: version + 1 }; entries.set(d.id, saved); return saved; },
    async remove(id, version) { return entries.get(id)?.version === version && entries.delete(id); },
    async createSession(hash, version, expiresAt) { sessions.set(hash, { version, expiresAt }); },
    async hasSession(hash, version) { const s = sessions.get(hash); return Boolean(s && s.version === version && s.expiresAt > Date.now()); },
    async deleteSession(hash) { sessions.delete(hash); },
  };
}
async function fixture(t, extra = {}) {
  const store = memoryStore();
  const server = createApp({ store, config: { passwordHash, origins: ["https://vedamrit01.github.io"], trustProxyHops: 0 }, ...extra }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let token = "";
  const request = async (path, method = "GET", body, headers = {}) => fetch(origin + path, { method, headers: { "Content-Type": "application/json", Origin: "https://vedamrit01.github.io", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) });
  const login = async () => { const r = await request("/api/login", "POST", { password }); assert.equal(r.status, 200); token = (await r.json()).token; return token; };
  return { store, request, login, setToken(value) { token = value; } };
}
test("Password hashes verify, tokens are random, and database names are constrained", async () => {
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("wrong", passwordHash), false);
  assert.equal(await verifyPassword(null, passwordHash), false);
  assert.notEqual(createToken(), createToken());
  assert.equal(databaseName({}), "robustthreed_ledger");
  assert.throws(() => databaseName({ DB_NAME: "ledger`;DROP DATABASE x" }));
  assert.throws(() => serverConfig({ LEDGER_PASSWORD_HASH: passwordHash, NODE_ENV: "production", ALLOWED_ORIGINS: "http://localhost:5173" }));
  assert.throws(() => serverConfig({ LEDGER_PASSWORD_HASH: passwordHash, ALLOWED_ORIGINS: "https://vedamrit01.github.io/ROBUSTTHREED_LEDGER/" }));
});
test("Every ledger operation requires a valid session, and logout revokes it", async t => {
  const f = await fixture(t);
  for (const method of ["GET", "POST", "PUT", "DELETE"]) assert.equal((await f.request("/api/entries", method, method === "GET" ? undefined : entry())).status, 401);
  assert.equal((await f.request("/api/login", "POST", { password: "wrong" })).status, 401);
  const token = await f.login();
  assert.equal(f.store.sessions.has(token), false);
  assert.equal(f.store.sessions.has(digest(token)), true);
  assert.equal((await f.request("/api/entries")).status, 200);
  assert.equal((await f.request("/api/logout", "POST", {})).status, 200);
  assert.equal((await f.request("/api/entries")).status, 401);
  await f.login();
  for (const value of f.store.sessions.values()) value.expiresAt = 0;
  assert.equal((await f.request("/api/entries")).status, 401);
});
test("HTTP create, retry, exact paise, stale edits and deletes", async t => {
  const f = await fixture(t); await f.login(); const d = entry();
  assert.equal((await f.request("/api/entries", "POST", d)).status, 201);
  assert.equal((await f.request("/api/entries", "POST", d)).status, 201);
  assert.equal((await f.request("/api/entries", "POST", { ...d, amount: 2 })).status, 409);
  let r = await f.request("/api/entries"); let body = await r.json();
  assert.equal(body.entries.length, 1); assert.equal(body.entries[0].amount, 100025);
  r = await f.request("/api/entries", "PUT", { ...d, amount: 32109, version: 1 });
  assert.equal(r.status, 200); assert.equal((await r.json()).entry.version, 2);
  assert.equal((await f.request("/api/entries", "PUT", { ...d, version: 1 })).status, 409);
  assert.equal((await f.request("/api/entries", "DELETE", { id: d.id, version: 1 })).status, 409);
  assert.equal((await f.request("/api/entries", "DELETE", { id: d.id, version: 2 })).status, 200);
  assert.equal((await (await f.request("/api/entries")).json()).entries.length, 0);
});
test("Origin checks, body limits, server validation and recoverable errors", async t => {
  const f = await fixture(t); await f.login();
  let r = await f.request("/api/entries", "OPTIONS"); assert.equal(r.status, 204); assert.equal(r.headers.get("access-control-allow-origin"), "https://vedamrit01.github.io");
  assert.equal((await f.request("/api/entries", "GET", undefined, { Origin: "https://other.example" })).status, 403);
  assert.equal((await f.request("/api/entries", "POST", entry({ amount: -1 }))).status, 400);
  assert.equal((await f.request("/api/entries", "POST", entry({ notes: "a".repeat(21000) }))).status, 413);
  assert.equal((await f.request("/api/entries", "POST", "{broken")).status, 400);
  assert.equal((await f.request("/api/entries?page=-1")).status, 400);
  assert.equal((await f.request("/api/entries?page=1%20OR%201=1")).status, 400);
  f.store.fail = true; r = await f.request("/api/entries");
  assert.equal(r.status, 503); assert.match((await r.json()).error, /temporarily unavailable/);
});
test("Login requests are rate limited", async t => {
  const f = await fixture(t, { checkLogin: loginLimiter({ limit: 2 }) });
  for (let i = 0; i < 2; i++) assert.equal((await f.request("/api/login", "POST", { password: "bad" })).status, 401);
  const r = await f.request("/api/login", "POST", { password });
  assert.equal(r.status, 429); assert.equal(r.headers.get("retry-after"), "900");
});
