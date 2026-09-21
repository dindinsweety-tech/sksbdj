/* utm.js — сохранность рекламных меток.
   Подключать в Tilda первым, в «Начало BODY» или в HEAD.

   Метки берутся из адресной строки при первом заходе, кладутся в sessionStorage
   и подставляются в скрытые поля всех форм. Живут через якоря, открытие квиза
   и переходы внутри лендинга — именно это страхует потерю UTM и сохраняет CPL. */
(function () {
  'use strict';
  var KEY = 'ac71_utm';
  var FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'yclid', 'gclid', 'ymclid', 'fbclid', 'roistat'];

  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { return {}; }
  }
  function write(data) {
    try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  var stored = read();
  var params = new URLSearchParams(location.search);
  FIELDS.forEach(function (k) {
    var v = params.get(k);
    if (v) stored[k] = v;
  });
  if (!stored.referrer) stored.referrer = document.referrer || '';
  if (!stored.landing_url) stored.landing_url = location.href;
  if (!stored.first_visit_at) stored.first_visit_at = new Date().toISOString();
  write(stored);

  /** Публичный доступ: window.AC71_UTM.get() */
  window.AC71_UTM = {
    get: function () { return read(); },
    /** Дописывает скрытые поля в форму (Tilda отдаёт их в webhook как обычные поля). */
    fill: function (form) {
      if (!form || form.__ac71Filled) return;
      var data = read();
      Object.keys(data).forEach(function (name) {
        var input = form.querySelector('input[name="' + name + '"]');
        if (!input) {
          input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          form.appendChild(input);
        }
        input.value = data[name];
      });
      form.__ac71Filled = true;
    },
    fillAll: function () {
      var self = this;
      Array.prototype.forEach.call(document.querySelectorAll('form'), function (f) { self.fill(f); });
    }
  };

  function run() { window.AC71_UTM.fillAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  /* Tilda дорисовывает формы асинхронно — повторяем ещё пару раз. */
  setTimeout(run, 800);
  setTimeout(run, 2500);
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.tagName === 'FORM') window.AC71_UTM.fill(e.target);
  }, true);
})();
