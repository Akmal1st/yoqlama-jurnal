/* Hisobotlar bo'limi — tasdiqlangan dizayn (maket v1, Akmal 2026-11-01). Ko'rinish shu faylda, hisob-kitob index.html da:
   reportRows, statsData, attMonth, sumData, compareRows/compareTotal, readiness, qualityOf, saveTable, fitPrint.
   Bu fayl asosiy skriptdan OLDIN ulanadi; ichidagi funksiyalar asosiy skriptdagi nomlarni faqat chaqirilganda ishlatadi.
   Kompyuterda: chapda turlar ro'yxati (4 guruh), o'ngda hisobot paneli. Telefonda: «Almashtirish» tugmasi va pastdan chiqadigan tanlov. */
/* 2026-11-07 (Akmal: «hisobotlar bo'limini kamchiliklarini aniqla…», maket v2 tasdiqlandi): Loyiha ishi o'z nomi bilan va BSB qismida,
   «Izoh» qisqa belgilar (to'liq matn — title), jami qatori, chorak baholarida «ball to'liq emas», «Ball qo'yish» aynan o'sha ishni ochadi,
   statistikada 2 haftalik o'zgarish + davomat + Excel, ota-onalar varag'ida sinf o'rtachasi va bitta «E'tibor bering» bloki,
   o'quvchi tartib raqami bo'yicha ochiladi (ismdoshlar), tanlangan sinf eslab qolinadi, telefonda 3 tugma bir qatorda. */
