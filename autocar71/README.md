# autocar71.ru — технический слой лендинга

Этап 1 договора № 17/09-2026 — «Каркас проекта»: базовая структура, основные экраны
и связи между ними + технический каркас обработки заявок.

Сам лендинг собирается в **Tilda Publishing (Zero Block)**. В этом репозитории лежит
всё остальное: приёмник заявок, модули для вставки в Tilda, конфиги nginx и парсер витрины.

- **Демо-страница для заказчика:** [`../docs/autocar71/`](../docs/autocar71/) —
  кликабельный прототип со всеми экранами, витриной, квизом и сборкой JSON-пакета заявки.

```
autocar71/
├─ server/     Node.js приёмник заявок: POST /lead, очередь, доставка в MAX
├─ tilda/      JS/CSS-модули, которые вставляются в Tilda, и кастомная 404
├─ nginx/      склейка доменов-зеркал и проксирование /lead
├─ scripts/    парсер витрины investauto71.ru и подготовка фото
└─ data/       срез витрины (cars.json), который заполняет парсер
```

---

## 1. Почему заявки принимает свой сервер, а не готовый коннектор

В компании действует SLA: первый контакт с лидом за 15 минут. Потеря UTM-меток при
редиректе или задержка доставки считаются браком работы. Готовые коннекторы
(Albato / Make) этого не гарантируют, поэтому:

- `POST /lead` отвечает `200 OK` **до любой внешней сети** — Tilda считает заявку
  доставленной по коду ответа, а доставка в MAX идёт асинхронно;
- лид пишется в SQLite **до первой попытки отправки**, поэтому перезапуск процесса
  и падение VPS не теряют ни одной заявки;
- ретраи по экспоненте (1с → 3с → 10с → 30с → 2м → 5м → 15м, максимум 8 попыток);
- если MAX молчит дольше 10 минут — резервное уведомление ответственному,
  чтобы SLA не сгорел молча.

---

## 2. Развёртывание на VPS с нуля

Требуется: Ubuntu 22.04+ / Debian 12+, 1 ГБ RAM, Node.js 20+ (рекомендуется 22 LTS).

```bash
# --- Node.js 22 ---
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx

# --- Пользователь и каталоги ---
sudo useradd --system --home /opt/autocar-lead --shell /usr/sbin/nologin autocar
sudo mkdir -p /opt/autocar-lead /var/lib/autocar-lead /var/log/autocar-lead
sudo chown -R autocar:autocar /var/lib/autocar-lead /var/log/autocar-lead

# --- Код ---
sudo git clone <repo> /opt/autocar-lead
cd /opt/autocar-lead/server
sudo cp .env.example .env && sudo nano .env      # заполнить секреты
sudo chown -R autocar:autocar /opt/autocar-lead
sudo chmod 600 .env

# --- Сервис ---
sudo cp systemd/autocar-lead.service /etc/systemd/system/
sudo cp systemd/autocar-lead.logrotate /etc/logrotate.d/autocar-lead
sudo systemctl daemon-reload
sudo systemctl enable --now autocar-lead
sudo systemctl status autocar-lead

# --- nginx + SSL ---
sudo cp ../nginx/autocar71.conf /etc/nginx/sites-available/
sudo cp ../nginx/mirrors.conf   /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/autocar71.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/mirrors.conf   /etc/nginx/sites-enabled/
sudo certbot --nginx -d autocar71.ru -d www.autocar71.ru
sudo certbot --nginx -d avtocar71.ru -d www.avtocar71.ru
sudo certbot --nginx -d xn--71-6kcaj2c1aso.xn--p1ai -d www.xn--71-6kcaj2c1aso.xn--p1ai
sudo nginx -t && sudo systemctl reload nginx
```

> На Node.js 22 очередь использует встроенный `node:sqlite`, поэтому в systemd-юните
> стоит флаг `--experimental-sqlite`. На Node.js 24+ флаг можно убрать. Если предпочитаете
> нативный драйвер — `npm i better-sqlite3`, код подхватит его автоматически.

### Smoke-тест после установки

```bash
# 1. Сервис жив
curl -s https://autocar71.ru/health | jq

# 2. Заявка принимается и отвечает быстрее 200 мс
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  -X POST https://autocar71.ru/lead \
  -d "phone=8 953 970-88-77&purpose=Работа в такси&qualifies=Да&channel=MAX&consent=on&utm_source=test&utm_term=arenda"

# 3. Склейка доменов: ровно один 301 и полная query-строка
curl -sIL "http://avtocar71.ru/old/page?utm_source=yandex&utm_term=arenda" | grep -iE "^(HTTP|location)"
```

---

## 3. Что подключается в Tilda

| Файл | Куда вставлять | Зачем |
|---|---|---|
| `tilda/multilanding.js` | **только HEAD** | подмена H1 под метку до первой отрисовки |
| `tilda/utm.js` | начало BODY | сохранность UTM через якоря и открытие квиза |
| `tilda/quiz.css` + `tilda/quiz.js` | блок T123 с `<div id="ac71-quiz"></div>` | квиз-генератор заявок |
| `tilda/sticky-bar.js` | конец BODY | прилипающая панель «Звонок / Чат», только мобильная |
| `tilda/recaptcha-init.js` | конец BODY | reCAPTCHA v3, site key |
| `tilda/metrika-goals.js` | конец BODY | цели Метрики и сбор аудиторий |
| `tilda/404.html` | настройки сайта → страница 404 | кастомная 404 с кнопкой в каталог |

