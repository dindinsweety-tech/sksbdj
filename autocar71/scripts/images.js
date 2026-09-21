#!/usr/bin/env node
/* images.js — скачивание и подготовка фото автомобилей из data/cars.json.
   Каждое фото: обрезка под карточку витрины 3:2, WebP + JPEG-фоллбек,
   две ширины (1080 и 640) для srcset. Раскладка: data/img/<slug>/.

   Запуск: node scripts/images.js
   Требуется sharp: npm i -D sharp  (единственная зависимость этого скрипта). */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const IN = resolve(process.argv[2] || 'data/cars.json');
const OUT_DIR = resolve('data/img');
const WIDTHS = [1080, 640];
const RATIO = 3 / 2;

const loadSharp = async () => {
  try { return (await import('sharp')).default; }
  catch {
    process.stderr.write('Нужен sharp: npm i -D sharp\n');
    process.exit(1);
  }
};

const download = async url => {
  const res = await fetch(url, { headers: { 'User-Agent': 'autocar71-sync/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

const main = async () => {
  const sharp = await loadSharp();
  const { cars } = JSON.parse(await readFile(IN, 'utf8'));
  const manifest = [];

  for (const car of cars) {
    const dir = join(OUT_DIR, car.slug);
    await mkdir(dir, { recursive: true });
    const files = [];

    for (const [i, url] of car.images.entries()) {
      try {
        const buf = await download(url);
        for (const w of WIDTHS) {
          const h = Math.round(w / RATIO);
          const base = sharp(buf).rotate().resize(w, h, { fit: 'cover', position: 'centre' });
          const name = `${String(i + 1).padStart(2, '0')}-${w}`;
          await base.clone().webp({ quality: 72, effort: 6 }).toFile(join(dir, `${name}.webp`));
          await base.clone().jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(join(dir, `${name}.jpg`));
          files.push(`${car.slug}/${name}.webp`);
        }
        process.stderr.write(`  ✓ ${car.slug} #${i + 1}\n`);
      } catch (err) {
        process.stderr.write(`  ✗ ${car.slug} #${i + 1}: ${err.message}\n`);
      }
    }
    manifest.push({ slug: car.slug, title: car.title, files });
  }

  await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stderr.write(`Готово. Файлы: ${OUT_DIR}\n`);
};

main().catch(err => { process.stderr.write(`Ошибка: ${err.message}\n`); process.exitCode = 1; });
