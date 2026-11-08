/* Saqlash: localStorage (asosiy) + IndexedDB (nusxa va 14 kunlik kunlik nusxalar), ma'lumot versiyasi va migratsiya,
   bir nechta oyna (tab) himoyasi. index.html dagi asosiy skriptdan OLDIN ulanadi; undagi nomlar (D, normalize, render, toast,
   todayIso, autoDates, …) faqat chaqirilganda ishlatiladi. */
"use strict";
const STORE_KEY = "yoqlama_jurnal";
/* Ma'lumot versiyasi: D.web.dv. Tuzilma o'zgarsa DATA_VER oshiriladi va MIGRATE ga [eski dv] → yangi qadam qo'shiladi.
   Yangiroq ilovada saqlangan ma'lumotni eski ilova ustidan yozmaydi (NEWER). */
const DATA_VER = 2;
const MIGRATE = {
  0: (d) => d,   // 0 → 1: versiya belgisi va saqlash vaqti qo'shildi, tuzilma o'zgarmagan
  // 1 → 2: guruhlarda yo'qlama o'rniga «dars o'tildi» (ot) / «o'tilmadi» (ox). Yo'qlama qilingan kunlarda:
  // belgisiz yoki kech qolgan → o'tildi, kelmagan (s/dq/k) → o'tilmadi
  1: (d) => {
    const t = todayIso();
    for (const c of d.classes) {
      if (!(c.kind === "club" || c.kind === "paid")) continue;
      for (const dt of c.dates) {
        if (dt > t || !((c.att_ok || []).includes(dt) || c.students.some((s) => s.marks[dt]))) continue;
        for (const s of c.students) {
          if (s.joined && dt < s.joined) continue;
          const mk = s.marks[dt] || "";
          if (["s", "dq", "k"].includes(mk)) s.marks[dt] = "ox"; else if (!mk || mk === "kq") s.marks[dt] = "ot";
        }
      }
    }
    return d;
  },
};
let NEWER = false;
const tooNew = (d) => (+((d && d.web) || {}).dv || 0) > DATA_VER;
function migrate(d) {
  let v = +d.web.dv || 0;
  if (v > DATA_VER) { NEWER = true; return d; }
  while (v < DATA_VER) { d = (MIGRATE[v] || ((x) => x))(d); v++; }
  // 2026-10: yangi «Zamonaviy» dizayn hammaga bir marta yoqiladi (Akmal: dizaynni tubdan yangila); eski uslublar Sozlamalar → Dizayn'da qoladi
  // o'xshash shriftlar olib tashlandi: Times New Roman → Liberation Serif, Liberation Sans → tizim shrifti; ixcham dizayn olib tashlandi
  if (d.web.font === "times") d.web.font = "lserif"; else if (d.web.font === "lsans") d.web.font = "system";
  delete d.web.density;
  if (!d.web.ui26) { d.web.ui26 = 1; d.web.style = "dash"; if (!d.web.font || d.web.font === "lserif") d.web.font = "system"; }
  d.settings.method_weekday = null;   // metod kuni ilovadan olib tashlangan (Akmal, 2026-10-25): o'sha kunlar oddiy dars kuni
  d.web.dv = DATA_VER; return d;
}
// xotiradagi matn o'qilmasa (buzilgan) — u yo'qolib ketmasin: alohida kalitga ko'chiriladi, idbBoot zaxiradan tiklaydi yoki ogohlantiradi
let LOAD_BROKEN = false;
function load() {
  let t = null; BASE_REV = revNow();
  try { t = localStorage.getItem(STORE_KEY); } catch (e) { console.warn(e); }
  if (t) {
    try { return migrate(normalize(JSON.parse(t))); } catch (e) {
      console.warn(e); LOAD_BROKEN = true;
      try { localStorage.setItem(STORE_KEY + "_buzilgan", t); } catch (e2) { /* joy yo'q — IndexedDB'dagi nusxa qoladi */ }
    }
  }
  return migrate(normalize({web: {off: Object.fromEntries(SIMPLE_OFF.map((k) => [k, 1]))}}));
}
/* Bir nechta oyna (tab): har saqlash umumiy hisoblagichni (REV_KEY) oshiradi. Oyna o'zi oxirgi ko'rgan raqamdan katta
   raqam ko'rsa, demak jurnalni boshqa oyna o'zgartirgan: eski nusxa ustidan yozilmaydi, yangi holat yuklanadi. */
