# Yo'qlama jurnali

Bu dastur o'qituvchilar uchun. Unda yo'qlama, kundalik baholar, BSB/CHSB, chorak va yillik baholar yuritiladi. Hisobotlar chiqarish va emaktab bilan ishlash ham mumkin.

**Dastur: web ilova.** Manzil: https://akmal1st.github.io/yoqlama-jurnal/ (telefonda «Bosh ekranga qo'shish»). Python'dagi kompyuter dasturi va Python Telegram bot 2026-11-08 da olib tashlandi; eski kodi git tarixida qoladi. Ularning `journal.json` fayllarini web ilova hamon ochadi (Sozlamalar → Ma'lumotlar → yuklash).

| Papka | Nima bor |
|---|---|
| `docs/` | **Web ilova** (kompyuter va telefonda brauzerda ishlaydi, internetsiz). GitHub Pages shu papkadan sayt qiladi. |
| `bot-server/` | Umumiy Telegram bot serveri (Google Apps Script `gas/`, Cloudflare varianti `worker.js`) |
| `tests/` | Hisob-kitob va brauzer testlari |

## Ishga tushirish

- **Web ilova:** `docs/index.html` faylini brauzerda oching. Telefonda sayt manzilini oching va «Bosh ekranga qo'shish» tugmasini bosing.
- **emaktab.uz dan import:** Sozlamalar → Ma'lumotlar → «emaktab.uz saytidan to'g'ridan-to'g'ri» → «📒 emaktab → Jurnal» tugmasini xatcho'plar paneliga sudrang. Keyin emaktab'ga kirib, «Sinflarim» sahifasida shu xatcho'pni bosing. Joriy chorak jurnallari ilovaga keladi, login/parol hech qayerga uzatilmaydi. Bu usul faqat sayt manzilidan ochilgan ilovada ishlaydi, `docs/index.html` faylidan ochilganda ishlamaydi.
- **Telegram bot:** o'rnatish [bot-server/README.md](bot-server/README.md) da.

## Testlar

- `tests/fixtures/journal.json`: to'qima test ma'lumotlari.
- `tests/inputs.json`: test qilinadigan kirish qiymatlari (belgilar, ballar, KTR matni, emaktab varag'i).
- `tests/golden.json`, `tests/hisobot_golden.json`: **to'g'ri javoblar**. Web ilova har safar shularga solishtiriladi.

```
npm test          # hisob-kitoblar
npm run test:ui   # brauzerda (npx playwright install chromium kerak)
```

Har bir yuklashda GitHub Actions bu testlarni o'zi ishga tushiradi.

Hisob-kitob qoidasi **ataylab** o'zgartirilsa:

1. Web ilovani o'zgartiring.
2. `node tests/make_golden.mjs` (va kerak bo'lsa `node tests/make_hisobot_golden.mjs`) bilan to'g'ri javoblarni yangilang.
3. `git diff tests/` da faqat kutilgan qiymatlar o'zgarganini tekshiring.

## Web ilovani yangilash

`docs/index.html` faylini o'zgartirgandan keyin `docs/sw.js` ichidagi `VERSION` qiymatini oshiring. Shunda o'rnatilgan ilovalar yangi versiyani oladi.
