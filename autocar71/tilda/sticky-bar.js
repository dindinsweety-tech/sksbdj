/* sticky-bar.js — прилипающая панель «Звонок» и «Чат».
   Только мобильная версия: от 720px скрывается.
   Обязательно учитывает env(safe-area-inset-bottom) на iPhone с «чёлкой»
   и добавляет нижний padding телу страницы, чтобы панель не перекрывала
   контент и кнопку отправки квиза. */
(function () {
  'use strict';
  var PHONE = '+79539708877';
  var CHAT = 'https://max.ru/u/79539708877';

  if (document.querySelector('.ac71-bar')) return;

  var css = document.createElement('style');
  css.textContent = [
    '.ac71-bar{position:fixed;left:0;right:0;bottom:0;z-index:9000;display:none;',
      'grid-template-columns:1fr 1fr;gap:8px;padding:9px 10px calc(9px + env(safe-area-inset-bottom));',
      'background:rgba(17,17,17,.96);backdrop-filter:blur(10px)}',
    '.ac71-bar a{display:flex;align-items:center;justify-content:center;gap:8px;min-height:55px;',
      'border-radius:12px;font:700 16px/1 Inter,Arial,sans-serif;text-decoration:none;',
      'transition:transform .15s ease}',
    '.ac71-bar a:active{transform:scale(.98)}',
    '.ac71-bar .ac71-call{background:#333;color:#fff}',
    '.ac71-bar .ac71-chat{background:#FFC800;color:#1A1A1A}',
    '@media(max-width:719px){.ac71-bar{display:grid}',
      'body{padding-bottom:calc(74px + env(safe-area-inset-bottom))!important}}'
  ].join('');
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.className = 'ac71-bar';
  bar.setAttribute('aria-label', 'Быстрые действия');
  bar.innerHTML =
    '<a class="ac71-call" href="tel:' + PHONE + '" data-ac71-goal="phone_click">' +
      '<span aria-hidden="true">&#9742;</span>Позвонить</a>' +
    '<a class="ac71-chat" href="' + CHAT + '" target="_blank" rel="noopener" data-ac71-goal="messenger_click">' +
      '<span aria-hidden="true">&#128172;</span>Написать в MAX</a>';
  document.body.appendChild(bar);
})();