const REV_KEY = STORE_KEY + "_rev";
let BASE_REV = 0;
function revNow() { try { return +localStorage.getItem(REV_KEY) || 0; } catch (e) { return 0; } }
const busyUi = () => !!document.querySelector(".modal") || /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
async function otherTabReload(why) {
  let d = load();
  // localStorage to'lgan bo'lsa, boshqa oyna faqat IndexedDB'ga yozgan bo'lishi mumkin
  try { const txt = IDB.db && await idbReq("kv", "readonly", (st) => st.get("main")); const I = txt && JSON.parse(txt); if (I && savedAt(I) > savedAt(d)) d = migrate(normalize(I)); } catch (e) { /* localStorage nusxasi qoladi */ }
  D = d; EPOCH++; autoDates(); render();
  toast(why === "conflict" ? "Jurnal boshqa oynada o'zgartirilgan edi — oxirgi o'zgarish saqlanmadi, yangi holat yuklandi. Iltimos, qaytadan kiriting."
    : "Boshqa oynadagi o'zgarishlar yuklandi");
}
let REV_WAIT = false;
function onOtherTab() {
  if (revNow() <= BASE_REV) return;
  if (busyUi()) { if (!REV_WAIT) { REV_WAIT = true; setTimeout(() => { REV_WAIT = false; onOtherTab(); }, 1500); } return; }
  otherTabReload("sync");
}
window.addEventListener("storage", (e) => { if (e.key === REV_KEY && D) onOtherTab(); });
// ko'p belgini birdan qo'yishda (hammasi keldi) har biri uchun butun jurnalni qayta yozmaslik: oxirida bir marta saqlanadi
const SAVE_HOLD = {n: 0, dirty: false};
function batch(fn) {
  SAVE_HOLD.n++;
  try { return fn(); } finally { if (!--SAVE_HOLD.n && SAVE_HOLD.dirty) { SAVE_HOLD.dirty = false; save(); } }
}
// hisobot keshi davri — har saqlashda yangilanadi (pastda: memo)
let EPOCH = 0; const MEMO = new WeakMap();
const LOG_MAX = 5000;   // o'zgarishlar tarixi: oxirgi 5000 yozuv (o'chirish, tiklash yozuvlari ham shu chegarada)
function save() {
  EPOCH++;
  if (SAVE_HOLD.n) { SAVE_HOLD.dirty = true; return; }
  if (NEWER) { toast("Bu ma'lumot ilovaning yangiroq versiyasida saqlangan — o'zgarish saqlanmadi. Sahifani yangilang."); return; }
  const rev = revNow();
  if (rev > BASE_REV) { otherTabReload("conflict"); return; }   // boshqa oyna yangiroq saqlagan — uning ustidan yozilmaydi
  if (D.changelog && D.changelog.length > LOG_MAX) D.changelog.splice(0, D.changelog.length - LOG_MAX);
  D.web.dv = DATA_VER; D.web.saved = new Date().toISOString();
  const txt = JSON.stringify(D); let ok = true;
  try { localStorage.setItem(STORE_KEY, txt); } catch (e) { ok = false; }
  BASE_REV = rev + 1; try { localStorage.setItem(REV_KEY, String(BASE_REV)); } catch (e) { /* kichik kalit — odatda yoziladi */ }
  idbSave(txt);
  if (!ok) toast(IDB.ok ? "Brauzerning asosiy xotirasi to'lgan — ma'lumot zaxira xotiraga (IndexedDB) saqlandi. «Sozlamalar → Ma'lumotlar»dan faylga ham saqlab qo'ying."
    : "Saqlab bo'lmadi: brauzer xotirasi to'lgan yoki yopiq. «Sozlamalar → Ma'lumotlar»dan faylga saqlang.");
}

