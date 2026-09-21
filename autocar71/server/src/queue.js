/* Персистентная очередь заявок на SQLite.
   Лид пишется на диск ДО первой попытки отправки, поэтому перезапуск процесса
   и падение VPS не теряют ни одной заявки.

   Драйвер: better-sqlite3, если установлен; иначе встроенный node:sqlite
   (Node 22 — с флагом --experimental-sqlite, Node 24+ — без флага). */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000, 120_000, 300_000, 900_000];
export const MAX_ATTEMPTS = 8;

const openDatabase = async file => {
  try {
    const { default: Better } = await import('better-sqlite3');
    const db = new Better(file);
    return {
      exec: sql => db.exec(sql),
      run: (sql, params = []) => db.prepare(sql).run(params),
      all: (sql, params = []) => db.prepare(sql).all(params),
      get: (sql, params = []) => db.prepare(sql).get(params),
      close: () => db.close()
    };
  } catch {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(file);
    return {
      exec: sql => db.exec(sql),
      run: (sql, params = []) => db.prepare(sql).run(...params),
      all: (sql, params = []) => db.prepare(sql).all(...params),
      get: (sql, params = []) => db.prepare(sql).get(...params),
      close: () => db.close()
    };
  }
};

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
CREATE TABLE IF NOT EXISTS leads (
  lead_id        TEXT PRIMARY KEY,
  idempotency    TEXT NOT NULL,
  received_at    TEXT NOT NULL,
  phone          TEXT,
  qualifies      INTEGER NOT NULL DEFAULT 1,
  priority       TEXT NOT NULL DEFAULT 'hot',
  status         TEXT NOT NULL DEFAULT 'new',
  payload        TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_idem ON leads(idempotency);
CREATE INDEX IF NOT EXISTS leads_received ON leads(received_at);
CREATE TABLE IF NOT EXISTS outbox (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  next_try_at  TEXT NOT NULL,
  state        TEXT NOT NULL DEFAULT 'pending',
  last_error   TEXT,
  UNIQUE(lead_id)
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(state, next_try_at);
CREATE TABLE IF NOT EXISTS attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     TEXT NOT NULL,
  attempt     INTEGER NOT NULL,
  at          TEXT NOT NULL,
  http_status INTEGER,
  body        TEXT,
  ok          INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS spam (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  reason      TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

export const openQueue = async (file = process.env.DB_FILE || './data/leads.db') => {
  if (file !== ':memory:') { try { mkdirSync(dirname(file), { recursive: true }); } catch {} }
  const db = await openDatabase(file);
  db.exec(SCHEMA);

  const nowIso = () => new Date().toISOString();

  return {
    /** Сохраняет лид и ставит его в outbox одной транзакцией. Повтор по ключу идемпотентности не создаёт второй лид. */
    saveLead(lead, idempotency) {
      const existing = db.get('SELECT lead_id FROM leads WHERE idempotency = ?', [idempotency]);
      if (existing) return { lead_id: existing.lead_id, duplicate: true };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.run(
          'INSERT INTO leads (lead_id, idempotency, received_at, phone, qualifies, priority, status, payload) VALUES (?,?,?,?,?,?,?,?)',
          [lead.lead_id, idempotency, lead.received_at, lead.contact.phone,
           lead.quiz.qualifies ? 1 : 0, lead.routing.priority, 'new', JSON.stringify(lead)]
        );
        db.run('INSERT INTO outbox (lead_id, attempts, next_try_at, state) VALUES (?,0,?,?)',
          [lead.lead_id, nowIso(), 'pending']);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { lead_id: lead.lead_id, duplicate: false };
    },

    saveSpam(reason, payload) {
      db.run('INSERT INTO spam (at, reason, payload) VALUES (?,?,?)', [nowIso(), reason, JSON.stringify(payload)]);
    },

    /** Задачи, которым пора: state=pending и next_try_at <= сейчас. */
    claimDue(limit = 10) {
      const rows = db.all(
        `SELECT o.id, o.lead_id, o.attempts, l.payload
           FROM outbox o JOIN leads l ON l.lead_id = o.lead_id
          WHERE o.state = 'pending' AND o.next_try_at <= ?
          ORDER BY o.id LIMIT ?`, [nowIso(), limit]);
      return rows.map(r => ({ ...r, lead: JSON.parse(r.payload) }));
    },

    recordAttempt(leadId, attempt, httpStatus, body, ok) {
      db.run('INSERT INTO attempts (lead_id, attempt, at, http_status, body, ok) VALUES (?,?,?,?,?,?)',
        [leadId, attempt, nowIso(), httpStatus ?? null, body ? String(body).slice(0, 2000) : null, ok ? 1 : 0]);
    },

    markSent(leadId) {
      db.run("UPDATE outbox SET state='sent', last_error=NULL WHERE lead_id = ?", [leadId]);
      db.run("UPDATE leads SET status='sent' WHERE lead_id = ?", [leadId]);
      db.run("INSERT INTO meta (key,value) VALUES ('last_success',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [nowIso()]);
    },

    /** Помечает попытку неудачной и переносит следующую по экспоненте. После MAX_ATTEMPTS — state=dead. */
    markFailed(leadId, attempts, error) {
      const next = attempts + 1;
      if (next >= MAX_ATTEMPTS) {
        db.run("UPDATE outbox SET attempts=?, state='dead', last_error=? WHERE lead_id=?", [next, String(error).slice(0, 500), leadId]);
        db.run("UPDATE leads SET status='dead' WHERE lead_id=?", [leadId]);
        return { state: 'dead', attempts: next, next_try_at: null };
      }
      const delay = RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)];
      const at = new Date(Date.now() + delay).toISOString();
      db.run("UPDATE outbox SET attempts=?, next_try_at=?, last_error=? WHERE lead_id=?", [next, at, String(error).slice(0, 500), leadId]);
      return { state: 'pending', attempts: next, next_try_at: at, delay_ms: delay };
    },

    stats() {
      const pending = db.get("SELECT COUNT(*) AS n FROM outbox WHERE state='pending'").n;
      const dead = db.get("SELECT COUNT(*) AS n FROM outbox WHERE state='dead'").n;
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const last24h = db.get('SELECT COUNT(*) AS n FROM leads WHERE received_at >= ?', [since]).n;
      const cold = db.get('SELECT COUNT(*) AS n FROM leads WHERE qualifies = 0 AND received_at >= ?', [since]).n;
      const lastSuccess = db.get("SELECT value FROM meta WHERE key='last_success'");
      const oldest = db.get("SELECT MIN(next_try_at) AS t FROM outbox WHERE state='pending'");
      return {
        queue_size: pending,
        dead_letters: dead,
        leads_24h: last24h,
        cold_leads_24h: cold,
        last_success_at: lastSuccess ? lastSuccess.value : null,
        oldest_pending_at: oldest ? oldest.t : null
      };
    },

    close() { db.close(); }
  };
};

export { RETRY_DELAYS_MS };
