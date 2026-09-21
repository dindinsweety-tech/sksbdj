(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const params = new URLSearchParams(location.search);
  const campaign = `${params.get('utm_campaign') || ''} ${params.get('utm_term') || ''} ${params.get('utm_content') || ''}`.toLowerCase();
  const hero = $('#hero-title');
  if (campaign.includes('arenda')) hero.innerHTML = 'Аренда автомобилей под такси и личные цели <mark>от 10 дней</mark> и <span class="price-nowrap">1 800 ₽/сутки</span>';
  if (campaign.includes('vikup') || campaign.includes('vykup')) hero.innerHTML = 'Автомобили под выкуп <mark><span class="price-nowrap">от 1 800 ₽/сутки</span>.</mark> Одобрение с любой КИ';

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
  const openCar = card => {
    const name = $('h3', card).textContent.trim();
    const specs = (card.dataset.specs || '').split('|').filter(Boolean);
    $('#modal-title').textContent = name; $('#modal-image').src = card.dataset.image; $('#modal-image').alt = name;
    $('#modal-specs').innerHTML = specs.map(x => `<span>${x}</span>`).join('');
    $('.deposit-box strong').textContent = '25 000 ₽';
    $('.deposit-box small').textContent = 'для автомобиля из наличия';
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
    let d = e.target.value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11); if (!d.startsWith('7')) d = `7${d}`;
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
    location.href = 'thanks.html';
  });

  const openQuiz = event => {
    if (modal.open) closeModal();
    const purpose = event?.currentTarget?.dataset.purpose;
    if (purpose && !stepping) { Object.keys(answers).forEach(k => { if (k !== 'channel') delete answers[k]; }); answers.purpose = purpose; buildPath(); current = 1; renderStep(); }
    $('#quiz').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  };
  $$('.js-open-quiz').forEach(btn => btn.addEventListener('click', openQuiz));
  $('.modal-quiz').addEventListener('click', openQuiz);

  const calculator = $('[data-calculator]');
  if (calculator) {
    const price = $('#calc-price');
    const advance = $('#calc-advance');
    const term = $('#calc-term');
    const money = value => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
    const monthWord = value => value % 10 === 1 && value % 100 !== 11 ? 'месяц' : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20) ? 'месяца' : 'месяцев';
    const paintRange = input => {
      const progress = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--range-progress', `${progress}%`);
    };
    const updateCalculator = () => {
      const carPrice = Number(price.value);
      const advancePercent = Number(advance.value);
      const months = Number(term.value);
      const advanceAmount = carPrice * advancePercent / 100;
      const balance = carPrice - advanceAmount;
      const weeks = months * 52 / 12;
      $('#calc-price-output').textContent = money(carPrice);
      $('#calc-advance-output').textContent = `${advancePercent}% · ${money(advanceAmount)}`;
      $('#calc-term-output').textContent = `${months} ${monthWord(months)}`;
      $('#calc-weekly').textContent = money(balance / weeks);
      $('#calc-monthly').textContent = money(balance / months);
      $('#calc-balance').textContent = money(balance);
      $('#lead-calc-price').value = String(carPrice);
      $('#lead-calc-advance').value = String(advancePercent);
      $('#lead-calc-term').value = String(months);
      [price, advance, term].forEach(paintRange);
    };
    [price, advance, term].forEach(input => input.addEventListener('input', updateCalculator));
    updateCalculator();
  }
  renderStep();
  clearTimeout(window.__revealFallback);
})();
