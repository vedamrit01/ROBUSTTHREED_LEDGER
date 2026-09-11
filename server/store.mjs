import mysql from "mysql2/promise";
import { databaseOptions } from "./config.mjs";

const columns = "id,kind,title,amount,channel,category,status,date,method,reference,notes,version,created_at AS createdAt,updated_at AS updatedAt";
const values = d => [d.kind,d.title,d.amount,d.channel,d.category,d.status,d.date,d.method,d.reference,d.notes];
function entry(row) {
  if (!row) return null;
  const amount = Number(row.amount);
  if (!Number.isSafeInteger(amount)) throw new Error("Unsafe stored amount.");
  return { ...row, amount, version: Number(row.version) };
}
export function createPool(env = process.env) {
  return mysql.createPool({ ...databaseOptions(env), waitForConnections: true, connectionLimit: 5, queueLimit: 50, enableKeepAlive: true });
}
export function mysqlStore(pool) {
  async function get(id) {
    const [rows] = await pool.execute(`SELECT ${columns} FROM ledger_entries WHERE id=?`, [id]);
    return entry(rows[0]);
  }
  return {
    async health() { await pool.execute("SELECT 1 FROM ledger_entries LIMIT 1"); },
    async list(page) {
      if (!Number.isInteger(page) || page < 0 || page > 10000) throw new Error("Invalid page.");
      // Integer-only SQL literal avoids MySQL's prepared LIMIT double-parameter ambiguity.
      const [rows] = await pool.execute(`SELECT ${columns} FROM ledger_entries ORDER BY date DESC,created_at DESC,id DESC LIMIT 1001 OFFSET ${page * 1000}`);
      return { entries: rows.slice(0, 1000).map(entry), hasMore: rows.length > 1000 };
    },
    async create(d) {
      const now = new Date().toISOString();
      try {
        await pool.execute("INSERT INTO ledger_entries (id,kind,title,amount,channel,category,status,date,method,reference,notes,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)", [d.id,...values(d),now,now]);
      } catch (e) { if (e.code !== "ER_DUP_ENTRY") throw e; }
      const saved = await get(d.id);
      return saved && Object.entries(d).every(([key, value]) => saved[key] === value) ? saved : null;
    },
    async update(d, version) {
      // The version comparison prevents one browser from overwriting another's edits.
      const [result] = await pool.execute("UPDATE ledger_entries SET kind=?,title=?,amount=?,channel=?,category=?,status=?,date=?,method=?,reference=?,notes=?,version=version+1,updated_at=? WHERE id=? AND version=?", [...values(d),new Date().toISOString(),d.id,version]);
      return result.affectedRows === 1 ? get(d.id) : null;
    },
    async remove(id, version) {
      const [result] = await pool.execute("DELETE FROM ledger_entries WHERE id=? AND version=?", [id,version]);
      return result.affectedRows === 1;
    },
    async createSession(tokenHash, authVersion, expiresAt) {
      await pool.execute("DELETE FROM ledger_sessions WHERE expires_at<=? OR auth_version<>?", [Date.now(),authVersion]);
      await pool.execute("INSERT INTO ledger_sessions (token_hash,auth_version,expires_at) VALUES (?,?,?)", [tokenHash,authVersion,expiresAt]);
    },
    async hasSession(tokenHash, authVersion) {
      const [rows] = await pool.execute("SELECT token_hash FROM ledger_sessions WHERE token_hash=? AND auth_version=? AND expires_at>?", [tokenHash,authVersion,Date.now()]);
      return rows.length === 1;
    },
    async deleteSession(tokenHash) { await pool.execute("DELETE FROM ledger_sessions WHERE token_hash=?", [tokenHash]); },
  };
}
