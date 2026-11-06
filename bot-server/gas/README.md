# Umumiy Telegram bot — Google Apps Script serveri

Cloudflare'ning `workers.dev` manzili O'zbekistonda VPN'siz ochilmadi, Google manzillari esa ochiladi.
Shuning uchun server Google Apps Script'da ishlaydi: bepul, domen kerak emas, Google akkaunti yetarli.
Mantiq Cloudflare varianti (`../worker.js`) bilan bir xil. Bot tokeni faqat shu yerda turadi.

## O'rnatish (bir marta, ~10 daqiqa)

Bot allaqachon bor bo'lsa (@YoqlamaJurnalbot), 1-qadamni o'tkazib yuboring.

1. **Bot.** [@BotFather](https://t.me/BotFather) → `/newbot` → tokenni saqlang.
2. **Loyiha.** [script.google.com](https://script.google.com) → **Yangi loyiha** (New project).
   Nomini `jurnal-bot` qiling. `Code.gs` ichidagi hamma narsani o'chirib, [`Code.gs`](Code.gs) faylining
   butun matnini qo'ying (GitHub'da **Raw** → hammasini belgilash → nusxa) → 💾 Saqlash.
3. **Sozlamalar.** Chapdagi ⚙️ **Project Settings** → pastda **Script Properties** → **Add script property**, uchta qator:
   - `BOT_TOKEN` — bot tokeni;
   - `ADMIN_IDS` — Telegram ID'ingiz (masalan `5466056709`), bir nechta bo'lsa vergul bilan;
   - `SETUP_SECRET` — o'zingiz o'ylagan uzun so'z.
   → **Save script properties**.
4. **Chiqarish.** Tepada **Deploy → New deployment** → ⚙️ yonidan **Web app** ni tanlang:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   → **Deploy** → Google ruxsat so'raydi: **Authorize access** → akkauntingiz → *Advanced* → *Go to jurnal-bot (unsafe)* → **Allow**.
   (Bu sizning o'z skriptingiz, «unsafe» degani faqat Google tekshirmagan degani.)
   Oxirida **Web app URL** chiqadi: `https://script.google.com/macros/s/…/exec` — nusxa oling.
5. **Ishga tushirish.** Brauzerda oching: `<Web app URL>?a=setup&s=<SETUP_SECRET>`
   Javobda `"ok":true` va bot nomi chiqsa — tayyor. Bu qadam har daqiqalik triggerni ham o'zi qo'shadi.
   Manzilning o'zi ochilganda `"v"` (kod versiyasi) va `"tick":true` (trigger bor) ko'rinadi.
6. **Ilovaga ulash.** Web app URL ni Claude'ga yuboring — u `docs/tg-umumiy.js` dagi `URL0` ga yoziladi.

> Cloudflare'da ham shu bot ulangan bo'lsa, u endi kerak emas: 5-qadam Telegram webhook'ini o'chiradi.
> Bitta botni bir vaqtda ikki joyda ishlatmang.

## Kodni yangilash

Code.gs o'zgarsa: matnni almashtiring → Saqlash → **Deploy → Manage deployments** → ✏️ → *Version*: **New version** → **Deploy**.
Shunda manzil o'zgarmaydi. («New deployment» yangi manzil beradi — uni ishlatmang.)

## Admin

Botda `/start` → pastda faqat sizga: **👥 O'qituvchilar** (🚫 bloklash / ↩ / ✅ tasdiqlash), **🟢 Tasdiqsiz ulanish ⇄ 🔒 Tasdiq bilan**, **📈 Holat**.
Apps Script'da webhook ishlamaydi, shuning uchun bot xabarlarni o'zi har daqiqada tekshiradi: admin tugmalari **1 daqiqagacha**
kechikib javob beradi. O'qituvchi ulanayotganda esa ilova har 2 soniyada so'raydi — ulanish bir necha soniyada bo'ladi.

## Qanday ishlaydi

| So'rov | Kim | Nima |
|---|---|---|
| `POST {a:"new", t, d}` | ilova (tugma bosilganda) | ulanish havolasini va qurilma nomini yozadi; Telegram `t.me/<bot>?start=<t>` bilan ochiladi |
| `GET ?a=link&t=…` | ilova (har 2 soniyada) | yangi xabarlarni oladi (`/start <t>`), holatni qaytaradi; kalit bir marta beriladi |
| `POST {a:"api", k, m, p, f}` | ilova | kalitni va `chat_id` ni tekshirib Telegram'ga uzatadi; fayllar `f` da base64 |
| `POST {a:"api", k, m:"backupFile"}` | ilova (boshqa qurilmada tiklash) | o'z chatidagi qadalgan zaxira faylini o'qib beradi — shu sabab chatga «📦1/11 H4sI…» matn bo'laklari yuborilmaydi |
| `GET ?a=setup&s=…` | admin, bir marta | webhook'ni o'chiradi, buyruqlar, har daqiqalik `tick` trigger |
| `tick()` | trigger, har daqiqada | admin tugmalari, guruhga qo'shilish, eski havolalarni tozalash |

Ma'lumot **Script Properties** da: `u:<id>` o'qituvchi, `k:<sha256>` kalit izi, `l:<t>` ulanish, `g:<uid>` guruhlar, `c:*` holat.
Zaxira, rasm va PDF saqlanmaydi — faqat uzatiladi.

Bepul Google limitlari (kuniga 20 000 tashqi so'rov, trigger uchun 90 daqiqa) o'nlab-yuzlab o'qituvchiga yetadi.

Testlar: `node --test tests/gas_server.test.mjs` va `tests/ui.test.mjs` dagi «Umumiy bot (Google serveri)».
