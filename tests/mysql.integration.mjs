import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPool, mysqlStore } from "../server/store.mjs";
import { createToken, digest } from "../server/auth.mjs";
import { todayIST } from "../lib/ledger.ts";

test("MySQL persistence, concurrent writes, sessions, and pagination", { skip: process.env.RUN_MYSQL_TESTS !== "1" }, async () => {
  // CI provisions a dedicated test database; never run this test on live ledger data.
  assert.match(process.env.DB_NAME || "", /_test$/);
  let pool = createPool(); let store = mysqlStore(pool);
  const id = randomUUID(), ids = [id], tokenHash = digest(createToken()), authVersion = digest("integration-fixture");
  const d = { id, kind: "payment", title: "Fixture: quote ' and ₹", amount: 100025, channel: "Amazon", category: "Settlement", status: "settled", date: todayIST(), method: "Bank transfer", reference: "fixture", notes: "Integration data" };
  try {
    await store.health();
    const first = await store.create(d); assert.equal(first.amount, d.amount); assert.equal(first.date, d.date);
    assert.equal((await store.create(d)).id, id);
    assert.equal(await store.create({ ...d, amount: 1 }), null);
    // A new pool/connection must read the saved data after the old pool closes.
    await pool.end(); pool = createPool(); store = mysqlStore(pool);
    assert.equal((await store.list(0)).entries.find(x => x.id === id).amount, d.amount);
    const concurrent = await Promise.all([store.update({ ...d, amount: 50050 }, 1), store.update({ ...d, amount: 99999 }, 1)]);
    assert.equal(concurrent.filter(Boolean).length, 1);
    assert.equal(await store.remove(id, 1), false);
    assert.equal(await store.remove(id, 2), true);
    await store.createSession(tokenHash, authVersion, Date.now() + 10000);
    assert.equal(await store.hasSession(tokenHash, authVersion), true);
    assert.equal(await store.hasSession(tokenHash, digest("changed-password")), false);
    await store.deleteSession(tokenHash); assert.equal(await store.hasSession(tokenHash, authVersion), false);
    // Every row across the 1,000-row API boundary must be returned exactly once.
    for (let i = 0; i < 1001; i++) {
      const nextId = randomUUID(); ids.push(nextId);
      await store.create({ ...d, id: nextId, title: `Pagination fixture ${i}` });
    }
    const seen = []; let page = 0, hasMore = true;
    while (hasMore) { const result = await store.list(page++); seen.push(...result.entries); hasMore = result.hasMore; }
    assert.equal(new Set(seen.map(x => x.id)).size, seen.length);
    assert.equal(seen.filter(x => ids.includes(x.id)).length, 1001);
  } finally {
    for (const entryId of ids) await pool.execute("DELETE FROM ledger_entries WHERE id=?", [entryId]);
    await pool.execute("DELETE FROM ledger_sessions WHERE token_hash=?", [tokenHash]);
    await pool.end();
  }
});
