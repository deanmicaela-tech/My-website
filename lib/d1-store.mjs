// The site's own small database (Cloudflare D1, bound as DB). Two tables:
//   kv               taken mats ("mat-bookings") and sent alerts ("favorite-alerts")
//   form_submissions every contact, collaboration and booking form sent
// Tables are created automatically the first time they're needed.
// Member accounts, bookings and favorites live in Supabase, not here.

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (store TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (store, key))',
  'CREATE TABLE IF NOT EXISTS form_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, form TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
];

let ready = null;
export function ensureSchema(db) {
  if (!ready) ready = db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((err) => { ready = null; throw err; });
  return ready;
}

// A key/value store with the same calls the mat map and alerts use
export function d1Store(db, name) {
  return {
    async get(key) {
      const row = await db.prepare('SELECT value FROM kv WHERE store = ? AND key = ?').bind(name, key).first();
      return row ? row.value : null;
    },
    // onlyIfNew: only save if nobody has this key yet (how two people can't take the same mat)
    async set(key, value, { onlyIfNew = false } = {}) {
      const sql = onlyIfNew
        ? 'INSERT OR IGNORE INTO kv (store, key, value) VALUES (?, ?, ?)'
        : 'INSERT OR REPLACE INTO kv (store, key, value) VALUES (?, ?, ?)';
      const result = await db.prepare(sql).bind(name, key, value).run();
      return { modified: result.meta.changes > 0 };
    },
    async delete(key) {
      await db.prepare('DELETE FROM kv WHERE store = ? AND key = ?').bind(name, key).run();
    },
    async list() {
      const { results } = await db.prepare('SELECT key FROM kv WHERE store = ?').bind(name).all();
      return { blobs: results.map((r) => ({ key: r.key })) };
    }
  };
}

export async function saveSubmission(db, form, data) {
  await db.prepare('INSERT INTO form_submissions (form, data) VALUES (?, ?)').bind(form, JSON.stringify(data)).run();
}
