(() => {
  // Stage-one presentation build; production lead delivery is connected during Tilda transfer.
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const landing = document.documentElement.dataset.landing;
  const offer = {
    arenda: {
      promise: 'Автомобиль для работы и личных поездок',
      subtitle: 'Одобрение за 30 минут по 2 документам. Только для граждан РФ.',
      first: ['Формат', 'Аренда из нашего парка'], second: ['Условия', 'Депозит от 25 000 ₽ · график 7 / 0'],
      action: 'Подобрать авто в аренду', purpose: '', proof: ['25 000 ₽', 'депозит из наличия', '7 / 0', 'график аренды'],
      description: 'Аренда автомобилей из парка Автокар71 для работы и личных поездок. Парк в Новомосковске, условия индивидуально после проверки.'
    },
    vykup: {
      promise: 'Вы выбираете авто — мы покупаем его под вас',
      subtitle: 'Одобрение за 30 минут по 2 документам. Только для граждан РФ.',
      first: ['Формат подбора', 'Автомобиль под ваш запрос'], second: ['Первоначальный взнос', 'От 20% для автомобиля под заказ'],
      action: 'Обсудить выкуп', purpose: 'Авто под заказ', proof: ['20%', 'взнос под заказ', 'Договор', 'условия до оплаты'],
      description: 'Автомобиль с правом выкупа в Автокар71: из наличия или под заказ. Первоначальный взнос от 20% для автомобиля под заказ.'
    },
    taxi: {
      promise: 'Автомобиль для работы в такси',
      subtitle: 'Одобрение за 30 минут по 2 документам. Только для граждан РФ.',
      first: ['Для работы', 'Автомобили под такси'], second: ['График аренды', '7 / 0 · депозит от 25 000 ₽'],
      action: 'Подобрать авто для такси', purpose: 'Работа в такси', proof: ['7 / 0', 'график аренды', 'СТО', 'обслуживание парка'],
      description: 'Аренда автомобилей для работы в такси в Автокар71. Автомобили из парка, график 7 / 0, индивидуальные условия.'
    },
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
  }

  const menuButton = $('.menu-button');
  const menu = $('#mobile-menu');
  const setMenu = open => {
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  menuButton.addEventListener('click', () => setMenu(menu.hidden));
  $$('#mobile-menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { setMenu(false); menuButton.focus(); }
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
  });


  const handover = $('#handover-slider');
  const handoverCards = $$('.story-card', handover);
  const previousPhoto = $('.handover-prev'), nextPhoto = $('.handover-next');
  let handoverFrame;
  const handoverIndex = () => {
    const left = handover.getBoundingClientRect().left;
    return handoverCards.reduce((best, card, index) =>
      Math.abs(card.getBoundingClientRect().left - left) < Math.abs(handoverCards[best].getBoundingClientRect().left - left) ? index : best, 0);
  };
  const updateHandover = () => {
    const index = handoverIndex();
    const visible = matchMedia('(max-width:720px)').matches ? 1 : 2;
    $('.handover-counter').textContent = visible === 1 ? `${index + 1} / ${handoverCards.length}` : `${index + 1}–${Math.min(index + visible, handoverCards.length)} / ${handoverCards.length}`;
    previousPhoto.disabled = handover.scrollLeft < 2;
    nextPhoto.disabled = handover.scrollLeft >= handover.scrollWidth - handover.clientWidth - 2;
  };
  const moveHandover = direction => {
    const index = Math.max(0, Math.min(handoverCards.length - 1, handoverIndex() + direction));
    const offset = handoverCards[index].getBoundingClientRect().left - handover.getBoundingClientRect().left + handover.scrollLeft;
    handover.scrollTo({left: offset, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
  };
  previousPhoto.addEventListener('click', () => moveHandover(-1));
  nextPhoto.addEventListener('click', () => moveHandover(1));
  handover.addEventListener('scroll', () => { cancelAnimationFrame(handoverFrame); handoverFrame = requestAnimationFrame(updateHandover); }, {passive:true});
  handover.addEventListener('keydown', event => {
    if (event.target === handover && ['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); moveHandover(event.key === 'ArrowRight' ? 1 : -1); }
  });
  new ResizeObserver(updateHandover).observe(handover);
  updateHandover();

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
    specs.unshift('Класс: ' + $('.car-class', card).textContent.trim());
    $('#modal-title').textContent = name; $('#modal-image').src = card.dataset.image || '/assets/logo.webp'; $('#modal-image').alt = card.dataset.image ? name : 'Фотография автомобиля уточняется';
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

  const openQuiz = event => {
    const source = event?.currentTarget;
    if (modal.open) closeModal();
    window.autocarQuizStart?.(source?.dataset.purpose || '', source?.dataset.car || '');
    $('#quiz').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
  };
  $$('.js-open-quiz').forEach(btn => btn.addEventListener('click', openQuiz));
  $('.modal-quiz').addEventListener('click', openQuiz);
  clearTimeout(window.__revealFallback);
})();
