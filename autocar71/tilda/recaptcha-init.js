/* recaptcha-init.js — reCAPTCHA v3 на стороне страницы.
   Site key публичный и лежит здесь; secret key — только в .env на сервере,
   проверка score выполняется в обработчике заявок.

   Перед публикацией подставить свой site key. */
(function () {
  'use strict';
  var SITE_KEY = window.AC71_RECAPTCHA_SITE_KEY || 'ЗАМЕНИТЬ_НА_SITE_KEY';
  if (SITE_KEY.indexOf('ЗАМЕНИТЬ') === 0) return;

  var s = document.createElement('script');
  s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(SITE_KEY);
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);

  /** Токен получаем непосредственно перед отправкой: он живёт 2 минуты. */
  window.AC71_RECAPTCHA = {
    token: function (action) {
      action = action || 'quiz_submit';
      return new Promise(function (resolve) {
        if (!window.grecaptcha || !window.grecaptcha.ready) { resolve(null); return; }
        var done = false;
        var finish = function (v) { if (!done) { done = true; resolve(v); } };
        setTimeout(function () { finish(null); }, 3000);
        window.grecaptcha.ready(function () {
          window.grecaptcha.execute(SITE_KEY, { action: action }).then(finish, function () { finish(null); });
        });
      });
    }
  };
})();
