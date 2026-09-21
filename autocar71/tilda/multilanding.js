/* multilanding.js — динамическая подмена H1 под рекламную метку.
   Подключать ТОЛЬКО в <head> (Tilda: «Настройки сайта → Ещё → HEAD»),
   до первой отрисовки, иначе виден дефолтный заголовок и текст «мигает».

   Правило подбора: вхождение подстроки в utm_campaign / utm_term / utm_content. */
(function () {
  'use strict';

  var DEFAULT_H1 = 'Автомобили под такси и личные цели с правом выкупа от 1800 ₽/сутки';
  var RULES = [
    { match: 'arenda', h1: 'Аренда автомобилей под такси и личные цели от 10 дней и 1800 ₽/сутки' },
    { match: 'vikup',  h1: 'Автомобили под выкуп от 1800 ₽/сутки. Одобрение с любой КИ' },
    { match: 'vykup',  h1: 'Автомобили под выкуп от 1800 ₽/сутки. Одобрение с любой КИ' },
    { match: 'taxi',   h1: 'Автомобили под такси с правом выкупа от 1800 ₽/сутки' }
  ];
  /* Подзаголовок по ТЗ постоянный, меняется только H1. */
  var SELECTOR = '[data-ac71-h1], .t-title, h1';

  function pickH1() {
    try {
      var p = new URLSearchParams(location.search);
      var haystack = [p.get('utm_campaign'), p.get('utm_term'), p.get('utm_content')]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack) return null;
      for (var i = 0; i < RULES.length; i++) {
        if (haystack.indexOf(RULES[i].match) > -1) return RULES[i].h1;
      }
    } catch (e) {}
    return null;
  }

  var target = pickH1();
  window.AC71_H1 = target || DEFAULT_H1;
  if (!target) return;

  /* Прячем hero до подмены, чтобы дефолтный текст не успел показаться. */
  var style = document.createElement('style');
  style.setAttribute('data-ac71', 'h1-guard');
  style.textContent = '[data-ac71-h1],.t-title{visibility:hidden}';
  (document.head || document.documentElement).appendChild(style);

  function apply() {
    var nodes = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.tagName === 'H1' || el.hasAttribute('data-ac71-h1')) { el.textContent = target; break; }
    }
    if (style.parentNode) style.parentNode.removeChild(style);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  /* Страховка: если Tilda отрисовала Zero Block позже — снимаем guard в любом случае. */
  setTimeout(apply, 1200);
})();
