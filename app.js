(() => {
  // Stage-one presentation build; production lead delivery is connected during Tilda transfer.
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const landing = document.documentElement.dataset.landing;
  const offer = {
    arenda: {
      promise: 'Автомобиль для работы и личных поездок',
      subtitle: 'Одобрение за 30 минут по 2 документам.',
      first: ['Формат', 'Аренда из нашего парка'], second: ['Условия', 'Депозит от 25 000 ₽ · график 7 / 0'],
      action: 'Подобрать авто в аренду', purpose: '', proof: ['25 000 ₽', 'депозит из наличия', '7 / 0', 'график аренды'],
      description: 'Аренда автомобилей из парка Автокар71 для работы и личных поездок. Парк в Новомосковске, условия индивидуально после проверки.'
    },
    vykup: {
      promise: 'Вы выбираете авто — мы покупаем его под вас',
      subtitle: 'Одобрение за 30 минут по 2 документам.',
      first: ['Формат подбора', 'Автомобиль под ваш запрос'], second: ['Первоначальный взнос', 'От 20% для автомобиля под заказ'],
      action: 'Обсудить выкуп', purpose: 'Авто под заказ', proof: ['20%', 'взнос под заказ', 'Договор', 'условия до оплаты'],
      description: 'Автомобиль с правом выкупа в Автокар71: из наличия или под заказ. Первоначальный взнос от 20% для автомобиля под заказ.'
    },
    taxi: {
      promise: 'Автомобиль для работы в такси',
      subtitle: 'Одобрение за 30 минут по 2 документам.',
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


  const reduceMotion = matchMedia('(prefers-reduced-motion:reduce)');
  function setupCarousel(track, cardSelector, controls, delay) {
    if (!track) return;
    const slides=$$(cardSelector,track);
    let timer, busy=false, visible=false;
    const index=()=>slides.reduce((best,slide,i)=>Math.abs(slide.offsetLeft-track.offsetLeft-track.scrollLeft)<Math.abs(slides[best].offsetLeft-track.offsetLeft-track.scrollLeft)?i:best,0);
    const move=direction=>{
      const max=track.scrollWidth-track.clientWidth;
      const next=Math.max(0,Math.min(slides.length-1,index()+direction));
      const edge=direction>0&&track.scrollLeft>=max-2?0:direction<0&&track.scrollLeft<2?max:null;
      const target=edge===null?Math.min(max,slides[next].offsetLeft-track.offsetLeft):edge;
      track.scrollTo({left:target,behavior:reduceMotion.matches?'instant':'smooth'});
    };
    const stop=()=>{clearInterval(timer);timer=undefined};
    const play=()=>{stop();if(visible&&!busy&&!document.hidden&&!reduceMotion.matches)timer=setInterval(()=>move(1),delay)};
    controls?.previous?.addEventListener('click',()=>{move(-1);play()});
    controls?.next?.addEventListener('click',()=>{move(1);play()});
    track.addEventListener('pointerdown',()=>{busy=true;stop()},{passive:true});
    window.addEventListener('pointerup',()=>{if(busy){busy=false;play()}},{passive:true});
    track.addEventListener('pointercancel',()=>{busy=false;play()},{passive:true});
    track.addEventListener('mouseenter',()=>{busy=true;stop()});
    track.addEventListener('mouseleave',()=>{busy=false;play()});
    track.addEventListener('focusin',()=>{busy=true;stop()});
    track.addEventListener('focusout',()=>{busy=false;play()});
    track.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowRight'?1:-1)}});
    document.addEventListener('visibilitychange',play);
    reduceMotion.addEventListener('change',play);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;play()},{threshold:.2}).observe(track);
  }
  setupCarousel($('#handover-slider'),'.story-card',{previous:$('.handover-prev'),next:$('.handover-next')},5000);
  setupCarousel($('#review-slider'),'.review-card',null,6500);

  // Measure the actual bars rather than maintaining rounded CSS estimates.
  const mobileBar=$('.mobile-bar'), header=$('.site-header');
  const syncBars=()=>{
    document.documentElement.style.setProperty('--mobile-bar-height',mobileBar.getBoundingClientRect().height+'px');
    document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px');
  };
  new ResizeObserver(syncBars).observe(mobileBar);
  new ResizeObserver(syncBars).observe(header);
  window.addEventListener('resize',syncBars,{passive:true});
  syncBars();

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
  let pageLock;
  const lockPage=()=>{
    if(pageLock)return;
    pageLock={y:window.scrollY,body:document.body.getAttribute('style'),html:document.documentElement.style.overflow};
    document.body.style.position='fixed';document.body.style.top=-pageLock.y+'px';document.body.style.left='0';document.body.style.right='0';document.body.style.width='100%';
    document.documentElement.style.overflow='hidden';
  };
  const unlockPage=()=>{
    if(!pageLock)return;
    const saved=pageLock;pageLock=null;
    if(saved.body===null)document.body.removeAttribute('style');else document.body.setAttribute('style',saved.body);
    document.documentElement.style.overflow=saved.html;
    window.scrollTo({top:saved.y,left:0,behavior:'instant'});
  };
  const openCar = card => {
    const name = $('h3', card).textContent.trim();
    const specs = (card.dataset.specs || '').split('|').filter(Boolean);
    specs.unshift('Класс: ' + $('.car-class', card).textContent.trim());
    $('#modal-title').textContent = name; $('#modal-image').src = card.dataset.image || '/assets/logo.webp'; $('#modal-image').alt = card.dataset.image ? name : 'Фотография автомобиля уточняется';
    $('.modal-media span').textContent = $('.car-status', card).textContent;
    $('#modal-specs').innerHTML = specs.map(x => `<span>${x}</span>`).join('');
    $('.modal-quiz').dataset.purpose = 'Хочу выкупить авто';
    $('.modal-quiz').dataset.car = name;
    lockPage(); modal.showModal();
  };
  $$('.car-card').forEach(card => {
    card.addEventListener('click', () => openCar(card));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCar(card); } });
  });
  const closeModal = () => { modal.close(); unlockPage(); };
  $('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('close', unlockPage);
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

