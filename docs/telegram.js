/* Telegram: avtomatik zaxira, qurilmalar orasida almashish (sinx.js bilan birlashtirish) va shifrlash.
   index.html dagi asosiy skriptdan OLDIN ulanadi; undagi nomlar (D, save, render, toast, modal, …) faqat chaqirilganda ishlatiladi.
   Umumiy bot — tg-umumiy.js, PDF yuborish — pdf-tg.js. */
"use strict";
// O'qituvchining o'z boti: token faqat shu brauzerda saqlanadi (journal.json ga yozilmaydi).
// Zaxira botga fayl bo'lib boradi va qadab qo'yiladi; boshqa qurilma qadalgan faylni ko'rib, yangiroq bo'lsa yuklashni taklif qiladi.
const TG_KEY = "yoqlama_tg", TG_GAP = 2 * 36e5;
function tgCfg() { try { return JSON.parse(localStorage.getItem(TG_KEY)) || {}; } catch (e) { return {}; } }
function tgSet(p) { const c = Object.assign(tgCfg(), p); try { localStorage.setItem(TG_KEY, JSON.stringify(c)); } catch (e) {} return c; }
const tgOn = () => { const c = tgCfg(); return !!((c.token || c.key) && c.chat); };   // key — umumiy bot (tg-umumiy.js)
function tgDev() { let c = tgCfg(); if (!c.dev) c = tgSet({dev: Math.random().toString(36).slice(2, 8)}); return c.dev; }
const tgAge = () => { const l = tgCfg().last; return tgOn() && l ? Math.floor((Date.now() - Date.parse(l)) / 864e5) : null; };
const djb = (t) => { let x = 5381; for (let i = 0; i < t.length; i++) x = (x * 33 ^ t.charCodeAt(i)) >>> 0; return x.toString(36) + t.length; };
// Bot API so'rovi «oddiy» ko'rinishda (form yoki FormData): JSON sarlavhasi brauzerni avval OPTIONS so'rovini yuborishga majbur qilardi,
// ba'zi tarmoqlarda u o'tmay «Telegram'ga ulanib bo'lmadi» chiqardi
// Umumiy bot ulangan bo'lsa (tgCfg().key), so'rov Cloudflare serveriga boradi: u kalitni tekshirib, Telegram'ga uzatadi (tg-umumiy.js)
async function tgApi(method, params, token = tgCfg().token) {
  let body = params instanceof FormData ? params : new URLSearchParams(Object.entries(params || {}).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)]));
  const key = !token && tgCfg().key;
  if (key && TGU.gas()) body = await TGU.pack(method, body, key);   // Google serveri: JSON matn
  else if (key) { body.delete("_k"); body.append("_k", key); }
  const url = key ? TGU.api(method) : `https://api.telegram.org/bot${token}/${method}`;
  for (let k = 0; ; k++) {
    const r = await tgFetch(url, {method: "POST", body});
    const j = await r.json().catch(() => ({}));
    if (j.ok) return j.result;
    // ko'p xabar ketma-ket ketganda Telegram «biroz kuting» deydi — kutib, qayta yuboramiz
    const w = j.parameters && j.parameters.retry_after;
    if (j.error_code === 429 && w && w <= 30 && k < 3) { await new Promise((ok) => setTimeout(ok, w * 1000 + 300)); continue; }
    throw new Error(j.description || `Telegram javob bermadi (${r.status})`);
  }
}
// tarmoq xatosi: bir marta qayta urinadi, so'ng sababini aniqlab tushunarli xabar beradi
async function tgFetch(url, opt = {}, ms = 25000) {
  for (let k = 0; ; k++) {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms);
    try { return await fetch(url, Object.assign({}, opt, {signal: ac.signal})); }
    catch (e) { if (k) throw await tgNetErr(e); await new Promise((r) => setTimeout(r, 1500)); }
    finally { clearTimeout(tm); }
  }
}
async function tgNetErr(e) {
  if (navigator.onLine === false) return Object.assign(new Error("Internet yo'q — ulanib, qayta urinib ko'ring"), {net: "off"});
  let reach = false;
  try { await fetch(tgCfg().key ? TGU.url() + "/" : "https://api.telegram.org/", {mode: "no-cors", cache: "no-store"}); reach = true; } catch (x) { /* server ochilmadi */ }
  if (reach) return Object.assign(new Error("Telegram serveri ochildi, lekin brauzer javobni qabul qilmadi — sahifani yangilab, qayta urinib ko'ring"), {net: "cors"});
  return Object.assign(new Error(e && e.name === "AbortError" ? "Telegram javob bermadi (vaqt tugadi) — internet sekin yoki Telegram tarmog'ingizda to'silgan. VPN yoqib, qayta urinib ko'ring"
    : "Telegram serveriga ulanib bo'lmadi — internetni tekshiring. Telegram ilovasi VPN bilan ishlasa, brauzerda ham VPN yoqing"), {net: "down"});
}
const tgErrTxt = (e) => e.net ? e.message : "Telegram: " + e.message;
let TG_NEW = null, tgBusy = false; // TG_NEW — boshqa qurilmadan kelgan yangiroq zaxira (Bugun sahifasida taklif qilinadi)
// Telegram fayl manzili (api.telegram.org/file/…) brauzerga CORS ruxsatini bermaydi — faylni qaytarib o'qib bo'lmaydi.
// Shuning uchun o'z botida zaxira yana siqilgan matn bo'laklari bo'lib xabar sifatida ham boradi; bot API usullari esa CORS bilan ishlaydi.
// Umumiy botda bo'laklar kerak emas: server faylni o'zi o'qib beradi (backupFile).
const TG_PART = 4000, TG_MAXP = 60;
const b64u = (u8) => { let t = ""; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (t) => { const b = atob(t.replace(/-/g, "+").replace(/_/g, "/")), u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); return u8; };
async function gzipTxt(t) { return new Uint8Array(await new Response(new Blob([t]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()); }
async function gunzipTxt(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).text(); }
/* Zaxirani parol bilan shifrlash (ixtiyoriy): PBKDF2-SHA256 → AES-GCM 256, brauzerning o'z crypto.subtle vositasi.
   Telegram akkauntiga begona kirsa ham o'quvchilar ma'lumoti o'qilmaydi.
   Parolning o'zi saqlanmaydi: undan yasalgan kalit IndexedDB'da «chiqarib bo'lmaydigan» (non-extractable) CryptoKey bo'lib turadi —
   brauzer u bilan shifrlaydi, lekin kalitni ham, parolni ham hech kim (sahifa kodi ham) o'qiy olmaydi. Tuz (kslt) zaxiraga yoziladi,
   boshqa qurilma parol + shu tuzdan xuddi shu kalitni yasaydi. IndexedDB ishlamasa — eski usul: parol shu qurilmada saqlanadi. */
const SEAL_ITER = 310000;
async function sealKey(pass, salt, use) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name: "PBKDF2", salt, iterations: SEAL_ITER, hash: "SHA-256"}, base, {name: "AES-GCM", length: 256}, false, [].concat(use));
}
async function sealWith(txt, key, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, new TextEncoder().encode(txt)));
  return JSON.stringify({type: "jurnal-sealed", v: 1, salt, iv: b64u(iv), ct: b64u(ct)});
}
async function sealTxt(txt, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return sealWith(txt, await sealKey(pass, salt, "encrypt"), b64u(salt));
}
const isSealed = (d) => !!d && d.type === "jurnal-sealed";
async function unsealWith(d, key) {
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({name: "AES-GCM", iv: unb64u(d.iv)}, key, unb64u(d.ct))); }
  catch (e) { throw new Error("Parol noto'g'ri yoki zaxira buzilgan"); }
}
async function unsealTxt(d, pass) {
  let key; try { key = await sealKey(pass, unb64u(d.salt), "decrypt"); } catch (e) { throw new Error("Parol noto'g'ri yoki zaxira buzilgan"); }
  return unsealWith(d, key);
}
// shifrlash yoqilganmi: yangi usul (kslt — kalit IndexedDB'da) yoki eski usul (pass)
const tgEnc = (c = tgCfg()) => !!(c.kslt || c.pass);
const TGK = {key: null, salt: null};
async function tgKeyGet() {
  const s = tgCfg().kslt; if (!s) return null;
  if (TGK.key && TGK.salt === s) return TGK.key;
  try { const k = IDB.db && await idbReq("kv", "readonly", (st) => st.get("tg_key")); if (k) { TGK.key = k; TGK.salt = s; return k; } } catch (e) { /* yo'q */ }
  return null;
}
// paroldan kalit yasab, IndexedDB'ga saqlash; salt berilsa (boshqa qurilma zaxirasidan) — o'sha tuz bilan
async function tgKeySet(pass, salt) {
  salt = salt || b64u(crypto.getRandomValues(new Uint8Array(16)));
  if (IDB.db) {
    try {
      const key = await sealKey(pass, unb64u(salt), ["encrypt", "decrypt"]);
      await idbReq("kv", "readwrite", (st) => st.put(key, "tg_key"));
      TGK.key = key; TGK.salt = salt;
      const c = tgCfg(); delete c.pass; c.kslt = salt; localStorage.setItem(TG_KEY, JSON.stringify(c));
      return;
    } catch (e) { console.warn("Telegram kaliti:", e); }
  }
  const c = tgCfg(); delete c.kslt; c.pass = pass; localStorage.setItem(TG_KEY, JSON.stringify(c));   // IndexedDB yo'q — eski usul
}
async function tgKeyDrop() {
  TGK.key = null; TGK.salt = null;
  try { if (IDB.db) await idbReq("kv", "readwrite", (st) => st.delete("tg_key")); } catch (e) { /* */ }
}
// zaxirani shifrlash: saqlangan kalit bilan; eski usulda saqlangan ochiq parol birinchi zaxirada kalitga almashtiriladi
async function tgSeal(txt) {
  let c = tgCfg();
  if (c.pass && IDB.db) { await tgKeySet(c.pass); c = tgCfg(); }
  if (c.kslt) { const key = await tgKeyGet(); if (key) return sealWith(txt, key, c.kslt); }
  if (c.pass) return sealTxt(txt, c.pass);
  throw new Error("Shifrlash kaliti topilmadi (brauzer xotirasi tozalangan bo'lishi mumkin). «Sozlamalar → Ma'lumotlar»da parolni qayta kiriting.");
}
// shifrlangan zaxirani ochish: saqlangan kalit (yoki eski usuldagi parol) bilan, bo'lmasa so'raladi (3 marta)
async function openSealed(d) {
  if (!isSealed(d)) return d;
  const c = tgCfg();
  if (c.kslt && c.kslt === d.salt) { const key = await tgKeyGet(); if (key) try { return JSON.parse(await unsealWith(d, key)); } catch (e) { /* so'raymiz */ } }
  if (c.pass) try { return JSON.parse(await unsealTxt(d, c.pass)); } catch (e) { /* parol o'zgargan — so'raymiz */ }
  for (let i = 0; i < 3; i++) {
    const p = await ask("Shifrlangan zaxira", i ? "Parol noto'g'ri. Qayta kiriting:" : "Bu zaxira parol bilan shifrlangan. Parolni kiriting:", "", "password");
    if (p === null) throw new Error("Parol kiritilmadi — zaxira yuklanmadi");
    try { const out = JSON.parse(await unsealTxt(d, p)); if (tgOn()) await tgKeySet(p, d.salt); return out; } catch (e) { /* yana */ }
  }
  throw new Error("Parol noto'g'ri — zaxira yuklanmadi");
}
const tgBtn = () => ({inline_keyboard: [[{text: "📒 Ilovani ochish", url: `https://akmal1st.github.io/yoqlama-jurnal/#${Date.now().toString(36)}`}]]});
// Umumiy bot serveri qadalgan zaxira faylini o'zi o'qib bera oladimi (backupFile usuli; eski server o'rnatilgan bo'lsa — yo'q).
// Shunda matn bo'laklari umuman yuborilmaydi: chatda faqat zaxira fayli qoladi (Akmal, 2026-11-06: «📦1/11 H4sI…» xabarlari tushunarsiz).
let TG_FSRV = null;
async function tgSrvFile() {
  if (!tgCfg().key) return false;
  if (tgCfg().fsrv) return true;
  if (TG_FSRV !== null) return TG_FSRV;
  try { await tgApi("backupFile", {file_id: "-"}); TG_FSRV = true; }
  catch (e) { if (e.net) return false; TG_FSRV = !/ruxsat yo'q/.test(e.message); }
  if (TG_FSRV) tgSet({fsrv: 1});
  return TG_FSRV;
}
// Bo'laklar yig'iq (bosilganda ochiladigan) iqtibos ichida boradi: chatda har biri bitta qisqa qator bo'lib ko'rinadi
async function tgSendParts(chat, json) {
  if (typeof CompressionStream === "undefined") return [];
  if (await tgSrvFile()) return [];
  const z = b64u(await gzipTxt(json)), n = Math.ceil(z.length / TG_PART), ids = [];
  if (n > TG_MAXP) return [];
  for (let i = 0; i < n; i++) {
    const m = await tgApi("sendMessage", {chat_id: chat, parse_mode: "HTML", text: `📦 Zaxira nusxasi ${i + 1}/${n} — boshqa qurilmada tiklash uchun. O'chirmang, keyingi zaxirada o'zi o'chadi.\n<blockquote expandable>${z.slice(i * TG_PART, (i + 1) * TG_PART)}</blockquote>`, disable_notification: true, reply_markup: tgBtn()});
    ids.push(m.message_id);
  }
  return ids;
}
// bo'lak matnidan ma'lumot qismi: yangi usulda oxirgi qatorda, eski usulda («📦1/11 H4sI…») birinchi bo'shliqdan keyin
const tgPartData = (t) => { t = String(t || "").replace(/<[^>]*>/g, "").trim(); const i = t.lastIndexOf("\n"); return i >= 0 ? t.slice(i + 1).trim() : t.slice(t.indexOf(" ") + 1); };
// o'z xabarining matnini qaytarib olish: tugmani yangilash (editMessageReplyMarkup) butun xabarni qaytaradi
async function tgReadParts(ids) {
  const chat = tgCfg().chat, out = [];
  for (let i = 0; i < ids.length; i += 5) {
    const ms = await Promise.all(ids.slice(i, i + 5).map((id) => tgApi("editMessageReplyMarkup", {chat_id: chat, message_id: id, reply_markup: tgBtn()})));
    for (const m of ms) out.push(tgPartData(m.text));
  }
  return JSON.parse(await gunzipTxt(unb64u(out.join(""))));
}
const tgPartIds = (pm) => (((pm.caption || "").match(/#d([\d.]+)/) || [])[1] || "").split(".").filter(Boolean).map(Number);
async function tgBackup(force) {
  const c = tgCfg(); if (!tgOn() || tgBusy) return false;
  const hash = djbData();
  if (!force && c.hash === hash) return false;
  tgBusy = true;
  try {
    const enc = tgEnc(c), json = enc ? await tgSeal(JSON.stringify(D)) : JSON.stringify(D);
    const now = new Date(), hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`, fd = new FormData();
    let parts = [];
    try { parts = await tgSendParts(c.chat, json); } catch (e) { console.warn("Telegram bo'laklar:", e.message); }
    fd.append("chat_id", c.chat);
    fd.append("document", new Blob([json], {type: "application/json"}), `journal_${iso(now)}_${hm.replace(":", "")}.json`);
    fd.append("caption", `📒 Yo'qlama jurnali zaxirasi\n${fmt(iso(now))} ${hm} · ${D.classes.length} ta sinf\n${enc ? "🔐 Parol bilan shifrlangan.\n" : ""}Tiklash: ilovada «Sozlamalar → Ma'lumotlar → Telegram'dan yuklash» yoki faylni «Fayldan yuklash» orqali oching.\n#q${tgDev()}${parts.length ? " #d" + parts.join(".") : ""}`);
    fd.append("disable_notification", "true");
    const msg = await tgApi("sendDocument", fd);
    try { await tgApi("pinChatMessage", {chat_id: c.chat, message_id: msg.message_id, disable_notification: true}); } catch (e) { /* qadash shart emas */ }
    // oldingi zaxiraning matn bo'laklari endi kerak emas (fayllar tarix uchun qoladi)
    if (c.parts && c.parts.length) try { await tgApi("deleteMessages", {chat_id: c.chat, message_ids: c.parts}); } catch (e) { /* 48 soatdan eski xabar o'chmaydi — zarari yo'q */ }
    tgSet({hash, last: now.toISOString(), seen: msg.message_id, parts});
    await SINX.setBase(JSON.stringify(D));   // ikki qurilmani birlashtirish uchun oxirgi umumiy holat (sinx.js)
    return true;
  } finally { tgBusy = false; }
}
async function tgPinned() {
  const ch = await tgApi("getChat", {chat_id: tgCfg().chat}), pm = ch.pinned_message;
  return pm && pm.document ? pm : null;
}
// saqlash vaqti (web.saved) o'zgarishi «yangi ma'lumot» hisoblanmasin
function djbData() { const w = D.web.saved; delete D.web.saved; const h = djb(JSON.stringify(D)); if (w) D.web.saved = w; return h; }
async function tgData(pm) {
  const ids = tgPartIds(pm);
  let data;
  if (await tgSrvFile()) data = JSON.parse((await tgApi("backupFile", {file_id: pm.document.file_id})).text);
  else if (ids.length && typeof DecompressionStream !== "undefined") data = await tgReadParts(ids);
  else {
    if (tgCfg().key) throw new Error("Bu zaxirani yuklab bo'lmadi — uni yuborgan qurilmada «📤 Yuborish»ni bosing, so'ng shu yerda qayta urinib ko'ring");
    const f = await tgApi("getFile", {file_id: pm.document.file_id});
    try { data = await (await tgFetch(`https://api.telegram.org/file/bot${tgCfg().token}/${f.file_path}`)).json(); }
    catch (e) { if (e.net === "cors") throw Object.assign(new Error("Bu zaxira eski usulda yuborilgan — brauzer uni o'qiy olmaydi. Uni yuborgan qurilmada ilovani yangilab, «Sozlamalar → Ma'lumotlar → 📤 Hozir yuborish»ni bosing, so'ng shu yerda qayta yuklang. Yoki botdagi faylni telefonga saqlab, «Fayldan yuklash» orqali oching"), {net: "file"}); throw e; }
  }
  data = await openSealed(data);
  if (!data || !Array.isArray(data.classes)) throw new Error("bu jurnal fayli emas");
  if (tooNew(data)) throw new Error("zaxira ilovaning yangiroq versiyasida saqlangan — sahifani yangilang");
  return data;
}
async function tgPull(pm) {
  const data = await tgData(pm);
  await keepBefore();
  D = migrate(normalize(data)); autoDates(); save(); TG_NEW = null;
  await SINX.setBase(JSON.stringify(D));
  tgSet({seen: pm.message_id, hash: djbData(), last: new Date(pm.date * 1000).toISOString(), parts: tgPartIds(pm)});
}
// shu qurilmada oxirgi almashishdan keyin o'zgarish bormi (bo'lsa — almashtirish o'rniga birlashtirish taklif qilinadi)
const tgLocalChanged = () => tgCfg().hash !== djbData();
/* ikki qurilmani birlashtirish (sinx.js): Telegram'dagi + shu qurilmadagi o'zgarishlar; ziddiyat bo'lsa o'qituvchi tanlaydi.
   Natija saqlanadi va darhol Telegram'ga yuboriladi — ikkala qurilma bir xil holatga keladi */
async function tgMerge(pm) {
  toast("Telegram'dagi zaxira olinmoqda…");
  const theirs = migrate(normalize(await tgData(pm))), base0 = await SINX.getBase(), base = base0 && migrate(normalize(base0));
  const R = SINX.merge(base, JSON.parse(JSON.stringify(D)), theirs);
  let pick = "theirs";
  if (R.clash.length) {
    const rows = R.clash.slice(0, 40).map((x) => `<tr><td>${esc(x.cls)}</td><td>${esc(x.student || x.what)}</td><td>${/^\d{4}-\d\d-\d\d$/.test(x.key) ? fmt(x.key) : esc(x.key)}</td><td><b>${esc(SINX.show(x.mine))}</b></td><td><b>${esc(SINX.show(x.theirs))}</b></td></tr>`).join("");
    pick = await modal(`<h2>Bir xil katak ikki qurilmada turlicha</h2>
      <div class="muted">${R.clash.length} ta katakda ikkala qurilmada ham har xil qiymat qo'yilgan. Qolgan ${R.n + R.added} ta o'zgarish ziddiyatsiz birlashtiriladi. Ziddiyatli kataklar uchun qaysi qurilmanikini olay?</div>
      <div style="overflow:auto;max-height:50vh"><table class="table table-sm"><thead><tr><th>Sinf</th><th>O'quvchi</th><th>Sana</th><th>Shu qurilmada</th><th>Telegram'da</th></tr></thead><tbody>${rows}</tbody></table>${R.clash.length > 40 ? `<div class="muted">… yana ${R.clash.length - 40} ta</div>` : ""}</div>
      <div class="hrow wrap"><button class="btn" data-x>Bekor qilish</button><span class="sp"></span><button class="btn" data-p="theirs">Telegram'dagini olish</button><button class="btn btn-primary" data-p="mine">Shu qurilmanikini olish</button></div>`,
      (m, close) => { $("[data-x]", m).onclick = () => close(null); m.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => close(b.dataset.p)); });
    if (!pick) return false;
  }
  await keepBefore();
  D = migrate(normalize(SINX.resolve(R, pick))); autoDates(); save(); TG_NEW = null;
  tgSet({seen: pm.message_id});
  await tgBackup(true);   // birlashgan holat — yangi umumiy asos
  toast(`Birlashtirildi: shu qurilmadan ${R.n + R.added} ta o'zgarish qo'shildi${R.clash.length ? `, ${R.clash.length} ta ziddiyat — ${pick === "mine" ? "shu qurilmaniki" : "Telegram'dagi"} olindi` : ""}`);
  return true;
}
// ilova ochilganda: avval boshqa qurilmada yangiroq zaxira bormi — bo'lsa, so'ramasdan ustidan yozmaymiz
async function tgAuto() {
  if (!tgOn() || navigator.onLine === false) return;
  try {
    const pm = await tgPinned(), dev = pm && ((pm.caption || "").match(/#q(\w+)/) || [])[1];
    if (pm && dev !== tgDev() && pm.message_id > (tgCfg().seen || 0)) { TG_NEW = pm; if (S.page === "today") render(); return; }
    await tgBackup(false);
  } catch (e) { console.warn("Telegram:", e.message); }
}
document.addEventListener("visibilitychange", () => {
  const l = tgCfg().last;
  if (document.visibilityState === "hidden" && tgOn() && !TG_NEW && (!l || Date.now() - Date.parse(l) > TG_GAP)) tgBackup(false).catch(() => {});
});
function tgSetup() {
  return modal(`<h2>Telegram'ga avtomatik zaxira</h2>
    <div class="muted">Ma'lumotlaringiz o'zingizning Telegram botingizga fayl bo'lib boradi: har gal ilovani ochganingizda (o'zgarish bo'lsa) va ilovadan chiqqaningizda (2 soatda bir martadan ko'p emas). Bot faqat sizniki — boshqa hech kim ko'rmaydi.</div>
    <ol class="vcol" style="gap:8px;padding-left:20px;margin:4px 0">
      <li>Telegram'da <a href="https://t.me/BotFather" target="_blank" rel="noopener"><b>@BotFather</b></a> ni oching, <b>/newbot</b> deb yozing, botga nom va «..._bot» bilan tugaydigan manzil bering.</li>
      <li>BotFather bergan <b>tokenni</b> (masalan, <code>123456789:AAH…</code>) nusxalab shu yerga qo'ying:</li></ol>
    <input class="form-control" type="text" id="tgt" placeholder="123456789:AAH..." autocomplete="off" spellcheck="false">
    <div id="tgs" class="vcol" style="gap:8px"></div>
    <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok>Davom etish</button></div>`, (m, close) => {
    let step = 0, bot = null;
    const out = $("#tgs", m), ok = $("[data-ok]", m), tok = () => $("#tgt", m).value.trim();
    $("[data-x]", m).onclick = () => close(false);
    ok.onclick = async () => {
      ok.disabled = true;
      try {
        if (step === 0) {
          if (!/^\d+:[\w-]{20,}$/.test(tok())) throw new Error("Token noto'g'ri ko'rinishda");
          bot = await tgApi("getMe", {}, tok()); step = 1; ok.textContent = "Tekshirish";
          out.innerHTML = `<div>3. Endi botingizni oching va <b>«Start»</b> (yoki «Boshlash») tugmasini bosing:</div>
            <a class="btn" href="https://t.me/${esc(bot.username)}" target="_blank" rel="noopener">✈️ @${esc(bot.username)} ni ochish</a><div class="muted">So'ng shu yerga qaytib «Tekshirish»ni bosing.</div>`;
        } else {
          const ups = await tgApi("getUpdates", {}, tok());
          const u = ups.reverse().find((x) => x.message && x.message.chat && x.message.chat.type === "private");
          if (!u) throw new Error("Botga hali xabar kelmadi — botni ochib «Start» bosing, so'ng qayta tekshiring");
          tgSet({token: tok(), chat: u.message.chat.id, bot: bot.username, hash: "", seen: 0});
          await tgApi("sendMessage", {chat_id: u.message.chat.id, text: "✅ Yo'qlama jurnali ulandi. Zaxira nusxalar shu yerga keladi, oxirgisi doim tepada qadalgan turadi."});
          TG_NEW = null; await tgAuto(); close(true);
        }
      } catch (e) { toast(e.message); }
      ok.disabled = false;
    };
  });
}
async function tgAction(a) {
  try {
    if (a === "tgon") { if (await tgSetup()) { render(); toast(TG_NEW ? "Ulandi. Botda boshqa qurilmadan zaxira bor — «Bugun» sahifasiga qarang" : "Ulandi va birinchi zaxira yuborildi"); } }
    else if (a === "tgpass") {
      const p1 = await ask("Zaxira paroli", "Kamida 6 belgi. Unutsangiz, shifrlangan zaxirani hech kim (biz ham) ocha olmaydi:", "", "password"); if (p1 === null) return;
      if (p1.length < 6) { toast("Parol kamida 6 belgidan iborat bo'lishi kerak"); return; }
      const p2 = await ask("Zaxira paroli", "Parolni takrorlang:", "", "password"); if (p2 !== p1) { toast("Parollar mos kelmadi"); return; }
      await tgKeySet(p1); toast("Yuborilmoqda…"); await tgBackup(true); render(); toast("Shifrlash yoqildi — zaxira parol bilan yuborildi");
    } else if (a === "tgnopass") {
      if (!await confirmBox("Shifrlashni o'chirish", "Keyingi zaxiralar shifrlanmagan holda yuboriladi.", "O'chirish")) return;
      const c = tgCfg(); delete c.pass; delete c.kslt; localStorage.setItem(TG_KEY, JSON.stringify(c)); await tgKeyDrop(); await tgBackup(true); render(); toast("Shifrlash o'chirildi");
    }
    else if (a === "tguon") TGU.connect();   // await'siz: oyna bosish paytida ochilishi kerak
    else if (a === "tgucancel") TGU.cancel();
    else if (a === "tgsend") { toast("Yuborilmoqda…"); await tgBackup(true); TG_NEW = null; render(); toast("Zaxira Telegram'ga yuborildi"); }
    else if (a === "tgload" || a === "tgnew") {
      const pm = a === "tgnew" ? TG_NEW : await tgPinned();
      if (!pm) { toast("Botda qadalgan zaxira topilmadi"); return; }
      const when = new Date(pm.date * 1000), at = `${fmt(iso(when))} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
      if (tgLocalChanged() && D.classes.length) {
        // shu qurilmada ham o'zgarish bor: almashtirsak, ular yo'qoladi — birlashtirish taklif qilinadi
        const k = await modal(`<h2>Telegram'dan yuklash</h2><div>${at} dagi zaxira. Shu qurilmada ham oxirgi almashishdan keyin o'zgarishlar bor.</div>
          <div class="muted"><b>Birlashtirish</b> — ikkala qurilmadagi baholar saqlanadi. <b>Almashtirish</b> — shu qurilmadagi o'zgarishlar o'chadi.</div>
          <div class="hrow wrap"><button class="btn" data-x>Bekor qilish</button><span class="sp"></span><button class="btn" data-k="swap">Almashtirish</button><button class="btn btn-primary" data-k="merge">Birlashtirish</button></div>`,
          (m, close) => { $("[data-x]", m).onclick = () => close(null); m.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => close(b.dataset.k)); });
        if (!k) return;
        if (k === "merge") { if (await tgMerge(pm)) { S.ci = 0; go("today"); } return; }
      } else if (!await confirmBox("Telegram'dan yuklash", `${at} dagi zaxira yuklanadi.\nShu qurilmadagi hozirgi ma'lumotlar uning o'rniga almashtiriladi.`, "Yuklash")) return;
      await tgPull(pm); S.ci = 0; go("today"); toast(`${D.classes.length} ta sinf Telegram'dan yuklandi`);
    } else if (a === "tgmerge") {
      if (TG_NEW && await tgMerge(TG_NEW)) { S.ci = 0; go("today"); }
    } else if (a === "tgkeep") { tgSet({seen: TG_NEW.message_id}); TG_NEW = null; await tgBackup(true); render(); toast("Shu qurilmadagi ma'lumotlar Telegram'ga yuborildi"); }
    else if (a === "tgoff") {
      if (!await confirmBox("Telegram'ni uzish", "Avtomatik zaxira to'xtaydi. Botdagi eski fayllar o'chmaydi.", "Uzish")) return;
      const c = tgCfg(); localStorage.setItem(TG_KEY, JSON.stringify({dev: c.dev})); await tgKeyDrop(); TG_NEW = null; render();
    }
  } catch (e) { toast(tgErrTxt(e)); }
}
