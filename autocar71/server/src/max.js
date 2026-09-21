/* Клиент корпоративного мессенджера MAX + резервный канал уведомлений.
   Без MAX_API_TOKEN работает мок-транспорт: пакет пишется в лог, доставка считается успешной,
   чтобы всю остальную цепочку можно было тестировать до получения токена от заказчика. */
import { log } from './log.js';
import { renderLeadMessage } from './normalize.js';

const TIMEOUT_MS = Number(process.env.MAX_TIMEOUT_MS || 7000);

export class DeliveryError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'DeliveryError';
    this.status = status ?? null;
    this.body = body ?? null;
  }
}

/** Отправка карточки лида в MAX. Бросает DeliveryError — воркер сам решает про ретрай. */
export const sendToMax = async lead => {
  const token = process.env.MAX_API_TOKEN || '';
  const apiUrl = process.env.MAX_API_URL || '';
  const hotChat = process.env.MAX_CHAT_ID || '';
  const coldChat = process.env.MAX_COLD_CHAT_ID || hotChat;
  const chatId = lead.quiz.qualifies ? hotChat : coldChat;
  const text = renderLeadMessage(lead);

  if (!token || !apiUrl) {
    log.warn('max_mock_transport', { lead_id: lead.lead_id, priority: lead.routing.priority, preview: text.split('\n')[0] });
    return { status: 200, body: '{"mock":true}' };
  }

  let res;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        tags: [lead.routing.priority, lead.quiz.qualifies ? 'qualified' : 'rejected'],
        lead_id: lead.lead_id
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (err) {
    throw new DeliveryError(`сеть недоступна: ${err.message}`, null, null);
  }

  const body = await res.text().catch(() => '');
  if (!res.ok) throw new DeliveryError(`MAX ответил ${res.status}`, res.status, body);
  return { status: res.status, body };
};

/** Резервное уведомление ответственному, если MAX молчит дольше FALLBACK_AFTER_MS — чтобы SLA 15 минут не сгорел молча. */
export const notifyFallback = async (reason, stats) => {
  const tgToken = process.env.FALLBACK_TG_TOKEN || '';
  const tgChat = process.env.FALLBACK_TG_CHAT || '';
  const text = `⚠️ autocar71: доставка заявок в MAX не проходит.\nПричина: ${reason}\n` +
    `В очереди: ${stats.queue_size}\nПоследняя успешная отправка: ${stats.last_success_at || 'не было'}\n` +
    'Заявки сохранены на сервере и уйдут автоматически после восстановления связи.';

  if (!tgToken || !tgChat) { log.error('fallback_channel_not_configured', { reason, ...stats }); return false; }
  try {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text }),
      signal: AbortSignal.timeout(5000)
    });
    log.warn('fallback_notified', { reason });
    return true;
  } catch (err) {
    log.error('fallback_failed', { error: String(err) });
    return false;
  }
};
