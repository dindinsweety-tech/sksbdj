/* Проверка разбора карточки каталога на фикстуре — источник недоступен в CI,
   но структура разметки та же. Запуск: node --test scripts/test/parse.test.js */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCards } from '../parse-investauto.js';

const FIXTURE = `
<div class="catalog">
  <article class="car-card">
    <a href="/cars/granta-2024"><img data-src="/upload/granta-1.jpg" alt=""></a>
    <img data-src="/upload/granta-2.jpg" alt="">
    <h3 class="car-card__title">Lada Granta 2024</h3>
    <div class="params">1.6 л, МКПП, бензин</div>
    <div class="price">от 2 000 ₽ в сутки</div>
  </article>
  <article class="car-card">
    <a href="/cars/solaris-hc-2024"><img src="https://investauto71.ru/upload/solaris.webp" alt=""></a>
    <h3 class="car-card__title">Hyundai Solaris HC 2024</h3>
    <div class="params">1.6 л, АКПП, бензин — под заказ</div>
    <div class="price">от 3 600 ₽ в сутки</div>
  </article>
</div>`;

test('карточки каталога разбираются в структуру для витрины', () => {
  const cars = parseCards(FIXTURE, 'https://investauto71.ru/');
  assert.equal(cars.length, 2);

  const granta = cars[0];
  assert.equal(granta.title, 'Lada Granta 2024');
  assert.equal(granta.slug, 'lada-granta-2024');
  assert.equal(granta.brand, 'Lada');
  assert.equal(granta.year, '2024');
  assert.equal(granta.engine, '1.6');
  assert.equal(granta.transmission, 'МКПП');
  assert.equal(granta.fuel, 'бензин');
  assert.equal(granta.price_per_day, 2000);
  assert.equal(granta.deposit, 25000);
  assert.equal(granta.in_stock, true);
  assert.equal(granta.url, 'https://investauto71.ru/cars/granta-2024');
  assert.deepEqual(granta.images, [
    'https://investauto71.ru/upload/granta-1.jpg',
    'https://investauto71.ru/upload/granta-2.jpg'
  ], 'относительные ссылки на фото приводятся к абсолютным');

  const solaris = cars[1];
  assert.equal(solaris.in_stock, false, '«под заказ» снимает наличие');
  assert.equal(solaris.deposit, 100000, 'для авто под заказ депозит 100 000 ₽');
  assert.equal(solaris.class, 'comfort');
});

test('пустая страница не роняет парсер', () => {
  assert.deepEqual(parseCards('<html><body>нет карточек</body></html>'), []);
});
