import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLead, normalizePhone, idempotencyKey, renderLeadMessage } from '../src/normalize.js';

test('телефон приводится к +7XXXXXXXXXX из любого формата', () => {
  assert.equal(normalizePhone('8 (953) 970-88-77'), '+79539708877');
  assert.equal(normalizePhone('+7 953 970 88 77'), '+79539708877');
  assert.equal(normalizePhone('9539708877'), '+79539708877');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('+7 777 777-77-77'), null, 'мусорный номер из одной цифры не проходит');
});

test('пакет из формы Tilda (form-urlencoded) собирается полностью', () => {
  const lead = normalizeLead({
    phone: '8 953 970-88-77',
    purpose: 'Работа в такси',
    class: 'Эконом из наличия от 1800 ₽/сутки',
    fuel_gearbox: 'Только газ (ГБО)',
    qualifies: 'Да, РФ, от 23 лет, стаж от 3-х лет',
    channel: 'MAX',
    consent: 'on',
    utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: 'arenda_tula',
    utm_term: 'arenda', yclid: '99887766',
    landing_url: 'https://autocar71.ru/?utm_source=yandex&utm_term=arenda'
  }, { ip: '1.2.3.4', ua: 'Mozilla/5.0 (iPhone)' });

  assert.equal(lead.contact.phone, '+79539708877');
  assert.equal(lead.contact.preferred_channel, 'MAX');
  assert.equal(lead.quiz.purpose, 'Работа в такси');
  assert.equal(lead.quiz.fuel_gearbox, 'Только газ (ГБО)');
  assert.equal(lead.quiz.qualifies, true);
  assert.equal(lead.routing.priority, 'hot');
  assert.equal(lead.utm.utm_source, 'yandex');
  assert.equal(lead.utm.utm_term, 'arenda');
  assert.equal(lead.utm.yclid, '99887766');
  assert.equal(lead.consent.accepted, true);
  assert.equal(lead.meta.device, 'mobile');
  assert.match(lead.meta.ip_hash, /^[0-9a-f]{32}$/, 'IP хранится только хэшем');
  assert.ok(!JSON.stringify(lead).includes('1.2.3.4'), 'сырой IP в пакет не попадает');
});

test('ответ «Нет» на шаге 4 помечает лид как холодный и не смешивает с горячим потоком', () => {
  const lead = normalizeLead({ phone: '9539708877', qualifies: 'Нет, по какому-то пункту не прохожу' }, {});
  assert.equal(lead.quiz.qualifies, false);
  assert.equal(lead.routing.priority, 'cold');
  assert.ok(lead.quiz.reject_reason);
  assert.match(renderLeadMessage(lead), /ОТКАЗОМ ПО КРИТЕРИЮ/);
});

test('пакет из квиза (JSON) принимается как есть', () => {
  const lead = normalizeLead({
    contact: { phone: '+79539708877', preferred_channel: 'Telegram' },
    quiz: { purpose: 'Личные поездки', class: 'Комфорт из наличия', fuel_gearbox: 'АКПП', qualifies: true },
    utm: { utm_source: 'direct', landing_url: 'https://autocar71.ru/' },
    consent: { accepted: true, policy_version: '2026-09-17' }
  }, { ua: 'Mozilla/5.0' });
  assert.equal(lead.contact.preferred_channel, 'Telegram');
  assert.equal(lead.quiz.class, 'Комфорт из наличия');
  assert.equal(lead.routing.priority, 'hot');
});

test('ключ идемпотентности одинаков в пределах минуты и различается между минутами', () => {
  const a = idempotencyKey('+79539708877', '2026-09-17T12:04:31.000Z', 'quiz');
  const b = idempotencyKey('+79539708877', '2026-09-17T12:04:59.000Z', 'quiz');
  const c = idempotencyKey('+79539708877', '2026-09-17T12:05:01.000Z', 'quiz');
  assert.equal(a, b);
  assert.notEqual(a, c);
});
