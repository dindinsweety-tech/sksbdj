/* Сборка единого JSON-пакета заявки из того, что прислала форма Tilda
   (application/x-www-form-urlencoded) или наш квиз (application/json). */
import { createHash } from 'node:crypto';

const QUIZ_FIELDS = {
  purpose: ['purpose', 'quiz_purpose', 'Цель', 'cel'],
  class: ['class', 'car_class', 'quiz_class', 'Класс'],
  fuel_gearbox: ['fuel_gearbox', 'fuel', 'gearbox', 'Топливо'],
  qualifies: ['qualifies', 'requirements', 'Требования']
};
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'yclid', 'gclid'];

const pick = (src, names) => {
  for (const n of names) {
    if (src[n] !== undefined && src[n] !== null && String(src[n]).trim() !== '') return String(src[n]).trim();
  }
  return null;
};

/** Телефон приводим к +7XXXXXXXXXX. Возвращаем null, если номер не похож на российский мобильный. */
export const normalizePhone = raw => {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length !== 11 || !digits.startsWith('7')) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null; // 7777777777 и подобное
  return `+${digits}`;
};

export const hashIp = (ip, salt = process.env.IP_SALT || 'autocar71') =>
  ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32) : null;

/** Ключ идемпотентности: телефон + минута + шаг квиза. Повтор в пределах минуты не создаёт второй лид. */
export const idempotencyKey = (phone, receivedAt, step = 'quiz') => {
  const minute = new Date(receivedAt).toISOString().slice(0, 16);
  return createHash('sha1').update(`${phone || 'anon'}|${minute}|${step}`).digest('hex');
};

export const makeLeadId = (receivedAt = new Date()) =>
  `${receivedAt.toISOString().replace(/[:.]/g, '-')}-${createHash('sha1')
    .update(String(Math.random())).digest('hex').slice(0, 6)}`;

const truthy = v => v !== null && /^(да|yes|true|1|да,)/i.test(String(v).trim());

/**
 * @param {object} body  распарсенное тело запроса
 * @param {object} meta  { ip, ua, recaptcha: {score, action, passed} }
 */
export const normalizeLead = (body = {}, meta = {}) => {
  const now = new Date();
  const receivedAt = now.toISOString();

  /* Квиз шлёт уже собранный пакет — берём его как основу, но пересобираем служебные поля. */
  const nested = body.quiz && typeof body.quiz === 'object' ? body : null;
  const flat = nested ? { ...body.quiz, ...body.utm, ...body.contact } : body;

  const phone = normalizePhone(nested ? body.contact?.phone : pick(flat, ['phone', 'Phone', 'tel', 'Телефон']));
  const qualifiesRaw = nested ? body.quiz.qualifies : pick(flat, QUIZ_FIELDS.qualifies);
  const qualifies = typeof qualifiesRaw === 'boolean' ? qualifiesRaw : truthy(qualifiesRaw);

  const utm = {};
  UTM_FIELDS.forEach(k => { utm[k] = (nested ? body.utm?.[k] : flat[k]) || null; });

  const lead = {
    lead_id: makeLeadId(now),
    received_at: receivedAt,
    contact: {
      phone,
      name: (nested ? body.contact?.name : pick(flat, ['name', 'Name', 'Имя'])) || null,
      preferred_channel: (nested ? body.contact?.preferred_channel : pick(flat, ['channel', 'preferred_channel', 'Канал'])) || null
    },
    quiz: {
      purpose: nested ? body.quiz.purpose || null : pick(flat, QUIZ_FIELDS.purpose),
      class: nested ? body.quiz.class || null : pick(flat, QUIZ_FIELDS.class),
      fuel_gearbox: nested ? body.quiz.fuel_gearbox || null : pick(flat, QUIZ_FIELDS.fuel_gearbox),
      qualifies,
      reject_reason: qualifies ? null : 'Не проходит по возрасту / стажу / гражданству'
    },
    utm: {
      ...utm,
      referrer: (nested ? body.utm?.referrer : flat.referrer) || null,
      landing_url: (nested ? body.utm?.landing_url : flat.landing_url) || null
    },
    recaptcha: meta.recaptcha || { score: null, action: null, passed: null },
    consent: {
      accepted: nested ? Boolean(body.consent?.accepted) : truthy(pick(flat, ['consent', 'agree', 'Согласие'])) || flat.consent === 'on',
      policy_version: (nested ? body.consent?.policy_version : flat.policy_version) || process.env.POLICY_VERSION || '2026-09-17'
    },
    routing: {
      target: 'max_corporate',
      priority: qualifies ? 'hot' : 'cold'
    },
    meta: {
      ua: meta.ua || null,
      ip_hash: hashIp(meta.ip),
      device: /mobile|android|iphone/i.test(meta.ua || '') ? 'mobile' : 'desktop',
      source_form: (nested ? 'quiz' : pick(flat, ['formname', 'form', 'formid'])) || 'tilda'
    }
  };

  return lead;
};

/** Текст карточки лида для корпоративного MAX. */
export const renderLeadMessage = lead => {
  const hot = lead.quiz.qualifies;
  const lines = [
    hot ? '🟢 ГОРЯЧИЙ ЛИД — autocar71.ru' : '🟡 ЛИД С ОТКАЗОМ ПО КРИТЕРИЮ — autocar71.ru',
    '',
    `Телефон: ${lead.contact.phone || '—'}`,
    `Канал связи: ${lead.contact.preferred_channel || '—'}`,
    '',
    `Цель: ${lead.quiz.purpose || '—'}`,
    `Класс: ${lead.quiz.class || '—'}`,
    `Топливо / КПП: ${lead.quiz.fuel_gearbox || '—'}`,
    `Требования: ${hot ? 'подходит (РФ, 23+, стаж 3+)' : `НЕ подходит — ${lead.quiz.reject_reason}`}`,
    '',
    `Источник: ${lead.utm.utm_source || 'прямой заход'} / ${lead.utm.utm_medium || '—'} / ${lead.utm.utm_campaign || '—'}`,
    `Ключ: ${lead.utm.utm_term || '—'}   yclid: ${lead.utm.yclid || '—'}`,
    `Страница: ${lead.utm.landing_url || '—'}`,
    '',
    `Заявка: ${lead.lead_id}`,
    `Время: ${new Date(lead.received_at).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК`
  ];
  return lines.join('\n');
};
