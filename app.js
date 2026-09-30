(() => {
  // Stage-one presentation build; production lead delivery is connected during Tilda transfer.
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Keep campaign attribution while navigating between landing pages.
  const campaign = new URLSearchParams();
  new URLSearchParams(location.search).forEach((value, key) => {
    if (/^utm_(source|medium|campaign|content|term)$/.test(key)) campaign.set(key, value);
  });
  if (campaign.size) $$('a[href^="/p/"]').forEach(link => {
    const target = new URL(link.href);
    campaign.forEach((value, key) => target.searchParams.set(key, value));
    link.href = target.pathname + target.search + target.hash;
  });

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
    'kak-eto-rabotaet': {
      promise: 'Понятный путь от заявки до ключей',
      subtitle: 'Выбираете вариант, обсуждаете условия с менеджером и оформляете договор после проверки документов.',
      first: ['Шаг 01', 'Выбрать автомобиль'], second: ['Шаг 02', 'Согласовать условия и оформление'],
      action: 'Обсудить свой вариант', purpose: '', proof: ['2 документа', 'для рассмотрения', 'Договор', 'условия до оплаты'],
      description: 'Как работает аренда автомобиля с выкупом в Автокар71: выбор машины, проверка документов, согласование условий и оформление.'
    },
    avtomobili: {
      promise: 'Выберите автомобиль для своих задач',
      subtitle: 'Посмотрите варианты из парка Автокар71. Актуальное наличие конкретной машины подтвердит менеджер.',
      first: ['Наш парк', 'Автомобили разных классов'], second: ['Стоимость', 'От 1 800 ₽/сутки'],
      action: 'Помочь с подбором', purpose: '', proof: ['14 авто', 'в каталоге', 'Новомосковск', 'наш парк'],
      description: 'Каталог автомобилей Автокар71 в Новомосковске: характеристики, фотографии и цены на аренду с выкупом.'
    },
    usloviya: {
      promise: 'Условия понятны до оформления',
      subtitle: 'Базовые требования и график платежей — ниже. Решение и итоговые условия индивидуальны после проверки документов.',
      first: ['Возраст', 'От 23 лет'], second: ['Водительский стаж', 'От 3 лет'],
      action: 'Уточнить условия', purpose: '', proof: ['23 года', 'минимальный возраст', '3 года', 'водительский стаж'],
      description: 'Условия выдачи автомобиля в Автокар71: возраст от 23 лет, стаж от 3 лет, гражданство и индивидуальное решение после проверки.'
    },
    'podbor-avto': {
      promise: 'Расскажите, какая машина вам нужна',
      subtitle: 'Ответьте на несколько вопросов — подготовим подходящие варианты для обсуждения с менеджером.',
      first: ['Формат', 'Подбор под ваши задачи'], second: ['Следующий шаг', 'Согласование условий после проверки'],
      action: 'Начать подбор', purpose: '', proof: ['Каталог', 'варианты в парке', 'Менеджер', 'уточнит наличие'],
      description: 'Подбор автомобиля в Автокар71: расскажите о своих задачах, посмотрите варианты и обсудите условия с менеджером.'
    },
    otzyvy: {
      promise: 'Ознакомьтесь с опытом клиентов',
      subtitle: 'Реальные выдачи автомобилей и отзывы из карточки Автокар71 на Яндекс Картах.',
      first: ['Источник', 'Отзывы на Яндекс Картах'], second: ['Реальные выдачи', 'Фотографии клиентов и авто'],
      action: 'Задать вопрос', purpose: '', proof: ['Отзывы', 'на Яндекс Картах', 'Фото', 'реальные выдачи'],
      description: 'Отзывы клиентов Автокар71 и фотографии реальных выдач автомобилей. Отзывы из карточки компании на Яндекс Картах.'
    },
    kontakty: {
      promise: 'Мы на связи в рабочие дни',
      subtitle: 'Позвоните или напишите в удобный мессенджер. Парк автомобилей находится в Новомосковске.',
      first: ['Телефон', '+7 953 970-88-77'], second: ['Адрес парка', 'Новомосковск, Первомайская, 73'],
      action: 'Заказать звонок', purpose: '', proof: ['09:00–18:00', 'пн–пт', 'Новомосковск', 'парк автомобилей'],
      description: 'Контакты Автокар71: +7 953 970-88-77, Новомосковск, ул. Первомайская, 73. MAX, Telegram и WhatsApp.'
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

  // Each navigation URL starts with its own relevant content, while the main page remains complete.
  const focusedSection = {
    'kak-eto-rabotaet': '#order', avtomobili: '#fleet', usloviya: '#terms', 'podbor-avto': '#quiz', otzyvy: '#stories'
  }[landing];
  if (focusedSection) {
    $('.hero').after($(focusedSection));
    if (landing === 'otzyvy') {
      const stories = $('#stories');
      const heading = $('#stories-title');
      heading.innerHTML = 'Опыт клиентов <em>Автокар71</em>';
      $('.section-kicker', stories).textContent = 'Отзывы клиентов';
      $('.section-head .text-link', stories).textContent = 'Реальные выдачи ↓';
      $('.section-head .text-link', stories).href = '#story-photos';
      $('.story-grid', stories).id = 'story-photos';
      $('.section-head', stories).after($('#reviews'));
    }
  }
  if (landing === 'kontakty') $('#contact-entry').hidden = false;

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
