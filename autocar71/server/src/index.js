/* HTTP-приёмник заявок autocar71.ru.
   Главное правило: POST /lead отвечает 200 OK до любой внешней сети.
   Tilda считает заявку доставленной по коду ответа, вся доставка в MAX — асинхронно из очереди. */
import { createServer } from 'node:http';
import { openQueue, MAX_ATTEMPTS } from './queue.js';
import { normalizeLead, idempotencyKey } from './normalize.js';
import { verifyRecaptcha } from './recaptcha.js';
import { sendToMax, notifyFallback, DeliveryError } from './max.js';
import { log, maskPhone } from './log.js';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';
const BODY_LIMIT = 64 * 1024;
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 10);          // заявок
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 600_000); // за 10 минут
const WORKER_TICK_MS = Number(process.env.WORKER_TICK_MS || 1000);
const FALLBACK_AFTER_MS = Number(process.env.FALLBACK_AFTER_MS || 600_000); // 10 минут
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

const queue = await openQueue();

/* ---------- Rate limit по IP ---------- */
const hits = new Map();
const rateLimited = ip => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT;
};
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) {
    const keep = list.filter(t => now - t < RATE_WINDOW_MS);
    if (keep.length) hits.set(ip, keep); else hits.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

/* ---------- Разбор тела ---------- */
const readBody = req => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', c => {
    size += c.length;
    if (size > BODY_LIMIT) { reject(new Error('body_too_large')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const parseBody = (raw, contentType = '') => {
  if (!raw) return {};
  if (contentType.includes('application/json')) return JSON.parse(raw);
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
};

const clientIp = req =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Cache-Control': 'no-store'
  });
  res.end(body);
};

/* ---------- Воркер доставки ---------- */
let workerBusy = false;
let firstFailureAt = null;
let fallbackSent = false;

const deliverOne = async task => {
  const attempt = task.attempts + 1;
  try {
    const { status, body } = await sendToMax(task.lead);
    queue.recordAttempt(task.lead_id, attempt, status, body, true);
    queue.markSent(task.lead_id);
    log.info('lead_delivered', { lead_id: task.lead_id, attempt, status, priority: task.lead.routing.priority });
    firstFailureAt = null;
    fallbackSent = false;
  } catch (err) {
    const status = err instanceof DeliveryError ? err.status : null;
    queue.recordAttempt(task.lead_id, attempt, status, err.message, false);
    const next = queue.markFailed(task.lead_id, task.attempts, err.message);
    log.warn('lead_delivery_failed', {
      lead_id: task.lead_id, attempt, of: MAX_ATTEMPTS, status,
      error: err.message, next_try_at: next.next_try_at, state: next.state
    });
    if (!firstFailureAt) firstFailureAt = Date.now();
    if (!fallbackSent && Date.now() - firstFailureAt > FALLBACK_AFTER_MS) {
      fallbackSent = true;
      await notifyFallback(err.message, queue.stats());
    }
  }
};

const tick = async () => {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const due = queue.claimDue(10);
    for (const task of due) await deliverOne(task);
  } catch (err) {
    log.error('worker_tick_failed', { error: String(err) });
  } finally {
    workerBusy = false;
  }
};
const workerTimer = setInterval(tick, WORKER_TICK_MS);

/* ---------- Маршруты ---------- */
const handleLead = async (req, res) => {
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';

  let body;
  try {
    body = parseBody(await readBody(req), req.headers['content-type'] || '');
  } catch (err) {
    json(res, 400, { ok: false, error: 'bad_request' });
    log.warn('lead_bad_body', { error: String(err) });
    return;
  }

  if (rateLimited(ip)) {
    json(res, 429, { ok: false, error: 'rate_limited' });
    queue.saveSpam('rate_limited', { ip_hash: true, body });
    log.warn('lead_rate_limited', {});
    return;
  }

  /* Пакет собираем без сети: reCAPTCHA проверяется уже после ответа клиенту. */
  const lead = normalizeLead(body, { ip, ua });

  if (!lead.contact.phone) {
    json(res, 200, { ok: true, accepted: false, reason: 'invalid_phone' });
    queue.saveSpam('invalid_phone', body);
    log.warn('lead_invalid_phone', {});
    return;
  }

  const key = idempotencyKey(lead.contact.phone, lead.received_at, lead.meta.source_form);
  let saved;
  try {
    saved = queue.saveLead(lead, key);
  } catch (err) {
    log.error('lead_save_failed', { error: String(err) });
    json(res, 500, { ok: false, error: 'storage' });
    return;
  }

  /* Ответ ушёл. Дальше — уже фон. */
  json(res, 200, { ok: true, id: saved.lead_id, duplicate: saved.duplicate });
  log.info('lead_accepted', {
    lead_id: saved.lead_id, duplicate: saved.duplicate, priority: lead.routing.priority,
    qualifies: lead.quiz.qualifies, phone: maskPhone(lead.contact.phone),
    utm_source: lead.utm.utm_source, utm_campaign: lead.utm.utm_campaign
  });

  if (saved.duplicate) return;

  /* Проверка капчи вне критического пути: подозрительный лид снимаем с отправки. */
  const token = body['g-recaptcha-response'] || body.recaptcha_token || body.recaptcha?.token;
  const check = await verifyRecaptcha(token, ip);
  if (!check.passed) {
    queue.markFailed(saved.lead_id, MAX_ATTEMPTS - 1, `recaptcha score=${check.score}`);
    queue.saveSpam('recaptcha', { lead_id: saved.lead_id, score: check.score });
    log.warn('lead_marked_spam', { lead_id: saved.lead_id, score: check.score });
    return;
  }
  tick();
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/lead') return handleLead(req, res);

  if (req.method === 'GET' && url.pathname === '/health') {
    const stats = queue.stats();
    const stale = stats.last_success_at
      ? Date.now() - Date.parse(stats.last_success_at) > FALLBACK_AFTER_MS && stats.queue_size > 0
      : stats.queue_size > 0;
    return json(res, stale ? 503 : 200, { ok: !stale, uptime_s: Math.round(process.uptime()), ...stats });
  }

  json(res, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, HOST, () => log.info('server_started', { host: HOST, port: PORT }));

const shutdown = signal => {
  log.info('shutdown', { signal });
  clearInterval(workerTimer);
  server.close(() => { queue.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { server, queue };
