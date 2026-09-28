(() => {
  // Stage-one presentation build; production lead delivery is connected during Tilda transfer.
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const landing = document.documentElement.dataset.landing;
  const offer = {
    arenda: {
      promise: 'Автомобиль для работы и личных поездок',
      subtitle: 'Подберите автомобиль из нашего парка. Доступность и сроки аренды подтвердит менеджер.',
      first: ['Формат', 'Аренда из нашего парка'], second: ['Условия', 'Депозит от 25 000 ₽ · график 7 / 0'],
      action: 'Подобрать авто в аренду', purpose: '', proof: ['25 000 ₽', 'депозит из наличия', '7 / 0', 'график аренды'],
      description: 'Аренда автомобилей из парка Автокар71 для работы и личных поездок. Парк в Новомосковске, условия индивидуально после проверки.'
    },
    vykup: {
      promise: 'Вы выбираете авто — мы покупаем его под вас',
      subtitle: 'Авто под заказ с первоначальным взносом 20% или выкуп из наличия. Условия — по договору после проверки.',
      first: ['Формат подбора', 'Автомобиль под ваш запрос'], second: ['Первоначальный взнос', 'От 20% для автомобиля под заказ'],
      action: 'Обсудить выкуп', purpose: 'Авто под заказ', proof: ['20%', 'взнос под заказ', 'Договор', 'условия до оплаты'],
      description: 'Автомобиль с правом выкупа в Автокар71: из наличия или под заказ. Первоначальный взнос от 20% для автомобиля под заказ.'
    },
    taxi: {
      promise: 'Автомобиль для работы в такси',
      subtitle: 'Выберите автомобиль из парка для ежедневной работы. Наличие и условия аренды подтвердит менеджер.',
      first: ['Для работы', 'Автомобили под такси'], second: ['График аренды', '7 / 0 · депозит от 25 000 ₽'],
      action: 'Подобрать авто для такси', purpose: 'Работа в такси', proof: ['7 / 0', 'график аренды', 'СТО', 'обслуживание парка'],
      description: 'Аренда автомобилей для работы в такси в Автокар71. Автомобили из парка, график 7 / 0, индивидуальные условия.'
    }
  }[landing];
  if (offer) {
    $('.hero-promise').textContent = offer.promise;
    $('.hero-subtitle').textContent = offer.subtitle;
    const labels = $$('.hero-labels div');
    [offer.first, offer.second].forEach(([caption, value], i) => {
      $('small', labels[i]).textContent = caption;
      $('strong', labels[i]).textContent = value;
    });
    const action = $('.hero-actions .button');
    action.firstChild.textContent = `${offer.action} `;
    if (offer.purpose) action.dataset.purpose = offer.purpose;
    else delete action.dataset.purpose;
    const proof = $$('.hero-proof div');
    $('strong', proof[0]).textContent = offer.proof[0]; $('span', proof[0]).textContent = offer.proof[1];
    $('strong', proof[2]).textContent = offer.proof[2]; $('span', proof[2]).textContent = offer.proof[3];
    $('meta[name="description"]').content = offer.description;
  }

  const menuButton = $('.menu-button');
  const menu = $('#mobile-menu');
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
  });
  $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); }));

  const observer = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
  }), { threshold: .08 });
  $$('.reveal').forEach(el => observer.observe(el));

  const cars = $('#cars-list');
  let fleetFilter = 'all', fleetExpanded = false;
  const fleetToggle = $('#fleet-toggle');
  function renderFleet() {
    const matching = $$('.car-card').filter(card => fleetFilter === 'all' || card.dataset.class === fleetFilter);
    const limit = matchMedia('(max-width:720px)').matches ? 3 : 6;
    $$('.car-card').forEach(card => card.hidden = !matching.includes(card) || (!fleetExpanded && matching.indexOf(card) >= limit));
    fleetToggle.hidden = matching.length <= limit;
    fleetToggle.setAttribute('aria-expanded', String(fleetExpanded));
    fleetToggle.textContent = fleetExpanded ? 'Свернуть автопарк' : `Показать все ${matching.length} авто`;
    $('#fleet-summary').textContent = `Показано ${fleetExpanded ? matching.length : Math.min(limit, matching.length)} из ${matching.length} автомобилей`;
  }
  fleetToggle.addEventListener('click', () => { fleetExpanded = !fleetExpanded; if (!fleetExpanded) $('#fleet').scrollIntoView({behavior:'instant'}); renderFleet(); });
  matchMedia('(max-width:720px)').addEventListener('change', renderFleet);
  $$('.tabs button').forEach(tab => tab.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', 'false'));
    tab.setAttribute('aria-selected', 'true');
    fleetFilter = tab.dataset.filter; fleetExpanded = false; renderFleet();
  }));
  renderFleet();
  const modal = $('#car-modal');
  // Optional independent catalog flags: data-availability="rented|available",
  // data-no-mileage="true", data-old-price="2 000 ₽", data-sale-price="1 800 ₽".
  // No promotional prices or statuses are fabricated when these fields are absent.
  $$('.car-card').forEach(card => {
    const status = $('.car-status', card);
    if (card.dataset.availability === 'rented') { status.textContent = 'В аренде'; status.classList.add('rented'); }
    else if (card.dataset.availability === 'available') status.textContent = 'Доступно';
    if (card.dataset.noMileage === 'true') {
      const badge = document.createElement('span'); badge.className = 'car-mileage'; badge.textContent = 'Без пробега';
      $('.car-media', card).append(badge);
    }
    if (card.dataset.salePrice && card.dataset.oldPrice) {
      const price = $('.car-price', card);
      const previous = document.createElement('del'); previous.textContent = `от ${card.dataset.oldPrice}`;
      $('strong', price).textContent = `от ${card.dataset.salePrice}`;
      price.prepend(previous);
      const sale = document.createElement('span'); sale.className = 'car-sale'; sale.textContent = 'Акция';
      $('.car-media', card).append(sale);
    }
  });
  const openCar = card => {
    const name = $('h3', card).textContent.trim();
    const specs = (card.dataset.specs || '').split('|').filter(Boolean);
    $('#modal-title').textContent = name; $('#modal-image').src = card.dataset.image; $('#modal-image').alt = name;
    $('.modal-media span').textContent = $('.car-status', card).textContent;
    $('#modal-specs').innerHTML = specs.map(x => `<span>${x}</span>`).join('');
    $('.modal-quiz').dataset.purpose = 'Хочу выкупить авто';
    $('.modal-quiz').dataset.car = name;
    modal.showModal(); document.body.style.overflow = 'hidden';
  };
  $$('.car-card').forEach(card => {
    card.addEventListener('click', () => openCar(card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCar(card); } });
  });
  const closeModal = () => { modal.close(); document.body.style.overflow = ''; };
  $('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('close', () => { document.body.style.overflow = ''; });
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  const allSteps = $$('.quiz-step');
  const answers = {};
  let current = 0;
  let path = [];
  const branchFromPurpose = value => value === 'Авто под заказ' ? 'order' : value === 'Личные поездки' ? 'personal' : value === 'Хочу выкупить авто' ? 'buyout' : 'taxi';
  const buildPath = () => {
    const branch = branchFromPurpose(answers.purpose);
    path = [
      $('[data-question="purpose"]'),
      ...$$(`[data-branch="${branch}"]`),
      $('[data-question="qualifies"]'),
      $('[data-question="contact"]')
    ];
  };
  const renderStep = () => {
    if (!path.length) buildPath();
    allSteps.forEach(s => s.classList.remove('active'));
    path[current].classList.add('active');
    const pct = Math.round(((current + 1) / path.length) * 100);
    $('#quiz-progress').style.width = `${pct}%`; $('#quiz-percent').textContent = `${pct}%`;
    $('#quiz-step-label').textContent = current < path.length - 1 ? `Вопрос ${current + 1} из ${path.length - 1}` : 'Контактные данные';
    $('#quiz-back').disabled = current === 0;
  };
  let stepping = false;
  allSteps.filter(step => step.dataset.question !== 'contact').forEach(step => $$('.answer', step).forEach(btn => btn.addEventListener('click', () => {
    if (stepping || !step.classList.contains('active')) return;
    stepping = true;
    $$('.answer', step).forEach(x => x.classList.remove('selected')); btn.classList.add('selected');
    answers[step.dataset.question] = btn.dataset.value;
    if (step.dataset.question === 'purpose') {
      Object.keys(answers).filter(k => k !== 'purpose').forEach(k => delete answers[k]);
      $$('.channels button').forEach(x => x.classList.remove('selected'));
      allSteps.filter(s => s !== step).forEach(s => $$('.answer', s).forEach(x => x.classList.remove('selected')));
      telegramField.hidden = true;
      validateContact();
      buildPath();
    }
    setTimeout(() => { current = Math.min(path.length - 1, current + 1); renderStep(); stepping = false; }, 170);
  })));
  $('#quiz-back').addEventListener('click', () => { if (!stepping && current > 0) { current--; renderStep(); } });
  const telegramField = $('.telegram-field');
  const telegram = $('#telegram-username');
  $$('.channels button').forEach(btn => btn.addEventListener('click', () => {
    $$('.channels button').forEach(x => x.classList.remove('selected')); btn.classList.add('selected'); answers.channel = btn.dataset.channel;
    telegramField.hidden = answers.channel !== 'Telegram';
    if (telegramField.hidden) { telegram.value = ''; $('#telegram-error').textContent = ''; telegram.classList.remove('error'); }
    validateContact();
  }));
  const phone = $('#lead-phone'); const consent = $('#consent'); const submit = $('.quiz-submit');
  const phoneDigits = () => phone.value.replace(/\D/g, '').replace(/^8/, '7');
  const telegramValid = () => answers.channel !== 'Telegram' || /^@[A-Za-z0-9_]{5,32}$/.test(telegram.value.trim());
  const validateContact = () => { submit.disabled = !(phoneDigits().length === 11 && answers.channel && telegramValid() && consent.checked); };
  phone.addEventListener('input', e => {
    let d = e.target.value.replace(/\D/g, '');
    if (!d) { e.target.value = ''; validateContact(); return; }
    if (d.length === 10 && !d.startsWith('7') && !d.startsWith('8')) d = `7${d}`;
    else if (d.startsWith('8')) d = `7${d.slice(1)}`;
    else if (!d.startsWith('7')) d = `7${d}`;
    d = d.slice(0, 11);
    const p = d.slice(1); let v = '+7'; if (p.length) v += ` (${p.slice(0,3)}`; if (p.length >= 3) v += ') '; if (p.length > 3) v += p.slice(3,6); if (p.length > 6) v += `-${p.slice(6,8)}`; if (p.length > 8) v += `-${p.slice(8,10)}`;
    e.target.value = v; e.target.classList.remove('error'); $('#phone-error').textContent = ''; validateContact();
  });
  telegram.addEventListener('input', () => { telegram.classList.remove('error'); $('#telegram-error').textContent = ''; validateContact(); });
  consent.addEventListener('change', validateContact);
  $('#lead-quiz').addEventListener('submit', e => {
    e.preventDefault();
    if (!consent.checked || !answers.channel || current !== path.length - 1) { validateContact(); return; }
    if (phoneDigits().length !== 11) { phone.classList.add('error'); $('#phone-error').textContent = 'Введите номер полностью'; return; }
    if (!telegramValid()) { telegram.classList.add('error'); $('#telegram-error').textContent = 'Укажите никнейм в формате @username'; return; }
    // Demo only. No personal data persistence or delivery-success analytics.
    // Production payload must include consent version, timestamp and qualification.
    try { sessionStorage.removeItem('autocar71_lead'); } catch (_) {}
    location.href = '/thanks.html';
  });

  const openQuiz = event => {
    if (modal.open) closeModal();
    const purpose = event?.currentTarget?.dataset.purpose;
    if (purpose && !stepping) { Object.keys(answers).forEach(k => { if (k !== 'channel') delete answers[k]; }); answers.purpose = purpose; buildPath(); current = 1; renderStep(); }
    if (event?.currentTarget?.dataset.car) answers.selected_car = event.currentTarget.dataset.car;
    validateContact();
    $('#quiz').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  };
  $$('.js-open-quiz').forEach(btn => btn.addEventListener('click', openQuiz));
  $('.modal-quiz').addEventListener('click', openQuiz);

  renderStep();
  clearTimeout(window.__revealFallback);
})();
