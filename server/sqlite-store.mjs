import { DatabaseSync } from 'node:sqlite';
import { entrySchema } from '../lib/ledger.ts';
const columns = 'id,kind,title,amount,channel,category,status,date,method,reference,notes,version,created_at AS createdAt,updated_at AS updatedAt';
const values = d => [d.id,d.kind,d.title,d.amount,d.channel,d.category,d.status,d.date,d.method,d.reference,d.notes];
const insert = 'INSERT INTO ledger_entries (id,kind,title,amount,channel,category,status,date,method,reference,notes,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
export function openSqlite(filename) {
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA busy_timeout=1000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > 1) throw new Error('This database needs a newer portable app.');
    db.exec(`CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('payment','expense')),
      title TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 100000000000),
      channel TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','settled')),
      date TEXT NOT NULL, method TEXT NOT NULL, reference TEXT NOT NULL, notes TEXT NOT NULL,
      version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 4294967294), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger_entries(date,created_at,id);
      CREATE TABLE IF NOT EXISTS ledger_sessions(token_hash TEXT PRIMARY KEY,auth_version TEXT NOT NULL,expires_at INTEGER NOT NULL);
      PRAGMA user_version=1;`);
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Database check failed. Restore a backup before continuing.');
  } catch (e) { db.close(); throw e; }
  const get = id => { const row = db.prepare(`SELECT ${columns} FROM ledger_entries WHERE id=?`).get(id); return row ? {...row} : null; };
  return {
    close() { db.close(); },
    backup(path) { db.prepare('VACUUM INTO ?').run(path); },
    clearSessions() { db.exec('DELETE FROM ledger_sessions'); },
    count() { return db.prepare('SELECT count(*) AS n FROM ledger_entries').get().n; },
    // Import everything in one transaction, preserving IDs, versions, timestamps and integer paise.
    importEntries(rows) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (this.count()) throw new Error('Import requires an empty portable ledger.');
        const stmt = db.prepare(insert);
        for (const r of rows) {
          const d = entrySchema.parse(r);
          if (!Number.isInteger(r.version) || r.version < 1 || r.version > 4294967294 || ![r.createdAt,r.updatedAt].every(x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)))) throw new Error('Invalid imported metadata.');
          stmt.run(...values(d),r.version,r.createdAt,r.updatedAt);
        }
        db.exec('COMMIT');
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async health() { db.prepare('SELECT 1 FROM ledger_entries LIMIT 1').get(); },
    async list(page) {
      if (!Number.isInteger(page) || page < 0 || page > 10000) throw new Error('Invalid page.');
      const rows = db.prepare(`SELECT ${columns} FROM ledger_entries ORDER BY date DESC,created_at DESC,id DESC LIMIT 1001 OFFSET ?`).all(page*1000);
      return {entries: rows.slice(0,1000).map(r=>({...r})),hasMore:rows.length>1000};
    },
    async create(d) {
      const now = new Date().toISOString();
      db.prepare(insert + ' ON CONFLICT(id) DO NOTHING').run(...values(d),1,now,now);
      const row = get(d.id);
      return row && Object.entries(d).every(([key,value])=>row[key]===value) ? row : null;
    },
    async update(d,version) {
      const result = db.prepare('UPDATE ledger_entries SET kind=?,title=?,amount=?,channel=?,category=?,status=?,date=?,method=?,reference=?,notes=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(...values(d).slice(1),new Date().toISOString(),d.id,version);
      return result.changes === 1 ? get(d.id) : null;
    },
    async remove(id,version) { return db.prepare('DELETE FROM ledger_entries WHERE id=? AND version=?').run(id,version).changes===1; },
    async createSession(tokenHash,authVersion,expiresAt) {
      db.prepare('DELETE FROM ledger_sessions WHERE expires_at<=? OR auth_version<>?').run(Date.now(),authVersion);
      db.prepare('INSERT INTO ledger_sessions VALUES (?,?,?)').run(tokenHash,authVersion,expiresAt);
    },
    async hasSession(tokenHash,authVersion) { return !!db.prepare('SELECT 1 FROM ledger_sessions WHERE token_hash=? AND auth_version=? AND expires_at>?').get(tokenHash,authVersion,Date.now()); },
    async deleteSession(tokenHash) { db.prepare('DELETE FROM ledger_sessions WHERE token_hash=?').run(tokenHash); },
  };
}
