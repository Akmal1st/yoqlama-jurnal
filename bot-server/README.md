# Umumiy Telegram bot serveri

Hamma o'qituvchilar bitta botdan foydalanadi. O'qituvchi ilovada **«✈️ Telegram'ni ulash»** tugmasini bosadi, Telegram ochiladi
va ilova o'zi ulanadi. Bot tokeni faqat shu serverda turadi, ilovada va saytda ko'rinmaydi.

Server Cloudflare'da bepul ishlaydi (Workers + D1). Zaxira, rasm va PDF serverda saqlanmaydi, faqat Telegram'ga uzatiladi.
D1 bazasida faqat o'qituvchilar ro'yxati (Telegram ID, ism), kalitlarning izi va ota-onalar guruhlari turadi.

## O'rnatish (bir marta, ~15 daqiqa)

1. **Bot yarating.** Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → nom va `..._bot` manzil.
   Bergan **tokenni** saqlab qo'ying.
2. **Telegram ID'ingizni bilib oling.** [@userinfobot](https://t.me/userinfobot) ga `/start` yozing, u raqam beradi (masalan `57680595`).
   Bu raqam admin bo'ladi.
3. **Cloudflare akkaunti.** [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) da bepul ro'yxatdan o'ting.
4. **Baza.** Chap menyu → *Storage & Databases* → *D1 SQL Database* → *Create* → nomi `jurnal-bot` → *Create*.
5. **Server.** Chap menyu → *Workers & Pages* → *Create* → *Worker* (Hello World) → nomi `jurnal-bot` → *Deploy*.
   So'ng *Edit code* → hamma kodni o'chirib, [`worker.js`](worker.js) faylining butun matnini qo'ying → *Deploy*.
6. **Bazani ulash.** Worker sahifasi → *Bindings* → *Add binding* → *D1 database* → Variable name: `DB`, database: `jurnal-bot` → *Add*.
7. **Maxfiy sozlamalar.** Worker → *Settings* → *Variables and Secrets* → *Add*:
   - `BOT_TOKEN` (turi **Secret**) — 1-qadamdagi token;
   - `SETUP_SECRET` (turi **Secret**) — o'zingiz o'ylab topgan uzun so'z, masalan `olma-qovun-2026-jurnal`;
   - `ADMIN_IDS` (turi **Text**) — 2-qadamdagi ID. Bir nechta admin bo'lsa, vergul bilan: `57680595,123456789`.
8. **Ishga tushirish.** Brauzerda oching (o'z manzilingiz va so'zingiz bilan):
   `https://jurnal-bot.<sizning-nomingiz>.workers.dev/setup?s=<SETUP_SECRET>`
   Javobda `"ok": true` va botingiz nomi chiqsa — tayyor.
9. **Ilovaga ulash.** Worker manzilini (`https://jurnal-bot.….workers.dev`) Claude'ga yuboring — u `docs/tg-umumiy.js` dagi
   `URL0` ga yoziladi va saytda «✈️ Telegram'ni ulash» tugmasi paydo bo'ladi.
   (Sinab ko'rish uchun brauzer konsolida: `localStorage.setItem("yoqlama_tgu_url", "https://jurnal-bot.….workers.dev")`.)

## Admin

Botda `/start` yozing — pastda faqat sizga ko'rinadigan tugmalar chiqadi:

- **👥 O'qituvchilar** — ro'yxat, har biri yonida 🚫 bloklash / ↩ blokdan chiqarish / ✅ tasdiqlash.
- **🟢 Tasdiqsiz ulanish ⇄ 🔒 Tasdiq bilan** — odatda o'qituvchi darhol ulanadi va sizga «ulandi» xabari keladi.
  «Tasdiq bilan» rejimida har bir yangi o'qituvchini siz tasdiqlaysiz.
- **📈 Holat** — nechta o'qituvchi, guruh.

Bloklangan o'qituvchining hamma qurilmalaridagi kalitlari darhol bekor bo'ladi.

## Qanday ishlaydi

| Manzil | Kim chaqiradi | Nima qiladi |
|---|---|---|
| `GET /go/<t>` | ilova (tugma) | `t` ni yozadi va `t.me/<bot>?start=<t>` ga yo'naltiradi |
| `POST /tg` | Telegram (webhook) | `/start <t>` → o'qituvchini ulaydi, kalit yaratadi; admin tugmalari; bot guruhga qo'shilsa — guruhni eslab qoladi |
| `GET /link/<t>` | ilova (har 2 soniyada) | ulanish holati; kalit faqat bir marta beriladi |
| `POST /api/<usul>` | ilova | `_k` kalitni tekshiradi, `chat_id` faqat o'z chati yoki o'zi qo'shgan guruh bo'lsa, Telegram'ga uzatadi |
| `GET /setup?s=…` | admin (bir marta) | jadvallar, webhook, bot buyruqlari |

Ruxsat etilgan usullar: `sendMessage`, `sendPhoto`, `sendDocument`, `pinChatMessage`, `unpinChatMessage`, `deleteMessage`,
`deleteMessages`, `editMessageReplyMarkup`, `getChat` (faqat o'z chati), `getMe`, `myGroups` (o'qituvchi qo'shgan guruhlar).

Bepul Cloudflare cheklovlari (kuniga 100 000 so'rov, D1 da 100 000 yozuv) yuzlab o'qituvchiga yetadi.

Testlar: `node --test tests/bot_server.test.mjs` (server) va `tests/ui.test.mjs` dagi «Umumiy Telegram bot» (ilova + server).
