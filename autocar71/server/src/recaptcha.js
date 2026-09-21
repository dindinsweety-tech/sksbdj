/* Серверная проверка reCAPTCHA v3. Secret живёт только в .env.
   Порог по умолчанию 0.3: ниже — считаем спамом и в MAX не отправляем. */
import { log } from './log.js';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export const verifyRecaptcha = async (token, remoteIp) => {
  const secret = process.env.RECAPTCHA_SECRET || '';
  const threshold = Number(process.env.RECAPTCHA_THRESHOLD || 0.3);

  /* Ключ ещё не выдан заказчиком — не блокируем заявки, но помечаем проверку как пропущенную. */
  if (!secret) return { score: null, action: null, passed: true, skipped: true };
  if (!token) return { score: 0, action: null, passed: false, reason: 'no_token' };

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set('remoteip', remoteIp);
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(4000)
    });
    const data = await res.json();
    const score = typeof data.score === 'number' ? data.score : 0;
    return {
      score,
      action: data.action || null,
      passed: Boolean(data.success) && score >= threshold,
      reason: data.success ? null : (data['error-codes'] || []).join(',')
    };
  } catch (err) {
    /* Google недоступен — заявку терять нельзя, пропускаем с пометкой. */
    log.warn('recaptcha_unavailable', { error: String(err) });
    return { score: null, action: null, passed: true, skipped: true, reason: 'verify_unavailable' };
  }
};
