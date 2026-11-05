/* ───────── TPT guruhlari: yillik mavzular rejasi (alohida fayl) ─────────
   guruhlar.js dan oldin yuklanadi; guruhlar.js o'z yordamchilarini TPTM.init(...) bilan beradi.

   Ma'lumot (D.classes ichidagi guruhda):
     c.gplan = {topics: [{t, h}], start: "YYYY-MM-DD"}   t — mavzu, h — necha dars (1…10), start — reja boshlanadigan kun
     c.gtop  = {"YYYY-MM-DD": {t: "o'z mavzusi"} | {off: true}}   kun bo'yicha o'zgartirish
   Qoida: mavzular start kunidan boshlab guruhning dars kunlariga tartib bilan qo'yiladi.
     Dars kuni = jadvaldagi kun (bayram emas)  yoki  jadvaldan tashqari kun, lekin kimdir kelgan (qo'shimcha dars).
     «Dars bo'lmadi» (off) yoki «Boshqa mavzu» (t) belgilangan kun rejadan mavzu olmaydi — qolganlari bir darsga suriladi. */
const TPTM = (() => {
  let H = null; // guruhlar.js yordamchilari
  const ISO = /^\d{4}-\d\d-\d\d$/;
  const T = {flt: "next"};

  function parse(text) {
    const out = [];
    for (const raw of String(text || "").split(/\r?\n/)) {
      let line = raw.trim(); if (!line || line.startsWith("#") || /^=+/.test(line) || /^([1-4]|IV|III|II|I)\s*-?\s*chorak\b/i.test(line)) continue;
      let h = 1; const parts = line.split(/\s*\|\s*|\t+/);
      if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1].trim())) { h = Math.max(1, Math.min(+parts[parts.length - 1], 10)); line = parts.slice(0, -1).join(" / ").trim(); }
      line = line.replace(/^\d+\s*[.)]\s+/, "").trim().slice(0, 200);
      if (line) out.push({t: line, h});
    }
    return out.slice(0, 600);
  }
  const toText = (p) => (p && p.topics || []).map((x) => x.h > 1 ? `${x.t} | ${x.h}` : x.t).join("\n");
  function slots(p) {
    const o = [];
    (p && p.topics || []).forEach((x, i) => { const h = Math.max(1, +x.h || 1); for (let k = 0; k < h; k++) o.push({t: x.t, i, k, h}); });
    return o;
  }
  const has = (c) => !!(c && c.gplan && c.gplan.topics && c.gplan.topics.length);
  const holi = (d) => { try { return typeof holidaySet === "function" && holidaySet(+d.slice(0, 4)).has(d); } catch (err) { return false; } };
  // mavzular kunlarga: {map: {sana: {n, s?, own?, off?}}, rows: [{d, n, s}], end, total}
  function layout(c) {
    const p = c.gplan, sl = slots(p), top = c.gtop || {}, map = {}, rows = [];
    if (!sl.length) return {map, rows, total: 0, end: ""};
    const start = ISO.test(String(p.start || "")) ? p.start : H.today();
    const x = H.pd(start); let n = 0;
    for (let i = 0; i < 1100 && n < sl.length; i++, x.setDate(x.getDate() + 1)) {
      const d = H.iso(x), o = top[d];
      const les = (H.isLesson(c, d) && !holi(d)) || H.cntOn(c, d) > 0;
      if (o && o.off) { if (les || H.isLesson(c, d)) map[d] = {off: true}; continue; }
      if (!les && !(o && o.t)) continue;
      if (o && o.t) { map[d] = {own: o.t}; rows.push({d, own: o.t}); continue; }
      map[d] = {n: n + 1, s: sl[n]}; rows.push({d, n: n + 1, s: sl[n]}); n++;
    }
    // reja tugaganidan keyin ham o'z mavzusi yozilgan kunlar ro'yxatda qolsin
    for (const d of Object.keys(top).sort()) if (top[d].t && !map[d]) { map[d] = {own: top[d].t}; rows.push({d, own: top[d].t}); }
    rows.sort((a, b) => a.d.localeCompare(b.d));
    return {map, rows, total: sl.length, placed: n, end: rows.filter((r) => r.n).map((r) => r.d).pop() || ""};
  }
  const sTxt = (s) => s.h > 1 ? `${s.t} (${s.k + 1}/${s.h})` : s.t;
  // kun ro'yxati ustidagi mavzu qatori (Yo'qlama → Kun)
  function dayStrip(c, d) {
    if (!has(c)) return "";
    const L = layout(c), m = L.map[d];
    if (!m) return H.isLesson(c, d) && holi(d) ? `<div class="g-tpc off"><span class="g-tpn">Bayram</span><span class="g-tpt">Bu kun dam olish — mavzu keyingi darsga</span></div>` : "";
    const lab = m.off ? "Dars bo'lmadi" : m.own ? "Boshqa mavzu" : `${m.n}-dars`;
    const txt = m.off ? "Rejadagi mavzu keyingi darsga surildi" : m.own ? H.e(m.own) : H.e(sTxt(m.s));
    return `<div class="g-tpc ${m.off ? "off" : m.own ? "own" : ""}"><span class="g-tpn g-num">${lab}${m.n ? ` / ${L.total}` : ""}</span><span class="g-tpt">${txt}</span><button class="g-btn sm ghost" type="button" data-tpe="${d}" aria-label="Mavzuni o'zgartirish">✎</button></div>`;
  }
  // «Mavzular» bo'limi
  function tabHtml(c) {
    if (!has(c)) return `<div class="g-card g-empty"><h2>Yillik mavzular rejasi kiritilmagan</h2>
      <div class="g-muted">Mavzularni bir marta kiriting — ular guruhning dars kunlariga (${H.e(H.sched(c))}) tartib bilan o'zi qo'yiladi. Har kuni Yo'qlamada shu kun mavzusi ko'rinadi.</div>
      <div class="g-row" style="justify-content:center"><button class="g-btn pri" type="button" data-tpl>＋ Mavzularni kiritish</button><button class="g-btn" type="button" data-tpx>Excel'dan yuklash</button></div></div>`;
    const L = layout(c), t = H.today(), done = L.rows.filter((r) => r.n && r.d < t).length, cur = L.rows.find((r) => r.d >= t && r.n);
    const pct = L.total ? Math.round(done / L.total * 100) : 0;
    let list = L.rows.concat(Object.keys(L.map).filter((d) => L.map[d].off).map((d) => ({d, off: true}))).sort((a, b) => a.d.localeCompare(b.d));
    if (T.flt === "next") list = list.filter((r) => r.d >= t); else if (T.flt === "past") list = list.filter((r) => r.d < t).reverse();
    const left = L.total - L.placed;
    let mo = "", body = "";
    for (const r of list) {
      const m = r.d.slice(0, 7);
      if (m !== mo) { mo = m; body += `<div class="g-tmh">${H.MN[+m.slice(5) - 1]} ${m.slice(0, 4)}</div>`; }
      const st = r.d < t ? "past" : r.d === t ? "now" : "";
      body += `<div class="g-trow ${st} ${r.off ? "off" : ""} ${r.own ? "own" : ""}">
        <span class="g-tdd"><b class="g-num">${+r.d.slice(8, 10)}</b><small>${H.WDS[H.wdOf(r.d)]}</small></span>
        <span class="g-tno g-num">${r.n || (r.off ? "—" : "＊")}</span>
        <span class="g-ttx">${r.off ? `<i>Dars bo'lmadi</i>` : r.own ? `${H.e(r.own)} <small>boshqa mavzu</small>` : H.e(sTxt(r.s))}</span>
        ${st === "now" ? `<span class="g-pill p-acc">Bugun</span>` : st === "past" && !r.off ? `<span class="g-tok" aria-label="o'tildi">✓</span>` : ""}
        <button class="g-btn sm ghost" type="button" data-tpe="${r.d}" aria-label="O'zgartirish">✎</button></div>`;
    }
    return `<div class="g-card g-tsum">
        <div class="g-row" style="flex-wrap:nowrap;align-items:flex-start"><div style="flex:1;min-width:0"><h2>Yillik mavzular</h2>
          <div class="g-muted" style="font-size:13px">${c.gplan.topics.length} mavzu · ${L.total} dars · ${H.dm(c.gplan.start || t)} ${String(c.gplan.start || t).slice(0, 4)} dan</div></div>
          <button class="g-btn sm" type="button" data-tpl>Tahrirlash</button></div>
        <div class="g-tbar"><i style="width:${pct}%"></i></div>
        <div class="g-row g-num" style="font-size:13px;gap:6px 14px"><span><b>${done}</b> / ${L.total} dars o'tildi</span><span class="g-muted">${left > 0 ? `${left} darsga kun yetmadi` : L.end ? `reja ${H.dm(L.end)} ${L.end.slice(0, 4)} da tugaydi` : ""}</span></div>
        ${cur ? `<div class="g-tnext"><small>${cur.d === t ? "Bugungi mavzu" : `Keyingi dars — ${H.dm(cur.d)}, ${H.WL[H.wdOf(cur.d)]}`}</small><b>${cur.n}. ${H.e(sTxt(cur.s))}</b></div>` : `<div class="g-tnext"><small>Reja</small><b>Hamma mavzular o'tildi</b></div>`}
      </div>
      <div class="g-row"><div class="g-seg"><button type="button" data-tpf="next" class="${T.flt === "next" ? "on" : ""}">Qolganlari</button><button type="button" data-tpf="past" class="${T.flt === "past" ? "on" : ""}">O'tilganlar</button><button type="button" data-tpf="all" class="${T.flt === "all" ? "on" : ""}">Hammasi</button></div></div>
      <div class="g-card g-tlist">${body || `<div class="g-muted">${T.flt === "past" ? "Hali o'tilgan mavzu yo'q." : "Qolgan mavzu yo'q."}</div>`}</div>
      <span class="g-muted" style="font-size:12.5px;line-height:1.45">Mavzular dars kunlariga tartib bilan qo'yiladi: jadvaldagi kunlar (bayramlar o'tkazib yuboriladi) va jadvaldan tashqari kimdir kelgan kunlar. ✎ — «Dars bo'lmadi» yoki «Boshqa mavzu» desangiz, keyingi mavzular bir darsga suriladi.</span>`;
  }

  // reja oynasi: matn yoki Excel
  function planDialog(c, pre) {
    const F = {text: pre != null ? pre : toText(c.gplan), start: c.gplan && ISO.test(String(c.gplan.start || "")) ? c.gplan.start : schoolStart()};
    const cnt = (txt) => { const p = parse(txt); return `${p.length} mavzu · ${p.reduce((a, x) => a + x.h, 0)} dars`; };
    const draw2 = () => H.openLayer(`<div class="g-dlg g-tdlg" role="dialog" aria-modal="true" aria-label="Yillik mavzular">${H.hdr("Yillik mavzular")}
      <div class="g-fld"><label for="g-tt">Mavzular — har qatorda bittasi</label>
        <textarea id="g-tt" class="g-inp g-tta" rows="10" placeholder="Tanishuv. Alifbo&#10;Present Simple | 2&#10;Oila haqida suhbat">${H.e(F.text)}</textarea>
        <span class="g-muted" style="font-size:12.5px;line-height:1.4">Bir mavzuga bir necha dars kerak bo'lsa, oxiriga «| 2» yozing. <b id="g-tc" class="g-num" style="color:var(--g-text)">${cnt(F.text)}</b></span></div>
      <button class="g-btn" type="button" data-tpx>Excel fayldan yuklash</button>
      <div class="g-fld"><span class="g-lbl">Reja qaysi kundan boshlanadi</span>
        <div class="g-chips eq3"><button type="button" class="g-chip ${F.start === schoolStart() ? "on" : ""}" data-tps="${schoolStart()}">1-sentabr</button><button type="button" class="g-chip ${F.start === H.today() ? "on" : ""}" data-tps="${H.today()}">Bugundan</button><button type="button" class="g-chip ${F.start !== schoolStart() && F.start !== H.today() ? "on" : ""}" data-tpo>${F.start !== schoolStart() && F.start !== H.today() ? `${H.dm(F.start)}` : "Boshqa kun"}</button></div></div>
      <div class="g-foot2"><button class="g-btn" type="button" data-x>Bekor qilish</button><button class="g-btn pri" type="button" data-save>Saqlash</button></div>
      ${has(c) ? `<button class="g-btn ghost dang" type="button" data-tpdel>Rejani o'chirish</button>` : ""}</div>`, true, (w) => {
      const ta = H.q("#g-tt", w);
      ta.oninput = () => { F.text = ta.value; H.q("#g-tc", w).textContent = cnt(ta.value); };
      H.qa("[data-tps]", w).forEach((b) => b.onclick = () => { F.text = ta.value; F.start = b.dataset.tps; draw2(); });
      H.q("[data-tpo]", w).onclick = () => { F.text = ta.value; H.dayPicker({title: "Reja boshlanadigan kun", cur: F.start, future: true, pick: (d) => { F.start = d; draw2(); }, back: draw2}); };
      H.q("[data-tpx]", w).onclick = () => { F.text = ta.value; fromExcel(c, (txt) => { F.text = txt; draw2(); }); };
      const dl = H.q("[data-tpdel]", w); if (dl) dl.onclick = () => H.confirmG("Rejani o'chirish", "Yillik mavzular rejasi va kunlarga yozilgan o'zgartirishlar o'chiriladi. Yo'qlama va to'lovlarga tegilmaydi.", "O'chirish", () => { delete c.gplan; delete c.gtop; H.save(); H.draw(); H.toast("Reja o'chirildi"); });
      H.q("[data-save]", w).onclick = () => {
        const topics = parse(ta.value); if (!topics.length) { H.toast("Kamida bitta mavzu yozing"); return; }
        c.gplan = {topics, start: F.start}; H.save(); H.closeLayer(); H.draw();
        const L = layout(c); H.toast(`${topics.length} mavzu dars kunlariga qo'yildi${L.total - L.placed > 0 ? `, ${L.total - L.placed} tasiga kun yetmadi` : ""}`);
      };
    });
    draw2();
  }
  function schoolStart() { const t = H.today(), y = +t.slice(0, 4) - (+t.slice(5, 7) < 8 ? 1 : 0); return `${y}-09-01`; }
  function fromExcel(c, done) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv,.txt";
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        if (/\.(txt|csv)$/i.test(f.name)) { done((await f.text()).split(/\r?\n/).map((l) => l.split(/[;,]\s*/).filter(Boolean).sort((a, b) => b.length - a.length)[0] || "").join("\n")); return; }
        if (typeof planFromExcel !== "function") { H.toast("Excel o'qib bo'lmadi"); return; }
        const sh = await planFromExcel(f, {name: c.name, subject: c.subject || ""});
        if (!sh.length) { H.toast("Faylda mavzular topilmadi: «Mavzu» ustuni bo'lishi kerak"); return; }
        done(sh[0].text); H.toast(`«${sh[0].n}» varag'idan ${sh[0].k} mavzu olindi — tekshirib, Saqlang`);
      } catch (err) { H.toast("Faylni o'qib bo'lmadi"); }
    };
    inp.click();
  }
  // kun mavzusini o'zgartirish
  function dayDialog(c, d) {
    const o = (c.gtop || {})[d] || {};
    // shu kunga rejadan qaysi mavzu tushardi (o'zgartirish bo'lmasa)
    const plain = (() => { const keep = c.gtop; const tmp = Object.assign({}, keep); delete tmp[d]; c.gtop = tmp; const r = layout(c).map[d]; c.gtop = keep; return r && r.s ? r : null; })();
    const F = {k: o.off ? "off" : o.t ? "own" : "plan", t: o.t || ""};
    const draw2 = () => H.openLayer(`<div class="g-dlg" role="dialog" aria-modal="true" aria-label="Kun mavzusi">${H.hdr(`${H.dm(d)}, ${H.WL[H.wdOf(d)]}`)}
      <div class="g-topts">
        <button type="button" class="g-chip ${F.k === "plan" ? "on" : ""}" data-tk="plan">Rejadagi mavzu<small>${plain ? `${plain.n}. ${H.e(sTxt(plain.s))}` : "bu kunga rejadan mavzu tushmaydi"}</small></button>
        <button type="button" class="g-chip ${F.k === "own" ? "on" : ""}" data-tk="own">Boshqa mavzu o'tildi<small>rejadagi mavzu keyingi darsga suriladi</small></button>
        <button type="button" class="g-chip ${F.k === "off" ? "on" : ""}" data-tk="off">Dars bo'lmadi<small>mavzular bir darsga suriladi</small></button></div>
      ${F.k === "own" ? `<div class="g-fld"><label for="g-to">Mavzu</label><input id="g-to" class="g-inp" value="${H.e(F.t)}" placeholder="Masalan: Takrorlash, nazorat ishi" autofocus></div>` : ""}
      <div class="g-foot2"><button class="g-btn" type="button" data-x>Bekor qilish</button><button class="g-btn pri" type="button" data-save>Saqlash</button></div></div>`, true, (w) => {
      H.qa("[data-tk]", w).forEach((b) => b.onclick = () => { const i = H.q("#g-to", w); if (i) F.t = i.value; F.k = b.dataset.tk; draw2(); });
      H.q("[data-save]", w).onclick = () => {
        const top = Object.assign({}, c.gtop || {});
        if (F.k === "plan") delete top[d];
        else if (F.k === "off") top[d] = {off: true};
        else { const v = H.q("#g-to", w).value.trim().slice(0, 200); if (!v) { H.toast("Mavzuni yozing"); return; } top[d] = {t: v}; }
        if (Object.keys(top).length) c.gtop = top; else delete c.gtop;
        H.save(); H.closeLayer(); H.draw(); H.toast("Saqlandi");
      };
    });
    draw2();
  }
  // bosh sahifadagi guruh kartasi uchun: bugungi mavzu
  function todayLine(c) { if (!has(c)) return ""; const m = layout(c).map[H.today()]; return m && m.s ? `${m.n}. ${sTxt(m.s)}` : m && m.own ? m.own : ""; }
  function topicOf(c, d) { if (!has(c)) return ""; const m = layout(c).map[d]; return m ? m.off ? "Dars bo'lmadi" : m.own ? m.own : `${m.n}. ${sTxt(m.s)}` : ""; }

  function bind(m, c) {
    H.qa("[data-tpl]", m).forEach((b) => b.onclick = () => planDialog(c));
    H.qa("[data-tpx]", m).forEach((b) => b.onclick = () => fromExcel(c, (txt) => planDialog(c, txt)));
    H.qa("[data-tpe]", m).forEach((b) => b.onclick = () => dayDialog(c, b.dataset.tpe));
    H.qa("[data-tpf]", m).forEach((b) => b.onclick = () => { T.flt = b.dataset.tpf; H.draw(); });
  }
  return {init: (h) => { H = h; }, parse, layout, has, tabHtml, dayStrip, bind, todayLine, topicOf, _state: T};
})();