/* ───────── IndexedDB: asosiy xotiraning nusxasi va kunlik avtomatik nusxalar ───────── */
// "kv": main → oxirgi holat (JSON matn); "snap": YYYY-MM-DD → {at, txt} — oxirgi SNAP_DAYS kun
const IDB = {db: null, ok: false, ready: false, pend: null, timer: null, pruned: ""};
const SNAP_DAYS = 14;
function idbOpen() {
  return new Promise((res) => {
    if (typeof indexedDB === "undefined") return res(null);
    try {
      const r = indexedDB.open("yoqlama_jurnal", 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv"); if (!db.objectStoreNames.contains("snap")) db.createObjectStore("snap"); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbReq(store, mode, fn) {
  return new Promise((res, rej) => {
    if (!IDB.db) return res(null);
    try { const tx = IDB.db.transaction(store, mode), st = tx.objectStore(store), r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }
    catch (e) { rej(e); }
  });
}
function idbSave(txt) {
  IDB.pend = txt; if (!IDB.ready) return;
  clearTimeout(IDB.timer); IDB.timer = setTimeout(idbFlush, 300);
}
async function idbFlush() {
  const txt = IDB.pend; if (txt === null || !IDB.db) return; IDB.pend = null;
  const day = todayIso();
  try {
    await idbReq("kv", "readwrite", (st) => st.put(txt, "main"));
    await idbReq("snap", "readwrite", (st) => st.put({at: new Date().toISOString(), txt}, day));
    // eski nusxalarni tozalash — kuniga bir marta yetadi
    if (IDB.pruned !== day) {
      const keys = (await idbReq("snap", "readonly", (st) => st.getAllKeys())) || [];
      // oxirgi SNAP_DAYS KUN saqlanadi: «tiklashdan oldingi» nusxalar (kalit oxirida «~») kunlar sonini kamaytirmaydi
      const days = [...new Set(keys.map((k) => String(k).slice(0, 10)))].sort(), keep = new Set(days.slice(-SNAP_DAYS));
      const old = keys.filter((k) => !keep.has(String(k).slice(0, 10)));
      if (old.length) await idbReq("snap", "readwrite", (st) => old.forEach((k) => st.delete(k)));
      IDB.pruned = day;
    }
    IDB.ok = true;
  } catch (e) { IDB.ok = false; console.warn("IndexedDB:", e); }
}
window.addEventListener("pagehide", () => { if (IDB.pend !== null) idbFlush(); });
const savedAt = (d) => Date.parse((d && d.web && d.web.saved) || "") || 0;
// ishga tushganda: localStorage bo'sh, buzilgan yoki eskiroq bo'lsa — IndexedDB'dagi nusxadan tiklash
async function idbBoot() {
  IDB.db = await idbOpen(); IDB.ok = !!IDB.db;
  if (IDB.db) {
    try {
      const txt = await idbReq("kv", "readonly", (st) => st.get("main"));
      const I = txt ? JSON.parse(txt) : null;
      if (I && Array.isArray(I.classes) && (savedAt(I) > savedAt(D) || !D.classes.length && I.classes.length)) {
        NEWER = false; D = migrate(normalize(I)); autoDates();
        try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); } catch (e) { /* to'lgan bo'lsa ham IndexedDB'da bor */ }
        render(); toast("Ma'lumotlar zaxira xotiradan (IndexedDB) tiklandi");
      }
    } catch (e) { console.warn("IndexedDB:", e); }
  }
  if (LOAD_BROKEN && !D.classes.length) toast("Brauzer xotirasidagi jurnal buzilgan, zaxira xotirada ham nusxa topilmadi. Buzilgan matn alohida saqlab qo'yildi. Faylga yoki Telegram'ga saqlangan zaxiradan yuklang (Sozlamalar → Ma'lumotlar).");
  IDB.ready = true;
  if (!NEWER) idbSave(JSON.stringify(D));
  // brauzer joy tanqisligida ma'lumotni o'chirib yubormasligi uchun
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* qo'llab-quvvatlanmaydi */ }
}
// jurnal butunlay almashtirilishidan oldin (fayldan, Telegram'dan, nusxadan tiklash) hozirgi holat alohida nusxa bo'lib qoladi:
// aks holda keyingi saqlash bugungi kunlik nusxani yangi ma'lumot bilan bosib ketadi va bugungi ish qaytarib bo'lmaydi
async function keepBefore() {
  if (!IDB.db || !D.classes.length) return;
  try { const cur = JSON.stringify(D); await idbReq("snap", "readwrite", (st) => st.put({at: new Date().toISOString(), txt: cur}, todayIso() + "~")); } catch (e) { /* bo'lmasa ham davom etamiz */ }
}
