(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const params = new URLSearchParams(location.search);
  const campaign = `${params.get('utm_campaign') || ''} ${params.get('utm_term') || ''} ${params.get('utm_content') || ''}`.toLowerCase();
  const hero = $('#hero-title');
  if (campaign.includes('arenda')) hero.innerHTML = 'Аренда автомобилей под такси и личные цели <mark>от 10 дней</mark> и 1800 ₽/сутки';
  if (campaign.includes('vikup') || campaign.includes('vykup')) hero.innerHTML = 'Автомобили под выкуп <mark>от 1800 ₽/сутки.</mark> Одобрение с любой КИ';

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
  $$('.tabs button').forEach(tab => tab.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', 'false'));
    tab.setAttribute('aria-selected', 'true');
    const filter = tab.dataset.filter;
    $$('.car-card').forEach(card => card.hidden = !(filter === 'all' || (filter === 'order' ? $('.car-status.order', card) : card.dataset.class === filter)));
  }));
  $('.cars-prev').addEventListener('click', () => cars.scrollBy({ left: -430, behavior: 'smooth' }));
  $('.cars-next').addEventListener('click', () => cars.scrollBy({ left: 430, behavior: 'smooth' }));

  const modal = $('#car-modal');
  const carData = {
    'Lada Granta 2024': { image: 'assets/granta-2024.webp', specs: ['2024 год', '1.6 л', 'МКПП', 'бензин + газ'], deposit: '25 000 ₽' },
    'Hyundai Solaris 2020': { image: 'assets/solaris-2020.webp', specs: ['2020 год', '1.6 л', 'АКПП', 'ГБО'], deposit: '25 000 ₽' },
    'Kia Rio 2013': { image: 'assets/kia-rio-2013.webp', specs: ['2013 год', '1.6 л', 'МКПП', 'бензин'], deposit: '25 000 ₽' },
    'Solaris HC 2024': { image: 'assets/solaris-hc-2024.webp', specs: ['2024 год', '1.6 л', 'МКПП', 'бензин'], deposit: '100 000 ₽' }
  };
  const openCar = card => {
    const name = $('h3', card).textContent.trim(); const data = carData[name];
    $('#modal-title').textContent = name; $('#modal-image').src = data.image; $('#modal-image').alt = name;
    $('#modal-specs').innerHTML = data.specs.map(x => `<span>${x}</span>`).join('');
    $('.deposit-box strong').textContent = data.deposit;
    $('.deposit-box small').textContent = name === 'Solaris HC 2024' ? 'для нового авто под заказ' : 'для авто из наличия';
    modal.showModal(); document.body.style.overflow = 'hidden';
  };
  $$('.car-card').forEach(card => {
    card.addEventListener('click', () => openCar(card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCar(card); } });
  });
  const closeModal = () => { modal.close(); document.body.style.overflow = ''; };
  $('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  const steps = $$('.quiz-step');
  const answers = {};
  let current = 0;
  const renderStep = () => {
    steps.forEach((s, i) => s.classList.toggle('active', i === current));
    const pct = (current + 1) * 20;
    $('#quiz-progress').style.width = `${pct}%`; $('#quiz-percent').textContent = `${pct}%`;
    $('#quiz-step-label').textContent = current < 4 ? `Вопрос ${current + 1} из 4` : 'Контактные данные';
    $('#quiz-back').disabled = current === 0;
  };
  steps.slice(0, 4).forEach((step, idx) => $$('.answer', step).forEach(btn => btn.addEventListener('click', () => {
    $$('.answer', step).forEach(x => x.classList.remove('selected')); btn.classList.add('selected');
    answers[step.dataset.question] = btn.dataset.value;
    setTimeout(() => { current = Math.min(4, idx + 1); renderStep(); }, 170);
  })));
  $('#quiz-back').addEventListener('click', () => { if (current > 0) { current--; renderStep(); } });
  $$('.channels button').forEach(btn => btn.addEventListener('click', () => {
    $$('.channels button').forEach(x => x.classList.remove('selected')); btn.classList.add('selected'); answers.channel = btn.dataset.channel; validateContact();
  }));
  const phone = $('#lead-phone'); const consent = $('#consent'); const submit = $('.quiz-submit');
  const phoneDigits = () => phone.value.replace(/\D/g, '').replace(/^8/, '7');
  const validateContact = () => { submit.disabled = !(phoneDigits().length === 11 && answers.channel && consent.checked); };
  phone.addEventListener('input', e => {
    let d = e.target.value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11); if (!d.startsWith('7')) d = `7${d}`;
    const p = d.slice(1); let v = '+7'; if (p.length) v += ` (${p.slice(0,3)}`; if (p.length >= 3) v += ') '; if (p.length > 3) v += p.slice(3,6); if (p.length > 6) v += `-${p.slice(6,8)}`; if (p.length > 8) v += `-${p.slice(8,10)}`;
    e.target.value = v; e.target.classList.remove('error'); $('#phone-error').textContent = ''; validateContact();
  });
  consent.addEventListener('change', validateContact);
  $('#lead-quiz').addEventListener('submit', e => {
    e.preventDefault();
    if (phoneDigits().length !== 11) { phone.classList.add('error'); $('#phone-error').textContent = 'Введите номер полностью'; return; }
    steps[current].classList.remove('active'); $('.quiz-thanks').hidden = false; $('.quiz-bottom').style.display = 'none';
  });
  $('.quiz-restart').addEventListener('click', () => {
    current = 0; Object.keys(answers).forEach(k => delete answers[k]); phone.value = ''; $$('.selected').forEach(x => x.classList.remove('selected')); $('.quiz-thanks').hidden = true; $('.quiz-bottom').style.display = ''; renderStep();
  });

  const openQuiz = () => { if (modal.open) closeModal(); $('#quiz').scrollIntoView({ behavior: 'smooth' }); };
  $$('.js-open-quiz').forEach(btn => btn.addEventListener('click', openQuiz));
  $('.modal-quiz').addEventListener('click', openQuiz);
  renderStep();
})();
