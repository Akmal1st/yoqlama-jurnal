# Yo'qlama jurnali

Bu dastur o'qituvchilar uchun. Unda yo'qlama, kundalik baholar, BSB/CHSB, chorak va yillik baholar yuritiladi. Hisobotlar chiqarish va emaktab bilan ishlash ham mumkin.

| Papka | Nima bor |
|---|---|
| `docs/` | **Web ilova** (kompyuter va telefonda brauzerda ishlaydi, internetsiz). GitHub Pages shu papkadan sayt qiladi. |
| `dastur/` | **Kompyuter dasturi** (PySide6): `yoqlama_jurnal.py`, yangi ko'rinish `yoqlama_jurnal2.py`, Telegram bot `emaktab_tgbot.py` |
| `tests/` | Hisob-kitoblar testlari |

## Ishga tushirish

- **Web ilova:** `docs/index.html` faylini brauzerda oching. Telefonda sayt manzilini oching va «Bosh ekranga qo'shish» tugmasini bosing.
- **Kompyuter dasturi:**
  1. `pip install PySide6 pandas xlrd openpyxl` buyrug'ini bajaring.
  2. `python dastur/yoqlama_jurnal2.py` buyrug'i bilan oching. Eski ko'rinish `yoqlama_jurnal.py` bilan ochiladi.
- **Telegram bot:**
  1. `dastur/bot.env.example` faylini `dastur/bot.env` nomi bilan nusxalang va to'ldiring.
  2. `python dastur/emaktab_tgbot.py` buyrug'i bilan ishga tushiring.
  3. `bot.env` faylini hech qachon repozitoriyaga qo'shmang.

Ikkala dastur ham bitta `journal.json` faylidan foydalanadi. Faylni web ilovada «Sozlamalar → Ma'lumotlar» bo'limida yuklab olish yoki yuklash mumkin.

## Testlar

Bir xil hisob-kitob ikki joyda yozilgan: Python'da (kompyuter dasturi) va JavaScript'da (web ilova). Testlar ikkalasining bir xil natija berishini tekshiradi.

- `tests/fixtures/journal.json`: to'qima test ma'lumotlari.
- `tests/inputs.json`: test qilinadigan kirish qiymatlari (belgilar, ballar, KTR matni, emaktab varag'i).
- `tests/golden.json`: kompyuter dasturi hisoblagan **to'g'ri javoblar**.

```
cd tests && python -m pytest -q test_python.py   # kompyuter dasturi
npm test                                          # web ilova
npm run test:ui                                   # brauzerda (npx playwright install chromium kerak)
```

Har bir yuklashda GitHub Actions bu testlarni o'zi ishga tushiradi.

Hisob-kitob qoidasi **ataylab** o'zgartirilsa, quyidagi tartibda ishlang:

1. Avval kompyuter dasturini o'zgartiring.
2. `python tests/make_golden.py` buyrug'i bilan to'g'ri javoblarni yangilang.
3. Web ilovani `npm test` o'tguncha moslang.

## Web ilovani yangilash

`docs/index.html` faylini o'zgartirgandan keyin `docs/sw.js` ichidagi `VERSION` qiymatini oshiring. Shunda o'rnatilgan ilovalar yangi versiyani oladi.