Перед вставкой задать глобальные переменные (блок HTML выше модулей):

```html
<script>
  window.AC71_LEAD_ENDPOINT = 'https://autocar71.ru/lead';
  window.AC71_POLICY_URL = 'https://autocar71.ru/privacy';
  window.AC71_METRIKA_ID = 00000000;            // ID счётчика Метрики
  window.AC71_RECAPTCHA_SITE_KEY = '6Lc...';    // публичный site key
</script>
```

Цели Метрики, которые отправляют модули: `quiz_start`, `quiz_step`, `form_submit`,
`lead_submit`, `phone_click`, `messenger_click`.

---

## 4. Наполнение витрины из investauto71.ru

```bash
node scripts/parse-investauto.js          # → data/cars.json
node scripts/parse-investauto.js --dry    # посмотреть результат без записи
npm i -D sharp && node scripts/images.js  # фото: 3:2, WebP + JPEG, 1080 и 640 px
```

Парсер отдаёт по каждой машине марку, модель, год, топливо, КПП, класс, цену,
ссылку на карточку и ссылки на фото. Класс определяется эвристикой по модели —
перед публикацией прайса его подтверждает менеджер.

Если каталог-источник поменяет вёрстку, правится только объект `SELECTORS`
в начале `scripts/parse-investauto.js`; на этот разбор есть тест на фикстуре.

---

## 5. Тесты

```bash
cd server && npm test        # 12 тестов: нормализация, очередь, HTTP-приём
node --test scripts/test/parse.test.js
```

Покрыты критерии приёмки из ТЗ:

| Критерий ТЗ | Тест |
|---|---|
| №1 `POST /lead` отвечает 200 OK быстрее 200 мс при недоступном MAX | `server/test/server.test.js` |
| №1 лид не теряется и уходит после восстановления связи | `server/test/queue.test.js` |
| №2 перезапуск с непустой очередью не теряет заявок | `server/test/queue.test.js` |
| №5 итоговый пакет содержит все ответы + канал + телефон + UTM | `server/test/normalize.test.js` |
| №6 «Нет, не прохожу» → `qualifies:false`, отдельный поток | `server/test/normalize.test.js` |
| идемпотентность: повтор в пределах минуты не создаёт второй лид | `server/test/queue.test.js` |
| разбор витрины investauto71.ru | `scripts/test/parse.test.js` |

Критерии №3 (склейка доменов), №4 (подмена H1), №7 (PageSpeed), №8 (safe-area),
№10 (цели Метрики) проверяются на опубликованной странице — команды в разделе 2
и в чек-листе ниже.

---

## 6. Безопасность и 152-ФЗ

- reCAPTCHA v3 проверяется **на сервере**, secret только в `.env`.
- Rate limit: 10 заявок с одного IP за 10 минут (и лимит на уровне nginx).
- Флаг согласия и версия политики пишутся в каждый лид.
- IP хранится только хэшем (`sha256` с солью `IP_SALT`), сырой IP в пакет не попадает.
- Логи с ПДн ротируются 30 дней (`systemd/autocar-lead.logrotate`), телефон в логе
  маскируется до последних 4 цифр.
- `.env` в репозиторий не коммитится (`server/.gitignore`).

---

## 7. Что нужно от заказчика для запуска

| Доступ | Без него не работает |
|---|---|
| API-токен корпоративного MAX + ID чатов | доставка лидов — главный узел SLA 15 минут |
| VPS / хостинг (Node.js 20+, 1 ГБ RAM) | обработчик заявок |
| Доступ к DNS всех доменов | склейка зеркал и выпуск SSL |
| Гостевой доступ к Tilda | сборка лендинга и вставка модулей |
| Доступ к Яндекс.Метрике и Вебмастеру | цели, ретаргетинг, гео-привязка |
| Site key + secret reCAPTCHA v3 | защита форм от спама |
| Текст политики обработки ПДн | ссылка в форме и подвале (типовой текст уже подготовлен) |

**Критический путь:** токен MAX и VPS. До их получения сервер работает на мок-транспорте:
вся цепочка (приём → очередь → ретраи → health) тестируется, в MAX ничего не уходит.

---

## 8. Чек-лист приёмки Этапа 1

- [x] Приёмник заявок: `POST /lead` (200 OK < 200 мс), `GET /health`
- [x] Единый JSON-пакет: контакты + 4 ответа квиза + UTM + reCAPTCHA + согласие + маршрутизация
- [x] Квалификация на сервере: «не прохожу» → `qualifies:false`, `priority:"cold"`, отдельный поток в MAX
- [x] Персистентная очередь SQLite, ретраи по экспоненте, dead-letter после 8 попыток
- [x] Резервное уведомление, если MAX недоступен дольше 10 минут
- [x] Идемпотентность по ключу «телефон + минута + шаг»
- [x] Rate limit, хэширование IP, ротация логов, секреты только в `.env`
- [x] Модули Tilda: UTM, мультилендинг, квиз, sticky-bar, reCAPTCHA, цели Метрики
- [x] Кастомная 404 с кнопкой «Вернуться в каталог авто»
- [x] nginx: склейка зеркал с `$is_args$args`, проксирование `/lead`, инструкция по SSL
- [x] Парсер витрины investauto71.ru → `cars.json` + подготовка фото
- [x] Демо-страница для заказчика: все экраны, витрина, квиз, карта, политика ПДн
- [ ] Боевой прогон доставки в MAX — после получения токена и VPS
- [ ] PageSpeed ≥ 90 на опубликованном домене — замер после публикации в Tilda
