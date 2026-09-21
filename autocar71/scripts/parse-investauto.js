#!/usr/bin/env node
/* parse-investauto.js — сбор актуальной витрины с investauto71.ru в data/cars.json.
   Результат используется для ручного наполнения карточек в Tilda и для повторной
   сверки цен при обновлении прайса.

   Запуск:
     node scripts/parse-investauto.js                 # обычный прогон
     node scripts/parse-investauto.js --dry           # без записи файла
     node scripts/parse-investauto.js --url=https://… # другой источник

   Зависимостей нет: HTML разбирается регулярками по разметке каталога.
   Если вёрстка источника поменяется — правится только объект SELECTORS ниже. */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const BASE = args.url || 'https://investauto71.ru/';
const OUT = resolve(args.out || 'data/cars.json');
const UA = 'Mozilla/5.0 (compatible; autocar71-sync/1.0; +https://autocar71.ru/)';

/* Разметку карточки держим в одном месте: меняется только здесь. */
const SELECTORS = {
  /* Карточку ищем по открывающему тегу, а кусок берём до следующей карточки:
     непарный поиск до </div> ломается на вложенных блоках внутри карточки. */
  cardOpen: /<(?:article|div|li)[^>]*class="[^"]*(?:car-card|catalog__item|catalog-item|product-card)[^"]*"[^>]*>/gi,
  title: /<(?:h2|h3|a)[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([\s\S]*?)<\//i,
  price: /(\d[\d\s  ]{2,})\s*(?:₽|руб)/i,
  link: /href="([^"]+)"/i,
  image: /(?:data-src|data-original|src)="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi,
  /* Кириллица: \b работает только по ASCII, поэтому границы слов задаём
     через Unicode-lookaround — иначе «1.6 л,» и «бензин» не находятся. */
  year: /(?<!\d)(19[89]\d|20[0-3]\d)(?!\d)/,
  transmission: /(?<!\p{L})(АКПП|МКПП|автомат\p{L}*|механик\p{L}*|вариатор|робот)/iu,
  fuel: /(?<!\p{L})(ГБО|бензин\p{L}*|дизел\p{L}*|газ\p{L}*|метан|пропан|гибрид|электро\p{L}*)/iu,
  engine: /(\d[.,]\d)\s*(?:л|l)(?!\p{L})/iu
};

/* Класс — эвристика по модели, совпадает с разбивкой витрины на лендинге.
   Перед публикацией прайса класс подтверждает менеджер. */
const CLASS_RULES = [
  { test: /(granta|rio|logan|polo|nexia|almera)/i, cls: 'economy' },
  { test: /(solaris|vesta|octavia|camry|optima|\bk5\b|sonata|monza|tiggo|haval)/i, cls: 'comfort' }
];

const strip = html => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const slugify = s => s.toLowerCase()
  .replace(/[аеёиоуыэюя]/g, m => ({ а:'a',е:'e',ё:'e',и:'i',о:'o',у:'u',ы:'y',э:'e',ю:'yu',я:'ya' }[m]))
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

const absolute = (url, base) => { try { return new URL(url, base).href; } catch { return null; } };

const fetchText = async url => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
};

export const parseCards = (html, base = BASE) => {
  const starts = [...html.matchAll(SELECTORS.cardOpen)].map(m => m.index);
  const cards = starts.map((from, i) => html.slice(from, starts[i + 1] ?? html.length));
  const seen = new Set();
  const out = [];

  for (const raw of cards) {
    const text = strip(raw);
    const titleMatch = raw.match(SELECTORS.title);
    const title = titleMatch ? strip(titleMatch[1]) : text.slice(0, 60);
    if (!title || title.length < 3) continue;

    const slug = slugify(title);
    if (seen.has(slug)) continue;
    seen.add(slug);

    const priceMatch = text.match(SELECTORS.price);
    const price = priceMatch ? Number(priceMatch[1].replace(/[\s ]/g, '')) : null;
    const images = [...raw.matchAll(SELECTORS.image)]
      .map(m => absolute(m[1], base))
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6);
    const linkMatch = raw.match(SELECTORS.link);
    const brandModel = title.replace(SELECTORS.year, '').trim();
    const cls = (CLASS_RULES.find(r => r.test.test(title)) || {}).cls || 'economy';

    out.push({
      slug,
      title,
      brand: brandModel.split(/\s+/)[0] || null,
      model: brandModel.split(/\s+/).slice(1).join(' ') || null,
      year: (title.match(SELECTORS.year) || text.match(SELECTORS.year) || [])[1] || null,
      engine: (text.match(SELECTORS.engine) || [])[1] || null,
      fuel: (text.match(SELECTORS.fuel) || [])[1] || null,
      transmission: (text.match(SELECTORS.transmission) || [])[1] || null,
      class: cls,
      price_per_day: price,
      price_label: price ? `от ${price.toLocaleString('ru-RU')} ₽ / сутки · аренда / выкуп` : null,
      deposit: /под заказ|новый/i.test(text) ? 100000 : 25000,
      in_stock: !/под заказ/i.test(text),
      url: linkMatch ? absolute(linkMatch[1], base) : null,
      images
    });
  }
  return out;
};

const main = async () => {
  process.stderr.write(`Источник: ${BASE}\n`);
  const html = await fetchText(BASE);
  const cars = parseCards(html, BASE);

  if (!cars.length) {
    process.stderr.write('Карточки не найдены: вероятно, изменилась вёрстка источника — поправьте SELECTORS.\n');
    process.exitCode = 2;
    return;
  }

  const payload = {
    source: BASE,
    fetched_at: new Date().toISOString(),
    count: cars.length,
    cars
  };

  process.stderr.write(`Найдено автомобилей: ${cars.length}\n`);
  cars.forEach(c => process.stderr.write(`  · ${c.title} — ${c.price_label || 'цена не распознана'} (${c.images.length} фото)\n`));

  if (args.dry) { process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`); return; }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stderr.write(`Записано: ${OUT}\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { process.stderr.write(`Ошибка: ${err.message}\n`); process.exitCode = 1; });
}
