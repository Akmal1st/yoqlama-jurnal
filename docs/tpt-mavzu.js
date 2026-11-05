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
  const T = {flt: "next", view: "plan", rq: 0, rv: "scr"};

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
  function qPer(c, q) {
    const r = qR(q); if (!r) return null;
    const pv = q > 1 ? qR(q - 1) : null, st = c.gplan && ISO.test(String(c.gplan.start || "")) ? c.gplan.start : r[0];
    return {q, from: pv ? addD(pv[1], 1) : st < r[0] ? st : r[0], to: r[1], end: r[1]};
  }
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
    const nxt = qPer(c, q + 1), nrows = nxt ? L.rows.filter((r) => r.n && r.d >= nxt.from && r.d <= nxt.to) : L.rows.filter((r) => r.n && r.d > P.to);
    const partial = !qDone(c, q);
    return {P, rows, offs, plan, own, topics, first, last, total: L.total, nTopics: c.gplan.topics.length, att: sumN ? Math.round(sumK / sumN * 100) : 0,
      miss: st.filter((x) => x.miss).sort((a, b) => b.miss - a.miss || a.name.localeCompare(b.name)).slice(0, 3),
      full: st.filter((x) => !x.miss).length, nSt: st.length, nrows, partial, upto};
  }
  // o'qituvchi uchun tayyor matn (xulosa) — ota-onalar guruhiga yoki ma'muriyatga
  function summary(c, A) {
    const sl = slots(c.gplan), P = A.P, out = [];
    out.push(`«${c.name}» guruhi, ${P.q}-chorak (${H.dm(P.from)} – ${fullD(A.partial ? A.upto : P.to)}).`);
    if (!A.rows.length) { out.push("Bu davrda dars o'tkazilmagan."); return out; }
    out.push(`${A.rows.length} ta dars o'tkazildi${A.own.length ? `, shundan ${A.own.length} tasi rejadan tashqari mavzu` : ""}. Yillik rejadagi ${A.total} darsdan ${A.first ? `${A.first}–${A.last}-darslar` : "hech biri"} o'tildi (${A.topics.length} ta mavzu); yillik reja ${Math.round(A.last / A.total * 100)}% bajarildi.`);
    const sh = A.offs.length + A.own.length;
    out.push(sh ? `${A.offs.length ? `${A.offs.length} kun dars bo'lmadi (${A.offs.map(H.dm).join(", ")})` : ""}${A.offs.length && A.own.length ? ", " : ""}${A.own.length ? `${A.own.length} darsda boshqa mavzu o'tildi` : ""} — reja ${sh} darsga surildi.` : "Darslar reja bo'yicha, kechikishsiz o'tildi.");
    out.push(`O'rtacha davomat ${A.att}%. ${A.full ? `${A.full} o'quvchi birorta ham darsni qoldirmadi.` : ""}${A.miss.length ? ` Ko'p qoldirganlar: ${A.miss.map((x) => `${x.name} (${x.miss})`).join(", ")}.` : ""}`.trim());
    if (A.nrows.length) { const a = A.nrows[0], b = A.nrows[A.nrows.length - 1]; out.push(`Keyingi chorakda ${A.nrows.length} ta dars rejalashtirilgan: «${a.s.t}» dan «${b.s.t}» gacha.`); }
    else if (A.last >= sl.length) out.push("Yillik reja to'liq bajarildi.");
    return out;
  }
  function sheet(c, A) {
    const P = A.P, lines = summary(c, A);
    const list = A.rows.concat(A.offs.map((d) => ({d, off: true}))).sort((a, b) => a.d.localeCompare(b.d));
    return `<div class="g-rhead"><small>O'tilgan mavzular hisoboti</small><h2>${H.e(c.name)} · ${P.q}-chorak</h2>
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
    const P = A.P, h = hdrS(), lines = summary(c, A).slice(1);
    const list = A.rows.concat(A.offs.map((d) => ({d, off: true}))).sort((a, b) => a.d.localeCompare(b.d));
    const head = `${h.school ? `<div class="g-a4sch">${H.e(h.school)}</div>` : ""}<div class="g-a4t">O'tilgan mavzular hisoboti</div>
      <div class="g-a4st">«${H.e(c.name)}» guruhi · ${P.q}-chorak · ${yearOf(P.from)} o'quv yili</div>
      <table class="g-a4info"><tr><td>Davr: <b>${dd(P.from)} – ${dd(P.to)}</b></td><td>Dars kunlari: <b>${H.e(H.sched(c))}</b></td></tr>
        <tr><td>O'quvchilar: <b>${A.nSt} nafar</b></td><td>O'qituvchi: <b>${h.teacher ? H.e(h.teacher) : "____________________"}</b></td></tr></table>
      ${A.partial ? `<div class="g-a4warn">Chorak hali tugamagan — ma'lumot ${dd(A.upto)} holatiga.</div>` : ""}
      <table class="g-a4kpi"><tr><th>O'tkazilgan darslar</th><th>O'tilgan mavzular</th><th>Yillik reja bajarilishi</th><th>O'rtacha davomat</th></tr>
        <tr><td>${A.rows.length}</td><td>${A.topics.length}</td><td>${A.total ? Math.round(A.last / A.total * 100) : 0}% <small>(${A.last}/${A.total} dars)</small></td><td>${A.att}%</td></tr></table>`;
    const rowH = (r) => `<tr class="${r.off ? "off" : ""}"><td>${r.n || (r.off ? "—" : "*")}</td><td>${dd(r.d)}</td><td>${H.WDS[H.wdOf(r.d)]}</td><td class="l">${r.off ? "Dars bo'lmadi (mavzu keyingi darsga surildi)" : r.own ? `${H.e(r.own)} <i>(rejadan tashqari)</i>` : H.e(sTxt(r.s))}</td><td>${r.off ? "" : `${r.k}/${r.na}`}</td></tr>`;
    const thead = (cont) => `<div class="g-a4h">Darslar va mavzular${cont ? " (davomi)" : ""}</div><table class="g-a4tab"><thead><tr><th>№</th><th>Sana</th><th>Kun</th><th class="l">Mavzu</th><th>Keldi</th></tr></thead><tbody>`;
    const tail = `<div class="g-a4h">Xulosa</div><div class="g-a4sum">${lines.map((x) => `<p>${H.e(x)}</p>`).join("")}</div>
      <div class="g-a4note">* — rejadan tashqari mavzu; «Keldi» — darsga kelgan / guruhdagi o'quvchilar.</div>
      <div class="g-a4sig"><div><span>O'qituvchi</span><i></i><small>(imzo)</small></div><div><span>F.I.Sh.</span><i>${h.teacher ? H.e(h.teacher) : ""}</i><small></small></div><div><span>Sana</span><i></i><small></small></div></div>`;
    return {head, rows: list.map(rowH), thead, tail, foot: (i, n) => `<div class="g-a4f"><span>«${H.e(c.name)}» · ${P.q}-chorak · o'tilgan mavzular</span><span>${i} / ${n}</span></div>`};
  }
  let host = null;
  function a4pages(c, A) {
    const X = a4parts(c, A);
    if (!host) { host = document.createElement("div"); host.className = "tpt g-a4host"; host.setAttribute("aria-hidden", "true"); }
    if (!host.isConnected) document.body.append(host);
    const page = (fs, body) => `<div class="bx-pg g-a4p" style="--fs:${fs}px"><div class="g-a4i">${body}</div></div>`;
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
    return `<div class="g-a4w">${ps.map((x) => `<div class="g-a4s">${x}</div>`).join("")}</div>
      <span class="g-muted" style="font-size:12.5px">A4 varaq: ${ps.length} bet. «Chop etish» bosilganda xuddi shunday chiqadi; «PDF — Telegram'ga» ham shu varaqni yuboradi.</span>`;
  }
  function printA4(c, q) {
    const ps = a4pages(c, repData(c, q));
    if (typeof printDoc === "function") printDoc(`<div class="tpt g-a4print">${ps.join("")}</div>`, false, false, `${c.name} ${q}-chorak mavzular`);
    else H.toast("Chop etib bo'lmadi");
  }
  function repHtml(c) {
    const qs = [1, 2, 3, 4].filter((q) => qPer(c, q)), t = H.today();
    if (!qs.length) return `<div class="g-card g-empty"><h2>Choraklar sanasi kiritilmagan</h2><div class="g-muted">Hisobot chorak bo'yicha tuziladi. «Sozlamalar»da o'quv yili choraklarining boshlanish va tugash sanalarini kiriting.</div></div>`;
    if (!T.rq || !qs.includes(T.rq)) T.rq = qs.filter((q) => qPer(c, q).from <= t).pop() || qs[0];
    const q = T.rq, A = repData(c, q);
    if (qDone(c, q) && !(c.grep || {})[q]) { c.grep = Object.assign({}, c.grep, {[q]: {at: t}}); H.save(); }
    return `<div class="g-row"><div class="g-seg g-qseg" role="group" aria-label="Chorak">${qs.map((x) => { const P = qPer(c, x); return `<button type="button" data-tpq="${x}" class="${x === q ? "on" : ""}">${x}-chorak<small>${P.from > t ? "boshlanmagan" : qDone(c, x) ? "tugagan" : "davom etmoqda"}</small></button>`; }).join("")}</div></div>
      ${qPer(c, q).from > t ? `<div class="g-card g-muted">${q}-chorak hali boshlanmagan (${fullD(qPer(c, q).from)}).</div>` : `<div class="g-row"><div class="g-seg" role="group" aria-label="Ko'rinish"><button type="button" data-tprv="scr" class="${T.rv !== "a4" ? "on" : ""}">Ekranda</button><button type="button" data-tprv="a4" class="${T.rv === "a4" ? "on" : ""}">A4 varaq</button></div></div>
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
  const pdfPages = (c, q) => [`<div class="tpt">${a4pages(c, repData(c, q)).join("")}</div>`];
  // A4 ko'rinishini ekran kengligiga moslab kichraytirish
  function fitA4(m) { H.qa(".g-a4s", m).forEach((w) => { const k = Math.min(1, w.clientWidth / 794), pg = w.firstElementChild; if (!pg) return; pg.style.transform = `scale(${k})`; w.style.height = Math.ceil(1123 * k) + "px"; }); }
  function copyTxt(txt) { const done = () => H.toast("Xulosa nusxalandi — Telegram yoki Word ga qo'ying"); try { navigator.clipboard.writeText(txt).then(done, () => H.toast(txt)); } catch (err) { H.toast(txt); } }

  function bind(m, c) {
    H.qa("[data-tpv]", m).forEach((b) => b.onclick = () => { T.view = b.dataset.tpv; H.draw(); });
    H.qa("[data-tprep]", m).forEach((b) => b.onclick = () => { T.view = "rep"; T.rq = +b.dataset.tprep; H.draw(); });
    H.qa("[data-tpq]", m).forEach((b) => b.onclick = () => { T.rq = +b.dataset.tpq; H.draw(); });
    H.qa("[data-tprv]", m).forEach((b) => b.onclick = () => { T.rv = b.dataset.tprv; H.draw(); });
    const pr = H.q("[data-tpprint]", m); if (pr) pr.onclick = () => printA4(c, T.rq);
    fitA4(m);
    const cp = H.q("[data-tpcopy]", m); if (cp) cp.onclick = () => copyTxt(summary(c, repData(c, T.rq)).join("\n"));
    const sd = H.q("[data-tpsend]", m); if (sd) sd.onclick = () => { const q = T.rq; if (typeof PTG === "undefined") { H.toast("PDF yuborib bo'lmadi"); return; }
      PTG.run(() => PTG.pagesPdf(pdfPages(c, q), false), `${c.name} ${q}-chorak mavzular`, `📘 ${c.name}: ${q}-chorak — o'tilgan mavzular\n${summary(c, repData(c, q))[1] || ""}`, sd); };
    H.qa("[data-tpl]", m).forEach((b) => b.onclick = () => planDialog(c));
    H.qa("[data-tpx]", m).forEach((b) => b.onclick = () => fromExcel(c, (txt) => planDialog(c, txt)));
    H.qa("[data-tpe]", m).forEach((b) => b.onclick = () => dayDialog(c, b.dataset.tpe));
    H.qa("[data-tpf]", m).forEach((b) => b.onclick = () => { T.flt = b.dataset.tpf; H.draw(); });
  }
  return {init: (h) => { H = h; }, parse, layout, has, tabHtml, homeNote, repData, summary, qPer, freshQ, openRep: (q) => { T.view = "rep"; T.rq = q; }, dayStrip, bind, todayLine, topicOf, _state: T};
})();