const HSB = (() => {
  const KINDS = [
    ["Sinf bo'yicha", [["cls", "📋", "Sinf hisoboti", "Baholar, davomat, xavf"], ["stats", "📈", "Grafik va statistika", "Haftalar bo'yicha o'zgarish"], ["att", "📅", "Davomat varag'i", "Chorak bo'yicha belgilar"]]],
    ["Chorak yakuni", [["sum", "🧮", "BSB va CHSB", "Ishlar va chorak bahosi"], ["ready", "✅", "Chorakka tayyorlik", "Nima yetishmaydi"]]],
    ["Chop etish uchun", [["par", "👪", "Ota-onalar majlisi", "Har o'quvchiga varaq"], ["blank", "📝", "Bo'sh varaq", "Qo'lda to'ldirish uchun"], ["seat", "🪑", "O'rindiq xaritasi", "Partalar bo'yicha joylashuv"]]],
    ["Barcha sinflar", [["cmp", "⚖️", "Sinflarni solishtirish", "Hamma sinflar yonma-yon"]]]];
  const KIND = Object.fromEntries(KINDS.flatMap(([, l]) => l.map((k) => [k[0], k])));
  // har tur nimani so'raydi: davr (per), chorak (q), oy (mon), yoki hech narsa
  const NEED = {cls: "per", stats: "per", par: "per", cmp: "per", sum: "q", ready: "q", att: "q", blank: "", seat: ""};
  const XLS = {blank: "data-bvx", cls: "data-xlsx", stats: "data-stxlsx", att: "data-dvx", cmp: "data-ccsv", ready: "data-rxlsx", sum: "data-sxlsx"};
  const SRC = {cls: "<b>Jurnal</b> baholari va yo'qlama, tanlangan davr ichida. Xavf ostida — <b>Sozlamalar → Baholash → Xavf turlari</b> bo'yicha.",
    stats: "<b>Jurnal</b> baholari va yo'qlama, haftalarga bo'lib.", att: "<b>Jurnal</b> yo'qlamasi: S, DQ, K, KQ belgilari, tanlangan chorak ichida (sanalar <b>Sozlamalar → Choraklar</b>dan). Belgisi yo'q kunlar — darsda bo'lgan.",
    sum: "<b>Jurnal → Umumiy</b> ballari va kundalik baholar (FB). Loyiha ishi chorakda BSB qismiga qo'shiladi (BSB + Loyiha = 50). Chorak bahosi: jami ≥ 86 — 5, ≥ 66 — 4, ≥ 30 — 3.",
    ready: "<b>Jurnal → Umumiy</b>, kundalik baholar soni va <b>Sozlamalar → Choraklar</b>.",
    par: "Sinf hisoboti bilan bir xil ma'lumot; «sinfda» — sinf o'rtachasi. O'qituvchi ismi <b>Summativ → Eksport</b> sarlavhasidan.",
    cmp: "Har sinfning sinf hisoboti, bir xil davr uchun. Jami qatori vaznli: baho — barcha baholar, davomat — o'quvchilar, BSB/CHSB — ballar yig'indisi bo'yicha.",
    blank: "O'quvchilar ro'yxati va dars kunlari <b>Jurnal</b>dan, kelgusi kunlar <b>dars jadvali</b>dan (bayram va metod kunlari tashlanadi); sarlavha <b>Summativ → Eksport</b> sarlavhasidagi maktab va o'qituvchi ismidan."};
  SRC.seat = "<b>O'rindiq xaritasi</b> (sinf menyusi yoki darsda «Xarita» rejimi). Bir sinfga bir necha fandan kirsangiz — xarita bitta. Chet eldagilar (oxirgi belgi CH) joysiz. O'qituvchi ismi <b>Summativ → Eksport</b> sarlavhasidan.";
  const CODES = {s: "S", dq: "DQ", k: "K", kq: "KQ", ch: "CH"};
  const has = (k) => k in KIND;
  const phone = () => matchMedia("(max-width:820px)").matches;
  const f = (v, d = 1, u = "") => v === null || v === undefined || Number.isNaN(v) ? "—" : (+v).toFixed(d) + u;
  const d5 = (s) => fmt(s).slice(0, 5);
  let pop = null;   // ochiq tanlov oynasi (kompyuter)

  /* ───────── holat ───────── */
  const classes = () => D.classes.map((_, i) => i).filter((i) => !isGrp(D.classes[i]));
  const keep = () => { try { localStorage.setItem("yoqlama_rep", JSON.stringify({kind: S.rep.kind, per: S.rep.per, ci: S.rep.ci})); } catch (e) {} };
  function ctx() {
    const R = S.rep, CL = classes();
    if (!CL.includes(R.ci)) R.ci = CL[0];
    if (!has(R.kind)) R.kind = "cls";
    const c = D.classes[R.ci], [lo, hi] = repRange(R.per), qNow = periodNow()[2];
    const rq = /^q\d$/.test(R.per) ? +R.per[1] : R.per === "cur" ? qNow : null;
    return {R, CL, c, lo, hi, rq, qNow, q: S.rq || curQuarter()};
  }
  function perLabel(X) {
    const n = NEED[X.R.kind];
    if (n === "per") {
      const p = X.R.per, nm = p === "cur" ? (X.qNow ? `${X.qNow}-chorak` : "Joriy oy") : /^q\d$/.test(p) ? `${p[1]}-chorak` : {month: "Shu oy", week: "Shu hafta", all: "Butun yil"}[p] || "Davr";
      return [nm, `${d5(X.lo)} – ${d5(X.hi)}`];
    }
    if (n === "q") { const r = qRange(X.q); return [`${X.q}-chorak`, r ? `${d5(r[0])} – ${d5(r[1])}` : "sanalari yo'q"]; }
    if (n === "mon") { const A = attMonth(X.c, S.amon); return [A.title, `${A.dates.length} dars kuni`]; }
    return null;
  }

  /* ───────── kichik bo'laklar ───────── */
  const kpi = (l, v, sub = "", cls = "") => `<div class="hb-kpi ${cls}"><small>${l}</small><b>${v}</b>${sub ? `<i>${sub}</i>` : ""}</div>`;
  const gp = (v) => { if (v === null || v === undefined) return `<span class="hb-gp">—</span>`; const col = gradeColor(v); return `<span class="hb-gp" ${col ? `style="background:${col};color:${contrast(col)}"` : ""}>${v.toFixed(2)}</span>`; };
  const dist = (parts, title) => {
    const tot = parts.reduce((a, p) => a + p[1], 0) || 1;
    return `<div class="hb-dist">${title ? `<h3>${title}</h3>` : ""}<div class="hb-bar">${parts.map(([, n, c]) => n ? `<i style="width:${100 * n / tot}%;background:${c}"></i>` : "").join("")}</div>
      <div class="hb-lg">${parts.map(([l, n, c]) => `<span style="--c:${c}">${l}: <b>${n}</b></span>`).join("")}</div></div>`;
  };
  const attCol = (k) => (D.settings.attendance || {})[k];
  const code = (k, txt) => { const col = attCol(k); return `<span class="hb-chip" ${col ? `style="background:${col};color:${contrast(col)}"` : ""}>${txt}</span>`; };
  const missChips = (r) => ["s", "dq", "k", "kq", "ch"].filter((k) => r[k]).map((k) => code(k, `${CODES[k]} ${r[k]}`)).join(" ");
  const missN = (r) => r.s + r.dq + r.k;
  const QCOL = ["var(--ok)", "var(--hb-ok-b)", "var(--hb-warn-b)", "var(--danger)"];
  const wCls = (t) => t === "chsb" ? "chsb" : t === "loyiha" ? "loy" : "bsb";
  // xavf sababining qisqa belgisi (to'liq matn — title'da va Excel'da): «O'rtacha 4.3», «Chorak 2», «Loyiha 10%»
  function why1(t, k) {
    const n = (re) => { const m = re.exec(t); return m ? m[1] : ""; };
    if (k === "avg") return [`O'rtacha ${n(/o'rtacha ([\d.]+)/)}`, "r"];
    if (k === "few") return [`Baho kam: ${n(/(\d+) ta baho/)}`, "r"];
    if (k === "min_n") return [`Baholar ${n(/soni (\d+)/)}`, "r"];
    if (k === "att") return [`Davomat ${n(/davomat (\d+%)/)}`, "r"];
    if (k === "s") return [`Sababsiz ${n(/sababsiz (\d+)/)}`, "r"];
    if (k === "qgrade") return ["Chorak 2", "r"];
    if (k === "consec") return [`Ketma-ket ${n(/ketma-ket (\d+)/)}`, "r"];
    if (k === "drop") return ["Baholar pasaymoqda", "r"];
    if (k === "work") { const m = /^(BSB|CHSB|Loyiha ishi) [\d.]+: (\d+%)/.exec(t); if (m) return [`${m[1] === "Loyiha ishi" ? "Loyiha" : m[1]} ${m[2]}`, m[1] === "CHSB" ? "chsb" : m[1] === "BSB" ? "bsb" : "loy"]; }
    return [t, "r"];
  }
  const whyChips = (r) => r.why.map((t, i) => { const [x, c] = why1(t, r.kinds[i]); return `<span class="hb-chip ${c} hb-wy" title="${esc(t)}">${esc(x)}</span>`; }).join("");

  /* ───────── 1. Sinf hisoboti ───────── */
  const SORTS = [["", "№ tartibida", "Jurnaldagi tartib"], ["name|1", "Ism bo'yicha", "A dan Z gacha"], ["avg|-1", "O'rtacha ↓", "Yuqoridan pastga"], ["avg|1", "O'rtacha ↑", "Pastdan yuqoriga"],
    ["att|1", "Davomat ↑", "Eng kami tepada"], ["miss|-1", "Qoldirgan ↓", "Eng ko'pi tepada"], ["why|-1", "Muammolar ↓", "Xavf sabablari ko'pi tepada"], ["qt|-1", "Chorak balli ↓", "Yuqoridan pastga"]];
  const KEY = {name: (r) => r.name, avg: (r) => r.avg, n: (r) => r.n, att: (r) => r.att, miss: (r) => missN(r), s: (r) => r.s, dq: (r) => r.dq, k: (r) => r.k, kq: (r) => r.kq, qt: (r) => r.q ? r.q.total : null, why: (r) => r.why.length};
  function clsList(X, rows) {
    const so = S.rsort || {}, rt = RISK_TYPES.some(([k]) => k === S.rtype) ? S.rtype : "", key = KEY[so.k];
    let L = rows.map((r, i) => [r, i]);
    if (S.rfilt === "risk") L = L.filter(([r]) => r.risk);
    if (rt) L = L.filter(([r]) => r.kinds.includes(rt));
    if (key) L.sort(([a], [b]) => { const x = key(a), y = key(b); if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (typeof x === "string" ? x.localeCompare(y, "uz") : x - y) * so.dir; });
    return {L, rt, so};
  }
  function repCls(X) {
    const {c, lo, hi, rq} = X, {rows, lessons} = reportRows(c, lo, hi, rq), gr = rows.filter((r) => r.avg !== null);
    const nG = gr.reduce((a, r) => a + r.n, 0), avg = nG ? gr.reduce((a, r) => a + r.avg * r.n, 0) / nG : null;
    const at = rows.filter((r) => r.att !== null), att = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null, nRisk = rows.filter((r) => r.risk).length;
    const ql = rq ? qualityOf(rows) : null, inc = rq ? rows.filter((r) => r.q && !r.q.complete).length : 0;
    const bands = ranges().map((b, i, a) => [esc(b.name) + ` (${b.min}${i + 1 < a.length ? (a[i + 1].min - 1 > b.min ? "–" + (a[i + 1].min - 1) : "") : "–10"})`, gr.filter((r) => r.avg >= b.min && (i + 1 >= a.length || r.avg < a[i + 1].min)).length, b.color]);
    const {L, rt, so} = clsList(X, rows), filt = S.rfilt === "risk" ? "risk" : "all";
    const sv = so.k ? `${so.k}|${so.dir}` : "", sN = (SORTS.find(([k]) => k === sv) || [, "Ustun bo'yicha"])[1];
    const th = (k, n, cls = "") => `<th data-rs="${k}" class="${cls}" title="Saralash">${n}${so.k === k ? ` ${so.dir > 0 ? "▲" : "▼"}` : ""}</th>`;
    const qCell = (r) => r.q ? (r.q.complete ? `<span class="hb-qg">${r.q.grade}</span> <span class="hb-mut hb-num" style="font-size:12px">${pyFixed(r.q.total, 1)}</span>` : `<span class="hb-mut" style="font-size:12px" title="BSB/CHSB ballari to'liq emas">${pyFixed(r.q.total, 1)} · to'liq emas</span>`) : "—";
    return `<div class="hb-kpis">${kpi("O'rtacha baho", f(avg, 2))}${kpi("Davomat", f(att, 1, "%"))}${kpi("Xavf ostida", `${nRisk} <i>/ ${rows.length}</i>`, "", nRisk ? "bad" : "")}${kpi("Dars kunlari", lessons)}</div>
      <div class="hb-two"><div class="hb-box">${gr.length ? dist(bands, `O'rtacha baho bo'yicha <span class="hb-mut">· ${gr.length} o'quvchi</span>`) : `<h3>O'rtacha baho bo'yicha</h3><span class="hb-mut">Bu davrda baho yo'q.</span>`}</div>
        <div class="hb-box">${ql ? dist([5, 4, 3, 2].map((g, i) => [String(g), ql.by[i], QCOL[i]]).concat(inc ? [["ball to'liq emas", inc, "var(--line)"]] : []), `Chorak baholari <span class="hb-mut">· sifat ${ql.q.toFixed(0)}% · o'zlashtirish ${ql.u.toFixed(0)}%</span>`)
          : `<h3>Chorak baholari</h3><span class="hb-mut">${rq ? "Hali chiqmagan — BSB/CHSB ballari to'liq emas." : "Chorak tanlanganda chiqadi."}</span>`}</div></div>
      <div class="hb-tools"><div class="hb-seg"><button class="${filt === "all" ? "on" : ""}" data-rf="all">Hammasi <em>${rows.length}</em></button><button class="${filt === "risk" ? "on" : ""}" data-rf="risk">⚠ Xavf ostida <em>${nRisk}</em></button></div>
        <button class="btn btn-sm hb-sortb" data-hk="sort">⇅ <span class="hb-pc" style="display:inline">${rt ? `${sN} · ${esc(RISK_TYPES.find(([k]) => k === rt)[1][0])}` : sN}</span><span class="hb-tel" style="display:inline">Saralash${rt ? " ·1" : ""}</span></button></div>
      <div class="hb-tw hb-pc"><table class="hb-t rcls"><thead><tr><th class="s">№</th>${th("name", "O'quvchi")}${th("avg", "O'rtacha", "s")}${th("n", "Baholar", "s")}${th("att", "Davomat", "s")}${th("miss", "Qoldirgan")}${rq ? th("qt", "Chorak", "s") : ""}${th("why", "Izoh")}</tr></thead><tbody>
        ${L.map(([r, i]) => `<tr class="${r.risk ? "hb-rk" : ""}"><td class="s hb-mut hb-num">${i + 1}</td><td class="nm"><button data-card="${i}">${esc(r.name)}</button></td><td class="s">${gp(r.avg)}</td><td class="s hb-num">${r.n}</td>
          <td class="s hb-num ${r.att !== null && r.att < D.settings.risk.att_below ? "hb-low" : ""}">${f(r.att, 1, "%")}</td><td style="white-space:nowrap">${missChips(r) || `<span class="hb-mut">—</span>`}</td>${rq ? `<td class="s" style="white-space:nowrap">${qCell(r)}</td>` : ""}
          <td class="hb-wyc">${r.why.length ? `<span class="hb-l3">${whyChips(r)}</span>` : `<span class="hb-mut">—</span>`}</td></tr>`).join("")}</tbody>
        ${L.length ? clsFoot(rows, avg, att, nRisk, rq) : ""}</table></div>
      <div class="hb-rows hb-tel">${L.map(([r, i]) => `<button class="hb-li ${r.risk ? "hb-rk" : ""}" data-card="${i}"><span class="hb-l1"><b class="hb-ell">${esc(r.name)}</b>${gp(r.avg)}</span>
        <span class="hb-l2">Davomat ${f(r.att, 1, "%")} · Qoldirgan ${missN(r)}${rq ? ` · Chorak ${r.q && r.q.complete ? r.q.grade : "—"}` : ""}</span>${r.why.length ? `<span class="hb-l3">${whyChips(r)}</span>` : ""}</button>`).join("")}</div>
      ${L.length ? "" : `<div class="hb-mut">${rt || filt === "risk" ? "Xavf ostida o'quvchi yo'q. 👍" : "O'quvchi yo'q."}</div>`}`;
  }
  // jadval oxiri: sinf bo'yicha o'rtacha / jami (hamma o'quvchilar, saralash va filtrdan qat'i nazar)
  function clsFoot(rows, avg, att, nRisk, rq) {
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0), Q = rows.filter((r) => r.q && r.q.complete);
    return `<tfoot><tr><td></td><td>O'rtacha / jami</td><td class="s hb-num">${f(avg, 2)}</td><td class="s hb-num">${rows.length ? f(sum("n") / rows.length, 0) : "—"}</td><td class="s hb-num">${f(att, 1, "%")}</td>
      <td style="white-space:nowrap">${["s", "dq", "k", "kq"].map((k) => `${CODES[k]} ${sum(k)}`).join(" · ")}</td>${rq ? `<td class="s hb-num">${Q.length ? (Q.reduce((a, r) => a + r.q.grade, 0) / Q.length).toFixed(2) : "—"}</td>` : ""}<td>${nRisk} o'quvchi xavf ostida</td></tr></tfoot>`;
  }
  /* ───────── 2. BSB va CHSB ───────── */
  const PB = [["86–100%", "var(--ok)"], ["66–85%", "var(--hb-ok-b)"], ["30–65%", "var(--hb-warn-b)"], ["30% dan past", "var(--danger)"]];
  function repSum(X) {
    const {c, q} = X;
    if (!qRange(q)) return `<div class="hb-box"><h3>${q}-chorak sanalari belgilanmagan</h3><span class="hb-mut">Sozlamalar → Dars kunlari va choraklar.</span></div>`;
    const D0 = sumData(c, q), {W, rows, ql} = D0;
    if (!W.length) return `<div class="hb-box"><h3>${q}-chorakda BSB yoki CHSB ishlari yo'q</h3><span class="hb-mut">Jurnal → «Umumiy» sahifasida ish qo'shilgach, natijalar shu yerda chiqadi.</span><div><button class="btn btn-sm" data-hgo="sum">＋ Ish qo'shish</button></div></div>`;
    const tag = (w) => `<span class="hb-chip ${wCls(w.type)}">${wTag(w)}</span>`, nT = (t) => W.filter((x) => x.w.type === t).length, bp = bsbPartName(D0.works);
    const avgCol = (fn) => { const v = rows.map(fn).filter(isNum); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const sc = (s, w) => { const v = (s.scores || {})[w.id]; return isNum(v) ? fmtNum(v) : `<span class="hb-why">—</span>`; };
    const works = W.map((x) => `<div class="hb-box"><div class="hb-tools">${tag(x.w)}<span class="hb-mut" style="font-size:12.5px">maks. ${x.mx} ball</span><b class="hb-num" style="margin-left:auto">${f(x.pct, 0, "%")}</b></div>
      <div class="hb-mut" style="font-size:12.5px">Topshirdi <b style="color:${x.n < D0.N ? "var(--hb-warn)" : "var(--text)"}">${x.n} / ${D0.N}</b> · o'rtacha ${f(x.avg)} ball${x.n ? ` · ${fmtNum(x.lo)}–${fmtNum(x.hi)}` : ""}</div>
      ${dist(PB.map(([l, cc], i) => [l, x.band[i], cc]))}</div>`).join("");
    const gcell = (r) => r.complete ? `<span class="hb-qg">${r.grade}</span>` : `<span class="hb-chip" title="ballar to'liq emas">to'liq emas</span>`;
    return `<div class="hb-kpis">${kpi("Ishlar", [["bsb", "BSB"], ["loyiha", "Loyiha"], ["chsb", "CHSB"]].filter(([t]) => t !== "loyiha" || nT(t)).map(([t, n]) => `${nT(t)} ${n}`).join(" · "), "", nT("loyiha") ? "hb-ksm" : "")}${kpi("Topshirish", f(D0.sub, 0, "%"))}${kpi("O'rtacha natija", f(D0.pct, 0, "%"), ql ? `sifat ${ql.q.toFixed(0)}% · o'zl. ${ql.u.toFixed(0)}%` : "")}${kpi("Chorak bahosi", `${D0.done} <i>/ ${D0.N}</i>`, D0.done < D0.N ? `${D0.N - D0.done} tasida ball yetmaydi` : "")}</div>
      <h3>Ishlar bo'yicha</h3><div class="hb-three">${works}</div>
      <h3>O'quvchilar · chorak yakuni</h3>
      <div class="hb-tw hb-pc"><table class="hb-t rsum"><thead><tr><th class="s">№</th><th>O'quvchi</th>${W.map((x) => `<th class="s">${wTag(x.w)}<small>${x.mx} ball</small></th>`).join("")}<th class="s">${bp}<small>/50</small></th><th class="s">CHSB<small>/40</small></th><th class="s">FB<small>/10</small></th><th class="s">Jami<small>/100</small></th><th class="s">Baho</th></tr></thead><tbody>
        ${rows.map(({s, r}, i) => `<tr><td class="s hb-mut hb-num">${i + 1}</td><td class="nm"><button data-card="${i}">${esc(s.name)}</button></td>${W.map((x) => `<td class="s hb-num">${sc(s, x.w)}</td>`).join("")}<td class="s hb-num">${fmtNum(r.bsb)}</td><td class="s hb-num">${fmtNum(r.chsb)}</td><td class="s hb-num">${r.fb}</td><td class="s hb-num"><b>${fmtNum(r.total)}</b></td><td class="s">${gcell(r)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td></td><td>O'rtacha</td>${W.map((x) => `<td class="s">${f(x.avg)}</td>`).join("")}<td class="s">${f(avgCol(({r}) => r.bsb))}</td><td class="s">${f(avgCol(({r}) => r.chsb))}</td><td class="s">${f(avgCol(({r}) => r.fb))}</td><td class="s">${f(avgCol(({r}) => r.total))}</td><td class="s">${f(avgCol(({r}) => r.complete ? r.grade : null), 2)}</td></tr></tfoot></table></div>
      <div class="hb-rows hb-tel">${rows.map(({s, r}, i) => `<button class="hb-li" data-card="${i}"><span class="hb-l1"><b class="hb-ell">${esc(s.name)}</b>${gcell(r)}</span>
        <span class="hb-l2">${W.map((x) => `${wTag(x.w)}: ${sc(s, x.w)}`).join(" · ")} · FB ${r.fb} · Jami ${fmtNum(r.total)}</span></button>`).join("")}</div>`;
  }
  /* ───────── 3. Grafik va statistika ───────── */
  function line(pts, lo, hi, step, fv, lbl) {
    const Wd = 320, H = 150, l = 30, r = 12, t = 14, b = 22, n = pts.length;
    const x = (i) => l + (n < 2 ? (Wd - l - r) / 2 : i * (Wd - l - r) / (n - 1)), y = (v) => t + (hi - v) * (H - t - b) / (hi - lo);
    let s = `<svg viewBox="0 0 ${Wd} ${H}" class="stat" role="img" aria-label="${esc(lbl)}">`;
    for (let v = lo; v <= hi + 1e-9; v += step) s += `<line class="gl" x1="${l}" x2="${Wd - r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l - 6}" y="${y(v) + 3}" text-anchor="end">${fv(v)}</text>`;
    const segs = []; let cur = [];
    pts.forEach((p, i) => { if (p.v === null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(p.v)]); });
    if (cur.length) segs.push(cur);
    for (const g of segs) {
      const ps = g.map(([a, c]) => `${a.toFixed(1)},${c.toFixed(1)}`).join(" ");
      if (g.length > 1) s += `<polygon class="ar" points="${g[0][0].toFixed(1)},${y(lo)} ${ps} ${g[g.length - 1][0].toFixed(1)},${y(lo)}"/>`;
      s += `<polyline class="ln" points="${ps}"/>`;
    }
    const last = pts.map((p, i) => [p, i]).filter(([p]) => p.v !== null).pop();
    pts.forEach((p, i) => { if (p.v !== null) s += `<g><circle class="${last && last[1] === i ? "end" : "dt"}" cx="${x(i)}" cy="${y(p.v)}" r="${last && last[1] === i ? 4 : 2.6}"/><title>${fmt(p.from)} haftasi: ${fv(p.v, 1)}${p.note ? " · " + p.note : ""}</title></g>`; });
    if (last) s += `<text class="vl" x="${x(last[1]) - 6}" y="${y(last[0].v) < t + 12 ? y(last[0].v) + 14 : y(last[0].v) - 8}" text-anchor="end">${fv(last[0].v, 1)}</text>`;
    const st = Math.max(1, Math.ceil(n / 4));
    pts.forEach((p, i) => { if (i % st === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${d5(p.from)}</text>`; });
    return s + `</svg>`;
  }
  function bars(dist) {
    const Wd = 320, H = 150, l = 8, r = 8, t = 16, b = 22, v = dist.slice(1), mx = Math.max(1, ...v), bw = (Wd - l - r) / 10, tot = v.reduce((a, c) => a + c, 0);
    return `<svg viewBox="0 0 ${Wd} ${H}" class="stat" role="img" aria-label="Baholar taqsimoti"><line class="gl" x1="${l}" x2="${Wd - r}" y1="${H - b}" y2="${H - b}"/>${v.map((n, i) => {
      const h = n * (H - t - b) / mx, g = i + 1, c = gradeColor(g) || "var(--acc)";
      return `<g><rect x="${(l + i * bw + 4).toFixed(1)}" y="${(H - b - h).toFixed(1)}" width="${(bw - 8).toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${c}"/>${n ? `<text class="vl" x="${l + i * bw + bw / 2}" y="${H - b - h - 4}" text-anchor="middle">${n}</text>` : ""}<text x="${l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${g}</text><title>${g} baho: ${n} ta${tot ? ` (${Math.round(100 * n / tot)}%)` : ""}</title></g>`; }).join("")}</svg>`;
  }
  function repStats(X) {
    const {c, lo, hi, rq} = X, {rows} = reportRows(c, lo, hi, rq), st = statsData(c, lo, hi), W = st.weeks.map((w) => ({...w, from: w.from < lo ? lo : w.from}));   // 1-hafta davr boshidan yoziladi
    const avgs = W.filter((w) => w.avg !== null), k2 = avgs.length >= 4 ? 2 : 1, mean = (L) => L.reduce((a, w) => a + w.avg, 0) / L.length;
    // o'zgarish: oxirgi 2 hafta o'rtachasi boshidagi 2 haftaga nisbatan (4 haftadan kam bo'lsa — oxirgi va birinchi hafta)
    const trend = avgs.length > 1 ? mean(avgs.slice(-k2)) - mean(avgs.slice(0, k2)) : null, trendSub = k2 === 2 ? "oxirgi 2 hafta, boshidagi 2 haftaga nisbatan" : "1-haftaga nisbatan";
    const at = rows.filter((r) => r.att !== null), attAll = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null;
    const mn = avgs.length ? Math.min(...avgs.map((w) => w.avg)) : 2, alo = Math.max(0, Math.min(8, Math.floor((mn - 0.5) / 2) * 2));
    const amin = Math.max(0, Math.floor(Math.min(...W.map((w) => w.att ?? 100)) / 10) * 10 - 10), astep = 100 - amin > 40 ? 20 : 10;
    const top = rows.filter((r) => missN(r) > 0).sort((a, b) => missN(b) - missN(a)).slice(0, 5);
    return `<div class="hb-kpis">${kpi("Dars kunlari", st.lessons, `${W.length} hafta`)}${kpi("Qo'yilgan baholar", st.dist.reduce((a, b) => a + b, 0))}${kpi("O'zgarish", trend === null ? "—" : (trend >= 0 ? "▲ +" : "▼ ") + Math.abs(trend).toFixed(2), trend === null ? "" : trendSub, trend === null ? "" : trend >= 0 ? "ok" : "bad")}${kpi("Davomat", f(attAll, 1, "%"), "butun davr")}</div>
      <div class="hb-two"><div class="hb-box"><h3>Sinf o'rtacha bahosi <span class="hb-mut">· haftalar bo'yicha</span></h3>${avgs.length ? line(W.map((w) => ({from: w.from, v: w.avg, note: `${w.n} ta baho`})), alo, 10, 2, (v, d) => d ? v.toFixed(2) : String(v), "Haftalik o'rtacha baho") : `<span class="hb-mut">Bu davrda baho yo'q.</span>`}</div>
        <div class="hb-box"><h3>Davomat <span class="hb-mut">· haftalar bo'yicha, %</span></h3>${W.length ? line(W.map((w) => ({from: w.from, v: w.att})), amin, 100, astep, (v, d) => d ? v.toFixed(0) + "%" : String(v), "Haftalik davomat") : `<span class="hb-mut">Bu davrda dars yo'q.</span>`}</div>
        <div class="hb-box"><h3>Baholar taqsimoti <span class="hb-mut">· 1 dan 10 gacha</span></h3>${bars(st.dist)}</div>
        <div class="hb-box"><h3>Ko'p qoldirganlar</h3>${top.length ? `<div class="hb-top5">${top.map((r, i) => `<button class="hb-li" data-card="${rows.indexOf(r)}"><span class="hb-l1"><span class="hb-mut hb-num" style="width:16px">${i + 1}</span><b class="hb-ell">${esc(r.name)}</b><span class="hb-num" style="font-weight:800">${missN(r)} dars</span></span><span class="hb-l3" style="padding-left:24px">${missChips(r)}</span></button>`).join("")}</div>` : `<span class="hb-mut">Qoldirish yo'q 👍</span>`}</div></div>`;
  }
  /* ───────── 4. Davomat varag'i: butun chorak — davomat.js (DVM) ───────── */
  const repAtt = (X) => DVM.body(X);
  /* ───────── 5. Ota-onalar majlisi ───────── */
  function repPar(X) {
    const {c, lo, hi, rq} = X, {rows} = reportRows(c, lo, hi, rq), filt = S.pfilt === "risk" ? "risk" : "all";
    const list = rows.map((r, i) => [r, c.students[i]]).filter(([r]) => filt === "all" || r.risk), tch = ((D.web.bsb_hdr || {}).teacher || "").trim(), nR = rows.filter((r) => r.risk).length;
    // sinf o'rtachasi — ota-ona farzandini sinf bilan solishtiradi (sinf hisobotidagi kabi: baho — baholar soni bo'yicha, davomat — o'quvchilar bo'yicha)
    const gr = rows.filter((r) => r.avg !== null), nG = gr.reduce((a, r) => a + r.n, 0), cAvg = nG ? gr.reduce((a, r) => a + r.avg * r.n, 0) / nG : null;
    const at = rows.filter((r) => r.att !== null), cAtt = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null;
    const sheet = ([r, s]) => {
      const ds = c.dates.filter((d) => lo <= d && d <= hi && !isNoLesson(c, d) && gradesOf(s.marks[d] || "").length);
      const ws = c.works.filter((w) => lo <= w.date && w.date <= hi).sort((a, b) => a.date < b.date ? -1 : 1);
      const h = feat("hw") ? hwStat(s, lo, hi) : {n: 0}, debts = feat("debts") ? debtsOf(c, s, lo, hi).filter((d) => !d.done) : [];
      // bitta «E'tibor bering»: qarzlar ro'yxati BSB/CHSB/Loyiha past natijasini o'z ichiga olgani uchun xavf sabablaridan «work» takrorlanmaydi
      const why = debts.length ? r.why.filter((_, k) => r.kinds[k] !== "work") : r.why;
      return `<article class="psheet"><div class="hb-sh1"><div><b class="pnm">${esc(s.name)}</b><div class="hb-mut" style="font-size:12px">${esc(label(c))} · ${fmt(lo)} – ${fmt(hi)}</div></div>
          ${rq && r.q && r.q.complete ? `<div class="hb-qb">${rq}-chorak bahosi<b>${r.q.grade}</b></div>` : ""}</div>
        <div>O'rtacha baho ${gp(r.avg)} <small class="hb-mut">(sinfda ${f(cAvg, 2)})</small> · Baholar <b>${r.n}</b> · Davomat <b>${f(r.att, 0, "%")}</b> <small class="hb-mut">(sinfda ${f(cAtt, 0, "%")})</small> · Qoldirgan <b>${r.absent}</b>${r.absent ? ` <small class="hb-mut">(${[["s", "sababsiz"], ["dq", "sababli"], ["k", "kasal"]].filter(([k]) => r[k]).map(([k, n]) => `${n} ${r[k]}`).join(", ")})</small>` : ""}${r.kq ? ` · Kech qolgan <b>${r.kq}</b>` : ""}</div>
        ${ds.length ? `<div><span class="hb-mut">Baholar:</span> ${ds.map((d) => `<span class="hb-pg">${gradesOf(s.marks[d]).join("/")}<small>${d5(d)}</small></span>`).join("")}</div>` : ""}
        ${ws.length ? `<div><span class="hb-mut">BSB / CHSB:</span> ${ws.map((w) => { const v = (s.scores || {})[w.id]; return `${wTag(w)} — <b>${isNum(v) ? `${v} / ${w.max}` : "topshirilmagan"}</b>`; }).join("; ")}</div>` : ""}
        ${h.n ? `<div><span class="hb-mut">Uy vazifasi:</span> ${h.ok} / ${h.n} bajarilgan</div>` : ""}
        ${why.length || debts.length ? `<div class="hb-why"><b>E'tibor bering:</b> ${esc(why.join("; "))}${why.length && debts.length ? ". " : ""}${debts.length ? `Qayta topshirish kerak: ${esc(debts.map((d) => d.what).join("; "))}` : ""}</div>` : `<div class="hb-okt">✓ Ko'rsatkichlar me'yorda</div>`}
        <div class="psig"><span>O'qituvchi: ${tch ? esc(tch) : ""}</span><span>Ota-ona imzosi:</span></div></article>`;
    };
    return `<style>@media print{@page{size:A4 portrait;margin:10mm}.hb .psheet{break-inside:avoid;page-break-inside:avoid;min-height:132mm;margin:0 0 6mm}.hb .psheet:nth-child(2n){margin-bottom:0}}</style>
      <div class="hb-tools"><div class="hb-seg"><button class="${filt === "all" ? "on" : ""}" data-pf="all">Hamma <em>${rows.length}</em></button><button class="${filt === "risk" ? "on" : ""}" data-pf="risk">Faqat xavf ostida <em>${nR}</em></button></div>
        <span class="hb-mut hb-sortb" style="font-size:12.5px">A4 varaqqa ikkitadan · ${Math.ceil(list.length / 2)} varaq${tch ? "" : " · o'qituvchi ismi: Summativ → Eksport"}</span></div>
      <div class="psheets">${list.map(sheet).join("") || `<div class="hb-mut">Xavf ostida o'quvchi yo'q. 👍</div>`}</div>`;
  }
  /* ───────── 6. Chorakka tayyorlik ───────── */
  function repReady(X) {
    const {c, q, R} = X;
    if (!qRange(q)) return `<div class="hb-box"><h3>${q}-chorak sanalari belgilanmagan</h3><span class="hb-mut">Sozlamalar → Dars kunlari va choraklar.</span></div>`;
    const [cp, list] = readinessRows(c, q), N = c.students.length, ok = N - list.length, p0 = N ? ok / N : 1, C = 2 * Math.PI * 26;
    // sinfda ish yetishmasa yoki maksimal ball noto'g'ri bo'lsa, o'quvchilar «tayyor» bo'lsa ham halqa to'lmaydi
    const p = cp.length ? Math.min(p0, .9) : p0;
    const works = worksInQuarter(c, q), nb = works.filter((w) => w.type !== "chsb").length, nc = works.length - nb, r = qRange(q), nl = works.filter((w) => w.type === "loyiha").length;
    const mxs = (t) => works.filter((w) => t(w.type)).map((w) => fmtNum(+w.max)), bTxt = nl ? `${nb - nl} BSB + ${nl} Loyiha ishi · ${mxs((t) => t !== "chsb").join(" + ")} = ${fmtNum(works.filter((w) => w.type !== "chsb").reduce((a, w) => a + +w.max, 0))} ball` : `${nb} ta ish`;
    const noScore = list.filter((x) => x.miss.length).length, fewFb = list.filter((x) => x.probs.some((t) => t.startsWith("formativ"))).length;
    const checks = [[1, "Chorak sanalari belgilangan", `${fmt(r[0])} – ${fmt(r[1])}`],
      [!cp.some((x) => x.startsWith("BSB")) && nb, nl ? "BSB va Loyiha ishlari kiritilgan" : "BSB ishlari kiritilgan", nb ? `${bTxt}${cp.find((x) => x.startsWith("BSB")) ? " · " + cp.find((x) => x.startsWith("BSB")) : ""}` : "Jurnal → Summativ → ＋ Yangi"],
      [!cp.some((x) => x.startsWith("CHSB")) && nc, "CHSB ishi kiritilgan", nc ? `${nc} ta ish${cp.find((x) => x.startsWith("CHSB")) ? " · " + cp.find((x) => x.startsWith("CHSB")) : ""}` : "Jurnal → Summativ → ＋ Yangi"],
      [!noScore, "Hamma ballar qo'yilgan", noScore ? `${noScore} o'quvchida yetishmaydi` : ""],
      [!fewFb, `Har o'quvchida kamida ${fbMin()} ta kundalik baho`, fewFb ? `${fewFb} o'quvchida kam (FB uchun)` : "FB uchun"]];
    const col = cp.length ? "var(--danger)" : p === 1 ? "var(--ok)" : p > .6 ? "var(--hb-warn-b)" : "var(--danger)";
    const bad = checks.filter(([y]) => !y).length;
    return `${cp.length || !nb || !nc ? `<div class="hb-box hb-why" style="color:var(--danger)">⛔ Sinf hali tayyor emas: ${esc(cp.length ? cp.join("; ") : !nb ? "BSB ishi kiritilmagan" : "CHSB ishi kiritilmagan")}. Bu tuzatilmaguncha chorak bahosi chiqmaydi.</div>` : ""}<div class="hb-two"><div class="hb-box"><div class="hb-prog"><svg class="hb-ring" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" style="stroke:${col}"/><text x="32" y="37" text-anchor="middle">${Math.round(p * 100)}%</text></svg>
        <div><h2>${ok} / ${N} o'quvchi tayyor</h2><span class="hb-mut" style="font-size:12.5px">${q}-chorak bahosiga tayyorlik</span></div></div>
        ${!bad && !list.length ? `<div class="hb-okt">✓ Hammasi tayyor: chorak baholarini qo'yish mumkin.</div>` : ""}</div>
        <div class="hb-box hb-chk">${checks.map(([y, t, s]) => `<div class="${y ? "y" : "n"}"><i>${y ? "✓" : "!"}</i><span>${t}${s ? `<small>${esc(s)}</small>` : ""}</span></div>`).join("")}</div></div>
      ${list.length ? `<h3>Nima yetishmaydi · ${list.length} o'quvchi</h3>
      <div class="hb-rows">${list.map((x) => `<div class="hb-li hb-rk hb-miss"><span><b class="hb-ell">${esc(x.name)}</b><span class="hb-why">${x.probs.map(esc).join("; ")}</span></span>${x.miss[0] ? `<button class="btn btn-sm" data-hwork="${esc(x.miss[0].id)}" title="Summativ → ${esc(wTypeName(x.miss[0]))} ${fmt(x.miss[0].date).slice(0, 5)}"><span class="hb-pc" style="display:inline">${esc(wTag(x.miss[0]))} · </span>Ball qo'yish ›</button>` : `<button class="btn btn-sm" data-hgo="j">Jurnalga ›</button>`}</div>`).join("")}</div>` : ""}`;
  }
  /* ───────── 7. Sinflarni solishtirish ───────── */
  function repCmp(X) {
    const {lo, hi, rq} = X, L = compareRows(lo, hi, rq), T = compareTotal(L), bp = bsbPartName(L.flatMap((r) => r.c.works.filter((w) => lo <= w.date && w.date <= hi)));
    const cb = (v, mx, d = 1, u = "") => v === null || v === undefined ? `<span class="hb-mut">—</span>` : `<span class="hb-cb"><b class="hb-num">${f(v, d, u)}</b><span class="tr"><i style="width:${Math.max(4, Math.min(100, 100 * v / mx))}%"></i></span></span>`;
    const many = (r) => r.n && r.risk > r.n / 2;
    const cells = (r) => `<td class="s hb-num">${r.n}</td><td class="s hb-num">${r.lessons}</td><td>${cb(r.avg, 10, 2)}</td><td>${cb(r.att, 100, 1, "%")}</td><td class="s"><b class="hb-num" style="color:${many(r) ? "var(--danger)" : "inherit"}">${r.risk}</b></td><td>${cb(r.bsb, 100, 0)}</td><td>${cb(r.chsb, 100, 0)}</td>${rq ? `<td>${cb(r.qq, 100, 0)}</td><td>${cb(r.qu, 100, 0)}</td>` : ""}`;
    return `<div class="hb-tw hb-pc"><table class="hb-t rcmp"><thead><tr><th>Sinf</th><th class="s">O'quvchi</th><th class="s">Darslar</th><th>O'rtacha</th><th>Davomat</th><th class="s">Xavf ostida</th><th>${bp} %</th><th>CHSB %</th>${rq ? "<th>Sifat %</th><th>O'zlashtirish %</th>" : ""}</tr></thead><tbody>
      ${L.map((r) => `<tr><td class="nm"><button data-cmpc="${D.classes.indexOf(r.c)}" title="Sinf hisobotini ochish">${esc(label(r.c))}</button></td>${cells(r)}</tr>`).join("")}</tbody>
      <tfoot><tr><td>Jami / o'rtacha</td>${cells(T)}</tr></tfoot></table></div>
      <span class="hb-mut hb-pc" style="font-size:12.5px">Sinf nomini bossangiz, o'sha sinfning hisoboti ochiladi.</span>
      <div class="hb-tel" style="display:flex;flex-direction:column;gap:8px">${L.map((r) => `<div class="hb-cc"><div class="h"><b class="hb-ell">${esc(label(r.c))}</b><span class="hb-mut" style="font-size:12px">${r.n} o'q. · ${r.lessons} dars</span></div>
        <div class="m"><div><small>O'rtacha</small><b>${f(r.avg, 2)}</b></div><div><small>Davomat</small><b>${f(r.att, 0, "%")}</b></div><div><small>Xavf</small><b style="color:${many(r) ? "var(--danger)" : "inherit"}">${r.risk}</b></div></div><div class="m m2"><div><small>${bp}</small><b>${f(r.bsb, 0, "%")}</b></div><div><small>CHSB</small><b>${f(r.chsb, 0, "%")}</b></div></div>
        <button class="hb-link" data-cmpc="${D.classes.indexOf(r.c)}">Sinf hisobotini ochish ›</button></div>`).join("")}</div>`;
  }
  /* ───────── 8. Bo'sh varaq — bosh-varaq.js (tasdiqlangan maket, 2026-11-04) ───────── */
  const repBlank = (X) => BVQ.body(X);
  const REP = {cls: repCls, sum: repSum, stats: repStats, att: repAtt, par: repPar, ready: repReady, cmp: repCmp, blank: repBlank, seat: (X) => ORX.hbBody(X.c)};

  /* ───────── tanlov oynalari ───────── */
  // sinf tanlashda har sinf yonida xavf ostidagilar soni: doim joriy chorak bo'yicha (tanlangan davrga qaramaydi), «Bugun» sahifasi bilan bir xil
  function riskTag(c) {
    try { const [lo, hi, q] = periodNow(), n = reportRows(c, lo, hi, q).rows.filter((r) => r.risk).length; return n ? `<span class="hb-bd" title="Joriy chorak: xavf ostidagi o'quvchilar">${n} xavf</span>` : ""; } catch (e) { return ""; }
  }
  function sheetBody(k, X) {
    if (k === "kind") return ["Hisobot turi", KINDS.map(([g, l]) => `<div class="hb-ogt">${g}</div><div class="hb-kg">${l.map(([kk, ic, n]) => `<button class="hb-kt ${X.R.kind === kk ? "on" : ""}" data-kind="${kk}"><span class="hb-ic">${ic}</span><b class="hb-ell">${n}</b></button>`).join("")}</div>`).join("")];
    if (k === "cls") return ["Sinf", `<div class="hb-opts">${X.R.kind === "blank" ? `<button class="hb-opt ${BVQ.isAll() ? "on" : ""}" data-ho="ci" data-v="all"><span class="hb-ic">📚</span><span><b class="hb-ell">Barcha sinflar</b><small>Har sinf alohida varaqda · ${X.CL.length} ta</small></span><span class="hb-ck">${BVQ.isAll() ? "✓" : ""}</span></button>` : ""}${X.CL.map((i) => { const c = D.classes[i]; return `<button class="hb-opt ${X.R.ci === i && !(X.R.kind === "blank" && BVQ.isAll()) ? "on" : ""}" data-ho="ci" data-v="${i}"><span class="hb-ic">${esc(c.name.slice(0, 4))}</span><span><b class="hb-ell">${esc(label(c))}</b><small>${c.students.length} o'quvchi · ${c.dates.length} dars kuni</small></span>${riskTag(c)}<span class="hb-ck">${X.R.ci === i && !(X.R.kind === "blank" && BVQ.isAll()) ? "✓" : ""}</span></button>`; }).join("")}</div>`];
    if (k === "sort") {
      const so = S.rsort || {}, sv = so.k ? `${so.k}|${so.dir}` : "", rt = S.rtype || "";
      const {rows} = reportRows(X.c, X.lo, X.hi, X.rq);
      return ["Saralash", `<div class="hb-opts">${SORTS.filter(([kk]) => X.rq || !kk.startsWith("qt")).map(([kk, n, d]) => `<button class="hb-opt ${sv === kk ? "on" : ""}" data-ho="sort" data-v="${kk}"><span><b>${n}</b><small>${d}</small></span><span class="hb-ck">${sv === kk ? "✓" : ""}</span></button>`).join("")}</div>
        <div class="hb-ogt">Xavf turi</div><div class="hb-opts">${[["", ["Barchasi"]], ...RISK_TYPES].map(([kk, n]) => { const cnt = kk ? rows.filter((r) => r.kinds.includes(kk)).length : rows.length; return `<button class="hb-opt ${rt === kk ? "on" : ""}" data-ho="type" data-v="${kk}"><span><b>${esc(n[0])}</b><small>${cnt} o'quvchi</small></span><span class="hb-ck">${rt === kk ? "✓" : ""}</span></button>`; }).join("")}</div>`];
    }
    if (k === "per") {
      const n = NEED[X.R.kind];
      const tiles = (on, attr, now) => `<div class="hb-qts">${[1, 2, 3, 4].map((q) => { const r = qRange(q); return `<button class="hb-qt ${on(q) ? "on" : ""}" data-ho="${attr}" data-v="${attr === "per" ? (q === now ? "cur" : "q" + q) : q}" ${r ? "" : "disabled"}>${q === now ? `<span class="now">joriy</span>` : ""}<b>${q}-chorak</b><small>${r ? `${d5(r[0])}–${d5(r[1])}` : "belgilanmagan"}</small></button>`; }).join("")}</div>`;
      if (n === "q") return ["Chorak", tiles((q) => X.q === q, "q", X.qNow)];
      if (n === "mon") { const A = attMonth(X.c, S.amon); return ["Oy", `<div class="hb-opts">${A.months.slice().reverse().map((m) => `<button class="hb-opt ${A.ym === m ? "on" : ""}" data-ho="mon" data-v="${m}"><span><b>${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</b>${m === todayIso().slice(0, 7) ? "<small>joriy oy</small>" : ""}</span><span class="hb-ck">${A.ym === m ? "✓" : ""}</span></button>`).join("")}</div>`]; }
      const p = X.R.per, onQ = (q) => p === "q" + q || (p === "cur" && q === X.qNow);
      const other = (X.qNow ? [] : [["cur", "Joriy oy"]]).concat([["month", "Shu oy"], ["week", "Shu hafta"], ["all", "Butun yil"]]);
      return ["Davr", `${[1, 2, 3, 4].some(qRange) ? `<div class="hb-ogt">Choraklar</div>${tiles(onQ, "per", X.qNow)}` : ""}<div class="hb-ogt">Boshqa</div><div class="hb-opts">${other.map(([kk, nm]) => { const [a, b] = repRange(kk); return `<button class="hb-opt ${p === kk ? "on" : ""}" data-ho="per" data-v="${kk}"><span><b>${nm}</b><small>${d5(a)} – ${d5(b)}</small></span><span class="hb-ck">${p === kk ? "✓" : ""}</span></button>`; }).join("")}</div>`];
    }
    return null;
  }
  function choose(attr, v) {
    const R = S.rep;
    if (attr === "ci") { if (R.kind === "blank") BVQ.setAll(v === "all"); if (v !== "all") R.ci = +v; }
    else if (attr === "per") { R.per = v; keep(); }
    else if (attr === "q") S.rq = +v;
    else if (attr === "mon") S.amon = v;
    else if (attr === "sort") { if (!v) S.rsort = null; else { const [k, d] = v.split("|"); S.rsort = {k, dir: +d}; } }
    else if (attr === "type") S.rtype = v;
  }
  function closePop() { if (pop) { pop.remove(); pop = null; document.querySelectorAll(".hb-pk.on,.hb-sortb.on").forEach((b) => b.classList.remove("on")); } }
  function open(k, trg) {
    closePop();
    const X = ctx(), b = sheetBody(k, X); if (!b) return;
    const bind = (root, done) => {
      root.querySelectorAll("[data-ho]").forEach((el) => el.onclick = () => { choose(el.dataset.ho, el.dataset.v); done(); render(); });
      root.querySelectorAll("[data-kind]").forEach((el) => el.onclick = () => { S.rep.kind = el.dataset.kind; keep(); done(); render(); window.scrollTo(0, 0); });
    };
    if (phone()) {
      modal(`<div class="hb hb-sheet"><div class="hb-shd"><h2>${b[0]}</h2><button class="hb-x" data-x aria-label="Yopish">✕</button></div>${b[1]}</div>`, (mm, close) => {
        mm.querySelector("[data-x]").onclick = () => close(); bind(mm, () => close());
      });
      return;
    }
    pop = h(`<div class="hb-popw"><div class="hb hb-pop" role="dialog" aria-label="${b[0]}">${b[1]}</div></div>`);
    document.body.append(pop);
    const box = pop.querySelector(".hb-pop"), r = trg.getBoundingClientRect();
    box.style.top = Math.min(r.bottom + 6, innerHeight - Math.min(box.offsetHeight, innerHeight * 0.7) - 8) + "px";
    box.style.left = Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8)) + "px";
    trg.classList.add("on");
    pop.addEventListener("click", (e) => { if (e.target === pop) closePop(); });
    bind(pop, closePop);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) { e.preventDefault(); closePop(); } });

  // o'quvchini bosganda: qisqacha ma'lumot (telefonda pastdan), undan jurnal yoki kartochka
  // key — o'quvchining tartib raqami (ismdoshlar adashmasin) yoki ismi (davomat.js)
  function student(key) {
    const X = ctx(), {c, lo, hi, rq} = X, i = /^\d+$/.test(String(key)) ? +key : c.students.findIndex((s) => s.name === key);
    if (!c.students[i]) return;
    const name = c.students[i].name;
    const r = reportRows(c, lo, hi, rq).rows[i], pl = perLabel({...X, R: {...X.R, kind: "cls"}});
    modal(`<div class="hb hb-stu" style="gap:10px"><div class="hb-shd"><h2 class="hb-ell">${esc(name)}</h2><button class="hb-x" data-x aria-label="Yopish">✕</button></div>
      <div class="hb-mut" style="margin-top:-6px;font-size:12.5px">${esc(label(c))} · ${pl[0]} · ${pl[1]}</div>
      <div class="hb-kpis">${kpi("O'rtacha", f(r.avg, 2))}${kpi("Davomat", f(r.att, 0, "%"))}${kpi("Chorak", r.q && r.q.complete ? r.q.grade : "—")}</div>
      ${missChips(r) ? `<div class="hb-tools">${missChips(r)}</div>` : ""}${r.why.length ? `<div class="hb-why" style="font-size:13.5px">⚠ ${esc(r.why.join("; "))}</div>` : `<div class="hb-okt" style="font-size:13.5px">✓ Xavf belgilari yo'q</div>`}
      <div class="hb-g2"><button class="btn" data-j>📝 Jurnalda</button><button class="btn btn-primary" data-k>📇 Kartochka</button></div></div>`, (mm, close) => {
      mm.querySelector("[data-x]").onclick = () => close();
      mm.querySelector("[data-j]").onclick = () => { close(); S.ci = X.R.ci; S.jpage = "j"; go("journal"); };
      mm.querySelector("[data-k]").onclick = () => { close(); studentCard(X.R.ci, name); };
    });
  }

  /* ───────── sahifa ───────── */
  function pickers(X) {
    const n = NEED[X.R.kind], pl = perLabel(X), on = (k) => pop && pop.dataset && false;
    const cls = X.R.kind === "cmp"
      ? `<span class="hb-pk fixed"><span class="hb-v"><small>Sinflar</small><b class="hb-ell">Hammasi · ${X.CL.length} ta</b></span></span>`
      : `<button class="hb-pk" data-hk="cls" aria-haspopup="true"><span class="hb-v"><small>Sinf</small><b class="hb-ell">${X.R.kind === "blank" && BVQ.isAll() ? `Barcha sinflar · ${X.CL.length} ta` : esc(label(X.c))}</b></span><span class="hb-car">▼</span></button>`;
    const per = pl ? `<button class="hb-pk" data-hk="per" aria-haspopup="true"><span class="hb-v"><small>${n === "q" ? "Chorak" : n === "mon" ? "Oy" : "Davr"}</small><b class="hb-ell">${pl[0]}${n !== "mon" ? `<span class="hb-mut hb-pc" style="font-weight:600;display:inline"> · ${pl[1]}</span>` : ""}</b></span><span class="hb-car">▼</span></button>` : "";
    return cls + per;
  }
  const actions = (k) => `<button class="btn btn-primary" data-print>🖨 Chop etish</button>${k === "blank" ? `<button class="btn" data-bvpdf title="A4 PDF faylni saqlash">⬇ PDF</button>` : k === "seat" ? `<button class="btn" data-oxpdf title="A4 PDF faylni saqlash">⬇ PDF</button>` : ""}<button class="btn" data-tgpdf title="Hisobotni PDF qilib Telegram botingizga yuborish">✈️ Telegram</button>${XLS[k] ? `<button class="btn" ${XLS[k]}>📊 Excel</button>` : ""}`;

  function page(m) {
    closePop();
    if (!D.classes.some((c) => !isGrp(c))) { m.innerHTML = `<div class="hb"><h1>Hisobotlar</h1><p class="hb-mut">Avval sinf qo'shing: Sozlamalar → Sinflar va o'quvchilar.</p></div>`; return; }
    const X = ctx(), K = KIND[X.R.kind], pl = perLabel(X), bot = typeof DZN !== "undefined" && DZN.cfg().act === "bot";
    const sub = `${X.R.kind === "cmp" || (X.R.kind === "blank" && BVQ.isAll()) ? "Barcha sinflar" : esc(label(X.c))}${pl ? ` · ${pl[0]}` : ""}`;
    let body;
    try { body = REP[X.R.kind](X); } catch (e) { console.error(e); setTimeout(() => { throw e; }); body = `<div class="hb-box hb-why">Hisobotni chizishda xato: ${esc(e.message)}</div>`; }
    m.innerHTML = `<div class="hb">
      <h1>Hisobotlar</h1>
      <button class="hb-kind hb-tel" data-hk="kind" aria-haspopup="true"><span class="hb-ic">${K[1]}</span><span><b class="hb-ell">${K[2]}</b><small class="hb-ell">${sub}</small></span><em>Almashtirish ▾</em></button>
      <div class="hb-g2 hb-tel">${pickers(X)}</div>${bot ? "" : `<div class="hb-g2 hb-tel ${(XLS[X.R.kind] && X.R.kind !== "blank") || X.R.kind === "seat" ? "hb-g3" : ""}">${actions(X.R.kind)}</div>`}
      <div class="hb-grid">
        <nav class="card hb-list hb-pc" aria-label="Hisobot turlari">${KINDS.map(([g, l]) => `<div class="hb-gt">${g}</div>${l.map(([k, ic, n, d]) => `<button class="hb-ri ${X.R.kind === k ? "on" : ""}" data-kind="${k}"><span class="hb-ic">${ic}</span><span><b class="hb-ell">${n}</b><small class="hb-ell">${d}</small></span></button>`).join("")}`).join("")}</nav>
        <section class="card hb-panel${HPR.has(X.R.kind) ? " hb-hasprt" : ""}">
          <div class="hb-hd hb-pc"><div class="hb-top"><div><h2>${K[1]} ${K[2]}</h2><p>${K[3]}</p></div>${bot ? "" : `<div class="hb-acts">${actions(X.R.kind)}</div>`}</div><div class="hb-pks">${pickers(X)}</div></div>
          ${["blank", "par", "att", "seat"].includes(X.R.kind) ? "" : `<h2 class="pronly" style="margin:0 0 6px">${K[2]} · ${sub}${pl && NEED[X.R.kind] !== "mon" ? ` · ${pl[1]}` : ""}</h2>`}
          ${HPR.has(X.R.kind) ? HPR.bar() : ""}
          <div class="hb-con">${body}</div>
          ${HPR.has(X.R.kind) ? HPR.html(X.R.kind, X, pl, X.R.kind === "cmp" ? "Barcha sinflar" : label(X.c)) : ""}
          <div class="hb-src"><span>ℹ</span><span>${SRC[X.R.kind]}</span></div>
          ${bot ? `<div class="hb-stick">${actions(X.R.kind)}</div>` : ""}
        </section></div></div>`;
    bindPage(m, X);
    m.querySelectorAll("[data-prt]").forEach((b) => b.onclick = () => { HPR.toggle(b.dataset.prt); render(); });
  }
  function bindPage(m, X) {
    const {R, c, lo, hi, rq} = X;
    m.querySelectorAll("[data-kind]").forEach((b) => b.onclick = () => { R.kind = b.dataset.kind; keep(); render(); });
    m.querySelectorAll("[data-hk]").forEach((b) => b.onclick = () => open(b.dataset.hk, b));
    m.querySelectorAll("[data-card]").forEach((b) => b.onclick = () => student(b.dataset.card));
    m.querySelectorAll("[data-rf]").forEach((b) => b.onclick = () => { S.rfilt = b.dataset.rf; render(); });
    m.querySelectorAll("[data-rs]").forEach((th) => th.onclick = () => { const k = th.dataset.rs, o = S.rsort || {}; S.rsort = {k, dir: o.k === k ? -(o.dir || 1) : (k === "name" ? 1 : -1)}; render(); });
    m.querySelectorAll("[data-pf]").forEach((b) => b.onclick = () => { S.pfilt = b.dataset.pf; render(); });
    if (R.kind === "blank") BVQ.bind(m, ctx);
    if (R.kind === "att") DVM.bind(m, ctx);
    m.querySelectorAll("[data-cmpc]").forEach((b) => b.onclick = () => { R.ci = +b.dataset.cmpc; R.kind = "cls"; keep(); render(); window.scrollTo(0, 0); });
    m.querySelectorAll("[data-hgo]").forEach((b) => b.onclick = () => { S.ci = R.ci; S.jpage = b.dataset.hgo; go("journal"); });
    // «Ball qo'yish»: aynan o'sha ish — Summativ sahifasida (index.html openAnalysis)
    m.querySelectorAll("[data-hwork]").forEach((b) => b.onclick = () => openAnalysis(R.ci, b.dataset.hwork));
    m.querySelectorAll("[data-print]").forEach((b) => b.onclick = () => { fitPrint(); window.print(); });
    if (R.kind === "seat") { ORX.hbBind(m, c); return; }   // o'z chop etish / PDF / Telegram (orindiq.js)
    // PDF → Telegram (pdf-tg.js)
    m.querySelectorAll("[data-tgpdf]").forEach((b) => b.onclick = () => { const K = KIND[R.kind], pl = perLabel(X), who = R.kind === "cmp" || (R.kind === "blank" && BVQ.isAll()) ? "Barcha sinflar" : label(c);
      const per = (pl ? `${pl[0]}${NEED[R.kind] !== "mon" && pl[1] ? ` · ${pl[1]}` : ""}` : "").replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, " ");
      const q = R.kind === "cmp" ? rq : null;   // «Sinflarni solishtirish» chorak bo'yicha — chorak hisoboti
      PTG.run(() => R.kind === "blank" ? BVQ.pdfPages(ctx()) : R.kind === "att" ? DVM.pdfPages(ctx()) : PTG.reportPdf(), `${K[2]} ${who} ${per}`, `📄 ${K[2]}\n${who}${per ? "\n" + per : ""}`, b)
        .then((ok) => { if (ok && q) PTG.markQ(q); }); });
    // Excel: hisob-kitob va ustunlar avvalgidek
    const on = (sel, fn) => m.querySelectorAll(sel).forEach((b) => b.onclick = fn);
    on("[data-xlsx]", () => {
      const {rows} = reportRows(c, lo, hi, rq);
      const hd = ["№", "O'quvchi", "O'rtacha", "Baholar", "Davomat %", "S", "DQ", "K", "KQ"].concat(rq ? ["Chorak balli", "Chorak bahosi"] : [], ["Izoh"]);
      const body = rows.map((r, i) => [i + 1, r.name, r.avg, r.n, r.att, r.s, r.dq, r.k, r.kq].concat(rq ? [r.q ? Math.round(r.q.total * 10) / 10 : null, r.q && r.q.complete ? r.q.grade : null] : [], [r.why.join("; ")]));
      saveTable(`${label(c)} ${lo} ${hi}`, [[`${label(c)} · ${fmt(lo)} – ${fmt(hi)}`], [], hd, ...body], [5, 28, 9, 8, 10, 5, 5, 5, 5].concat(rq ? [11, 12] : [], [50]));
    });
    on("[data-ccsv]", () => {
      const r2 = (v, d) => v === null || v === undefined ? null : +v.toFixed(d), L = compareRows(lo, hi, rq), T = compareTotal(L), ln = (r, nm) => [nm, r.n, r.lessons, r2(r.avg, 2), r2(r.att, 1), r.risk, r2(r.bsb, 0), r2(r.chsb, 0)].concat(rq ? [r2(r.qq, 0), r2(r.qu, 0)] : []);
      saveTable(`sinflar ${lo} ${hi}`, [[`Sinflarni solishtirish · ${fmt(lo)} – ${fmt(hi)}`], [], ["Sinf", "O'quvchi", "Darslar", "O'rtacha", "Davomat %", "Xavf ostida", "BSB %", "CHSB %"].concat(rq ? ["Sifat %", "O'zlashtirish %"] : []),
        ...L.map((r) => ln(r, label(r.c))), ln(T, "Jami / o'rtacha")], [22, 10, 9, 10, 11, 12, 8, 8, 9, 14]);
    });
    on("[data-rxlsx]", () => {
      const q = X.q; if (!qRange(q)) return toast(`${q}-chorak sanalari belgilanmagan`);
      const [cp, per] = readiness(c, q);
      saveTable(`${label(c)} ${q}-chorak tayyorlik`, [[`${label(c)} · ${q}-chorak bahosiga tayyorlik`], ...cp.map((x) => [x]), [], ["№", "O'quvchi", "Nima yetishmaydi"], ...Object.keys(per).map((n, i) => [i + 1, n, per[n].join("; ")])], [5, 30, 80]);
    });
    on("[data-stxlsx]", () => {
      const st = statsData(c, lo, hi), r1 = (v, d) => v === null || v === undefined ? null : +v.toFixed(d), t = todayIso();
      const end = (w) => { const e = iso(addDays(pdate(w.from), 6)); return e > hi ? hi : e > t ? t : e; };
      saveTable(`${label(c)} statistika ${lo} ${hi}`, [[`${label(c)} · Grafik va statistika · ${fmt(lo)} – ${fmt(hi)}`], [], ["Hafta", "Baholar soni", "O'rtacha baho", "Davomat %", "Kelmaganlar (S, DQ, K)"],
        ...st.weeks.map((w) => [`${d5(w.from < lo ? lo : w.from)} – ${d5(end(w))}`, w.n, r1(w.avg, 2), r1(w.att, 1), w.abs]), [], ["Baho", "Soni"], ...st.dist.slice(1).map((n, i) => [i + 1, n])], [16, 13, 14, 12, 22]);
    });
    on("[data-sxlsx]", () => { const q = X.q; if (!qRange(q)) return toast(`${q}-chorak sanalari belgilanmagan`); saveTable(`${label(c)} ${q}-chorak BSB CHSB`, ...sumAoa(c, q)); });
  }
  return {page, has, KINDS, leave: closePop, student, why1};
})();
