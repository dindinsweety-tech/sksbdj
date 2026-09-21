(() => {
  const key = 'autocar71_privacy_v1';
  const panel = document.querySelector('.cookie-panel');
  const widgets = [...document.querySelectorAll('.external-widget')];
  let allowed = false;
  function loadWidget(el) {
    if (el.querySelector('iframe')) return;
    const frame = document.createElement('iframe');
    frame.src = el.dataset.src; frame.loading = 'lazy';
    frame.title = el.dataset.widget === 'map' ? 'Карта проезда к Автокар71' : 'Отзывы об Автокар71 на Яндексе';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    el.querySelector('.widget-placeholder').hidden = true;
    el.append(frame);
  }
  const watcher = new IntersectionObserver(items => items.forEach(item => { if (allowed && item.isIntersecting) loadWidget(item.target); }), {rootMargin:'160px'});
  widgets.forEach(w => watcher.observe(w));
  function apply(value) {
    allowed = value;
    widgets.forEach(el => {
      if (!value) { el.querySelector('iframe')?.remove(); el.querySelector('.widget-placeholder').hidden = false; }
      else { watcher.unobserve(el); watcher.observe(el); }
    });
  }
  function save(value) { try {localStorage.setItem(key, JSON.stringify({external:value,version:'2026-09-21',at: new Date().toISOString()}));} catch (_) {} apply(value); panel.hidden = true; }
  try {const saved = JSON.parse(localStorage.getItem(key)); if(saved?.version === '2026-09-21') apply(saved.external === true); else panel.hidden = false;} catch (_) {panel.hidden = false;}
  document.querySelector('#cookies-allow').addEventListener('click', () => save(true));
  document.querySelector('#cookies-decline').addEventListener('click', () => save(false));
  document.querySelectorAll('.cookie-settings').forEach(b => b.addEventListener('click', () => {panel.hidden=false; document.querySelector('#cookies-decline').focus();}));
  widgets.forEach(el => el.querySelector('.widget-enable').addEventListener('click', () => loadWidget(el)));
})();
