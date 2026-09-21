/* quiz.js — генератор заявок для Tilda.
   Вставка: блок T123 «HTML-код» с контейнером <div id="ac71-quiz"></div>,
   затем <link rel="stylesheet" href=".../quiz.css"> и этот файл.

   Собирает единый JSON-пакет (ответы + канал + телефон + UTM + reCAPTCHA)
   и отправляет одним POST на /lead. Ответ сервера не ждём дольше секунды:
   обработчик отвечает 200 OK до любой внешней сети.

   Зависимости (необязательные): utm.js — метки, recaptcha-init.js — токен,
   metrika-goals.js — цели. Без них квиз работает, просто без этих данных. */
(function () {
  'use strict';

  var ENDPOINT = window.AC71_LEAD_ENDPOINT || '/lead';
  var POLICY_URL = window.AC71_POLICY_URL || '/privacy';
  var POLICY_VERSION = '2026-09-17';

  var STEPS = [
    {
      key: 'purpose',
      legend: 'Для каких целей нужен автомобиль?',
      options: ['Работа в такси', 'Личные поездки', 'Хочу выкупить авто']
    },
    {
      key: 'class',
      legend: 'Какой класс авто рассматриваете?',
      options: ['Эконом из наличия от 1800 ₽/сутки', 'Комфорт из наличия', 'Купить авто под заказ с авансом 20%']
    },
    {
      key: 'fuel_gearbox',
      legend: 'Предпочтения по топливу и КПП?',
      options: ['Только газ (ГБО)', 'Бензин, МКПП', 'АКПП']
    },
    {
      key: 'qualifies',
      legend: 'Подходите ли вы под наши требования?',
      options: [
        { label: 'Да, РФ, от 23 лет, стаж от 3-х лет', value: true },
        { label: 'Нет, по какому-то пункту не прохожу', value: false }
      ]
    }
  ];
  var CHANNELS = ['MAX', 'Telegram', 'WhatsApp', 'Жду звонка'];

  var root = document.getElementById('ac71-quiz');
  if (!root) return;

  var answers = {};
  var current = 0;
  var started = false;
  var sending = false;

  var fire = function (name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  };

  /* ---------- Разметка ---------- */
  root.className = 'ac71-quiz';
  root.innerHTML =
    '<div class="ac71-quiz__top"><span data-el="label">Вопрос 1 из 4</span><span data-el="percent">20%</span></div>' +
    '<div class="ac71-quiz__progress"><i data-el="bar"></i></div>' +
    '<form class="ac71-quiz__body" data-el="body" novalidate></form>' +
    '<div class="ac71-quiz__bottom" data-el="bottom">' +
      '<button type="button" class="ac71-quiz__back" data-el="back" disabled>&larr; Назад</button>' +
      '<span>Данные защищены</span>' +
    '</div>';

  var el = {};
  ['label', 'percent', 'bar', 'body', 'bottom', 'back'].forEach(function (k) {
    el[k] = root.querySelector('[data-el="' + k + '"]');
  });

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /* ---------- Телефон: жёсткая маска +7 (___) ___-__-__ ---------- */
  var digits = function (v) {
    var d = String(v || '').replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
    if (d && d[0] !== '7') d = '7' + d.slice(0, 10);
    return d;
  };
  var mask = function (v) {
    var p = digits(v).slice(1), out = '+7';
    if (p.length) out += ' (' + p.slice(0, 3);
    if (p.length >= 3) out += ') ';
    if (p.length > 3) out += p.slice(3, 6);
    if (p.length > 6) out += '-' + p.slice(6, 8);
    if (p.length > 8) out += '-' + p.slice(8, 10);
    return out;
  };

  /* ---------- Шаги ---------- */
  function renderProgress() {
    var pct = (current + 1) * 20;
    el.bar.style.width = pct + '%';
    el.percent.textContent = pct + '%';
    el.label.textContent = current < STEPS.length ? 'Вопрос ' + (current + 1) + ' из ' + STEPS.length : 'Контактные данные';
    el.back.disabled = current === 0;
  }

  function renderQuestion(idx) {
    var step = STEPS[idx];
    var html = '<p class="ac71-quiz__legend">' + esc(step.legend) + '</p><div class="ac71-quiz__answers">';
    step.options.forEach(function (opt, i) {
      var label = typeof opt === 'object' ? opt.label : opt;
      var selected = answers[step.key] !== undefined &&
        (typeof opt === 'object' ? answers[step.key] === opt.value : answers[step.key] === opt);
      html += '<button type="button" class="ac71-quiz__answer' + (selected ? ' is-selected' : '') +
        '" data-idx="' + i + '"><span>0' + (i + 1) + '</span>' + esc(label) + '<i aria-hidden="true">&rarr;</i></button>';
    });
    el.body.innerHTML = html + '</div>';

    el.body.querySelectorAll('.ac71-quiz__answer').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var opt = step.options[Number(btn.dataset.idx)];
        answers[step.key] = typeof opt === 'object' ? opt.value : opt;
        if (!started) { started = true; fire('ac71:quiz-start'); }
        fire('ac71:quiz-step', { step: idx + 1, key: step.key, value: String(typeof opt === 'object' ? opt.label : opt) });
        el.body.querySelectorAll('.ac71-quiz__answer').forEach(function (b) { b.classList.remove('is-selected'); });
        btn.classList.add('is-selected');
        setTimeout(function () { go(idx + 1); }, 170);
      });
    });
  }

  function renderContacts() {
    el.body.innerHTML =
      '<p class="ac71-quiz__legend">Куда отправить варианты?</p>' +
      '<div class="ac71-quiz__field">' +
        '<div class="ac71-quiz__channels" role="group" aria-label="Канал связи">' +
          CHANNELS.map(function (c) { return '<button type="button" data-channel="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
        '</div>' +
        '<label class="ac71-quiz__label" for="ac71-phone">Ваш номер телефона</label>' +
        '<input class="ac71-quiz__input" id="ac71-phone" name="phone" type="tel" inputmode="tel" ' +
          'autocomplete="tel" placeholder="+7 (___) ___-__-__" aria-describedby="ac71-phone-error">' +
        '<p class="ac71-quiz__error" id="ac71-phone-error" role="alert"></p>' +
        '<label class="ac71-quiz__consent"><input type="checkbox" data-el="consent" checked>' +
          '<span>Согласен на <a href="' + esc(POLICY_URL) + '" target="_blank" rel="noopener">обработку персональных данных</a></span></label>' +
        '<button type="submit" class="ac71-quiz__submit" data-el="submit" disabled>Получить предложение &rarr;</button>' +
      '</div>';

    var phone = el.body.querySelector('#ac71-phone');
    var err = el.body.querySelector('#ac71-phone-error');
    var consent = el.body.querySelector('[data-el="consent"]');
    var submit = el.body.querySelector('[data-el="submit"]');

    var validate = function () {
      submit.disabled = !(digits(phone.value).length === 11 && answers.channel && consent.checked);
    };

    el.body.querySelectorAll('[data-channel]').forEach(function (btn) {
      if (answers.channel === btn.dataset.channel) btn.classList.add('is-selected');
      btn.addEventListener('click', function () {
        el.body.querySelectorAll('[data-channel]').forEach(function (b) { b.classList.remove('is-selected'); });
        btn.classList.add('is-selected');
        answers.channel = btn.dataset.channel;
        fire('ac71:quiz-step', { step: 5, key: 'channel', value: answers.channel });
        validate();
      });
    });

    if (answers.phone) phone.value = mask(answers.phone);
    phone.addEventListener('input', function () {
      phone.value = mask(phone.value);
      answers.phone = digits(phone.value);
      phone.classList.remove('is-error');
      err.textContent = '';
      validate();
    });
    consent.addEventListener('change', validate);
    validate();

    el.body.onsubmit = function (e) {
      e.preventDefault();
      if (digits(phone.value).length !== 11) {
        phone.classList.add('is-error');
        err.textContent = 'Введите номер полностью';
        phone.focus();
        return;
      }
      send(submit, consent.checked);
    };
  }

  function go(idx) {
    current = Math.max(0, Math.min(STEPS.length, idx));
    renderProgress();
    if (current < STEPS.length) renderQuestion(current);
    else renderContacts();
  }

  el.back.addEventListener('click', function () { if (current > 0) go(current - 1); });

  /* ---------- Сборка пакета и отправка ---------- */
  function buildLead(token, consentAccepted) {
    var utm = (window.AC71_UTM && window.AC71_UTM.get()) || {};
    var qualifies = answers.qualifies !== false;
    return {
      received_at: new Date().toISOString(),
      contact: {
        phone: '+' + digits(answers.phone),
        name: null,
        preferred_channel: answers.channel || null
      },
      quiz: {
        purpose: answers.purpose || null,
        class: answers.class || null,
        fuel_gearbox: answers.fuel_gearbox || null,
        qualifies: qualifies,
        reject_reason: qualifies ? null : 'Не проходит по возрасту / стажу / гражданству'
      },
      utm: {
        utm_source: utm.utm_source || null,
        utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null,
        utm_term: utm.utm_term || null,
        utm_content: utm.utm_content || null,
        yclid: utm.yclid || null,
        referrer: utm.referrer || document.referrer || null,
        landing_url: utm.landing_url || location.href
      },
      recaptcha: { token: token || null, action: 'quiz_submit' },
      consent: { accepted: Boolean(consentAccepted), policy_version: POLICY_VERSION },
      routing: { target: 'max_corporate', priority: qualifies ? 'hot' : 'cold' },
      meta: { device: matchMedia('(max-width: 719px)').matches ? 'mobile' : 'desktop', ua: navigator.userAgent }
    };
  }

  function renderThanks(qualifies) {
    el.bar.style.width = '100%';
    el.percent.textContent = '100%';
    el.label.textContent = 'Готово';
    el.bottom.style.display = 'none';
    el.body.innerHTML =
      '<div class="ac71-quiz__thanks">' +
        '<div class="ac71-quiz__mark" aria-hidden="true">&#10003;</div>' +
        '<h3>Заявка отправлена</h3>' +
        '<p>' + (qualifies
          ? 'Менеджер свяжется в выбранном канале в течение 15 минут в рабочее время.'
          : 'Заявку приняли. Менеджер перезвонит и разберёт условия по вашему случаю отдельно.') + '</p>' +
      '</div>';
  }

  function send(submit, consentAccepted) {
    if (sending) return;
    sending = true;
    submit.disabled = true;
    submit.textContent = 'Отправляем…';

    var withToken = window.AC71_RECAPTCHA
      ? window.AC71_RECAPTCHA.token('quiz_submit')
      : Promise.resolve(null);

    withToken.then(function (token) {
      var lead = buildLead(token, consentAccepted);
      fire('ac71:lead', { priority: lead.routing.priority, channel: lead.contact.preferred_channel });
      /* Экран благодарности показываем сразу: сервер отвечает 200 OK до внешней сети,
         а доставка в MAX идёт из персистентной очереди. */
      renderThanks(lead.quiz.qualifies);
      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
        keepalive: true
      });
    }).catch(function () { /* заявка уже в keepalive-очереди браузера, пользователя не тревожим */ });
  }

  go(0);
  window.AC71_QUIZ = { reset: function () { answers = {}; started = false; sending = false; el.bottom.style.display = ''; go(0); } };
})();
