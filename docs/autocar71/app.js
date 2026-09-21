/* Автокар71 — клиентская логика лендинга (Этап 1).
   Модули: сохранение UTM, витрина с фильтрами, pop-up автомобиля,
   квиз-генератор заявок, сборка JSON-пакета лида, цели Яндекс.Метрики. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* Точка приёма заявок. Пустая строка = демо-режим: пакет собирается,
     показывается в интерфейсе, но никуда не отправляется. */
  const LEAD_ENDPOINT = '';

  /* ---------- Цели Яндекс.Метрики (безопасно молчат, пока счётчик не подключён) ---------- */
  const COUNTER_ID = window.YM_COUNTER_ID || null;
  const goal = (name, params) => {
    try {
      if (COUNTER_ID && typeof window.ym === 'function') window.ym(COUNTER_ID, 'reachGoal', name, params);
      (window.dataLayer = window.dataLayer || []).push({ event: name, ...(params || {}) });
    } catch (e) {}
  };

  /* ---------- UTM: забираем при первом заходе, переживаем якоря и переходы ---------- */
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'yclid', 'gclid'];
  const readStored = () => { try { return JSON.parse(sessionStorage.getItem('ac71_utm') || '{}'); } catch (e) { return {}; } };
  const utm = (() => {
    const stored = readStored();
    const params = new URLSearchParams(location.search);
    let touched = false;
    UTM_KEYS.forEach(k => { const v = params.get(k); if (v) { stored[k] = v; touched = true; } });
    if (!stored.referrer) { stored.referrer = document.referrer || ''; touched = true; }
    if (touched || !stored.landing_url) { stored.landing_url = location.href; }
    try { sessionStorage.setItem('ac71_utm', JSON.stringify(stored)); } catch (e) {}
    return stored;
  })();
  $$('#lead-quiz input[type=hidden]').forEach(input => { input.value = utm[input.name] || ''; });

  /* ---------- Меню ---------- */
  const menuButton = $('.menu-button');
  const menu = $('#mobile-menu');
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
    });
    $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => {
      menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------- Появление блоков ---------- */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }), { threshold: .08 });
    $$('.reveal').forEach(el => observer.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('visible'));
  }

  /* ---------- Витрина: фильтры по классам ---------- */
  const carsList = $('#cars-list');
  const emptyNote = $('#fleet-empty');
  const matches = (card, filter) =>
    filter === 'all' ? true :
    filter === 'order' ? !!$('.car-status.order', card) :
    card.dataset.class === filter && !$('.car-status.order', card);

  $$('.tabs button').forEach(tab => tab.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', 'false'));
    tab.setAttribute('aria-selected', 'true');
    const filter = tab.dataset.filter;
    let shown = 0;
    $$('.car-card').forEach(card => {
      const ok = matches(card, filter);
      card.hidden = !ok;
      if (ok) shown++;
    });
    if (emptyNote) emptyNote.hidden = shown > 0;
    if (carsList) carsList.scrollTo({ left: 0, behavior: 'smooth' });
    goal('fleet_filter', { filter });
  }));

  const step = 430;
  const prev = $('.cars-prev'); const next = $('.cars-next');
  if (prev) prev.addEventListener('click', () => carsList.scrollBy({ left: -step, behavior: 'smooth' }));
  if (next) next.addEventListener('click', () => carsList.scrollBy({ left: step, behavior: 'smooth' }));

  /* ---------- Pop-up автомобиля ---------- */
  const modal = $('#car-modal');
  let lastFocus = null;

  const openCar = card => {
    const d = card.dataset;
    $('#modal-title').textContent = d.name;
    const img = $('#modal-image');
    img.src = d.image; img.alt = d.name;
    $('#modal-specs').innerHTML = d.specs.split('|').map(x => `<span>${x}</span>`).join('');
    $('#modal-price').innerHTML = `<strong>${d.price}</strong><span>/ сутки · аренда / выкуп</span>`;
    $('.deposit-box strong').textContent = d.deposit;
    $('.deposit-box small').textContent = d.depositNote;
    $('#modal-badge').textContent = $('.car-status.order', card) ? 'Авто под заказ' : 'Авто в наличии';
    lastFocus = card;
    modal.showModal();
    document.body.style.overflow = 'hidden';
    goal('car_popup_open', { car: d.name });
  };
  const closeModal = () => {
    modal.close();
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };

  $$('.car-card').forEach(card => {
    card.addEventListener('click', () => openCar(card));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCar(card); }
    });
  });
  $('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  modal.addEventListener('close', () => { document.body.style.overflow = ''; });

  /* ---------- Карта офиса: фасад, виджет грузится по клику ---------- */
  const mapLoad = $('#map-load');
  if (mapLoad) mapLoad.addEventListener('click', () => {
    const facade = $('#map-facade');
    const frame = document.createElement('iframe');
    frame.className = 'map-frame';
    frame.title = 'Автокар71 на Яндекс Картах';
    frame.loading = 'lazy';
    frame.allowFullscreen = true;
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    frame.src = 'https://yandex.ru/map-widget/v1/?oid=7720672617&ol=biz&z=16';
    facade.replaceWith(frame);
    goal('map_open');
  });

  /* ---------- Квиз ---------- */
  const steps = $$('.quiz-step');
  const answers = {};
  let current = 0;
  let started = false;

  const renderStep = () => {
    steps.forEach((s, i) => s.classList.toggle('active', i === current));
    const pct = (current + 1) * 20;
    $('#quiz-progress').style.width = `${pct}%`;
    $('#quiz-percent').textContent = `${pct}%`;
    $('#quiz-step-label').textContent = current < 4 ? `Вопрос ${current + 1} из 4` : 'Контактные данные';
    $('#quiz-back').disabled = current === 0;
  };

  steps.slice(0, 4).forEach((stepEl, idx) => $$('.answer', stepEl).forEach(btn => btn.addEventListener('click', () => {
    if (!started) { started = true; goal('quiz_start'); }
    $$('.answer', stepEl).forEach(x => x.classList.remove('selected'));
    btn.classList.add('selected');
    answers[stepEl.dataset.question] = btn.dataset.value;
    if (btn.dataset.qualifies !== undefined) answers.qualifies = btn.dataset.qualifies === '1';
    goal('quiz_step', { step: idx + 1, value: btn.dataset.value });
    setTimeout(() => { current = Math.min(4, idx + 1); renderStep(); }, 170);
  })));

  $('#quiz-back').addEventListener('click', () => { if (current > 0) { current--; renderStep(); } });

  $$('.channels button').forEach(btn => btn.addEventListener('click', () => {
    $$('.channels button').forEach(x => x.classList.remove('selected'));
    btn.classList.add('selected');
    answers.channel = btn.dataset.channel;
    goal('messenger_click', { channel: btn.dataset.channel });
    validateContact();
  }));

  const phone = $('#lead-phone');
  const consent = $('#consent');
  const submit = $('.quiz-submit');
  const phoneDigits = () => phone.value.replace(/\D/g, '').replace(/^8/, '7');
  const validateContact = () => {
    submit.disabled = !(phoneDigits().length === 11 && answers.channel && consent.checked);
  };

  phone.addEventListener('input', e => {
    let d = e.target.value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
    if (!d.startsWith('7')) d = `7${d}`;
    const p = d.slice(1);
    let v = '+7';
    if (p.length) v += ` (${p.slice(0, 3)}`;
    if (p.length >= 3) v += ') ';
    if (p.length > 3) v += p.slice(3, 6);
    if (p.length > 6) v += `-${p.slice(6, 8)}`;
    if (p.length > 8) v += `-${p.slice(8, 10)}`;
    e.target.value = v;
    e.target.classList.remove('error');
    $('#phone-error').textContent = '';
    validateContact();
  });
  consent.addEventListener('change', validateContact);

  /* Единый JSON-пакет заявки — тот же формат, что принимает POST /lead */
  const buildLead = () => {
    const stored = readStored();
    const isMobile = matchMedia('(max-width: 720px)').matches;
    return {
      lead_id: `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
      received_at: new Date().toISOString(),
      contact: {
        phone: `+${phoneDigits()}`,
        name: null,
        preferred_channel: answers.channel || null
      },
      quiz: {
        purpose: answers.purpose || null,
        class: answers.class || null,
        fuel_gearbox: answers.fuel_gearbox || null,
        qualifies: answers.qualifies !== false,
        reject_reason: answers.qualifies === false ? 'Не проходит по возрасту / стажу / гражданству' : null
      },
      utm: {
        utm_source: stored.utm_source || null,
        utm_medium: stored.utm_medium || null,
        utm_campaign: stored.utm_campaign || null,
        utm_term: stored.utm_term || null,
        utm_content: stored.utm_content || null,
        yclid: stored.yclid || null,
        referrer: stored.referrer || null,
        landing_url: stored.landing_url || location.href
      },
      consent: { accepted: consent.checked, policy_version: '2026-09-17' },
      routing: {
        target: 'max_corporate',
        priority: answers.qualifies === false ? 'cold' : 'hot'
      },
      meta: { device: isMobile ? 'mobile' : 'desktop', ua: navigator.userAgent }
    };
  };

  $('#lead-quiz').addEventListener('submit', e => {
    e.preventDefault();
    if (phoneDigits().length !== 11) {
      phone.classList.add('error');
      $('#phone-error').textContent = 'Введите номер полностью';
      phone.focus();
      return;
    }
    const lead = buildLead();
    submit.disabled = true;

    if (LEAD_ENDPOINT) {
      /* Ответ сервера не ждём: обработчик отвечает 200 OK до любой внешней сети,
         доставка в MAX идёт асинхронно из очереди. */
      try {
        fetch(LEAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lead),
          keepalive: true
        }).catch(() => {});
      } catch (err) {}
    }

    $('#lead-json').textContent = JSON.stringify(lead, null, 2);
    $('#thanks-text').textContent = lead.quiz.qualifies
      ? 'Менеджер свяжется в выбранном канале в течение 15 минут в рабочее время.'
      : 'Заявку приняли. Менеджер перезвонит и разберёт условия по вашему случаю отдельно.';
    steps[current].classList.remove('active');
    $('.quiz-thanks').hidden = false;
    $('.quiz-bottom').style.display = 'none';
    goal('lead_submit', { priority: lead.routing.priority, channel: lead.contact.preferred_channel });
  });

  $('.quiz-restart').addEventListener('click', () => {
    current = 0;
    Object.keys(answers).forEach(k => delete answers[k]);
    phone.value = '';
    $$('.selected').forEach(x => x.classList.remove('selected'));
    $('.quiz-thanks').hidden = true;
    $('.quiz-bottom').style.display = '';
    submit.disabled = true;
    renderStep();
  });

  /* ---------- Переходы к квизу и цели по контактам ---------- */
  const openQuiz = e => {
    if (e) e.preventDefault();
    if (modal.open) closeModal();
    $('#quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $$('.js-open-quiz').forEach(btn => btn.addEventListener('click', openQuiz));
  $('.modal-quiz').addEventListener('click', openQuiz);
  $$('.js-phone').forEach(a => a.addEventListener('click', () => goal('phone_click')));

  renderStep();
})();
