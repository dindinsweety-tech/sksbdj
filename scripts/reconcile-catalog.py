"""Reconcile the demo cards with InvestAuto71's public catalog (30 Sep 2026)."""
from pathlib import Path
import re

page = Path(__file__).resolve().parents[1] / 'index.html'
html = page.read_text()
cards = re.findall(r'          <article class="car-card.*?          </article>', html, re.S)
assert len(cards) == 15, len(cards)

photos = {
    1: 'granta-2023', 3: 'solaris-2021', 4: 'rio-2013',
    5: 'rio-2020', 8: 'granta-2024-a', 9: 'granta-2024-b',
    10: 'granta-2024-c', 11: 'granta-2024-d',
    12: 'solaris-hc-2024', 13: 'solaris-hs-2024',
    14: 'rio-2021-a', 15: 'rio-2021-b',
}

for i, card in enumerate(cards, 1):
    if i in photos:
        source = f'/assets/real-cars/{photos[i]}.webp'
        card = re.sub(r'data-image="[^"]*"', f'data-image="{source}"', card, count=1)
        card = re.sub(r'<img loading="lazy".*? alt="([^"]*)">',
                      lambda m: f'<img loading="lazy" src="{source}" width="1600" height="1000" alt="{m.group(1)}">', card, count=1)
    if i == 5:  # The source catalog describes this 2020 Rio as 1.6 manual.
        card = card.replace('2020 год|1.4 л|АКПП|бензин', '2020 год|1.6 л|МКПП|бензин')
        card = card.replace('<li>1.4 л</li><li>АКПП</li>', '<li>1.6 л</li><li>МКПП</li>')
    if i == 6:  # Vesta is supplied in the client's newer message, but has no source photo.
        card = re.sub(r'data-image="[^"]*"', 'data-image=""', card, count=1)
        card = re.sub(r'<img loading="lazy".*? alt="[^"]*">',
                      '<div class="photo-pending" role="img" aria-label="Фото Lada Vesta уточняется"><span>Фото автомобиля уточняется</span></div>', card, count=1)
    if i in (14, 15):
        card = card.replace('Solaris HS 2024', 'Kia Rio 2021')
        card = card.replace('2024 год|1.6 л|МКПП|бензин', '2021 год|1.4 л|АКПП|бензин')
        card = card.replace('<li>2024 год</li><li>1.6 л</li><li>МКПП</li>', '<li>2021 год</li><li>1.4 л</li><li>АКПП</li>')
        card = card.replace('от 2 295 ₽', 'от 2 500 ₽')
        card = card.replace('class="comfort"', 'class="comfort"')
    if i >= 8:
        card = card.replace(f'<span class="car-index">{i:02}</span>', f'<span class="car-index">{i-1:02}</span>')
    cards[i-1] = card

# The second 2023 Granta is not in the source inventory. Its photograph is a Kia.
cards[6] = ''
for original in re.findall(r'          <article class="car-card.*?          </article>', html, re.S):
    replacement = cards.pop(0)
    html = html.replace(original, replacement, 1)

html = html.replace('Все авто <b>15</b>', 'Все авто <b>14</b>')
html = html.replace('Эконом <b>9</b>', 'Эконом <b>8</b>')
html = html.replace('/app.js?v=20260930-review-1', '/app.js?v=20260930-catalog-1')
html = html.replace('/refinement.css?v=20260930-review-1', '/refinement.css?v=20260930-catalog-1')
page.write_text(html)
