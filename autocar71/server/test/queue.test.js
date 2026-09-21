import test from 'node:test';
import assert from 'node:assert/strict';
import { openQueue, MAX_ATTEMPTS } from '../src/queue.js';
import { normalizeLead, idempotencyKey } from '../src/normalize.js';

const makeLead = (phone = '9539708877', qualifies = 'Да') =>
  normalizeLead({ phone, qualifies, purpose: 'Работа в такси' }, { ua: 'test' });

test('лид сохраняется на диск до первой попытки отправки и попадает в очередь', async () => {
  const q = await openQueue(':memory:');
  const lead = makeLead();
  const { duplicate } = q.saveLead(lead, idempotencyKey(lead.contact.phone, lead.received_at));
  assert.equal(duplicate, false);
  assert.equal(q.stats().queue_size, 1);
  assert.equal(q.claimDue()[0].lead_id, lead.lead_id);
  q.close();
});

test('повтор в пределах минуты не создаёт второй лид', async () => {
  const q = await openQueue(':memory:');
  const lead = makeLead();
  const key = idempotencyKey(lead.contact.phone, lead.received_at);
  q.saveLead(lead, key);
  const again = q.saveLead(makeLead(), key);
  assert.equal(again.duplicate, true);
  assert.equal(q.stats().queue_size, 1);
  q.close();
});

test('неудачная отправка переносится по экспоненте, после 8 попыток уходит в dead', async () => {
  const q = await openQueue(':memory:');
  const lead = makeLead();
  q.saveLead(lead, idempotencyKey(lead.contact.phone, lead.received_at));

  const first = q.markFailed(lead.lead_id, 0, 'MAX недоступен');
  assert.equal(first.state, 'pending');
  assert.equal(first.delay_ms, 1000);
  assert.equal(q.claimDue().length, 0, 'до наступления next_try_at задача не выдаётся');

  const second = q.markFailed(lead.lead_id, 1, 'MAX недоступен');
  assert.equal(second.delay_ms, 3000, 'пауза растёт: 1с → 3с');

  const last = q.markFailed(lead.lead_id, MAX_ATTEMPTS - 1, 'MAX недоступен');
  assert.equal(last.state, 'dead');
  assert.equal(q.stats().dead_letters, 1);
  q.close();
});

test('перезапуск процесса не теряет непустую очередь', async (t) => {
  const file = `${process.env.TMPDIR || '/tmp'}/autocar-queue-test-${Date.now()}.db`;
  const q1 = await openQueue(file);
  const lead = makeLead();
  q1.saveLead(lead, idempotencyKey(lead.contact.phone, lead.received_at));
  q1.close();

  const q2 = await openQueue(file);
  const due = q2.claimDue();
  assert.equal(due.length, 1, 'после «перезапуска» заявка на месте');
  assert.equal(due[0].lead.contact.phone, '+79539708877');
  q2.markSent(lead.lead_id);
  assert.equal(q2.stats().queue_size, 0);
  assert.ok(q2.stats().last_success_at);
  q2.close();
  t.after(async () => { const { rm } = await import('node:fs/promises'); for (const s of ['', '-wal', '-shm']) await rm(file + s, { force: true }); });
});

test('холодные лиды считаются отдельно', async () => {
  const q = await openQueue(':memory:');
  const hot = makeLead('9531112233', 'Да');
  const cold = makeLead('9534445566', 'Нет, не прохожу');
  q.saveLead(hot, idempotencyKey(hot.contact.phone, hot.received_at));
  q.saveLead(cold, idempotencyKey(cold.contact.phone, cold.received_at));
  const s = q.stats();
  assert.equal(s.leads_24h, 2);
  assert.equal(s.cold_leads_24h, 1);
  q.close();
});
