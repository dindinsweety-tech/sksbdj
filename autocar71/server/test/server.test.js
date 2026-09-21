/* Интеграционная проверка критериев приёмки №1 и №2:
   POST /lead отвечает 200 OK быстрее 200 мс при недоступном MAX,
   лид не теряется и остаётся в очереди до восстановления связи. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8391;
const BASE = `http://127.0.0.1:${PORT}`;

const waitForHealth = async (deadlineMs = 8000) => {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try { const r = await fetch(`${BASE}/health`); if (r.status < 600) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('сервер не поднялся');
};

test('приём заявки при недоступном MAX', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'autocar-srv-'));
  const child = spawn(process.execPath, ['--experimental-sqlite', 'src/index.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      PORT: String(PORT), HOST: '127.0.0.1',
      DB_FILE: join(dir, 'leads.db'), LOG_LEVEL: 'error', LOG_FILE: '',
      /* MAX «лежит»: адрес, который заведомо не отвечает */
      MAX_API_URL: 'http://127.0.0.1:9/lead', MAX_API_TOKEN: 'test-token', MAX_CHAT_ID: 'chat',
      MAX_TIMEOUT_MS: '400', WORKER_TICK_MS: '250', FALLBACK_AFTER_MS: '600000'
    },
    stdio: 'ignore'
  });
  t.after(async () => { child.kill('SIGTERM'); await new Promise(r => setTimeout(r, 300)); await rm(dir, { recursive: true, force: true }); });
  await waitForHealth();

  const started = Date.now();
  const res = await fetch(`${BASE}/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      phone: '8 953 970-88-77', purpose: 'Работа в такси',
      class: 'Эконом из наличия от 1800 ₽/сутки', fuel_gearbox: 'Только газ (ГБО)',
      qualifies: 'Да, РФ, от 23 лет, стаж от 3-х лет', channel: 'MAX', consent: 'on',
      utm_source: 'yandex', utm_term: 'arenda'
    })
  });
  const elapsed = Date.now() - started;
  const body = await res.json();

  assert.equal(res.status, 200, 'Tilda должна получить 200 OK');
  assert.equal(body.ok, true);
  assert.ok(body.id, 'в ответе есть lead_id');
  assert.ok(elapsed < 200, `ответ за ${elapsed} мс, требование ТЗ — меньше 200 мс`);

  /* Ждём несколько неудачных попыток доставки. */
  await new Promise(r => setTimeout(r, 1500));
  const health = await (await fetch(`${BASE}/health`)).json();
  assert.equal(health.queue_size, 1, 'заявка осталась в очереди, а не пропала');
  assert.equal(health.leads_24h, 1);
  assert.equal(health.last_success_at, null, 'успешных отправок в MAX не было');
});

test('пустой и мусорный телефон в MAX не уходит', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'autocar-srv2-'));
  const port = PORT + 1;
  const child = spawn(process.execPath, ['--experimental-sqlite', 'src/index.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_FILE: join(dir, 'leads.db'), LOG_LEVEL: 'error', LOG_FILE: '', WORKER_TICK_MS: '250' },
    stdio: 'ignore'
  });
  t.after(async () => { child.kill('SIGTERM'); await new Promise(r => setTimeout(r, 300)); await rm(dir, { recursive: true, force: true }); });

  const until = Date.now() + 8000;
  while (Date.now() < until) { try { await fetch(`http://127.0.0.1:${port}/health`); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

  const res = await fetch(`http://127.0.0.1:${port}/lead`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact: { phone: '123' }, quiz: {} })
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.accepted, false);
  assert.equal(body.reason, 'invalid_phone');

  const health = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
  assert.equal(health.leads_24h, 0, 'мусорная заявка в поток лидов не попала');
});
