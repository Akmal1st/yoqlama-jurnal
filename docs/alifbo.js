/* Hozirgi / yangi lotin alifbosi (Akmal, 2026-11-06 tasdiqlagan maket). Oʻ → Ö, Gʻ → Ğ, Sh → Ş, Ch → Ç; ng va tutuq (ʼ) o'zgarmaydi.
   Saqlangan ma'lumot (ismlar, mavzular, baholar) DOIM hozirgi alifboda qoladi — faqat ko'rinish va chiqadigan narsalar almashadi:
   • ekran: «Yangi» tanlansa butun hujjatdagi matn (va title/placeholder/aria-label) MutationObserver bilan o'giriladi;
     input/textarea qiymatlari va contenteditable tegilmaydi (foydalanuvchi yozayotgan ma'lumot), .alf-keep ichi ham;
   • eksport (sozlamada «Eksport fayllari» yoqilgan bo'lsa): Excel ichidagi matn va varaq nomlari, fayl nomlari (Excel, CSV, PDF, rasm),
     chop etish, vektor PDF va rasm (ekrandan olinadi). O'chirilgan bo'lsa — chop etish/PDF/rasm paytida matn vaqtincha hozirgi alifboga qaytadi;
   • Telegram («Telegram xabarlari»): bot xabarlari va izohlari, fayl nomlari, Telegram/SMS havolalari va «nusxalash» matnlari.
   Zaxira (.json) va zaxira xabarlari hech qachon o'girilmaydi.
   Sozlama: D.web.alf = {m: "y" | "h", exp: true, tg: true}. Asosiy skriptdan OLDIN ulanadi; render() ichida ALF.sync() chaqiriladi. */
