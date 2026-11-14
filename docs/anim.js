/* Animatsiyalar va o'tish effektlari (Akmal tasdiqlagan maket, 2026-11-14).
   Sozlamalar → Dizayn → Ko'rinish → «Animatsiyalar»: D.web.anim = "off" | "lite" (standart) | "full".
   Qurilmada «harakatni kamaytirish» yoqilgan bo'lsa — o'chiq. Ma'lumotlarga tegmaydi, chop etish/PDF'da o'chiq (anim.css).
   Ishlash tartibi: bosish/klaviatura oldidan holat eslab qolinadi (snap), sahifa chizilgach (MutationObserver) farqiga qarab
   effekt qo'yiladi (post). Dastur kodi o'zgarmaydi — faqat render'dan keyingi DOM'ga klass qo'shiladi. */
const ANM = (() => {
  const LV = {off: ["O'chiq", "Hech narsa harakatlanmaydi — dastur avvalgidek"], lite: ["Yengil", "Qisqa: xiralik va ozgina siljish"], full: ["To'liq", "Oynalar pastdan chiqadi, to'lqin, baraban, «🎉»"]};
  const html = document.documentElement;
  let mq = null; try { mq = matchMedia("(prefers-reduced-motion: reduce)"); } catch (e) {}
  const want = () => { const v = typeof D !== "undefined" && D && D.web ? D.web.anim : ""; return LV[v] ? v : "lite"; };
  const rm = () => !!(mq && mq.matches);
  // avtomatik testlarda (webdriver) — o'chiq, eski testlar barqaror qolsin; animatsiya testi window.ANM_TEST qo'yadi
  const level = () => (rm() || (navigator.webdriver && !window.ANM_TEST)) ? "off" : want();
  const on = () => level() !== "off";
  const full = () => level() === "full";
  const dur = (k) => !on() ? 0 : (full() ? [140, 240, 320] : [110, 160, 200])[k];
  const apply = () => { const l = level(); if (html.dataset.anim !== l) html.dataset.anim = l; };
  const re = (e, cls) => { if (!e) return; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); };
  const later = (fn, ms) => setTimeout(fn, ms);
  const $m = () => document.getElementById("main");

  /* ── holat: bosishdan oldin ── */
  const NAVO = ["today", "journal", "groups", "reports", "settings", "archive"];
  const pageKey = () => typeof S === "undefined" ? "" : [S.page, S.page === "journal" ? S.jpage + "|" + S.ci : "", S.page === "settings" ? S.sec : "", S.page === "lesson" ? S.step : ""].join("|");
  const perKey = () => typeof V === "undefined" || typeof S === "undefined" || S.page !== "journal" ? "" : V.mode + "|" + V.anchor;
  const POP = ".tg,.dg,.cell,.gb,.hwb,.ab,.ac,.swb button";
  const DEL = (t) => t && (t.matches("[data-del],[data-rm],[data-delete]") || /o['ʻ’]chir/i.test((t.getAttribute("title") || "") + (t.getAttribute("aria-label") || "")) || /^\s*(✕|×|🗑)\s*$/.test(t.textContent));
  const UNDO = (t) => t && (t.matches(".tact,[data-undo]") || /^\s*(↶\s*)?Qaytarish\s*$/.test(t.textContent));
  let P = null, lastKey = "", lastPer = "", lastSig = "", lastEl = null, lastAt = 0;
  // tanlov guruhlari (Kun/Hafta/Oy, Ro'yxat/Kartochka, sana tasmasi, bo'lim yorliqlari): tanlangan belgining joyi
  const GRP = ".seg, .jtabs, .dstrip, .dztabs, .bn-seg, .pmodes";
  const gKey = (g) => g.className + ":" + [...g.children].map((b) => (b.textContent || "").trim().slice(0, 24)).join("|");
  function groups() {
    const out = new Map();
    document.querySelectorAll(GRP).forEach((g) => { const o = g.querySelector(":scope > .on"); if (!o) return; const a = g.getBoundingClientRect(), r = o.getBoundingClientRect(); out.set(gKey(g), {x: r.left - a.left + g.scrollLeft, y: r.top - a.top + g.scrollTop, w: r.width, h: r.height}); });
    return out;
  }
  function rowsMap() {
    const m = $m(); if (!m) return null; const out = new Map();
    [...m.querySelectorAll("tr[data-q], .lrow, .drow[data-q], .kt-row, li")].slice(0, 600).forEach((e) => {
      let k = e.tagName + ":" + (e.dataset.q || e.textContent.replace(/\s+/g, " ").trim().slice(0, 140)); while (out.has(k)) k += "'";
      out.set(k, {top: e.getBoundingClientRect().top, el: e});
    });
    return out;
  }
  function snap(e, kind) {
    if (!on()) { P = null; return; }
    const t = e && e.target && e.target.closest ? e.target.closest("button,[data-c],select,a,[role=button],.cell") : null;
    if (t) { lastEl = t; lastAt = performance.now(); }
    const swc = document.getElementById("swc");
    P = {at: performance.now(), kind, key: e && e.key, el: t, page: pageKey(), per: perKey(), grp: groups(),
      dark: html.dataset.theme, all: !!(t && t.matches("[data-all]")),
      pop: t && t.matches(POP) ? [...t.attributes].filter((x) => x.name.startsWith("data-")).map((x) => `[${x.name}="${CSS.escape(x.value)}"]`).join("") : "",
      swc: swc && (t && t.matches("[data-sw]") || (kind === "key" && /^Arrow(Left|Right)$|^[sdkqc ]$/i.test(e.key))) && !swc.style.transform ? {g: swc.cloneNode(true), r: swc.getBoundingClientRect(), dir: t ? (t.dataset.sw === "" ? 1 : -1) : (e.key === "ArrowRight" || e.key === " " ? 1 : -1)} : null,
      rows: (kind === "change" && e.target.id === "jsort") || DEL(t) || UNDO(t) ? rowsMap() : null, del: DEL(t), undo: UNDO(t)};
  }

  /* ── chizilgandan keyin ── */
  let qd = false;
  const queue = () => { if (qd) return; qd = true; queueMicrotask(() => { qd = false; try { post(); } catch (err) { console.warn("anim", err); } }); };
  function post() {
    apply(); if (!on()) { P = null; lastKey = pageKey(); lastPer = perKey(); return; }
    const m = $m(); if (!m) return;
    const p = P && performance.now() - P.at < 900 ? P : null;
    const key = pageKey(), per = perKey();
    // 1. bo'lim almashishi
    if (lastKey && key !== lastKey && key.split("|")[0] !== "") {
      const a = NAVO.indexOf(lastKey.split("|")[0]), b = NAVO.indexOf(key.split("|")[0]);
      m.style.setProperty("--anm-dir", b >= a ? 1 : -1); re(m, "anm-pg");
      if (full()) [...m.children].slice(0, 12).forEach((c, i) => { c.style.setProperty("--anm-i", i); re(c, "anm-st"); });
    } else if (lastPer && per && per !== lastPer) {
      // 8. davr (hafta/oy) almashishi — jadval yon tomonga suriladi
      const box = m.querySelector("#tw") || (m.querySelector(".drow") || {}).parentElement;
      if (box) { box.style.setProperty("--anm-dir", per.split("|")[1] >= lastPer.split("|")[1] ? 1 : -1); re(box, "anm-per"); }
    }
    lastKey = key; lastPer = per;
    if (p) {
      // 3. yo'qlama / baho tugmasi
      if (p.pop) { const b = document.querySelector(p.pop); if (b) re(b, "anm-pop"); }
      if (p.all) { const rows = [...m.querySelectorAll(".lrow")]; const st = Math.min(18, 360 / Math.max(1, rows.length)); rows.forEach((r, i) => { r.style.setProperty("--anm-w", full() ? Math.round(i * st) + "ms" : "0ms"); re(r, "anm-wave"); }); re(m.querySelector("h1"), "anm-bump"); }
      // 6. kartochka bilan yo'qlama
      if (p.swc && p.page === key) cardFly(p.swc);
      // 10/17. saralash, o'chirish va qaytarish — qatorlar yangi joyiga sirpanadi
      if (p.rows) flip(p.rows, p.undo);
      // 19. tungi / kunduzgi
      if (p.dark !== html.dataset.theme) { html.classList.add("anm-theme"); clearTimeout(post.th); post.th = later(() => html.classList.remove("anm-theme"), dur(2) * 2.6); }
      P = null;
    }
    if (p) glide(p.grp);
    numbers(m);
    party(m);
    busy();
  }
  // 15. kutish: «⏳ PDF…», «Ochilmoqda…» kabi band tugmalar jimirlab turadi (To'liq), Yengilda — xira
  function busy() {
    document.querySelectorAll("button.anm-busy").forEach((b) => { if (!b.disabled || !/…\s*$/.test(b.textContent)) b.classList.remove("anm-busy"); });
    document.querySelectorAll("button:disabled").forEach((b) => { if (/…\s*$/.test(b.textContent)) b.classList.add("anm-busy"); });
  }
  // 9. tanlangan belgi (yorliq, Kun/Hafta, sana) yangi joyiga silliq siljiydi
  function glide(before) {
    if (!before || !before.size) return;
    document.querySelectorAll(GRP).forEach((g) => {
      const o = g.querySelector(":scope > .on"), was = before.get(gKey(g)); if (!o || !was) return;
      const a = g.getBoundingClientRect(), r = o.getBoundingClientRect();
      const now = {x: r.left - a.left + g.scrollLeft, y: r.top - a.top + g.scrollTop, w: r.width, h: r.height};
      if (Math.abs(now.x - was.x) < 2 && Math.abs(now.y - was.y) < 2) return;
      const cs = getComputedStyle(o), bg = cs.backgroundColor, clear = !bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
      const ul = clear && parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none" ? parseFloat(cs.borderBottomWidth) : 0;   // tagiga chizilgan yorliq
      if (clear && !ul) return;
      if (ul) { was.y += was.h - ul; now.y += now.h - ul; was.h = now.h = ul; }
      g.classList.add("anm-gl"); if (getComputedStyle(g).position === "static") g.classList.add("anm-rel");
      const b = document.createElement("i"); b.className = "anm-glide"; b.setAttribute("aria-hidden", "true");
      Object.assign(b.style, {width: was.w + "px", height: was.h + "px", background: ul ? cs.borderBottomColor : bg, borderRadius: ul ? "2px" : cs.borderRadius, boxShadow: ul ? "none" : cs.boxShadow, transform: `translate(${was.x}px,${was.y}px)`});
      g.append(b); o.classList.add(ul ? "anm-underl" : "anm-under"); void b.offsetWidth;
      Object.assign(b.style, {width: now.w + "px", height: now.h + "px", transform: `translate(${now.x}px,${now.y}px)`});
      later(() => { b.remove(); o.classList.remove("anm-under", "anm-underl"); g.classList.remove("anm-rel", "anm-gl"); }, dur(2) + 40);
    });
  }
  function cardFly(s) {
    const g = s.g; g.removeAttribute("id"); g.classList.add("anm-ghost", "anm-fly");
    Object.assign(g.style, {left: s.r.left + "px", top: s.r.top + "px", width: s.r.width + "px", height: s.r.height + "px"});
    g.style.setProperty("--anm-dir", s.dir); g.addEventListener("animationend", () => g.remove()); document.body.append(g); later(() => g.remove(), dur(2) + 80);
    re(document.getElementById("swc"), "anm-rise");
  }
  function flip(before, undo) {
    const after = rowsMap(); if (!after) return; const t = dur(2) * 1.5, moved = [];
    after.forEach((v, k) => {
      const b = before.get(k);
      if (!b) { if (undo) re(v.el, "anm-rise"); return; }
      const dy = b.top - v.top; if (!dy || Math.abs(dy) > 2400) return;
      v.el.style.transition = "none"; v.el.style.transform = `translateY(${dy}px)`; moved.push(v.el);
    });
    if (!moved.length) return; void document.body.offsetWidth;
    moved.forEach((e) => { e.style.transition = `transform ${t}ms cubic-bezier(.2,.8,.2,1)`; e.style.transform = ""; });
    later(() => moved.forEach((e) => { e.style.transition = ""; }), t + 60);
  }
  // 11. raqamlar sanab chiqadi, 12. diagramma o'sadi — faqat yangi ko'rsatilganda
  function numbers(m) {
    const ks = [...m.querySelectorAll(".hb-kpi>b, .ba-k b")].slice(0, 16), svg = [...m.querySelectorAll("svg.stat")];
    const sig = ks.map((k) => k.textContent).join("|") + "#" + svg.length;
    if (sig === lastSig) return; lastSig = sig;
    svg.forEach((s) => re(s, "anm-grow"));
    const T = full() ? 700 : 400;
    ks.forEach((b) => {
      const tn = [...b.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue)); if (!tn) return;
      const mm = tn.nodeValue.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/s); if (!mm) return;
      const [, pre, num, post2] = mm, sep = num.includes(",") ? "," : ".", dec = (num.split(/[.,]/)[1] || "").length, v = parseFloat(num.replace(",", "."));
      if (!isFinite(v) || v === 0) return;
      const fmt = (x) => pre + x.toFixed(dec).replace(".", sep) + post2, t0 = performance.now();
      const step = (now) => { if (!tn.isConnected) return; const k = Math.min(1, (now - t0) / T); tn.nodeValue = fmt(v * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
      tn.nodeValue = fmt(0); requestAnimationFrame(step);
    });
  }
  // 14. chorak yakuni — «🎉» (faqat To'liq), har chorak uchun bir marta
  function party(m) {
    const x = m.querySelector(".ba-x h2"); if (!x || !full()) return;
    const k = "anm-party:" + x.textContent.trim(); let seen = false;
    try { seen = !!localStorage.getItem(k); localStorage.setItem(k, "1"); } catch (e) { seen = !!party[k]; party[k] = 1; }
    if (!seen) confetti();
  }
  function confetti() {
    const c = document.createElement("div"); c.className = "anm-conf noprint"; c.setAttribute("aria-hidden", "true");
    const col = ["var(--acc)", "#2f9e57", "#e0a024", "#d9534f", "#7a5cc2", "#2f86d6"];
    c.innerHTML = Array.from({length: 46}, (_, i) => { const r = Math.random(), q = Math.random(); return `<i style="left:${(r * 100).toFixed(1)}%;--c:${col[i % col.length]};--dx:${((q - .5) * 180).toFixed(0)}px;--r:${Math.round(q * 720 - 360)}deg;--t:${(1.1 + r * .9).toFixed(2)}s;--dl:${(q * .25).toFixed(2)}s"></i>`; }).join("");
    document.body.append(c); later(() => c.remove(), 2600);
  }

  /* ── oynalar, xabarlar, ochiluvchi ro'yxatlar ── */
  function leaveable(n, cls) {
    const rm0 = Element.prototype.remove;
    n.remove = function () {
      if (this._anmOut) return; const t = on() && this.isConnected ? dur(1) : 0;
      if (!t) { rm0.call(this); return; }
      this._anmOut = 1; this.classList.remove("anm-in"); this.classList.add(cls); this.inert = true; this.setAttribute("aria-hidden", "true");
      later(() => rm0.call(this), t);
    };
  }
  function added(n) {
    if (n.nodeType !== 1 || !on()) return;
    if (n.classList.contains("modal")) { n.classList.add("anm-in"); leaveable(n, "anm-out"); dragClose(n); }
    else if (n.classList.contains("toast")) { document.querySelectorAll(".toast.anm-out").forEach((x) => Element.prototype.remove.call(x)); n.classList.add("anm-in"); leaveable(n, "anm-out"); }
    else if (n.classList.contains("bpop") || n.classList.contains("perpop")) n.classList.add("anm-in");
  }
  // 20. telefonda oynani pastga tortib yopish (tepadagi chiziqchadan)
  function dragClose(m) {
    const card = m.querySelector(":scope > .card"); if (!card || !matchMedia("(max-width: 820px)").matches) return;
    let y0 = null, dy = 0;
    card.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch" || e.clientY - card.getBoundingClientRect().top > 34 || card.scrollTop > 0) return; y0 = e.clientY; dy = 0; card.style.transition = "none"; });
    card.addEventListener("touchmove", (e) => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) e.preventDefault(); card.style.transform = `translateY(${dy}px)`; }, {passive: false});
    const end = () => { if (y0 === null) return; y0 = null; card.style.transition = ""; if (dy > 100 && m._close) { card.style.transform = ""; m._close(null); } else card.style.transform = ""; };
    card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end); card.addEventListener("touchend", end);
  }
  // 20. «Bugun»ni pastga tortib yangilash (telefon)
  function pullRefresh() {
    let y0 = null, dy = 0, ind = null;
    const ok = (e) => on() && typeof S !== "undefined" && S.page === "today" && window.scrollY <= 0 && !document.querySelector(".modal") && e.target.closest && e.target.closest("#main") && matchMedia("(max-width: 820px)").matches;
    document.addEventListener("touchstart", (e) => { if (!ok(e)) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, {passive: true});
    document.addEventListener("touchmove", (e) => {
      if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy <= 0 || window.scrollY > 0) { if (ind) ind.style.setProperty("--py", "-48px"); return; }
      e.preventDefault();
      if (!ind) { ind = document.createElement("div"); ind.className = "anm-ptr noprint"; ind.innerHTML = "<i>↓</i>"; document.body.append(ind); }
      ind.classList.remove("back"); ind.style.setProperty("--py", (Math.min(70, dy * .5) - 48) + "px"); ind.style.setProperty("--pr", dy * 2 + "deg");
    }, {passive: false});
    document.addEventListener("touchend", () => {
      if (y0 === null) return; y0 = null; const go = dy > 90, i = ind; ind = null; if (!i) return;
      if (!go) { i.classList.add("back"); i.style.setProperty("--py", "-48px"); later(() => i.remove(), 300); return; }
      i.style.setProperty("--py", "18px"); i.classList.add("spin");
      later(() => { if (typeof render === "function") render(); toast("Yangilandi"); i.classList.remove("spin"); i.classList.add("back"); i.style.setProperty("--py", "-48px"); later(() => i.remove(), 300); }, 500);
    });
  }

  /* ── 7. doskaga chaqirish: ismlar baraban kabi aylanadi (faqat To'liq) ── */
  function pick(box, names) {
    const nm = box && box.querySelector(".pname"); if (!nm || !full() || !names || names.length < 2) return false;
    const win = nm.textContent; let k = 0, sp = 40; box.classList.add("anm-drum");
    const tick = () => {
      if (!nm.isConnected) return;
      if (k >= 16) { nm.textContent = win; box.classList.remove("anm-drum"); re(box, "flash"); return; }
      nm.textContent = names[(k * 7 + 3) % names.length]; re(nm, "anm-tk"); k++; sp *= 1.13; later(tick, sp);
    };
    tick(); return true;
  }

  /* ── 16. xato bo'lsa chayqalish: belgi qo'yib bo'lmasa bosilgan katak chayqaladi ── */
  function shake() { if (!on() || !lastEl || performance.now() - lastAt > 600 || !lastEl.isConnected) { const c = document.querySelector("#tw .cell.sel"); if (c && on()) re(c, "anm-shake"); return; } re(lastEl, "anm-shake"); }

  /* ── Sozlamalar → Dizayn → Ko'rinish ── */
  function body() {
    const cur = want(), r = rm();
    return `<div class="sgroup dzg anm-set"><div class="dzh"><h3 class="sgt">Animatsiyalar</h3><span>Bo'lim almashishi, oynalar va belgilar harakati</span></div>
      <div class="radios">${Object.entries(LV).map(([k, [n, d]]) => `<button class="rd ${cur === k ? "on" : ""}" data-anim-l="${k}" role="radio" aria-checked="${cur === k}"><i class="rdo"></i><span><b>${n}${k === "lite" ? ' <em class="anm-std">★ standart</em>' : ""}</b><small>${d}</small></span></button>`).join("")}</div>
      <div class="anm-demo"><span class="anm-ball" aria-hidden="true">+</span><span class="muted">Tanlanganini sinab ko'ring</span><button class="btn btn-sm" data-anim-try>▶ Sinab ko'rish</button></div>
      ${r ? `<p class="anm-warn">Qurilmangizda «harakatni kamaytirish» yoqilgan, shuning uchun animatsiyalar o'chiq. Uni telefon yoki kompyuter sozlamasida o'zgartirish mumkin.</p>` : `<p class="muted anm-note">Chop etish, PDF va Excel'ga ta'sir qilmaydi.</p>`}</div>`;
  }
  function set(v) { if (!LV[v]) return; if (v === "lite") delete D.web.anim; else D.web.anim = v; save(); apply(); render(); toast("Animatsiya: " + LV[level()][0]); }
  function bind(m) {
    m.querySelectorAll("[data-anim-l]").forEach((b) => b.onclick = () => set(b.dataset.animL));
    const t = m.querySelector("[data-anim-try]"); if (t) t.onclick = () => { re(m.querySelector(".anm-ball"), "anm-pop"); toast("Animatsiya: " + LV[level()][0]); };
  }
  // Ctrl+K: O'chiq → Yengil → To'liq → O'chiq
  function cycle() { const o = ["off", "lite", "full"]; set(o[(o.indexOf(want()) + 1) % 3]); }

  function init() {
    apply();
    if (mq && mq.addEventListener) mq.addEventListener("change", () => { apply(); if (typeof S !== "undefined" && S.page === "settings") render(); });
    document.addEventListener("click", (e) => snap(e, "click"), true);
    document.addEventListener("change", (e) => snap(e, "change"), true);
    document.addEventListener("keydown", (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || "")) snap(e, "key"); }, true);
    new MutationObserver((rs) => { let sub = false; rs.forEach((r) => { if (r.target === document.body) r.addedNodes.forEach(added); else sub = true; }); if (sub) queue(); })
      .observe(document.body, {childList: true, subtree: true});
    // belgi qo'yib bo'lmasa — chayqalish
    if (typeof putMark === "function") { const p0 = putMark; putMark = function (c, si, d, nw, quiet) { const r = p0.apply(this, arguments); if (r === false && !quiet) shake(); return r; }; }
    pullRefresh();
    lastKey = pageKey(); lastPer = perKey();
  }
  return {init, level, want, body, bind, cycle, set, pick, apply, LV};
})();
