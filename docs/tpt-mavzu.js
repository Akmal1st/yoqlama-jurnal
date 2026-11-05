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
  const T = {flt: "next", view: "plan", rq: null, rk: "q", rs: "", rv: "scr", o: {by: "topic", stu: true, sum: true, sig: true, chart: true, rec: true, st: "v3"}};
  try { Object.assign(T.o, JSON.parse(localStorage.getItem("yoqlama_tptrep2")) || {}); } catch (err) { /* sozlama yo'q */ }
  // varaq uslubi: v3 — «Kartochkali» (yangi), mod — «Zamonaviy», off — «Rasmiy (oq-qora)»
  const stCls = () => T.o.st === "off" ? "" : T.o.st === "mod" ? "mod" : "mod v3";
  const stSeg = () => `<div class="g-seg g-stseg">${[["v3", "Kartochkali"], ["mod", "Zamonaviy"], ["off", "Rasmiy (oq-qora)"]].map(([k, l]) => `<button type="button" data-tpst="${k}" class="${(T.o.st || "v3") === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const keepO = () => { try { localStorage.setItem("yoqlama_tptrep2", JSON.stringify(T.o)); } catch (err) { /* saqlanmadi */ } };

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
  function planHtml(c) {
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

  /* ───────── chorak hisoboti: o'tilgan mavzular ─────────
     Chorak davri TPT uchun: oldingi chorak tugagan kundan keyin — shu chorak oxirigacha (ta'tildagi darslar keyingi chorakka kiradi);
     1-chorak reja boshlanishidan (chorakdan oldin bo'lsa). Chorak tugagach (oxirgi kundan keyin) hisobot «tayyor» bo'ladi. */
  const qR = (q) => { try { return typeof qRange === "function" ? qRange(q) : null; } catch (err) { return null; } };
  const addD = (d, k) => { const x = H.pd(d); x.setDate(x.getDate() + k); return H.iso(x); };
  // q = 0 — butun o'quv yili (1-chorak boshidan oxirgi chorak oxirigacha)
  function qPer(c, q) {
    if (q === 0) { const qs = [1, 2, 3, 4].filter((x) => qR(x)); if (!qs.length) return null; const a = qPer(c, qs[0]), b = qR(qs[qs.length - 1]); return {q: 0, lab: "Butun o'quv yili", from: a.from, to: b[1], end: b[1]}; }
    const r = qR(q); if (!r) return null;
    const pv = q > 1 ? qR(q - 1) : null, st = c.gplan && ISO.test(String(c.gplan.start || "")) ? c.gplan.start : r[0];
    return {q, lab: `${q}-chorak`, from: pv ? addD(pv[1], 1) : st < r[0] ? st : r[0], to: r[1], end: r[1]};
  }
  const qLab = (q) => q ? `${q}-chorak` : "yillik";
  const qBadge = (P) => P.q ? `<div class="g-a4qb"><b>${P.q}</b><span>chorak</span></div>` : `<div class="g-a4qb"><b>${yearOf(P.from).replace("–", "/").replace(/(\d\d)(\d\d)\/(\d\d)(\d\d)/, "$2/$4")}</b><span>o'quv yili</span></div>`;
  const qDone = (c, q) => { const p = qPer(c, q); return !!p && p.end < H.today(); };
  // shu kunlarda tugagan chorak (21 kun ichida), hisoboti hali ko'rilmagan
  function freshQ(c) {
    if (!has(c)) return 0; const t = H.today();
    for (let q = 4; q >= 1; q--) { const p = qPer(c, q); if (p && p.end < t && addD(p.end, 21) >= t) return (c.grep || {})[q] ? 0 : q; }
    return 0;
  }
  const fullD = (d) => `${H.dm(d)} ${d.slice(0, 4)}`;
  function repData(c, q) {
    const P = qPer(c, q); if (!P) return null;
    const L = layout(c), t = H.today(), upto = P.to < t ? P.to : addD(t, -1);
    const inP = (d) => d >= P.from && d <= upto;
    const rows = L.rows.filter((r) => inP(r.d)).map((r) => { const na = H.actOn(c, r.d).length, k = H.cntOn(c, r.d); return Object.assign({}, r, {k, na}); });
    const offs = Object.keys(L.map).filter((d) => L.map[d].off && inP(d)).sort();
    const plan = rows.filter((r) => r.n), own = rows.filter((r) => r.own);
    const topics = [...new Set(plan.map((r) => r.s.i))], last = plan.length ? plan[plan.length - 1].n : (L.rows.filter((r) => r.n && r.d < P.from).pop() || {}).n || 0;
    const first = plan.length ? plan[0].n : 0;
    const sumK = rows.reduce((a, r) => a + r.k, 0), sumN = rows.reduce((a, r) => a + r.na, 0);
    const st = c.students.map((s) => { const ds = rows.filter((r) => H.inG(s, r.d)); const came = ds.filter((r) => (s.marks || {})[r.d] === "ot").length; return {name: s.name, all: ds.length, came, miss: ds.length - came}; }).filter((x) => x.all);
    const nxt = q ? qPer(c, q + 1) : null, nrows = nxt ? L.rows.filter((r) => r.n && r.d >= nxt.from && r.d <= nxt.to) : L.rows.filter((r) => r.n && r.d > P.to);
    const partial = !qDone(c, q);
    return {P, rows, offs, plan, own, topics, first, last, total: L.total, nTopics: c.gplan.topics.length, att: sumN ? Math.round(sumK / sumN * 100) : 0,
      miss: st.filter((x) => x.miss).sort((a, b) => b.miss - a.miss || a.name.localeCompare(b.name)).slice(0, 3),
      full: st.filter((x) => !x.miss).length, nSt: st.length, stu: st, end: L.end,
      months: [...new Set(rows.map((r) => r.d.slice(0, 7)))].map((m) => { const rs = rows.filter((r) => r.d.startsWith(m)), k = rs.reduce((a, r) => a + r.k, 0), n = rs.reduce((a, r) => a + r.na, 0);
        return {m, n: rs.length, t: new Set(rs.filter((r) => r.n).map((r) => r.s.i)).size, att: n ? Math.round(k / n * 100) : 0}; }), nrows, partial, upto};
  }
  // o'qituvchi uchun tayyor matn (xulosa) — ota-onalar guruhiga yoki ma'muriyatga
  function summary(c, A) {
    const sl = slots(c.gplan), P = A.P, out = [];
    out.push(`«${c.name}» guruhi, ${P.lab.toLowerCase()} (${H.dm(P.from)} – ${fullD(A.partial ? A.upto : P.to)}).`);
    if (!A.rows.length) { out.push("Bu davrda dars o'tkazilmagan."); return out; }
    out.push(`${A.rows.length} ta dars o'tkazildi${A.own.length ? `, shundan ${A.own.length} tasi rejadan tashqari mavzu` : ""}. Yillik rejadagi ${A.total} darsdan ${A.first ? `${A.first}–${A.last}-darslar` : "hech biri"} o'tildi (${A.topics.length} ta mavzu); yillik reja ${Math.round(A.last / A.total * 100)}% bajarildi.`);
    const sh = A.offs.length + A.own.length;
    out.push(sh ? `${A.offs.length ? `${A.offs.length} kun dars bo'lmadi (${A.offs.map(H.dm).join(", ")})` : ""}${A.offs.length && A.own.length ? ", " : ""}${A.own.length ? `${A.own.length} darsda boshqa mavzu o'tildi` : ""} — reja ${sh} darsga surildi.` : "Darslar reja bo'yicha, kechikishsiz o'tildi.");
    out.push(`O'rtacha davomat ${A.att}%. ${A.full ? `${A.full} o'quvchi birorta ham darsni qoldirmadi.` : ""}${A.miss.length ? ` Ko'p qoldirganlar: ${A.miss.map((x) => `${x.name} (${x.miss})`).join(", ")}.` : ""}`.trim());
    if (A.nrows.length) { const a = A.nrows[0], b = A.nrows[A.nrows.length - 1]; out.push(`Keyingi chorakda ${A.nrows.length} ta dars rejalashtirilgan: «${a.s.t}» dan «${b.s.t}» gacha.`); }
    else if (A.last >= sl.length) out.push("Yillik reja to'liq bajarildi.");
    return out;
  }
  // tavsiyalar: ma'lumotdan kelib chiqadigan aniq takliflar
  function advice(c, A) {
    const out = [], pc = (x) => x.all ? Math.round(x.came / x.all * 100) : 100;
    const low = A.stu.filter((x) => pc(x) < 75).sort((a, b) => pc(a) - pc(b));
    if (low.length) out.push(`${low.slice(0, 5).map((x) => x.name).join(", ")}${low.length > 5 ? ` va yana ${low.length - 5} nafar` : ""} — davomati 75% dan past; ota-onalari bilan suhbat o'tkazish va qoldirilgan mavzularni qayta tushuntirish tavsiya etiladi.`);
    const tp = {}; for (const r of A.rows) if (r.n && r.na) { const t = tp[r.s.i] || (tp[r.s.i] = {t: r.s.t, k: 0, n: 0}); t.k += r.k; t.n += r.na; }
    const weak = Object.values(tp).filter((x) => x.k / x.n < 0.75).sort((a, b) => a.k / a.n - b.k / b.n).slice(0, 2);
    if (weak.length) out.push(`${weak.map((x) => `«${x.t}» (${Math.round(x.k / x.n * 100)}%)`).join(", ")} mavzularida davomat past bo'ldi — takrorlash darsida qisqacha qaytarish kerak.`);
    const sh = A.offs.length + A.own.length, q4 = qR(4);
    if (A.end && q4 && A.end > q4[1]) out.push(`Joriy sur'atda yillik reja ${fullD(A.end)} da tugaydi — o'quv yili oxiridan (${fullD(q4[1])}) keyin. Qo'shimcha dars belgilash yoki ayrim mavzularni birlashtirish kerak.`);
    else if (sh) out.push(`Reja ${sh} darsga surilgan, lekin yil oxirigacha yetadi${A.end ? ` (taxminan ${fullD(A.end)})` : ""}.`);
    if (!out.length) out.push("Reja va davomat bo'yicha kamchilik yo'q — shu tartibda davom ettirish tavsiya etiladi.");
    return out;
  }
  // har bir dars davomati — oq-qora ustunli grafik (A4 uchun)
  function chartSvg(A) {
    const rs = A.rows; if (rs.length < 2) return "";
    const W = 680, Hh = 96, pad = 24, bw = (W - pad) / rs.length, y = (v) => 6 + (Hh - 20) * (1 - v);
    let g = `<line x1="${pad}" x2="${W}" y1="${y(.75)}" y2="${y(.75)}" stroke="#000" stroke-dasharray="3 3" stroke-width=".8"/><text x="0" y="${y(.75) + 3}" font-size="8">75%</text><text x="0" y="${y(1) + 3}" font-size="8">100</text>`;
    rs.forEach((r, i) => { const v = r.na ? r.k / r.na : 0, x = pad + i * bw + bw * .15, w = bw * .7;
      g += `<rect x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" class="${r.own ? "c3" : v < .75 ? "c2" : "c1"}" fill="${r.own ? "#fff" : v < .75 ? "#000" : "#9a9a9a"}" stroke="#000" stroke-width=".6"/>`;
      if (i % Math.ceil(rs.length / 13) === 0) g += `<text x="${(x + w / 2).toFixed(1)}" y="${Hh - 2}" font-size="8" text-anchor="middle">${r.d.slice(8, 10)}.${r.d.slice(5, 7)}</text>`; });
    return `<svg class="g-a4ch" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Har bir darsdagi davomat">${g}<line x1="${pad}" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="#000" stroke-width=".8"/></svg>`;
  }
  function sheet(c, A) {
    const P = A.P, lines = summary(c, A);
    const list = A.rows.concat(A.offs.map((d) => ({d, off: true}))).sort((a, b) => a.d.localeCompare(b.d));
    return `<div class="g-rhead"><small>O'tilgan mavzular hisoboti</small><h2>${H.e(c.name)} · ${P.lab}</h2>
        <span class="g-muted">${fullD(P.from)} – ${fullD(P.to)} · ${H.e(H.sched(c))} · ${A.nSt} o'quvchi${A.partial ? ` · <b class="g-rpart">chorak hali tugamagan, ${H.dm(A.upto)} gacha</b>` : ""}</span></div>
      <div class="g-rkpi g-num"><div><b>${A.rows.length}</b><span>dars o'tkazildi</span></div><div><b>${A.topics.length}</b><span>mavzu o'tildi</span></div>
        <div><b>${A.total ? Math.round(A.last / A.total * 100) : 0}%</b><span>yillik reja</span></div><div><b>${A.att}%</b><span>davomat</span></div></div>
      <div class="g-rsum"><h3>Xulosa</h3>${lines.map((x) => `<p>${H.e(x)}</p>`).join("")}</div>
      <div class="g-rtw"><table class="g-rtab"><thead><tr><th>№</th><th>Sana</th><th class="l">Mavzu</th><th>Keldi</th></tr></thead>
        <tbody>${list.map((r) => `<tr class="${r.off ? "off" : r.own ? "own" : ""}"><td class="g-num">${r.n || (r.off ? "—" : "＊")}</td><td class="g-num">${+r.d.slice(8, 10)}.${r.d.slice(5, 7)} <small>${H.WDS[H.wdOf(r.d)]}</small></td>
          <td class="l">${r.off ? "Dars bo'lmadi" : r.own ? `${H.e(r.own)} <small>(rejadan tashqari)</small>` : H.e(sTxt(r.s))}</td><td class="g-num">${r.off ? "" : `${r.k}/${r.na}`}</td></tr>`).join("") || `<tr><td colspan="4">Bu davrda dars yo'q</td></tr>`}</tbody></table></div>
      ${A.nrows.length ? `<div class="g-rnext"><h3>Keyingi chorak rejasi</h3><span>${A.nrows.length} dars · ${A.nrows[0].n}–${A.nrows[A.nrows.length - 1].n}-darslar: ${H.e(A.nrows[0].s.t)} … ${H.e(A.nrows[A.nrows.length - 1].s.t)}</span></div>` : ""}
      <div class="g-rsig"><span>O'qituvchi: ____________________</span><span>${fullD(H.today())}</span></div>`;
  }
  /* ───────── A4 varaq (chop etish va PDF) ─────────
     Rasmiy hujjat ko'rinishi: oq-qora, Times. Avval bitta varaqqa sig'dirishga harakat (shrift 14 → 10 px),
     sig'masa — jadval keyingi varaqqa «(davomi)» bilan o'tadi. O'lchash yashirin .g-a4host ichida. */
  const hdrS = () => { try { return Object.assign({school: "", teacher: ""}, (D.web || {}).bsb_hdr || {}); } catch (err) { return {school: "", teacher: ""}; } };
  const yearOf = (d) => { const y = +d.slice(0, 4) - (+d.slice(5, 7) < 8 ? 1 : 0); return `${y}–${y + 1}`; };
  const dd = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  function a4parts(c, A) {
    const P = A.P, h0 = hdrS(), gh = c.grh || {}, h = {school: gh.org != null ? gh.org : h0.school, teacher: gh.tch != null ? gh.tch : h0.teacher}, lines = summary(c, A).slice(1);
    const list = A.rows.concat(A.offs.map((d) => ({d, off: true}))).sort((a, b) => a.d.localeCompare(b.d));
    const pct = A.total ? Math.round(A.last / A.total * 100) : 0, mod = T.o.st !== "off";
    const headM = `<div class="g-a4band"><div class="g-a4bl"><small>${h.school ? H.e(h.school) : "O'quv guruhi hisoboti"}</small><div class="g-a4t">O'tilgan mavzular hisoboti</div>
        <div class="g-a4st">«${H.e(c.name)}» guruhi · ${yearOf(P.from)} o'quv yili</div></div>${qBadge(P)}</div>
      <div class="g-a4meta"><div><small>Davr</small><b>${dd(P.from)} – ${dd(P.to)}</b></div><div><small>Dars kunlari</small><b>${H.e(H.sched(c))}</b></div><div><small>O'quvchilar</small><b>${A.nSt} nafar</b></div><div><small>O'qituvchi</small><b>${h.teacher ? H.e(h.teacher) : "&nbsp;"}</b></div></div>
      ${A.partial ? `<div class="g-a4warn">Chorak hali tugamagan — ma'lumot ${dd(A.upto)} holatiga.</div>` : ""}
      <div class="g-a4tiles"><div><b>${A.rows.length}</b><span>dars o'tkazildi</span></div><div><b>${A.topics.length}</b><span>mavzu o'tildi</span></div>
        <div class="w"><b>${pct}%</b><span>yillik reja · ${A.last}/${A.total} dars</span><div class="g-a4bar"><i style="width:${pct}%"></i></div></div><div><b>${A.att}%</b><span>o'rtacha davomat</span></div></div>`;
    const head0 = `${h.school ? `<div class="g-a4sch">${H.e(h.school)}</div>` : ""}<div class="g-a4t">O'tilgan mavzular hisoboti</div>
      <div class="g-a4st">«${H.e(c.name)}» guruhi · ${P.lab} · ${yearOf(P.from)} o'quv yili</div>
      <table class="g-a4info"><tr><td>Davr: <b>${dd(P.from)} – ${dd(P.to)}</b></td><td>Dars kunlari: <b>${H.e(H.sched(c))}</b></td></tr>
        <tr><td>O'quvchilar: <b>${A.nSt} nafar</b></td><td>O'qituvchi: <b>${h.teacher ? H.e(h.teacher) : "____________________"}</b></td></tr></table>
      ${A.partial ? `<div class="g-a4warn">Chorak hali tugamagan — ma'lumot ${dd(A.upto)} holatiga.</div>` : ""}
      <table class="g-a4kpi"><tr><th>O'tkazilgan darslar</th><th>O'tilgan mavzular</th><th>Yillik reja bajarilishi</th><th>O'rtacha davomat</th></tr>
        <tr><td>${A.rows.length}</td><td>${A.topics.length}</td><td>${pct}% <small>(${A.last}/${A.total} dars)</small></td><td>${A.att}%</td></tr></table>`;
    const head = (mod ? headM : head0) + `
      ${T.o.chart && A.rows.length > 1 ? `<div class="g-a4dyn"><div><div class="g-a4h">Darslardagi davomat</div>${chartSvg(A)}<div class="g-a4lg"><span><i class="b1"></i>75% va yuqori</span><span><i class="b2"></i>75% dan past</span><span><i class="b3"></i>rejadan tashqari</span></div></div>
        <div><div class="g-a4h">Oylar kesimida</div><table class="g-a4tab g-a4mo"><thead><tr><th class="l">Oy</th><th>Dars</th><th>Mavzu</th><th>Davomat</th></tr></thead><tbody>${A.months.map((x) => `<tr><td class="l">${H.MN[+x.m.slice(5) - 1]}</td><td>${x.n}</td><td>${x.t}</td><td>${x.att}%</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
    // «Mavzular bo'yicha»: bir mavzuning hamma darslari bitta qatorda (sanalari, soati, o'rtacha davomat)
    const groups = [];
    for (const r of list) {
      if (r.off) { groups.push({off: true, ds: [r.d]}); continue; }
      const key = r.own ? "own|" + r.own : "p|" + r.s.i, g = groups.find((x) => x.key === key);
      if (g) { g.ds.push(r.d); g.k += r.k; g.na += r.na; } else groups.push({key, n: r.n ? r.s.i + 1 : 0, t: r.own || r.s.t, own: !!r.own, h: r.s ? r.s.h : 1, ds: [r.d], k: r.k, na: r.na});
    }
    const dShort = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
    const grpH = (g) => g.off ? `<tr class="off"><td>—</td><td class="l" colspan="2">Dars bo'lmadi — mavzu keyingi darsga surildi</td><td>${g.ds.map(dShort).join(", ")}</td><td></td><td></td></tr>`
      : `<tr><td>${g.own ? "*" : g.n}</td><td class="l" colspan="2">${H.e(g.t)}${g.own ? " <i>(rejadan tashqari)</i>" : ""}</td><td>${g.ds.map(dShort).join(", ")}</td><td>${g.ds.length}${!g.own && g.h > 1 && g.ds.length < g.h ? `/${g.h}` : ""}</td><td>${g.na ? Math.round(g.k / g.na * 100) + "%" : ""}</td></tr>`;
    // o'quvchilar davomati: ikki ustunli ro'yxat
    const stu = A.stu, half = Math.ceil(stu.length / 2), pc = (x) => x.all ? Math.round(x.came / x.all * 100) : 0;
    const stCell = (x, i) => x ? `<td>${i + 1}</td><td class="l">${H.e(x.name)}</td><td>${x.came}/${x.all}</td><td>${pc(x) < 75 ? `<b>${pc(x)}%*</b>` : pc(x) + "%"}</td>` : `<td></td><td></td><td></td><td></td>`;
    const stuH = stu.length ? `<div class="g-a4h">O'quvchilar davomati</div><table class="g-a4tab g-a4stu"><colgroup>${'<col style="width:5%"><col style="width:27%"><col style="width:10%"><col style="width:8%">'.repeat(2)}</colgroup><thead><tr><th>№</th><th class="l">F.I.Sh.</th><th>Keldi</th><th>%</th><th>№</th><th class="l">F.I.Sh.</th><th>Keldi</th><th>%</th></tr></thead><tbody>${
      Array.from({length: half}, (_, i) => `<tr>${stCell(stu[i], i)}${stCell(stu[i + half], i + half)}</tr>`).join("")}</tbody></table>` : "";
    const rowH = (r) => `<tr class="${r.off ? "off" : ""}"><td>${r.n || (r.off ? "—" : "*")}</td><td>${dd(r.d)}</td><td>${H.WDS[H.wdOf(r.d)]}</td><td class="l">${r.off ? "Dars bo'lmadi (mavzu keyingi darsga surildi)" : r.own ? `${H.e(r.own)} <i>(rejadan tashqari)</i>` : H.e(sTxt(r.s))}</td><td>${r.off ? "" : `${r.k}/${r.na}`}</td></tr>`;
    const byT = T.o.by === "topic";
    const thead = (cont) => byT ? `<div class="g-a4h">O'tilgan mavzular${cont ? " (davomi)" : ""}</div><table class="g-a4tab"><thead><tr><th>№</th><th class="l" colspan="2">Mavzu</th><th>Dars sanalari</th><th>Soat</th><th>Davomat</th></tr></thead><tbody>`
      : `<div class="g-a4h">Darslar va mavzular${cont ? " (davomi)" : ""}</div><table class="g-a4tab"><thead><tr><th>№</th><th>Sana</th><th>Kun</th><th class="l">Mavzu</th><th>Keldi</th></tr></thead><tbody>`;
    const tail = `${T.o.stu ? stuH : ""}${T.o.sum ? `<div class="g-a4h">Xulosa</div><div class="g-a4sum">${lines.map((x) => `<p>${H.e(x)}</p>`).join("")}</div>` : ""}${T.o.rec ? `<div class="g-a4h">Tavsiyalar</div><ol class="g-a4rec">${advice(c, A).map((x) => `<li>${H.e(x)}</li>`).join("")}</ol>` : ""}
      <div class="g-a4note">* — rejadan tashqari mavzu${byT ? "; «Soat» — shu chorakda o'tilgan darslar (2/3 — mavzuning 3 darsidan 2 tasi)" : "; «Keldi» — darsga kelgan / guruhdagi o'quvchilar"}${T.o.stu && stu.length ? "; davomati 75% dan past o'quvchilar «*» bilan" : ""}.</div>
      ${T.o.sig ? "" : "<!--"}<div class="g-a4sig"><div><span>O'qituvchi</span><i></i><small>(imzo)</small></div><div><span>F.I.Sh.</span><i>${h.teacher ? H.e(h.teacher) : ""}</i><small></small></div><div><span>Sana</span><i></i><small></small></div></div>${T.o.sig ? "" : "-->"}`;
    return {head, rows: byT ? groups.map(grpH) : list.map(rowH), thead, tail, foot: (i, n) => `<div class="g-a4f"><span>«${H.e(c.name)}» · ${P.lab} · o'tilgan mavzular</span><span>${i} / ${n}</span></div>`};
  }
  let host = null;
  const a4pages = (c, A) => paginate(a4parts(c, A));
  function paginate(X) {
    if (!host) { host = document.createElement("div"); host.className = "tpt g-a4host"; host.setAttribute("aria-hidden", "true"); }
    if (!host.isConnected) document.body.append(host);
    const page = (fs, body) => `<div class="bx-pg g-a4p ${stCls()}" style="--fs:${fs}px"><div class="g-a4i">${body}</div></div>`;
    const fits = (html) => { host.innerHTML = html; const i = host.querySelector(".g-a4i"); return i.scrollHeight <= i.clientHeight + 1; };
    const one = (fs) => page(fs, X.head + X.thead(false) + X.rows.join("") + "</tbody></table>" + X.tail + X.foot(1, 1));
    try {
      for (let fs = 14; fs >= 10; fs -= 0.5) if (fits(one(fs))) return [one(fs)];
      // bir nechta varaq: har birida iloji boricha ko'p qator; oxirgisida xulosa va imzo
      const fs = 12, out = []; let i = 0;
      while (i < X.rows.length || !out.length) {
        let n = X.rows.length - i;
        const mk = (k, last) => page(fs, (out.length ? "" : X.head) + X.thead(out.length > 0) + X.rows.slice(i, i + k).join("") + "</tbody></table>" + (last ? X.tail : "") + X.foot(out.length + 1, "@@"));
        if (fits(mk(n, true))) { out.push(mk(n, true)); i += n; break; }
        while (n > 1 && !fits(mk(n, false))) n--;
        out.push(mk(n, false)); i += n;
        if (i >= X.rows.length) { out.push(page(fs, X.tail + X.foot(out.length + 1, "@@"))); break; }
      }
      return out.map((x) => x.replace("@@", out.length));
    } finally { host.innerHTML = ""; }
  }
  function a4view(c, A) {
    const ps = a4pages(c, A);
    const h0 = hdrS(), gh = c.grh || {}, hdr = {org: gh.org != null ? gh.org : h0.school, tch: gh.tch != null ? gh.tch : h0.teacher};
    const ck = (k, t) => `<button type="button" class="g-chip ${T.o[k] ? "on" : ""}" data-tpo2="${k}" aria-pressed="${!!T.o[k]}">${T.o[k] ? "✓ " : ""}${t}</button>`;
    return `<div class="g-card g-a4opt"><div class="g-fld"><span class="g-lbl">Dizayn</span>${stSeg()}</div>
      <div class="g-fld"><span class="g-lbl">Jadval</span><div class="g-seg"><button type="button" data-tpby="topic" class="${T.o.by === "topic" ? "on" : ""}">Mavzular bo'yicha</button><button type="button" data-tpby="day" class="${T.o.by !== "topic" ? "on" : ""}">Har bir dars</button></div></div>
        <div class="g-fld"><span class="g-lbl">Varaqqa qo'shish</span><div class="g-chips">${ck("chart", "Grafik va oylar")}${ck("stu", "O'quvchilar davomati")}${ck("sum", "Xulosa")}${ck("rec", "Tavsiyalar")}${ck("sig", "Imzo joyi")}</div></div>
        <div class="g-frow g-a4hdr"><div class="g-fld"><label for="g-ro">Tashkilot (markaz, maktab) nomi</label><input id="g-ro" class="g-inp" value="${H.e(hdr.org)}" placeholder="Masalan: «Bilim» o'quv markazi"></div>
          <div class="g-fld"><label for="g-rt">O'qituvchi F.I.Sh.</label><input id="g-rt" class="g-inp" value="${H.e(hdr.tch)}" placeholder="Masalan: Otaboboyev A."></div></div></div>
      <div class="g-a4w">${ps.map((x) => `<div class="g-a4s">${x}</div>`).join("")}</div>
      <span class="g-muted" style="font-size:12.5px">A4 varaq: ${ps.length} bet. «Chop etish» bosilganda xuddi shunday chiqadi; «PDF — Telegram'ga» ham shu varaqni yuboradi.</span>`;
  }
  const qChips = (c, q) => { const t = H.today(); return [1, 2, 3, 4].filter((x) => qPer(c, x)).map((x) => { const P = qPer(c, x); return `<button type="button" data-tpq="${x}" class="${x === q ? "on" : ""}">${x}-chorak<small>${P.from > t ? "boshlanmagan" : qDone(c, x) ? "tugagan" : "davom etmoqda"}</small></button>`; }).join("")
    + `<button type="button" data-tpq="0" class="${q === 0 ? "on" : ""}">Butun yil<small>${yearOf(qPer(c, 0).from)}</small></button>`; };
  /* ───────── boshqa turdagi hisobotlar: yillik (choraklar kesimi) va o'quvchi hisoboti ─────────
     Ikkalasi ham bitta qismlar (X) dan quriladi: A4 — paginate(X), ekranda — xuddi shu mazmun oqib turadigan varaqda. */
  const RK = [["q", "Chorak hisoboti"], ["yr", "Yillik: choraklar kesimi"], ["st", "O'quvchi hisoboti"]];
  const flow = (X) => `<div class="g-a4p g-a4flow ${stCls()}"><div class="g-a4i">${X.head}${X.rows.length ? X.thead(false) + X.rows.join("") + "</tbody></table>" : ""}${X.tail}</div></div>`;
  const hdrOf = (c) => { const h0 = hdrS(), gh = c.grh || {}; return {school: gh.org != null ? gh.org : h0.school, teacher: gh.tch != null ? gh.tch : h0.teacher}; };
  const band = (h, title, sub, badge) => T.o.st !== "off"
    ? `<div class="g-a4band"><div class="g-a4bl"><small>${h.school ? H.e(h.school) : "O'quv guruhi hisoboti"}</small><div class="g-a4t">${title}</div><div class="g-a4st">${sub}</div></div>${badge}</div>`
    : `${h.school ? `<div class="g-a4sch">${H.e(h.school)}</div>` : ""}<div class="g-a4t">${title}</div><div class="g-a4st">${sub}</div>`;
  const meta = (pairs) => T.o.st !== "off" ? `<div class="g-a4meta">${pairs.map(([k, v]) => `<div><small>${k}</small><b>${v || "&nbsp;"}</b></div>`).join("")}</div>`
    : `<table class="g-a4info"><tr>${pairs.slice(0, 2).map(([k, v]) => `<td>${k}: <b>${v || "____________"}</b></td>`).join("")}</tr><tr>${pairs.slice(2).map(([k, v]) => `<td>${k}: <b>${v || "____________"}</b></td>`).join("")}</tr></table>`;
  const tilesH = (ts) => T.o.st !== "off" ? `<div class="g-a4tiles" style="grid-template-columns:repeat(${ts.length},1fr)">${ts.map(([v, l, bar]) => `<div class="${bar != null ? "w" : ""}"><b>${v}</b><span>${l}</span>${bar != null ? `<div class="g-a4bar"><i style="width:${bar}%"></i></div>` : ""}</div>`).join("")}</div>`
    : `<table class="g-a4kpi"><tr>${ts.map(([, l]) => `<th>${l}</th>`).join("")}</tr><tr>${ts.map(([v]) => `<td>${v}</td>`).join("")}</tr></table>`;
  const sigH = (who) => `<div class="g-a4sig">${who.map(([a, b]) => `<div><span>${a}</span><i>${b ? H.e(b) : ""}</i><small>${b ? "" : "(imzo)"}</small></div>`).join("")}</div>`;
  const block = (t, items, ol) => items.length ? `<div class="g-a4h">${t}</div>${ol ? `<ol class="g-a4rec">${items.map((x) => `<li>${H.e(x)}</li>`).join("")}</ol>` : `<div class="g-a4sum">${items.map((x) => `<p>${H.e(x)}</p>`).join("")}</div>`}` : "";

  // yillik: har chorakda nechta dars, qaysi mavzular; kelajak choraklar — reja bo'yicha
  function yrData(c) {
    const L = layout(c), t = H.today(), qs = [1, 2, 3, 4].filter((q) => qPer(c, q));
    const rows = qs.map((q) => { const P = qPer(c, q), past = P.from <= t ? repData(c, q) : null;
      const fut = L.rows.filter((r) => r.n && r.d >= (t > P.from ? t : P.from) && r.d <= P.to);
      const done = past ? past.plan : [], all = done.concat(fut);
      return {q, P, st: P.from > t ? "rejada" : qDone(c, q) ? "tugagan" : "davom etmoqda", les: past ? past.rows.length : 0, fut: fut.length,
        a: all.length ? all[0] : null, b: all.length ? all[all.length - 1] : null, sh: past ? past.offs.length + past.own.length : 0, att: past && past.rows.length ? past.att : null}; });
    const Y = repData(c, 0);
    return {rows, Y, L, done: Y.last, total: L.total, end: L.end, q4: qR(4)};
  }
  function yrParts(c) {
    const YD = yrData(c), Y = YD.Y, h = hdrOf(c), pct = YD.total ? Math.round(YD.done / YD.total * 100) : 0;
    const head = band(h, "Yillik mavzular hisoboti", `«${H.e(c.name)}» guruhi · ${yearOf(Y.P.from)} o'quv yili`, qBadge(Y.P))
      + meta([["Dars kunlari", H.e(H.sched(c))], ["O'quvchilar", `${Y.nSt} nafar`], ["Reja", `${c.gplan.topics.length} mavzu · ${YD.total} dars`], ["O'qituvchi", h.teacher ? H.e(h.teacher) : ""]])
      + tilesH([[`${YD.done}/${YD.total}`, "dars o'tildi", pct], [Y.topics.length, "mavzu o'tildi"], [Y.att + "%", "o'rtacha davomat"], [YD.end ? dd(YD.end).slice(0, 5) : "—", YD.end && YD.q4 && YD.end > YD.q4[1] ? "reja tugashi — kech!" : "reja tugashi (taxminan)"]]);
    // choraklar grafigi: o'tilgan (to'q) va rejadagi (och) darslar
    const mx = Math.max(1, ...YD.rows.map((r) => r.les + r.fut)), W = 680, Hh = 110, bw = W / YD.rows.length;
    let g = ""; YD.rows.forEach((r, i) => { const x = i * bw + bw * .3, w = bw * .4, y1 = 90 * (1 - r.les / mx) + 6, y2 = 90 * (1 - (r.les + r.fut) / mx) + 6;
      g += `<rect x="${x}" y="${y2}" width="${w}" height="${y1 - y2}" class="c0" fill="#fff" stroke="#000" stroke-width=".6"/><rect x="${x}" y="${y1}" width="${w}" height="${96 - y1}" class="c1" fill="#9a9a9a" stroke="#000" stroke-width=".6"/>
        <text x="${x + w / 2}" y="${Hh - 2}" font-size="10" text-anchor="middle">${r.q}-chorak</text><text x="${x + w + 6}" y="${y2 + 10}" font-size="10">${r.les}${r.fut ? ` + ${r.fut}` : ""}</text>`; });
    const chart = `<div><div class="g-a4h">Choraklar bo'yicha darslar</div><svg class="g-a4ch" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Choraklar bo'yicha darslar">${g}<line x1="0" x2="${W}" y1="96" y2="96" stroke="#000" stroke-width=".8"/></svg>
      <div class="g-a4lg"><span><i class="b1"></i>o'tilgan darslar</span><span><i class="b0"></i>reja bo'yicha qolgan</span></div></div>`;
    const rows = YD.rows.map((r) => `<tr><td>${r.q}</td><td>${dd(r.P.from).slice(0, 5)}–${dd(r.P.to).slice(0, 5)}</td><td>${r.st}</td><td>${r.les}${r.fut ? ` <small>+${r.fut} rejada</small>` : ""}</td>
      <td class="l">${r.a ? `${r.a.n}–${r.b.n}: ${H.e(r.a.s.t)} … ${H.e(r.b.s.t)}` : "<i>mavzu yo'q</i>"}</td><td>${r.sh || ""}</td><td>${r.att == null ? "—" : r.att + "%"}</td></tr>`);
    const thead = () => `<div class="g-a4h">Choraklar kesimida</div><table class="g-a4tab g-a4yr"><thead><tr><th>Chorak</th><th>Davr</th><th>Holat</th><th>Darslar</th><th class="l">Darslar va mavzular</th><th>Surilgan</th><th>Davomat</th></tr></thead><tbody>`;
    const sum = [`${yearOf(Y.P.from)} o'quv yili: yillik rejadagi ${YD.total} darsdan ${YD.done} tasi (${pct}%) o'tildi, ${Y.topics.length} ta mavzu yakunlandi.`,
      YD.end ? `Joriy jadval bo'yicha reja ${fullD(YD.end)} da tugaydi${YD.q4 ? (YD.end > YD.q4[1] ? ` — o'quv yili oxiridan (${fullD(YD.q4[1])}) ${Math.round((H.pd(YD.end) - H.pd(YD.q4[1])) / 864e5)} kun kech` : ` — o'quv yili oxiridan (${fullD(YD.q4[1])}) oldin`) : ""}.` : "Reja kunlarga to'liq joylashmadi."];
    const tail = (T.o.chart ? chart : "") + (T.o.sum ? block("Xulosa", sum) : "") + (T.o.rec ? block("Tavsiyalar", advice(c, Y), true) : "") + (T.o.sig ? sigH([["O'qituvchi", ""], ["F.I.Sh.", h.teacher], ["Sana", ""]]) : "");
    return {head, rows, thead, tail, foot: (i, n) => `<div class="g-a4f"><span>«${H.e(c.name)}» · yillik mavzular hisoboti</span><span>${i} / ${n}</span></div>`};
  }

  // o'quvchi hisoboti (ota-onaga): kelgan/kelmagan darslar, qoldirilgan mavzular, to'lov holati
  function stParts(c, s, q) {
    const A = repData(c, q), P = A.P, h = hdrOf(c), my = A.rows.filter((r) => H.inG(s, r.d));
    const cm = my.filter((r) => (s.marks || {})[r.d] === "ot"), miss = my.filter((r) => (s.marks || {})[r.d] !== "ot"), pc = my.length ? Math.round(cm.length / my.length * 100) : 0;
    const ac = c.kind === "paid" && H.acct ? H.acct(c, s) : null;
    const tl = [[`${cm.length}/${my.length}`, "darsga keldi"], [pc + "%", "davomat", pc], [miss.length, "dars qoldirildi"]].concat(ac && ac.k ? [[ac.left < 0 ? `−${-ac.left}` : ac.left, ac.left < 0 ? "dars qarz (to'lanmagan)" : ac.left === 0 ? "to'langan dars qolmadi" : "to'langan dars qoldi"]] : []);
    const head = band(h, "O'quvchi hisoboti", `${H.e(s.name)} · «${H.e(c.name)}» guruhi`, qBadge(P))
      + meta([["Davr", `${dd(P.from)} – ${dd(P.to)}`], ["Dars kunlari", H.e(H.sched(c))], ["Guruh davomati", `${A.att}%`], ["O'qituvchi", h.teacher ? H.e(h.teacher) : ""]])
      + (A.partial ? `<div class="g-a4warn">Davr hali tugamagan — ma'lumot ${dd(A.upto)} holatiga.</div>` : "") + tilesH(tl);
    const rows = my.map((r, i) => { const on = (s.marks || {})[r.d] === "ot"; return `<tr class="${on ? "" : "miss"}"><td>${i + 1}</td><td>${dd(r.d).slice(0, 5)} <small>${H.WDS[H.wdOf(r.d)]}</small></td><td class="l">${r.own ? H.e(r.own) : H.e(sTxt(r.s))}</td><td>${on ? "✓ keldi" : "<b>✗ kelmadi</b>"}</td></tr>`; });
    const thead = (cont) => `<div class="g-a4h">Darslar${cont ? " (davomi)" : ""}</div><table class="g-a4tab g-a4st2"><thead><tr><th>№</th><th>Sana</th><th class="l">Mavzu</th><th>Holat</th></tr></thead><tbody>`;
    const mt = [...new Set(miss.map((r) => r.own || r.s.t))];
    const sum = [`${s.name} ${P.lab.toLowerCase()}da ${my.length} ta darsdan ${cm.length} tasiga keldi (${pc}%; guruh bo'yicha o'rtacha ${A.att}%).`]
      .concat(ac && ac.k ? [ac.left < 0 ? `To'lov: ${-ac.left} dars to'lanmagan.` : ac.left === 0 ? "To'lov: to'langan darslar tugadi, keyingi paket uchun to'lov qilish kerak." : `To'lov: yana ${ac.left} dars to'langan.`] : []);
    const rec = miss.length ? [`Qoldirilgan mavzularni uyda takrorlash kerak: ${mt.slice(0, 6).join("; ")}${mt.length > 6 ? ` va yana ${mt.length - 6} ta` : ""}.`].concat(pc < 75 ? ["Davomat 75% dan past — darslarga muntazam qatnashishini ta'minlashingizni so'raymiz."] : [])
      : ["Birorta ham dars qoldirilmagan — rahmat! Shu tartibda davom eting."];
    const tail = (T.o.sum ? block("Xulosa", sum) : "") + (T.o.rec ? block("Ota-onaga tavsiya", rec, true) : "") + (T.o.sig ? sigH([["O'qituvchi", ""], ["Ota-ona (tanishdim)", ""], ["Sana", ""]]) : "");
    return {head, rows: rows.length ? rows : [`<tr><td colspan="4">Bu davrda dars yo'q</td></tr>`], thead, tail, foot: (i, n) => `<div class="g-a4f"><span>${H.e(s.name)} · «${H.e(c.name)}» · ${P.lab}</span><span>${i} / ${n}</span></div>`};
  }
  const curStu = (c) => c.students.find((x) => x.id === T.rs) || c.students[0];
  // joriy hisobot turi: qismlar, nomi, matni
  function cur(c) {
    if (T.rk === "yr") return {X: () => yrParts(c), name: `${c.name} yillik mavzular`, text: () => { const YD = yrData(c); return [`«${c.name}» — yillik mavzular hisoboti.`, `Rejadagi ${YD.total} darsdan ${YD.done} tasi o'tildi.`].concat(advice(c, YD.Y)); }};
    if (T.rk === "st") { const s = curStu(c); return {X: () => stParts(c, s, T.rq), name: `${s ? s.name : ""} ${qLab(T.rq)} hisobot`, text: () => { const X = repData(c, T.rq), my = X.rows.filter((r) => H.inG(s, r.d)), cm = my.filter((r) => (s.marks || {})[r.d] === "ot").length; return [`${s.name}, «${c.name}» guruhi, ${X.P.lab.toLowerCase()}: ${my.length} ta darsdan ${cm} tasiga keldi.`]; }}; }
    return {X: () => a4parts(c, repData(c, T.rq)), name: `${c.name} ${qLab(T.rq)} mavzular`, text: () => summary(c, repData(c, T.rq))};
  }
  function optCard(c, keys) {
    const h = hdrOf(c), ck = (k, t) => `<button type="button" class="g-chip ${T.o[k] ? "on" : ""}" data-tpo2="${k}" aria-pressed="${!!T.o[k]}">${T.o[k] ? "✓ " : ""}${t}</button>`;
    return `<div class="g-card g-a4opt"><div class="g-fld"><span class="g-lbl">Dizayn</span>${stSeg()}</div>
      <div class="g-fld"><span class="g-lbl">Varaqqa qo'shish</span><div class="g-chips">${keys.map(([k, l]) => ck(k, l)).join("")}</div></div>
      <div class="g-frow g-a4hdr"><div class="g-fld"><label for="g-ro">Tashkilot (markaz, maktab) nomi</label><input id="g-ro" class="g-inp" value="${H.e(h.school)}" placeholder="Masalan: «Bilim» o'quv markazi"></div>
        <div class="g-fld"><label for="g-rt">O'qituvchi F.I.Sh.</label><input id="g-rt" class="g-inp" value="${H.e(h.teacher)}" placeholder="Masalan: Otaboboyev A."></div></div></div>`;
  }
  function otherHtml(c) {
    const isSt = T.rk === "st", t = H.today();
    if (isSt && !c.students.length) return `<div class="g-card g-muted">Guruhda o'quvchi yo'q.</div>`;
    const s = isSt ? curStu(c) : null; if (s) T.rs = s.id;
    const top = isSt ? `<div class="g-row"><div class="g-seg g-qseg" role="group" aria-label="Davr">${qChips(c, T.rq)}</div></div>
      <div class="g-row g-strow"><div class="g-fld" style="flex:1;min-width:220px"><label for="g-rsel">O'quvchi</label><select id="g-rsel" class="g-inp">${c.students.map((x, i) => `<option value="${H.e(x.id)}" ${x === s ? "selected" : ""}>${i + 1}. ${H.e(x.name)}</option>`).join("")}</select></div>
        <button class="g-btn sm ghost" type="button" data-rsn="-1" aria-label="Oldingi o'quvchi">‹ Oldingi</button><button class="g-btn sm ghost" type="button" data-rsn="1" aria-label="Keyingi o'quvchi">Keyingi ›</button></div>` : "";
    if (isSt && qPer(c, T.rq).from > t) return top + `<div class="g-card g-muted">${qLab(T.rq)} hali boshlanmagan.</div>`;
    const X = cur(c).X(), keys = [["sum", "Xulosa"], ["rec", isSt ? "Ota-onaga tavsiya" : "Tavsiyalar"], ["sig", "Imzo joyi"]].concat(isSt ? [] : [["chart", "Grafik"]]);
    return top + `<div class="g-row"><div class="g-seg" role="group" aria-label="Ko'rinish"><button type="button" data-tprv="scr" class="${T.rv !== "a4" ? "on" : ""}">Ekranda</button><button type="button" data-tprv="a4" class="${T.rv === "a4" ? "on" : ""}">A4 varaq</button></div></div>
      ${T.rv === "a4" ? (() => { const ps = paginate(X); return optCard(c, keys) + `<div class="g-a4w">${ps.map((x) => `<div class="g-a4s">${x}</div>`).join("")}</div><span class="g-muted" style="font-size:12.5px">A4 varaq: ${ps.length} bet.</span>`; })() : `<div class="g-card g-a4fw">${flow(X)}</div>`}
      <div class="g-row g-ract"><button class="g-btn pri" type="button" data-tpprint>Chop etish (A4)</button>${isSt ? `<button class="g-btn" type="button" data-tpall>Hamma o'quvchilarni chop etish (${c.students.length} ta)</button>` : ""}<button class="g-btn" type="button" data-tpsend>PDF — Telegram'ga</button><button class="g-btn" type="button" data-tpcopy>Matnni nusxalash</button></div>`;
  }
  function repHtml(c) {
    const kinds = `<div class="g-row"><div class="g-chips g-rkind" role="group" aria-label="Hisobot turi">${RK.map(([k, l]) => `<button type="button" class="g-chip ${T.rk === k ? "on" : ""}" data-tprk="${k}" aria-pressed="${T.rk === k}">${l}</button>`).join("")}</div></div>`;
    if (T.rk !== "q" && [1, 2, 3, 4].some((q) => qPer(c, q))) { if (T.rq == null) T.rq = [1, 2, 3, 4].filter((q) => qPer(c, q) && qPer(c, q).from <= H.today()).pop() || 0; return kinds + otherHtml(c); }
    return kinds + repHtmlQ(c);
  }
  function repHtmlQ(c) {
    const qs = [1, 2, 3, 4].filter((q) => qPer(c, q)), t = H.today();
    if (!qs.length) return `<div class="g-card g-empty"><h2>Choraklar sanasi kiritilmagan</h2><div class="g-muted">Hisobot chorak bo'yicha tuziladi. «Sozlamalar»da o'quv yili choraklarining boshlanish va tugash sanalarini kiriting.</div></div>`;
    if (T.rq == null || (T.rq && !qs.includes(T.rq))) T.rq = qs.filter((q) => qPer(c, q).from <= t).pop() || qs[0];
    const q = T.rq, A = repData(c, q);
    if (q && qDone(c, q) && !(c.grep || {})[q]) { c.grep = Object.assign({}, c.grep, {[q]: {at: t}}); H.save(); }
    return `<div class="g-row"><div class="g-seg g-qseg" role="group" aria-label="Chorak">${qChips(c, q)}</div></div>
      ${qPer(c, q).from > t ? `<div class="g-card g-muted">${qLab(q)} hali boshlanmagan (${fullD(qPer(c, q).from)}).</div>` : `<div class="g-row"><div class="g-seg" role="group" aria-label="Ko'rinish"><button type="button" data-tprv="scr" class="${T.rv !== "a4" ? "on" : ""}">Ekranda</button><button type="button" data-tprv="a4" class="${T.rv === "a4" ? "on" : ""}">A4 varaq</button></div></div>
      ${T.rv === "a4" ? a4view(c, A) : `<div class="g-card g-rep">${sheet(c, A)}</div>`}
      <div class="g-row g-ract"><button class="g-btn pri" type="button" data-tpprint>Chop etish (A4)</button><button class="g-btn" type="button" data-tpsend>PDF — Telegram'ga</button><button class="g-btn" type="button" data-tpcopy>Xulosa matnini nusxalash</button></div>`}`;
  }
  function tabHtml(c) {
    if (!has(c)) return planHtml(c);
    const fq = freshQ(c);
    return `${fq && T.view !== "rep" ? `<div class="g-note g-rnote"><b>${fq}-chorak tugadi.</b> O'tilgan mavzular bo'yicha hisobot tayyor. <button class="g-btn sm pri" type="button" data-tprep="${fq}">Hisobotni ko'rish</button></div>` : ""}
      <div class="g-row"><div class="g-seg"><button type="button" data-tpv="plan" class="${T.view !== "rep" ? "on" : ""}">Reja</button><button type="button" data-tpv="rep" class="${T.view === "rep" ? "on" : ""}">Chorak hisoboti</button></div></div>
      ${T.view === "rep" ? repHtml(c) : planHtml(c)}`;
  }
  // bosh sahifa: tugagan chorak hisoboti tayyor bo'lgan guruhlar
  const fresh = (list) => list.map((x) => ({ci: x.ci, c: x.c, q: freshQ(x.c)})).filter((x) => x.q);
  function homeNote(list) {
    const f = fresh(list); if (!f.length) return "";
    return `<div class="g-note g-rnote"><b>${f[0].q}-chorak tugadi.</b> O'tilgan mavzular hisoboti tayyor: ${f.map((x) => `<button class="g-btn sm" type="button" data-tphome="${x.ci}|${x.q}">${H.e(x.c.name)}</button>`).join(" ")}</div>`;
  }
  /* ───────── umumiy hisobot: hamma guruhlar bir varaqda (chorak yoki butun yil) ───────── */
  const AL = {q: null};
  function allData(list, q) {
    const t = H.today(), rows = [];
    for (const {c, ci} of list) {
      const P = qPer(c, q); if (!P || P.from > t) continue;
      const upto = P.to < t ? P.to : addD(t, -1);
      let A = null, les = 0, k = 0, n = 0;
      if (has(c)) { A = repData(c, q); les = A.rows.length; k = A.rows.reduce((a, r) => a + r.k, 0); n = A.rows.reduce((a, r) => a + r.na, 0); }
      else for (let d = P.from; d <= upto; d = addD(d, 1)) { const x = H.cntOn(c, d); if (x) { les++; k += x; n += H.actOn(c, d).length; } }
      const inc = c.kind === "paid" ? c.students.flatMap((s) => s.pays || []).filter((p) => String(p.d) >= P.from && String(p.d) <= P.to).reduce((a, p) => a + (+p.sum || 0), 0) : 0;
      const due = c.kind === "paid" && H.acct ? c.students.filter((s) => H.acct(c, s).due).length : 0;
      rows.push({c, ci, A, les, att: n ? Math.round(k / n * 100) : 0, k, n, inc, due, nSt: c.students.length, top: A ? A.topics.length : null,
        pct: A && A.total ? Math.round(A.last / A.total * 100) : null, sh: A ? A.offs.length + A.own.length : 0, late: !!(A && A.end && qR(4) && A.end > qR(4)[1])});
    }
    const k = rows.reduce((a, r) => a + r.k, 0), n = rows.reduce((a, r) => a + r.n, 0), wp = rows.filter((r) => r.pct != null);
    const P = list.length ? qPer(list[0].c, q) : null;
    return {rows, P, partial: !!P && P.to >= t, les: rows.reduce((a, r) => a + r.les, 0), st: rows.reduce((a, r) => a + r.nSt, 0), top: wp.reduce((a, r) => a + r.top, 0),
      att: n ? Math.round(k / n * 100) : 0, inc: rows.reduce((a, r) => a + r.inc, 0), pct: wp.length ? Math.round(wp.reduce((a, r) => a + r.pct, 0) / wp.length) : null, paid: rows.some((r) => r.c.kind === "paid")};
  }
  const sp3 = (x) => String(Math.round(x || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  function allSummary(G) {
    const P = G.P, out = [];
    out.push(`${P.lab} (${H.dm(P.from)} – ${fullD(G.partial ? addD(H.today(), -1) : P.to)}): ${G.rows.length} ta guruhda jami ${G.st} nafar o'quvchi bilan ${G.les} ta dars o'tkazildi${G.top ? `, ${G.top} ta mavzu o'tildi` : ""}.`);
    out.push(`O'rtacha davomat ${G.att}%${G.pct != null ? `, yillik rejalar o'rtacha ${G.pct}% bajarildi` : ""}.${G.paid ? ` Pullik guruhlardan tushum: ${sp3(G.inc)} so'm.` : ""}`);
    const best = G.rows.filter((r) => r.les).sort((a, b) => b.att - a.att)[0]; if (best && G.rows.length > 1) out.push(`Davomati eng yuqori guruh — «${best.c.name}» (${best.att}%).`);
    return out;
  }
  function allAdvice(G) {
    const out = [];
    const low = G.rows.filter((r) => r.les && r.att < 75); if (low.length) out.push(`${low.map((r) => `«${r.c.name}» (${r.att}%)`).join(", ")} — davomat 75% dan past; dars vaqti qulayligini va o'quvchilar sababini o'rganish kerak.`);
    const late = G.rows.filter((r) => r.late); if (late.length) out.push(`${late.map((r) => `«${r.c.name}»`).join(", ")} — yillik reja o'quv yili oxirigacha yetmaydi; qo'shimcha dars kerak.`);
    const np = G.rows.filter((r) => !has(r.c)); if (np.length) out.push(`${np.map((r) => `«${r.c.name}»`).join(", ")} — yillik mavzular rejasi kiritilmagan («Mavzular» bo'limida kiriting).`);
    const due = G.rows.filter((r) => r.due); if (due.length) out.push(`To'lov kutilmoqda: ${due.map((r) => `«${r.c.name}» — ${r.due} nafar`).join(", ")}.`);
    if (!out.length) out.push("Hamma guruhlarda reja va davomat yaxshi — shu tartibda davom ettirish tavsiya etiladi.");
    return out;
  }
  function allChart(G) {
    const rs = G.rows.filter((r) => r.les); if (!rs.length) return "";
    const W = 680, rh = 18, Hh = rs.length * rh + 16, lx = 170, x = (v) => lx + (W - lx - 40) * v;
    let g = `<line x1="${x(.75)}" x2="${x(.75)}" y1="0" y2="${Hh - 12}" stroke="#000" stroke-dasharray="3 3" stroke-width=".8"/><text x="${x(.75)}" y="${Hh - 2}" font-size="9" text-anchor="middle">75%</text>`;
    rs.forEach((r, i) => { const v = r.att / 100, y = i * rh + 3;
      g += `<text x="${lx - 6}" y="${y + 11}" font-size="10" text-anchor="end">${H.e(r.c.name.length > 28 ? r.c.name.slice(0, 27) + "…" : r.c.name)}</text><rect x="${lx}" y="${y}" width="${(x(v) - lx).toFixed(1)}" height="${rh - 6}" class="${v < .75 ? "c2" : "c1"}" fill="${v < .75 ? "#000" : "#9a9a9a"}" stroke="#000" stroke-width=".6"/><text x="${(x(v) + 4).toFixed(1)}" y="${y + 10}" font-size="10">${r.att}%</text>`; });
    return `<svg class="g-a4ch" viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Guruhlar davomati">${g}</svg>`;
  }
  function allParts(G) {
    const P = G.P, h0 = hdrS(), gh = (G.rows.find((r) => r.c.grh) || {c: {}}).c.grh || {}, h = {school: gh.org != null ? gh.org : h0.school, teacher: gh.tch != null ? gh.tch : h0.teacher}, mod = T.o.st !== "off";
    const mln = (x) => x >= 1e6 ? [`${String(Math.round(x / 1e5) / 10).replace(".", ",")} mln`, "tushum, so'm"] : [sp3(x), "tushum, so'm"];
    const tiles = [[G.rows.length, "guruh"], [G.st, "o'quvchi"], [G.les, "dars o'tkazildi"], [G.att + "%", "o'rtacha davomat"]].concat(G.paid ? [mln(G.inc)] : []);
    const head = mod ? `<div class="g-a4band"><div class="g-a4bl"><small>${h.school ? H.e(h.school) : "Guruhlar bo'yicha"}</small><div class="g-a4t">Umumiy hisobot</div>
        <div class="g-a4st">Barcha guruhlar · ${P.q ? P.lab + " · " : ""}${yearOf(P.from)} o'quv yili</div></div>${qBadge(P)}</div>
      <div class="g-a4meta"><div><small>Davr</small><b>${dd(P.from)} – ${dd(P.to)}</b></div><div><small>Guruhlar</small><b>${G.rows.length} ta</b></div><div><small>O'quvchilar</small><b>${G.st} nafar</b></div><div><small>O'qituvchi</small><b>${h.teacher ? H.e(h.teacher) : "&nbsp;"}</b></div></div>
      ${G.partial ? `<div class="g-a4warn">Davr hali tugamagan — ma'lumot ${dd(addD(H.today(), -1))} holatiga.</div>` : ""}
      <div class="g-a4tiles" style="grid-template-columns:repeat(${tiles.length},1fr)">${tiles.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>`
      : `${h.school ? `<div class="g-a4sch">${H.e(h.school)}</div>` : ""}<div class="g-a4t">Umumiy hisobot</div><div class="g-a4st">Barcha guruhlar · ${P.q ? P.lab + " · " : ""}${yearOf(P.from)} o'quv yili</div>
      <table class="g-a4info"><tr><td>Davr: <b>${dd(P.from)} – ${dd(P.to)}</b></td><td>O'qituvchi: <b>${h.teacher ? H.e(h.teacher) : "____________________"}</b></td></tr></table>
      ${G.partial ? `<div class="g-a4warn">Davr hali tugamagan — ma'lumot ${dd(addD(H.today(), -1))} holatiga.</div>` : ""}
      <table class="g-a4kpi"><tr>${tiles.map(([, l]) => `<th>${l}</th>`).join("")}</tr><tr>${tiles.map(([v]) => `<td>${v}</td>`).join("")}</tr></table>`;
    const ch = T.o.chart ? `<div><div class="g-a4h">Guruhlar davomati</div>${allChart(G)}</div>` : "";
    const rows = G.rows.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${H.e(r.c.name)}<br><small>${r.c.kind === "paid" ? "Pullik" : "To'garak"} · ${H.e(H.sched(r.c))}</small></td><td>${r.nSt}</td><td>${r.les}</td><td>${r.top == null ? "—" : r.top}</td>
      <td>${r.pct == null ? "<i>reja yo'q</i>" : `${r.pct}%${r.late ? "*" : ""}`}</td><td>${r.les ? (r.att < 75 ? `<b>${r.att}%</b>` : r.att + "%") : "—"}</td>${G.paid ? `<td>${r.c.kind === "paid" ? sp3(r.inc) : "—"}</td>` : ""}</tr>`);
    const thead = (cont) => `<div class="g-a4h">Guruhlar${cont ? " (davomi)" : ""}</div><table class="g-a4tab g-a4all"><thead><tr><th>№</th><th class="l">Guruh</th><th>O'quvchi</th><th>Dars</th><th>Mavzu</th><th>Yillik reja</th><th>Davomat</th>${G.paid ? "<th>Tushum, so'm</th>" : ""}</tr></thead><tbody>`;
    const tail = `${G.paid ? `</tbody><tfoot><tr><td></td><td class="l">Jami</td><td>${G.st}</td><td>${G.les}</td><td>${G.top || "—"}</td><td>${G.pct == null ? "—" : G.pct + "%"}</td><td>${G.att}%</td><td>${sp3(G.inc)}</td></tr></tfoot><tbody>` : ""}`;
    const end = `${ch}${T.o.sum ? `<div class="g-a4h">Xulosa</div><div class="g-a4sum">${allSummary(G).map((x) => `<p>${H.e(x)}</p>`).join("")}</div>` : ""}${T.o.rec ? `<div class="g-a4h">Tavsiyalar</div><ol class="g-a4rec">${allAdvice(G).map((x) => `<li>${H.e(x)}</li>`).join("")}</ol>` : ""}
      <div class="g-a4note">«Yillik reja» — o'tilgan darslar yillik mavzular rejasining necha foizi; * — reja o'quv yili oxirigacha yetmaydi; davomat 75% dan past bo'lsa qalin.</div>
      ${T.o.sig ? `<div class="g-a4sig"><div><span>Mas'ul</span><i></i><small>(imzo)</small></div><div><span>F.I.Sh.</span><i>${h.teacher ? H.e(h.teacher) : ""}</i><small></small></div><div><span>Sana</span><i></i><small></small></div></div>` : ""}`;
    return {head, rows: rows.length ? rows.concat(tail ? [tail] : []) : [`<tr><td colspan="8">Bu davrda dars o'tkazilgan guruh yo'q</td></tr>`], thead, tail: end, foot: (i, n) => `<div class="g-a4f"><span>Umumiy hisobot · ${P.lab}</span><span>${i} / ${n}</span></div>`};
  }
  function allHtml(list) {
    const t = H.today(), c0 = (list[0] || {}).c;
    const head = `<div class="g-head"><div class="g-t"><button class="g-back" type="button" data-home>‹ Guruhlar</button><h1>Umumiy hisobot</h1><div class="g-muted">Barcha faol guruhlar bo'yicha: darslar, mavzular, davomat${list.some((x) => x.c.kind === "paid") ? " va tushum" : ""}</div></div></div>`;
    if (!c0) return head + `<div class="g-card g-muted">Hali guruh yo'q.</div>`;
    if (!qPer(c0, 0)) return head + `<div class="g-card g-empty"><h2>Choraklar sanasi kiritilmagan</h2><div class="g-muted">«Sozlamalar»da o'quv yili choraklarini kiriting.</div></div>`;
    // standart: yaqinda (21 kun ichida) tugagan chorak, bo'lmasa joriy chorak
    if (AL.q == null) { const qs = [1, 2, 3, 4].filter((q) => qPer(c0, q)); AL.q = qs.filter((q) => qDone(c0, q) && addD(qPer(c0, q).end, 21) >= t).pop() || qs.filter((q) => qPer(c0, q).from <= t).pop() || 0; }
    const G = allData(list, AL.q);
    const pages = T.rv === "a4" ? paginate(allParts(G)) : null;
    return head + `<div class="g-row"><div class="g-seg g-qseg g-qseg5" role="group" aria-label="Davr">${qChips(c0, AL.q).replace(/data-tpq=/g, "data-alq=")}</div></div>
      <div class="g-row"><div class="g-seg" role="group" aria-label="Ko'rinish"><button type="button" data-tprv="scr" class="${T.rv !== "a4" ? "on" : ""}">Ekranda</button><button type="button" data-tprv="a4" class="${T.rv === "a4" ? "on" : ""}">A4 varaq</button></div></div>
      ${pages ? `<div class="g-card g-a4opt"><div class="g-fld"><span class="g-lbl">Dizayn</span>${stSeg()}</div>
        <div class="g-fld"><span class="g-lbl">Varaqqa qo'shish</span><div class="g-chips">${[["chart", "Davomat grafigi"], ["sum", "Xulosa"], ["rec", "Tavsiyalar"], ["sig", "Imzo joyi"]].map(([k, l]) => `<button type="button" class="g-chip ${T.o[k] ? "on" : ""}" data-tpo2="${k}" aria-pressed="${!!T.o[k]}">${T.o[k] ? "✓ " : ""}${l}</button>`).join("")}</div></div></div>
        <div class="g-a4w">${pages.map((x) => `<div class="g-a4s">${x}</div>`).join("")}</div><span class="g-muted" style="font-size:12.5px">A4 varaq: ${pages.length} bet.</span>`
      : `<div class="g-card g-rep"><div class="g-rhead"><small>Umumiy hisobot</small><h2>${G.P.lab}</h2><span class="g-muted">${fullD(G.P.from)} – ${fullD(G.P.to)}${G.partial ? ` · <b class="g-rpart">davr hali tugamagan</b>` : ""}</span></div>
        <div class="g-rkpi g-num"><div><b>${G.les}</b><span>dars o'tkazildi</span></div><div><b>${G.st}</b><span>o'quvchi</span></div><div><b>${G.att}%</b><span>davomat</span></div><div><b>${G.paid ? sp3(G.inc) : G.top}</b><span>${G.paid ? "tushum, so'm" : "mavzu o'tildi"}</span></div></div>
        <div class="g-rsum"><h3>Xulosa</h3>${allSummary(G).map((x) => `<p>${H.e(x)}</p>`).join("")}</div>
        <div class="g-allg">${G.rows.map((r) => `<button class="g-allc" type="button" data-allg="${r.ci}"><span class="g-allh"><b>${H.e(r.c.name)}</b>${r.c.kind === "paid" ? `<span class="g-pill p-acc">Pullik</span>` : `<span class="g-pill p-club">To'garak</span>`}</span>
          <span class="g-allk g-num"><span><b>${r.les}</b> dars</span><span><b>${r.top == null ? "—" : r.top}</b> mavzu</span><span><b style="color:${r.les && r.att < 75 ? "var(--g-bad)" : "inherit"}">${r.les ? r.att + "%" : "—"}</b> davomat</span>${r.c.kind === "paid" ? `<span><b>${sp3(r.inc)}</b> so'm</span>` : ""}</span>
          ${r.pct != null ? `<span class="g-tbar"><i style="width:${r.pct}%"></i></span><span class="g-muted" style="font-size:12px">yillik reja ${r.pct}%${r.late ? " — yil oxirigacha yetmaydi" : ""}</span>` : `<span class="g-muted" style="font-size:12px">yillik mavzular rejasi kiritilmagan</span>`}</button>`).join("")}</div>
        <div class="g-rsum" style="background:var(--g-alt)"><h3>Tavsiyalar</h3>${allAdvice(G).map((x, i) => `<p>${i + 1}. ${H.e(x)}</p>`).join("")}</div></div>`}
      <div class="g-row g-ract"><button class="g-btn pri" type="button" data-alprint>Chop etish (A4)</button><button class="g-btn" type="button" data-alsend>PDF — Telegram'ga</button><button class="g-btn" type="button" data-alcopy>Xulosa matnini nusxalash</button></div>`;
  }
  function bindAll(m, list, open) {
    H.qa("[data-alq]", m).forEach((b) => b.onclick = () => { AL.q = +b.dataset.alq; H.draw(); });
    H.qa("[data-tprv]", m).forEach((b) => b.onclick = () => { T.rv = b.dataset.tprv; H.draw(); });
    H.qa("[data-tpst]", m).forEach((b) => b.onclick = () => { T.o.st = b.dataset.tpst; keepO(); H.draw(); });
    H.qa("[data-tpo2]", m).forEach((b) => b.onclick = () => { const k = b.dataset.tpo2; T.o[k] = !T.o[k]; keepO(); H.draw(); });
    H.qa("[data-allg]", m).forEach((b) => b.onclick = () => open(+b.dataset.allg));
    const G = () => allData(list, AL.q), nm = () => `Umumiy hisobot ${qLab(AL.q)}`;
    const pr = H.q("[data-alprint]", m); if (pr) pr.onclick = () => { if (typeof printDoc === "function") printDoc(`<div class="tpt g-a4print">${paginate(allParts(G())).join("")}</div>`, false, false, nm()); else H.toast("Chop etib bo'lmadi"); };
    const cp = H.q("[data-alcopy]", m); if (cp) cp.onclick = () => copyTxt(allSummary(G()).concat(allAdvice(G()).map((x, i) => `${i + 1}. ${x}`)).join("\n"));
    const sd = H.q("[data-alsend]", m); if (sd) sd.onclick = () => { if (typeof PTG === "undefined") { H.toast("PDF yuborib bo'lmadi"); return; }
      PTG.run(() => PTG.pagesPdf([`<div class="tpt">${paginate(allParts(G())).join("")}</div>`], false), nm(), `📊 ${nm()}\n${allSummary(G())[0]}`, sd); };
    fitA4(m);
  }
  // A4 ko'rinishini ekran kengligiga moslab kichraytirish
  function fitA4(m) { H.qa(".g-a4s", m).forEach((w) => { const k = Math.min(1, w.clientWidth / 794), pg = w.firstElementChild; if (!pg) return; pg.style.transform = `scale(${k})`; w.style.height = Math.ceil(1123 * k) + "px"; }); }
  function copyTxt(txt) { const done = () => H.toast("Xulosa nusxalandi — Telegram yoki Word ga qo'ying"); try { navigator.clipboard.writeText(txt).then(done, () => H.toast(txt)); } catch (err) { H.toast(txt); } }

  function bind(m, c) {
    H.qa("[data-tpv]", m).forEach((b) => b.onclick = () => { T.view = b.dataset.tpv; H.draw(); });
    H.qa("[data-tprep]", m).forEach((b) => b.onclick = () => { T.view = "rep"; T.rq = +b.dataset.tprep; H.draw(); });
    H.qa("[data-tpq]", m).forEach((b) => b.onclick = () => { T.rq = +b.dataset.tpq; H.draw(); });
    H.qa("[data-tprv]", m).forEach((b) => b.onclick = () => { T.rv = b.dataset.tprv; H.draw(); });
    H.qa("[data-tpst]", m).forEach((b) => b.onclick = () => { T.o.st = b.dataset.tpst; keepO(); H.draw(); });
    H.qa("[data-tpby]", m).forEach((b) => b.onclick = () => { T.o.by = b.dataset.tpby; keepO(); H.draw(); });
    H.qa("[data-tpo2]", m).forEach((b) => b.onclick = () => { const k = b.dataset.tpo2; T.o[k] = !T.o[k]; keepO(); H.draw(); });
    // sarlavha: yozib bo'lgach (change) saqlanadi — har harfda qayta chizilmaydi
    [["#g-ro", "org"], ["#g-rt", "tch"]].forEach(([sel, k]) => { const i = H.q(sel, m); if (i) i.onchange = () => { c.grh = Object.assign({}, c.grh, {[k]: i.value.trim().slice(0, 120)}); H.save(); H.draw(); }; });
    H.qa("[data-tprk]", m).forEach((b) => b.onclick = () => { T.rk = b.dataset.tprk; H.draw(); });
    const rs = H.q("#g-rsel", m); if (rs) rs.onchange = () => { T.rs = rs.value; H.draw(); };
    H.qa("[data-rsn]", m).forEach((b) => b.onclick = () => { const i = c.students.findIndex((x) => x.id === T.rs), n = c.students.length; T.rs = c.students[(i + +b.dataset.rsn + n) % n].id; H.draw(); });
    const pr = H.q("[data-tpprint]", m); if (pr) pr.onclick = () => { const C = cur(c); if (typeof printDoc === "function") printDoc(`<div class="tpt g-a4print">${paginate(C.X()).join("")}</div>`, false, false, C.name); else H.toast("Chop etib bo'lmadi"); };
    const pa = H.q("[data-tpall]", m); if (pa) pa.onclick = () => { if (typeof printDoc !== "function") return H.toast("Chop etib bo'lmadi");
      printDoc(`<div class="tpt g-a4print">${c.students.map((s) => paginate(stParts(c, s, T.rq)).join("")).join("")}</div>`, false, false, `${c.name} ${qLab(T.rq)} o'quvchilar hisoboti`); };
    fitA4(m);
    const cp = H.q("[data-tpcopy]", m); if (cp) cp.onclick = () => copyTxt(cur(c).text().join("\n"));
    const sd = H.q("[data-tpsend]", m); if (sd) sd.onclick = () => { if (typeof PTG === "undefined") { H.toast("PDF yuborib bo'lmadi"); return; }
      const C = cur(c); PTG.run(() => PTG.pagesPdf([`<div class="tpt">${paginate(C.X()).join("")}</div>`], false), C.name, `📘 ${C.name}\n${C.text()[1] || C.text()[0] || ""}`, sd); };
    H.qa("[data-tpl]", m).forEach((b) => b.onclick = () => planDialog(c));
    H.qa("[data-tpx]", m).forEach((b) => b.onclick = () => fromExcel(c, (txt) => planDialog(c, txt)));
    H.qa("[data-tpe]", m).forEach((b) => b.onclick = () => dayDialog(c, b.dataset.tpe));
    H.qa("[data-tpf]", m).forEach((b) => b.onclick = () => { T.flt = b.dataset.tpf; H.draw(); });
  }
  return {init: (h) => { H = h; }, allHtml, bindAll, _all: AL, parse, layout, has, tabHtml, homeNote, repData, summary, qPer, freshQ, openRep: (q) => { T.view = "rep"; T.rq = q; }, dayStrip, bind, todayLine, topicOf, _state: T};
})();