const ALF = (() => {
  const APOS = "'ʻ‘’`";
  const RE_OG = new RegExp(`([OoGg])[${APOS}]`, "g");
  const OG = {O: "Ö", o: "ö", G: "Ğ", g: "ğ"};
  // ingliz tilidagi nomlar (Chrome, Shift …) o'zgarmasin
  const KEEP = new Set(["chrome", "chromium", "shift", "sheet", "sheets", "sheetjs", "push", "cache", "flash", "bluetooth", "html2canvas", "search", "touch", "dashboard", "whatsapp", "ctrl"]);
  function word(w) {
    if (KEEP.has(w.toLowerCase().replace(/['ʻ‘’`].*$/, ""))) return w;
    return w.replace(RE_OG, (m, c) => OG[c]).replace(/S[Hh]/g, "Ş").replace(/sh/g, "ş").replace(/C[Hh]/g, "Ç").replace(/ch/g, "ç");
  }
  // so'z = lotin harflari + o'/g' belgisi; boshqa hamma narsa (kirill, raqam, emoji) o'zgarmaydi
  const RE_W = new RegExp(`[A-Za-z${APOS}]+`, "g");
  function yangi(s) {
    s = String(s ?? "");
    return /[sScCoOgG]/.test(s) ? s.replace(RE_W, word) : s;
  }

  /* ───── sozlama ───── */
  const DEF = {m: "h", exp: true, tg: true};
  function cfg() {
    const w = typeof D !== "undefined" && D && D.web;
    const a = w && w.alf && typeof w.alf === "object" ? w.alf : {};
    return {m: a.m === "y" ? "y" : "h", exp: a.exp !== false, tg: a.tg !== false};
  }
  const on = () => cfg().m === "y";
  const expOn = () => { const c = cfg(); return c.m === "y" && c.exp; };
  const tgOn_ = () => { const c = cfg(); return c.m === "y" && c.tg; };
  const ex = (s) => (expOn() ? yangi(s) : s);   // eksport fayllari uchun
  const tg = (s) => (tgOn_() ? yangi(s) : s);   // Telegram matnlari uchun

  /* ───── ekran: matnni o'girish (asl matn eslab qolinadi) ───── */
  const ORIG = new WeakMap();      // matn tuguni → [asl, o'girilgan]
  const AORIG = new WeakMap();     // element → {attr: [asl, o'girilgan]}
  const ATTRS = ["title", "placeholder", "aria-label", "alt", "data-tip"];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|svg|SVG|CODE|KBD|PRE)$/;
  function skipEl(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP.test(e.nodeName) || e.isContentEditable || (e.classList && e.classList.contains("alf-keep"))) return true;
    }
    return false;
  }
  function convText(n) {
    const v = n.nodeValue, r = ORIG.get(n);
    if (r && r[1] === v) return;                 // allaqachon o'girilgan
    const y = yangi(v);
    if (y !== v) { ORIG.set(n, [v, y]); n.nodeValue = y; } else if (r) ORIG.delete(n);
  }
  function shareHref(h) {   // Telegram/SMS havolasidagi xabar matni
    const m = /^(https:\/\/t\.me\/share\/url\?[^#]*?text=|sms:[^?]*\?body=)([^&#]*)(.*)$/.exec(h); if (!m) return h;
    let t; try { t = decodeURIComponent(m[2]); } catch (e) { return h; }
    return m[1] + encodeURIComponent(tg(t)) + m[3];
  }
  function convAttrs(el) {
    let rec = AORIG.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a), r = rec && rec[a];
      if (r && r[1] === v) continue;
      const y = yangi(v);
      if (y !== v) { if (!rec) AORIG.set(el, rec = {}); rec[a] = [v, y]; el.setAttribute(a, y); }
    }
    if (el.nodeName === "A") { const h = el.getAttribute("href"); if (h && /^(https:\/\/t\.me\/share|sms:)/.test(h)) { const y = shareHref(h); if (y !== h) el.setAttribute("href", y); } }
  }
  function convTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skipEl(root.parentElement)) convText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const top = root.nodeType === 1 ? root : null;
    if (top && skipEl(top)) return;
    if (top) convAttrs(top);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {acceptNode: (n) =>
      n.nodeType === 1 ? (SKIP.test(n.nodeName) || n.isContentEditable || n.classList.contains("alf-keep") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) : NodeFilter.FILTER_ACCEPT});
    for (let n; (n = w.nextNode());) { if (n.nodeType === 3) convText(n); else convAttrs(n); }
  }
  // hozirgi alifboga qaytarish (sozlama «Hozirgi»ga o'tganda yoki eksport o'chiq bo'lsa — chop etish paytida)
  function eachConverted(fn) {
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = document.documentElement; n; n = w.nextNode()) {
      if (n.nodeType === 3) { const r = ORIG.get(n); if (r) fn(n, r, null); }
      else { const r = AORIG.get(n); if (r) for (const a in r) fn(n, r[a], a); }
    }
  }
  const restored = [];
  function toOrig() {
    eachConverted((n, r, a) => {
      if (a) { if (n.getAttribute(a) === r[1]) { n.setAttribute(a, r[0]); restored.push([n, r, a]); } }
      else if (n.nodeValue === r[1]) { n.nodeValue = r[0]; restored.push([n, r, null]); }
    });
  }
  function backToNew() {
    for (const [n, r, a] of restored.splice(0)) { if (a) { if (n.getAttribute(a) === r[0]) n.setAttribute(a, r[1]); } else if (n.nodeValue === r[0]) n.nodeValue = r[1]; }
  }

  let mo = null, paused = 0;
  function start() {
    if (mo) return;
    mo = new MutationObserver((list) => {
      if (paused) return;
      for (const m of list) {
        if (m.type === "childList") m.addedNodes.forEach(convTree);
        else if (m.type === "characterData") { if (!skipEl(m.target.parentElement)) convText(m.target); }
        else if (m.type === "attributes" && !skipEl(m.target)) convAttrs(m.target);
      }
    });
    mo.observe(document.documentElement, {childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS, "href"]});
    convTree(document.documentElement);
  }
  function stop() {
    if (!mo) return; mo.disconnect(); mo = null;
    eachConverted((n, r, a) => { if (a) { if (n.getAttribute(a) === r[1]) n.setAttribute(a, r[0]); delete AORIG.get(n)[a]; } else { if (n.nodeValue === r[1]) n.nodeValue = r[0]; ORIG.delete(n); } });
  }
  // eksport hozirgi alifboda qolishi kerak bo'lsa: ekrandan olish paytida matnni vaqtincha qaytaramiz
  const needOrig = () => on() && !cfg().exp;
  async function plain(fn) {
    if (!needOrig() || !mo) return fn();
    paused++; toOrig();
    try { return await fn(); } finally { backToNew(); paused--; }
  }
  function sync() {
    document.documentElement.classList.toggle("alf-y", on());
    if (on()) start(); else stop();
  }

  /* ───── Excel: hujjat ichidagi matn va varaq nomlari ───── */
  function convBook(wb) {
    if (!expOn() || !wb || !wb.Sheets) return;
    const names = wb.SheetNames.map((n) => yangi(n).slice(0, 31)), map = {};
    wb.SheetNames.forEach((n, i) => { map[names[i]] = wb.Sheets[n]; });
    for (const ws of Object.values(map)) for (const k in ws) {
      if (k[0] === "!") continue; const c = ws[k];
      if (c && c.t === "s" && typeof c.v === "string") { c.v = yangi(c.v); if (c.w) c.w = yangi(c.w); if (c.h) c.h = yangi(c.h); }
    }
    wb.SheetNames.splice(0, wb.SheetNames.length, ...names); wb.Sheets = map;
  }
  function patchX(X) {
    if (!X || X.__alf) return X;
    for (const f of ["writeFile", "writeFileXLSX"]) {
      if (typeof X[f] !== "function") continue; const o = X[f];
      try { X[f] = function (wb, name, ...r) { convBook(wb); return o.call(this, wb, typeof name === "string" ? ex(name) : name, ...r); }; } catch (e) {}
    }
    try { X.__alf = 1; } catch (e) {}
    return X;
  }

  /* ───── Telegram so'rovlari ───── */
  const isBackup = (s) => /<blockquote|Zaxira nusxasi|^\s*\{/.test(String(s || ""));
  function tgParams(method, p) {
    if (!tgOn_() || !p) return p;
    if (p instanceof FormData) {
      const f = new FormData();
      for (const [k, v] of p.entries()) {
        if (typeof v === "string") f.append(k, (k === "caption" || k === "text") && !isBackup(v) ? yangi(v) : v);
        else if (v && v.name && !/\.json$/i.test(v.name)) f.append(k, v, yangi(v.name));
        else f.append(k, v);
      }
      return f;
    }
    if (typeof p === "object") {
      const o = Object.assign({}, p);
      for (const k of ["caption", "text"]) if (typeof o[k] === "string" && !isBackup(o[k])) o[k] = yangi(o[k]);
      return o;
    }
    return p;
  }

  /* ───── asosiy skript tayyor bo'lgach: kerakli funksiyalarni o'rab olamiz ───── */
  function wrap(name, mk) { const o = window[name]; if (typeof o !== "function" || o.__alf) return; const w = mk(o); w.__alf = 1; window[name] = w; }
  function hook() {
    // softRender: yangi qism ham oldindan o'giriladi — joyidagisi bilan bir xil bo'lib, keraksiz almashtirish bo'lmaydi
    wrap("morphKids", (o) => function (a, b) { if (mo) convTree(b); return o.call(this, a, b); });
    wrap("tgApi", (o) => function (method, params, ...r) { return o.call(this, method, tgParams(method, params), ...r); });
    wrap("download", (o) => function (name, text, type, ...r) {
      if (/\.json$/i.test(name)) return o.call(this, name, text, type, ...r);
      return o.call(this, ex(name), typeof text === "string" ? ex(text) : text, type, ...r);
    });
    // fayl nomi tozalanganda ' belgisi tushib qoladi — shuning uchun nomni oldinroq o'giramiz
    wrap("saveTable", (o) => function (name, aoa, ...r) { return o.call(this, ex(name), aoa, ...r); });
    wrap("baFileBase", (o) => function (c, B) { return o.call(this, Object.assign({}, c, {name: ex(c.name), subject: ex(c.subject)}), Object.assign({}, B, {kind: ex(B.kind), date: B.date})); });
    wrap("loadXlsx", (o) => function (...a) { return Promise.resolve(o.apply(this, a)).then(patchX); });
    wrap("printDoc", (o) => function (html, land, fit, fname, ...r) { return o.call(this, html, land, fit, typeof fname === "string" ? ex(fname) : fname, ...r); });
    if (window.XLSX) patchX(window.XLSX);
    // vektor PDF (pdf-tg.js) varaq matnini ekrandan o'qiydi: eksport o'chiq bo'lsa — o'qish paytida hozirgi alifbo
    if (typeof PTG !== "undefined") for (const f of ["reportPdf", "pagesPdf"]) if (typeof PTG[f] === "function" && !PTG[f].__alf) { const o = PTG[f]; PTG[f] = function (...a) { return plain(() => o.apply(this, a)); }; PTG[f].__alf = 1; }
    if (typeof PTG !== "undefined" && PTG.send && !PTG.send.__alf) { const o = PTG.send; PTG.send = function (blob, name, caption) { return o.call(this, blob, ex(name), caption); }; PTG.send.__alf = 1; }
    try {
      const cb = navigator.clipboard;
      if (cb && cb.writeText && !cb.writeText.__alf) { const o = cb.writeText.bind(cb), w = (t) => o(tg(t)); w.__alf = 1; cb.writeText = w; }
    } catch (e) {}
  }
  // html2canvas (PDF va rasm) yuklanganda — o'rab olamiz
  try {
    let h2c = window.html2canvas;
    Object.defineProperty(window, "html2canvas", {configurable: true, get: () => h2c,
      set: (f) => { h2c = typeof f === "function" ? Object.assign(function (...a) { return plain(() => f.apply(this, a)); }, f) : f; }});
  } catch (e) {}
  // chop etish (PDF saqlash ham) — eksport o'chiq bo'lsa vaqtincha hozirgi alifbo
  let printing = false;
  addEventListener("beforeprint", () => { if (needOrig() && mo && !printing) { printing = true; paused++; toOrig(); } });
  addEventListener("afterprint", () => { if (printing) { printing = false; backToNew(); paused--; } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { hook(); sync(); });
  else setTimeout(() => { hook(); sync(); });

  /* ───── Sozlamalar → Dizayn: «Alifbo» bo'limi ───── */
  const SAMPLE = "Oʻquvchi, gʻalaba, shanba, chorak";
  function set(k, v) {
    if (typeof D === "undefined" || !D) return;
    const c = cfg(); c[k] = v; D.web.alf = c; if (typeof save === "function") save();
    sync(); if (typeof render === "function") render();
    if (k === "m" && typeof toast === "function") toast(v === "y" ? "Yangi alifbo yoqildi" : "Hozirgi alifbo yoqildi");
  }
  const toggle = () => set("m", on() ? "h" : "y");
  function body() {
    const c = cfg(), y = c.m === "y";
    const opt = (k, t, s, smp) => `<button class="alf-opt ${c.m === k ? "on" : ""}" data-alf-m="${k}" role="radio" aria-checked="${c.m === k}"><span class="alf-rd"></span><b>${t}</b><small>${s}</small><span class="alf-smp alf-keep">${smp}</span></button>`;
    const tr = (a, b, e) => `<tr><td class="l">${a}</td><td class="ar">→</td><td class="l">${b}</td><td class="ex">${e}</td></tr>`;
    const sw = (k, ic, t, s) => `<div class="alf-row"><span class="alf-ico"><i class="bi bi-${ic}"></i></span><span class="alf-st"><b>${t}</b><small>${s}</small></span>${k
      ? `<button class="alf-tg ${c[k] ? "on" : ""}" data-alf-t="${k}" role="switch" aria-checked="${c[k]}" aria-label="${t}"></button>` : `<i class="bi bi-check-lg alf-ok"></i>`}</div>`;
    return `<div class="sgroup dzg alf-sec" id="alf-sec"><div class="dzh"><h3 class="sgt">Alifbo</h3><span>Ekran va eksport</span></div>
      <div class="alf-card"><div class="alf-opts">${opt("h", "Hozirgi alifbo", "Hozir maktabda va eMaktab'da ishlatiladi", SAMPLE)}${opt("y", "Yangi alifbo", "Isloh qilingan lotin alifbosi", yangi(SAMPLE))}</div></div>
      <p class="dzhint">Saqlangan ma'lumotlar (ismlar, mavzular) o'zgarmaydi — faqat ko'rinishi va eksport qilingan fayllar. Istalgan payt qaytarish mumkin.</p>
      <h4 class="alf-sub">Qaysi harflar almashadi</h4>
      <div class="alf-card alf-keep"><table class="alf-map"><thead><tr><th>Hozirgi</th><th></th><th>Yangi</th><th>Misol</th></tr></thead><tbody>
        ${tr("Oʻ oʻ", "Ö ö", "oʻquvchi → öquvchi")}${tr("Gʻ gʻ", "Ğ ğ", "gʻalaba → ğalaba")}${tr("Sh sh", "Ş ş", "shanba → şanba")}${tr("Ch ch", "Ç ç", "chorak → çorak")}${tr("ng", "ng", "o'zgarmaydi")}${tr("ʼ (tutuq)", "ʼ", "maʼlumot → maʼlumot")}</tbody></table></div>
      <h4 class="alf-sub">Qayerda qo'llanadi</h4>
      <div class="alf-card ${y ? "" : "alf-dim"}">${sw("", "window", "Dastur oynalari", "Menyu, tugmalar, jurnal, o'quvchi ismlari")}${sw("exp", "file-earmark-arrow-down", "Eksport fayllari", "Excel, PDF, rasm — fayl nomi ham, ichidagi matn ham")}${sw("tg", "telegram", "Telegram xabarlari", "Kunlik hisobot, ota-onalarga xabar, nusxalangan matn")}</div>
      <div class="alf-note"><i class="bi bi-info-circle"></i><span>eMaktab'dan import odatdagidek ishlaydi: fayl qaysi alifboda bo'lsa ham, ismlar to'g'ri moslashtiriladi.</span></div></div>`;
  }
  function bind(m) {
    m.querySelectorAll("[data-alf-m]").forEach((b) => b.onclick = () => { if (cfg().m !== b.dataset.alfM) set("m", b.dataset.alfM); });
    m.querySelectorAll("[data-alf-t]").forEach((b) => b.onclick = () => set(b.dataset.alfT, !cfg()[b.dataset.alfT]));
  }
  // yon panel pastidagi tezkor tugma (kompyuter) — tasdiqlangan maketdagi «Hozirgi / Yangi» belgisi
  const chip = (mini) => `<button class="btn btn-sm alf-chip" data-alf-chip title="Alifbo: ${on() ? "yangi" : "hozirgi"} — almashtirish uchun bosing" aria-label="Alifboni almashtirish"><i class="bi bi-translate"></i>${mini ? "" : `<span class="lbl">${on() ? "Yangi alifbo" : "Hozirgi alifbo"}</span>`}</button>`;

  return {yangi, cfg, on, ex, tg, sync, body, bind, toggle, chip, plain, convBook};
})();
