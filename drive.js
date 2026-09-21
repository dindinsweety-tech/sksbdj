(() => {
  const story = document.querySelector('#drive-story');
  const stage = document.querySelector('#drive-stage');
  if (!story || !stage) return;

  const cars = [
    {id:'01',model:'Lada Granta',specs:'2023 · МКПП · бензин + газ',price:'от 1 800 ₽ / сутки'},
    {id:'02',model:'Hyundai Solaris',specs:'2020 · АКПП · бензин + газ',price:'от 2 500 ₽ / сутки'},
    {id:'03',model:'Kia Rio',specs:'2013 · МКПП',price:'условия по запросу'},
    {id:'04',model:'Kia Rio',specs:'2021 · АКПП',price:'условия по запросу'},
    {id:'05',model:'Lada Granta',specs:'автомобиль из парка',price:'условия по запросу'},
    {id:'06',model:'Solaris HC',specs:'2024 · МКПП',price:'условия по запросу'}
  ];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const mobile = matchMedia('(max-width:720px)').matches;
  const requiredCars = cars.slice(0, mobile ? 3 : 6);
  const state = {active:false,ready:false,raf:0,lastY:scrollY,lastT:performance.now(),velocity:0,distance:0,index:-1,wheels:false,quality:3,fpsFrames:0,fpsStart:0,mask:''};
  const sharp = stage.querySelector('.drive-car-sharp');
  const wheels = stage.querySelector('.drive-car-wheels');
  const shadow = stage.querySelector('.drive-shadow');
  const status = document.querySelector('#drive-status');
  const controls = stage.querySelector('.drive-controls');

  const url = (id, suffix='') => `assets/drive/car-${id}${suffix}.webp`;
  const loadImage = src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const setCopy = index => {
    const car = requiredCars[index];
    document.querySelector('#drive-number').textContent = car.id;
    document.querySelector('#drive-model').textContent = car.model;
    document.querySelector('#drive-specs').textContent = car.specs;
    document.querySelector('#drive-price').textContent = car.price;
  };
  const showCar = index => {
    if (!state.ready || index === state.index) return;
    state.index = index;
    const car = requiredCars[index];
    sharp.style.opacity = '0';
    shadow.style.opacity = '0';
    setTimeout(() => {
      sharp.src = url(car.id);
      wheels.src = url(car.id,'-wheels');
      shadow.src = `assets/drive/shadow-${car.id}.webp`;
      state.mask = `url("${url(car.id)}")`;
      setCopy(index);
      sharp.style.opacity = '';
      shadow.style.opacity = '';
    }, 190);
  };
  const setStatic = message => {
    stage.dataset.quality = 'static';
    status.textContent = message;
    controls.hidden = !reduced;
    setCopy(Math.max(0,state.index));
  };
  const prepare = async () => {
    if (state.ready || reduced || lowPower) return;
    status.textContent = 'Загрузка сцены…';
    const backgroundUrls = ['sky.webp','far-0.webp','far-1.webp','far-2.webp','near-0.webp','near-1.webp','near-2.webp'];
    const base = await Promise.all([
      ...backgroundUrls.map(name=>loadImage(`assets/drive/${name}`)),loadImage(url(requiredCars[0].id)),
      loadImage(url(requiredCars[0].id,'-wheels')),loadImage(`assets/drive/shadow-${requiredCars[0].id}.webp`)
    ]);
    if (base.some(x => !x)) return setStatic('Ожидаются подготовленные ассеты');
    state.ready = true;
    stage.dataset.quality = 'full';
    status.hidden = true;
    showCar(0);
    requiredCars.slice(1).forEach(car => {
      loadImage(url(car.id)); loadImage(url(car.id,'-wheels')); loadImage(`assets/drive/shadow-${car.id}.webp`);
    });
  };
  const degrade = () => {
    state.quality -= 1;
    if (state.quality === 2) stage.classList.add('no-shine');
    if (state.quality === 1) stage.classList.add('no-bounce');
    if (state.quality <= 0) { state.ready = false; setStatic('Статичный режим для стабильной работы'); }
  };
  const frame = now => {
    if (!state.active || !state.ready) return;
    const dt = Math.min(48, now - state.lastT);
    const y = scrollY;
    const rawVelocity = (y - state.lastY) / Math.max(1,dt);
    state.velocity += (rawVelocity - state.velocity) * Math.min(1,dt / 130);
    if (Math.abs(rawVelocity) < .015) state.velocity *= Math.pow(.08,dt / 800);
    state.distance += state.velocity * dt;
    state.lastY = y; state.lastT = now;
    const rect = story.getBoundingClientRect();
    const progress = Math.max(0,Math.min(1,-rect.top / Math.max(1,rect.height-innerHeight)));
    const index = Math.min(requiredCars.length-1,Math.floor(progress*requiredCars.length));
    showCar(index);
    const speed = Math.min(1,Math.abs(state.velocity)/1.35);
    if (!state.wheels && speed>.26) state.wheels=true;
    if (state.wheels && speed<.16) state.wheels=false;
    const phase=state.distance*.012;
    const bounce=stage.classList.contains('no-bounce')?0:Math.sin(phase)*3*speed;
    const rotate=stage.classList.contains('no-bounce')?0:Math.sin(phase*.73)*.3*speed;
    const tile=innerWidth*1.5;
    const mod=(value,size)=>((value%size)+size)%size;
    const direction=-state.distance;
    const medium=Math.min(1,speed*1.55), strong=Math.max(0,(speed-.45)/.55);
    const shine=stage.classList.contains('no-shine')?0:speed*.42;
    stage.style.cssText = `--sky-image:url("assets/drive/sky.webp");--far-0:url("assets/drive/far-0.webp");--far-1:url("assets/drive/far-1.webp");--far-2:url("assets/drive/far-2.webp");--near-0:url("assets/drive/near-0.webp");--near-1:url("assets/drive/near-1.webp");--near-2:url("assets/drive/near-2.webp");--car-mask:${state.mask};--sky-x:${-mod(direction*.08,tile)}px;--far-x:${-mod(direction*.35,tile)}px;--near-x:${-mod(direction,tile)}px;--car-y:${bounce}px;--car-r:${rotate}deg;--shadow-y:${-bounce*.35}px;--blur-medium:${medium};--blur-strong:${strong};--wheels:${state.wheels?1:0};--shine:${shine};--shine-x:${-80+mod(state.distance*.08,180)}%;`;
    state.fpsFrames++;
    if (!state.fpsStart) state.fpsStart=now;
    if (now-state.fpsStart>=2000) {
      const fps=state.fpsFrames*1000/(now-state.fpsStart);
      if (fps<50) degrade();
      state.fpsFrames=0; state.fpsStart=now;
    }
    state.raf=requestAnimationFrame(frame);
  };
  const preloadObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { prepare(); preloadObserver.disconnect(); }
  },{rootMargin:'150% 0px'});
  preloadObserver.observe(story);
  const observer = new IntersectionObserver(entries => {
    const visible=entries[0].isIntersecting;
    if (visible) prepare();
    if (visible && state.ready && !reduced) {
      state.active=true; state.lastY=scrollY; state.lastT=performance.now();
      stage.classList.add('is-active'); state.raf=requestAnimationFrame(frame);
    } else {
      state.active=false; cancelAnimationFrame(state.raf); stage.classList.remove('is-active');
    }
  },{threshold:.01});
  observer.observe(story);
  if (reduced || lowPower) setStatic(reduced?'Движение отключено в настройках':'Статичный режим для вашего устройства');
  let manual=0;
  const manualShow=delta=>{manual=(manual+delta+requiredCars.length)%requiredCars.length;state.index=-1;if(state.ready)showCar(manual);else setCopy(manual)};
  document.querySelector('#drive-prev').addEventListener('click',()=>manualShow(-1));
  document.querySelector('#drive-next').addEventListener('click',()=>manualShow(1));
})();
