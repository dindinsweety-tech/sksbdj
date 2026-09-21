/* metrika-goals.js — цели Яндекс.Метрики и сбор аудиторий для ретаргетинга.
   Счётчик подключается отдельно (Tilda: «Настройки сайта → Аналитика»),
   здесь только цели. ID счётчика подставить в AC71_METRIKA_ID.

   Цели: отправка формы, старт квиза, каждый шаг квиза,
   клик по мессенджерам, клик по номеру телефона. */
(function () {
  'use strict';
  var ID = window.AC71_METRIKA_ID || null;

  function reach(name, params) {
    try {
      if (ID && typeof window.ym === 'function') window.ym(ID, 'reachGoal', name, params);
      (window.dataLayer = window.dataLayer || []).push(
        Object.assign({ event: name }, params || {}));
    } catch (e) {}
  }
  window.AC71_GOAL = reach;

  /* Клики по телефону, мессенджерам и любым элементам с data-ac71-goal */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a,button,[data-ac71-goal]') : null;
    if (!el) return;
    var explicit = el.getAttribute('data-ac71-goal');
    if (explicit) { reach(explicit); return; }
    var href = (el.getAttribute('href') || '').toLowerCase();
    if (href.indexOf('tel:') === 0) reach('phone_click', { number: href.slice(4) });
    else if (/(max\.ru|t\.me|telegram|wa\.me|whatsapp|api\.whatsapp)/.test(href)) reach('messenger_click', { href: href });
  }, true);

  /* Отправка любой формы на странице */
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.tagName === 'FORM') reach('form_submit', { form: e.target.name || e.target.id || 'tilda' });
  }, true);

  /* События квиза (quiz.js шлёт их через CustomEvent) */
  document.addEventListener('ac71:quiz-start', function () { reach('quiz_start'); });
  document.addEventListener('ac71:quiz-step', function (e) { reach('quiz_step', e.detail); });
  document.addEventListener('ac71:lead', function (e) { reach('lead_submit', e.detail); });
})();
