# Yo'qlama jurnali

Bu dastur o'qituvchilar uchun. Unda yo'qlama, kundalik baholar, BSB/CHSB, chorak va yillik baholar yuritiladi. Hisobotlar chiqarish va emaktab bilan ishlash ham mumkin.

**Asosiy dastur: web ilova.** Barcha yangi imkoniyatlar (guruhlar, to'lovlar, hisobotlar, Telegram zaxira, yangi dizayn) avval va faqat web ilovada chiqadi. Manzil: https://akmal1st.github.io/yoqlama-jurnal/ (telefonda «Bosh ekranga qo'shish»). Kompyuter dasturi (`dastur/`) qo'shimcha sifatida saqlanadi: u eski imkoniyatlarni biladi, lekin guruhlar va to'lovlarni bilmaydi.

| Papka | Nima bor |
|---|---|
| `docs/` | **Asosiy dastur: web ilova** (kompyuter va telefonda brauzerda ishlaydi, internetsiz). GitHub Pages shu papkadan sayt qiladi. |
| `dastur/` | Qo'shimcha: kompyuter dasturi (PySide6): `yoqlama_jurnal.py`, yangi ko'rinish `yoqlama_jurnal2.py`, Telegram bot `emaktab_tgbot.py` (jurnal qismi `jurnal_bot.py`) |
| `tests/` | Hisob-kitoblar testlari |

## Ishga tushirish

- **Web ilova:** `docs/index.html` faylini brauzerda oching. Telefonda sayt manzilini oching va «Bosh ekranga qo'shish» tugmasini bosing.
- **emaktab.uz dan import (web ilova):** Sozlamalar → Ma'lumotlar → «emaktab.uz saytidan to'g'ridan-to'g'ri» → «📒 emaktab → Jurnal» tugmasini xatcho'plar paneliga sudrang. Keyin emaktab'ga kirib, «Sinflarim» sahifasida shu xatcho'pni bosing. Joriy chorak jurnallari ilovaga keladi, login/parol hech qayerga uzatilmaydi. Bu usul faqat sayt manzilidan ochilgan ilovada ishlaydi, `docs/index.html` faylidan ochilganda ishlamaydi.
- **Kompyuter dasturi:**
  1. `pip install PySide6 pandas xlrd openpyxl` buyrug'ini bajaring.
  2. `python dastur/yoqlama_jurnal2.py` buyrug'i bilan oching. Eski ko'rinish `yoqlama_jurnal.py` bilan ochiladi.
- **Telegram bot:**
  1. `dastur/bot.env.example` faylini `dastur/bot.env` nomi bilan nusxalang va to'ldiring.
  2. `python dastur/emaktab_tgbot.py` buyrug'i bilan ishga tushiring.
  3. `bot.env` faylini hech qachon repozitoriyaga qo'shmang.
  4. Ixtiyoriy: @BotFather → botingiz → **Bot Settings → Inline Mode → Turn on**. Shunda istalgan chatda `@bot_nomi Ali` deb yozib, o'quvchi natijasini yuborish mumkin.

  Botda jurnalni Telegram'ning o'zida yuritish mumkin: «📅 Bugun» (bugungi darslar, yo'qlama tugmalari, «✓ Hamma keldi»), baholash (1–10, ikkinchi baho), dars mavzusi va uy vazifasi, «📒 Jurnal» (sinf ko'rsatkichlari, jadval, xavf ostidagilar, o'quvchi kartochkasi, ota-onaga tayyor xabar), kunlik yo'qlama eslatmasi. Pastdagi «📒 Ilova» tugmasi web ilovani Telegram ichida ochadi (manzil `WEBAPP_URL`). Web ilova bilan almashish fayl orqali: ilovadagi zaxira faylini botga yuborasiz, botdan «📤 Faylni olish» bilan qaytarib olasiz. Har foydalanuvchining jurnali `dastur/foydalanuvchilar/<ID>/journal.db` da (kompyuter dasturi bilan bir xil format) va har kuni nusxasi qoladi.

Kompyuter dasturi ma'lumotni `journal.db` (SQLite) faylida saqlaydi; eski `journal.json` birinchi ishga tushishda o'zi ko'chiriladi (`journal.json.eski` nomi bilan saqlanib qoladi). Zaxira va bulut nusxalari, shuningdek web ilova bilan almashish hamon JSON formatida: web ilovada «Sozlamalar → Ma'lumotlar» bo'limida yuklab olish yoki yuklash mumkin. Telegram bot holati `bot_holat.db` da.

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
