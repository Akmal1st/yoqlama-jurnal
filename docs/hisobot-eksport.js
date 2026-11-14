/* Hisobotlar bo'limi → umumiy «Chop etish va eksport» oynasi (EXP, eksport.js), 1-bosqich (maket v7, Akmal 2026-11-14 tasdiqladi).
   Bu fayl faqat varaq MAZMUNINI beradi: Sinf hisoboti, Grafik va statistika, Davomat varag'i, BSB va CHSB, Chorakka tayyorlik,
   Ota-onalar majlisi, Sinflarni solishtirish. Hisob-kitob index.html dagi bilan bir xil: reportRows, statsData, DVM.data, sumData,
   readinessRows, compareRows/compareTotal, quarterResult. Bo'sh varaq va O'rindiq xaritasi hozircha o'z oynasida (2–3-bosqich). */
const HEX = (() => {
  const KINDS = ["cls", "stats", "att", "sum", "ready", "par", "cmp"];
  const META = {cls: ["Sinf hisoboti", "clipboard-data", "per", 1], stats: ["Grafik va statistika", "bar-chart", "per", 0], att: ["Davomat varag'i", "calendar3", "q", 0],
    sum: ["BSB va CHSB", "award", "q", 1], ready: ["Chorakka tayyorlik", "list-check", "q", 0], par: ["Ota-onalar majlisi", "people", "per", 0], cmp: ["Sinflarni solishtirish", "table", "per", 0]};
  const ORI = {cls: ["p", "l"], stats: ["p", "l"], att: ["l", "p"], sum: ["p", "l"], ready: ["p"], par: ["p"], cmp: ["l", "p"]};
  const f2 = (v) => v === null || v === undefined ? "—" : (+v).toFixed(2), f1 = (v) => v === null || v === undefined ? "—" : (+v).toFixed(1), p1 = (v) => v === null || v === undefined ? "—" : (+v).toFixed(1) + "%";
  const pc = EXP.pct, d5 = (s) => fmt(s).slice(0, 5), avgOf = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const pc10 = (a) => a === null ? "" : a >= 8 ? "p-g" : a >= 5 ? "p-y" : "p-r";   // 10 ballik: 8+ yaxshi, 5–8 o'rta, 5 dan past
  const thr = () => { const v = +((D.settings.risk || {}).att_below); return Number.isFinite(v) ? v : 80; };
  const K = (items) => ({k: "kpi", h: 58, items});
  const R = (h, ...cells) => ({k: "row", h, cells: cells.filter(Boolean)});
  const SEC = (t) => ({k: "sec", h: 20, t});
  const bDist = (arr) => [["86–100%", (p) => p >= 86, "c5"], ["66–85%", (p) => p >= 66 && p < 86, "c4"], ["30–65%", (p) => p >= 30 && p < 66, "c3"], ["30% dan past", (p) => p < 30, "c2"]].map(([t, f, c]) => [t, arr.filter(f).length, c]);
  const CODES = {s: "S", dq: "DQ", k: "K", kq: "KQ", ch: "CH"};
  const absChips = (r) => [["s", "S", "r"], ["dq", "DQ", "b"], ["k", "K", "k"]].filter(([k]) => r[k]).map(([k, m, cl]) => [`${m} ${r[k]}`, cl]);
  const whyTags = (r) => r.why.map((t, i) => { const [x, c] = HSB.why1(t, r.kinds[i]); return [x, c === "r" ? "r" : "y"]; });

  /* davr: sahifadagi tanlov bilan boshlanadi, oynada boshqa chorakni ham tanlash mumkin */
  const qs = () => [1, 2, 3, 4].filter((q) => qRange(q));
  function perOpts(X) {
    const L = qs().map((q) => ["q" + q, `${q}-chorak`]), cur = X.R.per === "cur" && X.qNow ? "q" + X.qNow : X.R.per;
    if (!L.some(([v]) => v === cur)) L.push([cur, {cur: "Joriy oy", month: "Shu oy", week: "Shu hafta", all: "Butun yil"}[cur] || "Davr"]);
    return {L, v: cur};
  }
  const perName = (per) => /^q\d$/.test(per) ? `${per[1]}-chorak` : {cur: "Joriy oy", month: "Shu oy", week: "Shu hafta", all: "Butun yil"}[per] || "Davr";
  function rangeOf(o) { const [lo, hi] = repRange(o.per); return {lo, hi, rq: /^q\d$/.test(o.per) ? +o.per[1] : null, per: perName(o.per)}; }

  /* ───────── Sinf hisoboti ───────── */
  function cls(o, X) {
    const c = X.c, {lo, hi, rq, per} = rangeOf(o), {rows, lessons} = reportRows(c, lo, hi, rq), N = rows.length, t0 = thr();
    const gr = rows.filter((r) => r.avg !== null), nG = gr.reduce((a, r) => a + r.n, 0), avg = nG ? gr.reduce((a, r) => a + r.avg * r.n, 0) / nG : null;
    const at = rows.filter((r) => r.att !== null), att = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null, risk = rows.filter((r) => r.risk);
    const L = rows.map((r, i) => ({r, i})); if (o.ord === "g") L.sort((a, b) => (b.r.avg ?? -1) - (a.r.avg ?? -1));
    const T = (k) => rows.reduce((a, r) => a + r[k], 0);
    const qg = (r) => r.q ? (r.q.complete ? {v: r.q.grade, b: 1, c: r.q.grade === 2 ? "g2" : r.q.grade === 5 ? "g5" : ""} : {v: "to'liq emas", c: "mut"}) : "—";
    const body = L.map(({r, i}, k) => { const tg = whyTags(r);
      return Object.assign([o.ord === "g" ? k + 1 : i + 1, r.name, r.avg === null ? "—" : {v: f2(r.avg), n: r.avg, pill: 1, c: pc10(r.avg)}, r.n, r.att === null ? "—" : {v: p1(r.att), n: r.att, bar: r.att, lo: r.att < t0, mid: r.att < 90},
        r.s || "·", r.dq || "·", r.k || "·", r.kq || "·", r.ch || "·", qg(r), tg.length ? {tags: tg.slice(0, 2).concat(tg.length > 2 ? [["+" + (tg.length - 2), ""]] : []), n: r.why.join("; ")} : ""], {risk: r.risk}); });
    const Q = rows.filter((r) => r.q && r.q.complete);
    body.push(Object.assign(["", "Sinf bo'yicha", {v: f2(avg), n: avg}, nG, {v: p1(att), n: att}, T("s"), T("dq"), T("k"), T("kq"), T("ch"), Q.length ? {v: f2(avgOf(Q.map((r) => r.q.grade))), n: avgOf(Q.map((r) => r.q.grade))} : "", {v: `${risk.length} o'quvchi xavf ostida`, b: 1}], {tot: 1}));
    const bands = ranges().slice().reverse().slice(0, 4).map((b, i, a) => { const hi2 = i ? a[i - 1].min : 11; return [b.name || `${b.min}+`, gr.filter((r) => r.avg >= b.min && r.avg < hi2).length, ["c5", "c4", "c3", "c2"][i]]; });
    const ab = rows.filter((r) => r.absent).sort((a, b) => b.absent - a.absent).slice(0, 3);
    return {who: label(c), doc: "Sinf hisoboti", period: per, title: `Sinf hisoboti · ${label(c)}`, sub: `${per} · ${fmt(lo)} – ${fmt(hi)} · ${lessons} dars kuni`,
      pre: [K([[f2(avg), "O'rtacha baho"], [p1(att), "Davomat"], [risk.length, "Xavf ostida", "", risk.length ? "r" : "", N], [N, "O'quvchilar", `${lessons} dars kuni`]]),
        R(88, {k: "dist", t: "Baholar taqsimoti <small>· o'rtacha baho</small>", nonum: 1, parts: bands},
          {k: "dist", t: "Davomat taqsimoti", nonum: 1, parts: [["90%+", at.filter((r) => r.att >= 90).length, "c5"], [`${t0}–89%`, at.filter((r) => r.att >= t0 && r.att < 90).length, "c3"], [`${t0}% dan past`, at.filter((r) => r.att < t0).length, "c2"]]},
          o.ch.risk ? {k: "note", tone: risk.length ? "bad" : "ok", t: "Diqqat", text: risk.length ? `${ab.length ? `Ko'p qoldirgan: ${ab.map((r) => `<b>${esc(r.name.split(" ")[0])} ${r.absent}</b>`).join(" · ")}<br>` : ""}Xavf ostida: <b>${risk.length} o'quvchi</b>` : "Xavf ostida o'quvchi yo'q."} : null)],
      cols: [{h: "№", w: 4}, {h: "O'quvchi", w: 23, a: "l", xw: 30}, {h: "O'rtacha", w: 8}, {h: "Baho", w: 5, xh: "Baholar soni"}, {h: "Davomat", w: 13, xh: "Davomat %"}, {h: "S", w: 4}, {h: "DQ", w: 4}, {h: "K", w: 4}, {h: "KQ", w: 4}, {h: "CH", w: 4}, {h: "Chorak", w: 7, xh: "Chorak bahosi"}, {h: "Izoh", w: 20, a: "l", xw: 50}], rows: body,
      leg: o.ch.leg ? `S — sababsiz, DQ — sababli, K — kasal, KQ — kech qoldi, CH — chet elda (davomatga kirmaydi). «Baho» — shu davrdagi baholar soni. Chap qizil chiziq — xavf ostida. Baho: 8 va undan yuqori — yaxshi · 5 dan 8 gacha — o'rta · 5 dan past — past.` : "",
      cap: `📋 Sinf hisoboti\n${label(c)} · ${per}\nO'rtacha: ${f2(avg)} · Davomat: ${p1(att)} · Xavf ostida: ${risk.length}/${N}`};
  }

  /* ───────── Grafik va statistika ───────── */
  function stats(o, X) {
    const c = X.c, {lo, hi, rq, per} = rangeOf(o), {rows, dates} = reportRows(c, lo, hi, rq), st = statsData(c, lo, hi), t = todayIso();
    const W = st.weeks.map((w) => { const from = w.from < lo ? lo : w.from, e0 = iso(addDays(pdate(w.from), 6)), end = e0 > hi ? hi : e0 > t ? t : e0; return {...w, from, end, days: dates.filter((d) => d >= w.from && d <= e0).length}; });
    const wa = W.filter((w) => w.avg !== null), k2 = wa.length >= 4 ? 2 : 1, dlt = wa.length > 1 ? avgOf(wa.slice(-k2).map((w) => w.avg)) - avgOf(wa.slice(0, k2).map((w) => w.avg)) : null;
    const at = rows.filter((r) => r.att !== null), att = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null, nG = st.dist.reduce((a, b) => a + b, 0);
    const gr = rows.filter((r) => r.avg !== null), nGr = gr.reduce((a, r) => a + r.n, 0), cAvg = nGr ? gr.reduce((a, r) => a + r.avg * r.n, 0) / nGr : null;
    const tops = rows.filter((r) => r.absent).sort((a, b) => b.absent - a.absent).slice(0, 5), t0 = thr();
    const body = W.map((w, k) => [`${k + 1}-hafta · ${d5(w.from)}–${d5(w.end)}`, w.days, w.n, w.avg === null ? "—" : {v: f2(w.avg), n: w.avg, pill: 1, c: pc10(w.avg)}, w.att === null ? "—" : {v: p1(w.att), n: w.att, bar: w.att, lo: w.att < t0, mid: w.att < 90}, w.abs]);
    body.push(Object.assign([per, st.lessons, nG, {v: f2(cAvg), n: cAvg}, {v: p1(att), n: att}, W.reduce((a, w) => a + w.abs, 0)], {tot: 1}));
    const mn = wa.length ? Math.min(...wa.map((w) => w.avg)) : 4, amin = Math.min(...W.map((w) => w.att ?? 100), 100), aLo = Math.max(0, Math.floor((amin - 5) / 10) * 10), aLo2 = Math.min(aLo, 70);
    const yLo = Math.max(0, Math.min(4, Math.floor(mn) - 1)), every = Math.max(1, Math.ceil(W.length / 7));
    const cA = {k: "line", t: "Sinf o'rtacha bahosi <small>· haftalar bo'yicha</small>", pts: wa.map((w) => [d5(w.from), +w.avg.toFixed(2)]), min: yLo, max: 10, ticks: [yLo, ...[4, 6, 8, 10].filter((x) => x > yLo)].filter((x, i, a) => a.indexOf(x) === i), fmt: (v) => Number.isInteger(v) ? String(v) : v.toFixed(2), lab: "last", every, empty: "Bu davrda baho yo'q"};
    const cB = {k: "line", t: "Davomat <small>· haftalar bo'yicha, %</small>", pts: W.filter((w) => w.att !== null).map((w) => [d5(w.from), +w.att.toFixed(1)]), min: aLo2, max: 100, ticks: [aLo2, aLo2 + (100 - aLo2) / 3, aLo2 + 2 * (100 - aLo2) / 3, 100].map((x) => Math.round(x)), fmt: (v) => Number.isInteger(v) ? String(v) : v.toFixed(1) + "%", lab: "last", every, empty: "Bu davrda dars yo'q"};
    const cC = {k: "bars", t: "Baholar taqsimoti <small>· 1 dan 10 gacha</small>", items: st.dist.slice(1).map((v, k) => [String(k + 1), v, k < 4 ? "c2" : k < 7 ? "c3" : "c5"])};
    const cD = {k: "top", big: 1, t: "Ko'p qoldirganlar", items: tops.map((r) => [r.name, absChips(r), r.absent + " dars"]), empty: "Qoldirish yo'q"};
    return {who: label(c), doc: "Grafik va statistika", period: per, title: `Grafik va statistika · ${label(c)}`, sub: `${per} · ${fmt(lo)} – ${fmt(hi)} · ${W.length} hafta`,
      pre: [K([[st.lessons, "Dars kunlari", `${W.length} hafta`], [nG, "Qo'yilgan baholar"], [dlt === null ? "—" : (dlt >= 0 ? "▲ +" : "▼ ") + Math.abs(dlt).toFixed(2), "O'zgarish", dlt === null ? "" : k2 === 2 ? "oxirgi 2 hafta / dastlabki 2 hafta" : "1-haftaga nisbatan", dlt === null ? "" : dlt >= 0 ? "g" : "r"], [p1(att), "Davomat", "butun davr"]]),
        R(172, cA, cB), R(178, cC, cD)],
      cols: [{h: "Hafta", w: 30, a: "l", xw: 26}, {h: "Dars kunlari", w: 12}, {h: "Baholar", w: 12, xh: "Baholar soni"}, {h: "O'rtacha baho", w: 15}, {h: "Davomat", w: 19, xh: "Davomat %"}, {h: "Kelmaganlar", w: 12, xh: "Kelmaganlar (S, DQ, K)"}], rows: body, maxRh: 22,
      leg: o.ch.leg ? "Kelmaganlar — S, DQ va K (o'quvchi-dars). CH (chet elda) va KQ (kech qoldi) kelmaganga kirmaydi." : "",
      cap: `📈 Grafik va statistika\n${label(c)} · ${per}\nO'rtacha: ${f2(cAvg)} · Davomat: ${p1(att)}`};
  }

  /* ───────── Davomat varag'i (butun chorak) ───────── */
  function att(o, X) {
    const c = X.c, q = +o.q, A = DVM.data(c, q), per = `${q}-chorak`, land = o["ori_" + o.doc] === "l", t0 = thr();
    const base = {who: label(c), doc: "Davomat varag'i", period: per};
    if (A.none) return {...base, empty: `${q}-chorak sanalari belgilanmagan`, emptyHint: "Sozlamalar → Choraklar bo'limida chorak sanalarini kiriting."};
    if (A.future) return {...base, empty: `${q}-chorak hali boshlanmagan`, emptyHint: `${fmt(A.lo)} dan boshlanadi.`};
    if (!A.dates.length) return {...base, empty: `${q}-chorakda hali o'tilgan dars kunlari yo'q`};
    const lim = land ? 9 : 6, low = A.rows.filter((r) => r.att !== null && r.att < t0), y = +A.lo.slice(0, 4), yr = +A.lo.slice(5, 7) >= 8 ? `${y}–${y + 1}` : `${y - 1}–${y}`, h = EXP.HDR();
    const rows = A.rows.map((r) => Object.assign([r.i + 1, r.name, {marks: r.marks.map(([d, v]) => [d5(d), CODES[v]])}, r.s || "", r.dq || "", r.k || "", r.kq || "", r.ch || "",
      r.att === null ? "" : {v: Math.round(r.att) + (r.att < t0 ? "*" : ""), n: r.att, c: r.att < t0 ? "g2 u" : "", b: 1}], {x: r.marks.length > lim ? 2 : 1}));
    rows.push(Object.assign(["", "Jami", {v: `${A.abs} ta kelmagan holat, ${A.tot.kq} marta kech qolgan`, b: 1}, A.tot.s, A.tot.dq, A.tot.k, A.tot.kq, A.tot.ch, {v: A.att === null ? "" : Math.round(A.att), n: A.att, b: 1}], {tot: 1}));
    const top = A.rows.filter((r) => r.abs).sort((a, b) => b.abs - a.abs || (a.att ?? 100) - (b.att ?? 100)).slice(0, 4);
    return {...base, title: "Davomat varag'i", sub: `${label(c)} · ${per}, ${yr} o'quv yili`,
      pre: [{k: "info", h: 34, cols: 5, items: [["Davr", `${fmt(A.lo)} – ${fmt(A.hi)}${A.running ? " (bugungacha)" : ""}`, 2], ["O'qituvchi", h.teacher || "—"], ["Dars kunlari", A.dates.length], ["Davomat", p1(A.att)]]}],
      cols: [{h: "№", w: 4}, {h: "O'quvchining ismi, familiyasi", w: 25, a: "l", xw: 30}, {h: "Yo'qlama belgilari (sana va belgi)", w: 44, a: "l", xw: 70}, {h: "S", w: 4.2}, {h: "DQ", w: 4.2}, {h: "K", w: 4.2}, {h: "KQ", w: 4.2}, {h: "CH", w: 4.2}, {h: "%", w: 6, xh: "Davomat %"}], rows, maxRh: 24,
      post: [R(96, {k: "list", t: "Chorak bo'yicha", items: [["Dars kunlari", A.dates.length], ["O'quvchilar", A.rows.length], ["Sinf davomati", p1(A.att), "b"], ["Hamma darsda bo'lgan", A.clean + " nafar"]]},
        {k: "list", t: `Kelmagan holatlar · ${A.abs}`, items: [["Sababsiz (S)", A.tot.s, "r"], ["Sababli (DQ) · Kasal (K)", `${A.tot.dq} · ${A.tot.k}`], ["Kech qolgan (KQ) · Chet elda (CH)", `${A.tot.kq} · ${A.tot.ch}`], [`Davomati ${t0}% dan past`, low.length + " nafar", low.length ? "r" : ""]]},
        {k: "top", t: "Eng ko'p qoldirganlar", items: top.map((r) => [r.name, [], r.abs + " dars"]), empty: "Yo'q"})],
      sigs: [["Fan o'qituvchisi", h.teacher], ["Sinf rahbari", h.head], [h.role3, h.name3]], legH: 28,
      leg: o.ch.leg ? `S — sababsiz, DQ — sababli (hujjat bilan), K — kasal, KQ — kech qoldi, CH — chet elda (bu kunlar davomat foiziga kirmaydi). % — o'quvchining chorakdagi davomati; * — ${t0}% dan past.` : "",
      cap: `📅 Davomat varag'i\n${label(c)} · ${per}\nDavomat: ${p1(A.att)} · Sababsiz: ${A.tot.s}`};
  }

  /* ───────── BSB va CHSB ───────── */
  function sum(o, X) {
    const c = X.c, q = +o.q, per = `${q}-chorak`, base = {who: label(c), doc: "BSB va CHSB", period: per};
    if (!qRange(q)) return {...base, empty: `${q}-chorak sanalari belgilanmagan`, emptyHint: "Sozlamalar → Dars kunlari va choraklar."};
    const S0 = sumData(c, q), {W, rows} = S0, N = S0.N, r = qRange(q);
    if (!W.length) return {...base, empty: `${q}-chorakda BSB yoki CHSB ishlari yo'q`, emptyHint: "Jurnal → «Umumiy» sahifasida ish qo'shilgach, natijalar shu yerda chiqadi."};
    const bp = bsbPartName(S0.works), nT = (t) => W.filter((x) => x.w.type === t).length, ql = S0.ql;
    const L = rows.map((x, i) => ({...x, i})); if (o.ord === "g") L.sort((a, b) => (b.r.complete ? b.r.total : -1) - (a.r.complete ? a.r.total : -1));
    const sc = (s, w) => { const v = (s.scores || {})[w.id]; return isNum(v) ? {v: fmtNum(v), n: v} : {v: "—", c: "g2"}; };
    const body = L.map(({s, r: q2, i}, k) => [o.ord === "g" ? k + 1 : i + 1, s.name, ...W.map((x) => sc(s, x.w)), {v: fmtNum(q2.bsb), n: q2.bsb}, {v: fmtNum(q2.chsb), n: q2.chsb}, q2.fb, q2.complete ? {v: fmtNum(+q2.total.toFixed(1)), n: q2.total, b: 1} : {v: "—", b: 1},
      q2.complete ? {v: q2.grade, n: q2.grade, pill: 1, c: q2.grade === 5 ? "p-g" : q2.grade === 2 ? "p-r" : ""} : {tags: [["to'liq emas", ""]]}]);
    const av = (fn) => { const v = rows.map(fn).filter(isNum); return v.length ? avgOf(v) : null; };
    const done = rows.filter((x) => x.r.complete);
    body.push(Object.assign(["", "O'rtacha", ...W.map((x) => ({v: f1(x.avg), n: x.avg})), {v: f1(av((x) => x.r.bsb)), n: av((x) => x.r.bsb)}, {v: f1(av((x) => x.r.chsb)), n: av((x) => x.r.chsb)}, {v: f1(av((x) => x.r.fb)), n: av((x) => x.r.fb)},
      {v: f1(avgOf(done.map((x) => x.r.total))), n: avgOf(done.map((x) => x.r.total))}, done.length ? {v: f2(avgOf(done.map((x) => x.r.grade))), n: avgOf(done.map((x) => x.r.grade))} : ""], {tot: 1}));
    const card = (x) => ({k: "dist", t: `${esc(wTag(x.w))} <small>· ${fmtNum(x.mx)} ball</small>`, sub: `Topshirdi <b class="${x.n < N ? "o" : ""}">${x.n} / ${N}</b> · o'rtacha ${f1(x.avg)} ball${x.n ? ` · ${fmtNum(x.lo)}–${fmtNum(x.hi)}` : ""}`, parts: [["86–100%", x.band[0], "c5"], ["66–85%", x.band[1], "c4"], ["30–65%", x.band[2], "c3"], ["30% dan past", x.band[3], "c2"]]});
    const cards = []; for (let i = 0; i < W.length; i += 3) cards.push(R(104, ...W.slice(i, i + 3).map(card)));
    const ww = Math.max(6, Math.min(9, Math.floor(36 / W.length))), bpw = bp.length > 5 ? 11 : 7, nameW = 100 - 4 - W.length * ww - bpw - 7 - 6 - 8 - 11;   // «BSB + Loyiha» sarlavhasi kengroq
    return {...base, title: `BSB va CHSB · ${label(c)}`, sub: `${per} · ${fmt(r[0])} – ${fmt(r[1])} · ${bp} (50) + CHSB (40) + kundalik baholar FB (10) = 100`,
      pre: [K([[[["bsb", "BSB"], ["loyiha", "Loyiha"], ["chsb", "CHSB"]].filter(([t]) => t !== "loyiha" || nT(t)).map(([t, n]) => `${nT(t)} ${n}`).join(" · "), "Ishlar"], [S0.sub === null ? "—" : Math.round(S0.sub) + "%", "Topshirish"], [S0.pct === null ? "—" : Math.round(S0.pct) + "%", "O'rtacha natija", ql ? `sifat ${Math.round(ql.q)}% · o'zl. ${Math.round(ql.u)}%` : ""], [S0.done, "Chorak bahosi", `${N - S0.done} tasida ball yetmaydi`, "", N]]),
        SEC("Ishlar bo'yicha"), ...cards],
      cols: [{h: "№", w: 4}, {h: "O'quvchi", w: nameW, a: "l", xw: 28}, ...W.map((x) => ({h: `${esc(wTag(x.w).replace(/ (\S+)$/, ""))}<small>${wTag(x.w).split(" ").pop()} · ${fmtNum(x.mx)}</small>`, w: ww, xh: `${wTag(x.w)} /${fmtNum(x.mx)}`})), {h: `${esc(bp)}<small>/50</small>`, w: bpw, xh: `${bp} /50`}, {h: "CHSB<small>/40</small>", w: 7, xh: "CHSB /40"}, {h: "FB<small>/10</small>", w: 6, xh: "FB /10"}, {h: "JAMI<small>/100</small>", w: 8, xh: "Jami /100"}, {h: "BAHO", w: 11, xh: "Baho"}], rows: body,
      leg: o.ch.leg ? `${bp} — bo'lim summativlari${nT("loyiha") ? " va loyiha ishi" : ""} (50), CHSB — chorak summativi (40), FB — kundalik baholar o'rtachasi (10). Chorak bahosi: jami 86 va yuqori — 5 · 66–85 — 4 · 30–65 — 3 · 30 dan past — 2. «—» — ball qo'yilmagan.` : "",
      cap: `🧮 BSB va CHSB\n${label(c)} · ${per}\nO'rtacha natija: ${S0.pct === null ? "—" : Math.round(S0.pct) + "%"} · Chorak bahosi: ${S0.done}/${N}`};
  }

  /* ───────── Chorakka tayyorlik ───────── */
  function ready(o, X) {
    const c = X.c, q = +o.q, per = `${q}-chorak`, base = {who: label(c), doc: "Chorakka tayyorlik", period: per};
    if (!qRange(q)) return {...base, empty: `${q}-chorak sanalari belgilanmagan`, emptyHint: "Sozlamalar → Dars kunlari va choraklar."};
    const [cp, list] = readinessRows(c, q), works = worksInQuarter(c, q), r0 = qRange(q), N = c.students.length, by = new Map(list.map((x) => [x.i, x]));
    const nb = works.filter((w) => w.type !== "chsb").length, nc = works.length - nb, nl = works.filter((w) => w.type === "loyiha").length, fm = fbMin();
    const ballMiss = list.filter((x) => x.miss.length).length, few = list.filter((x) => x.probs.some((t) => t.startsWith("formativ"))).length, ok = N - list.length;
    const yes = (s, w) => isNum((s.scores || {})[w.id]) ? {v: "✓", c: "g5"} : {v: "—", c: "g2"};
    const rows = c.students.map((s, i) => { const x = by.get(i), nfb = x ? x.nfb : quarterResult(c, s, q, works).n_fb;
      const need = x ? x.miss.map((w) => [`Ball yo'q: ${wTag(w)}`, "r"]).concat(nfb < fm ? [[`Baho kam: ${nfb}`, "y"]] : []) : [];
      return Object.assign([i + 1, s.name, ...works.map((w) => yes(s, w)), {v: nfb, c: nfb < fm ? "g2" : "", b: nfb < fm}, need.length ? {tags: need, n: x.probs.join("; ")} : {tags: [["Tayyor", "g"]], n: "Tayyor"}], {risk: need.length ? 1 : 0}); });
    rows.push(Object.assign(["", {v: `Jami: ${list.length} tayyor emas`, b: 1}, ...works.map(() => ""), "", {v: `${ok} / ${N} tayyor (${pc(ok, N)}%)`, b: 1}], {tot: 1}));
    const ww = works.length ? Math.max(6, Math.min(11, Math.floor(40 / works.length))) : 0;
    const checks = [[true, "Chorak sanalari belgilangan", `${fmt(r0[0])} – ${fmt(r0[1])}`],
      [!cp.some((x) => x.startsWith("BSB")) && nb > 0, nl ? "BSB va Loyiha ishlari" : "BSB ishlari", nb ? `${nb} ta ish${cp.find((x) => x.startsWith("BSB")) ? " · " + cp.find((x) => x.startsWith("BSB")) : ""}` : "kiritilmagan"],
      [!cp.some((x) => x.startsWith("CHSB")) && nc > 0, "CHSB ishi", nc ? `${nc} ta ish${cp.find((x) => x.startsWith("CHSB")) ? " · " + cp.find((x) => x.startsWith("CHSB")) : ""}` : "kiritilmagan"],
      [!ballMiss, "Hamma ballar qo'yilgan", ballMiss ? `${ballMiss} o'quvchida yetishmaydi` : ""], [!few, `Kamida ${fm} ta kundalik baho`, few ? `${few} o'quvchida kam` : ""]];
    return {...base, title: `Chorakka tayyorlik · ${label(c)}`, sub: `${per} · ${fmt(r0[0])} – ${fmt(r0[1])}`,
      pre: [K([[ok, "Tayyor o'quvchilar", "", "", N], [pc(ok, N) + "%", "Tayyorlik"], [ballMiss, "Ball yetishmaydi", "", ballMiss ? "r" : ""], [few, "Baho kam", "", few ? "o" : ""]]),
        R(136, {k: "checks", t: "Sinf tekshiruvlari", span: 3, items: checks}, {k: "dist", t: "O'quvchilar holati", span: 2, nonum: 1, parts: [["Tayyor", ok, "c5"], ["Ball yetishmaydi", ballMiss, "c2"], ["Baho kam", few, "c3"]]})],
      cols: [{h: "№", w: 5}, {h: "O'quvchi", w: Math.max(18, 100 - 5 - 7 - 30 - works.length * ww), a: "l", xw: 30}, ...works.map((w) => ({h: `${esc(wTag(w).replace(/ (\S+)$/, ""))}<small>${wTag(w).split(" ").pop()}</small>`, w: ww, xh: wTag(w)})), {h: "Baho", w: 7, xh: "Kundalik baholar"}, {h: "Nima yetishmaydi", w: 30, a: "l", xw: 60}], rows, maxRh: 28,
      leg: o.ch.leg ? `Tayyor bo'lmaganlar chap chetida qizil chiziq bilan belgilangan. ✓ — ball kiritilgan, — — ball yo'q. «Baho» — kundalik baholar soni (kamida ${fm} ta kerak, kam bo'lsa qizil).${cp.length ? " Diqqat: " + cp.join("; ") + "." : ""}` : "",
      cap: `✅ Chorakka tayyorlik\n${label(c)} · ${per}\nTayyor: ${ok}/${N} (${pc(ok, N)}%)`};
  }

  /* ───────── Sinflarni solishtirish ───────── */
  function cmp(o) {
    const {lo, hi, rq, per} = rangeOf(o), L = compareRows(lo, hi, rq), T = compareTotal(L), bp = bsbPartName(L.flatMap((r) => r.c.works.filter((w) => lo <= w.date && w.date <= hi)));
    const base = {who: "Barcha sinflar", doc: "Sinflarni solishtirish", period: per};
    if (!L.length) return {...base, empty: "Sinflar yo'q"};
    const pp = (v) => v === null || v === undefined ? "—" : {v: Math.round(v) + "%", n: Math.round(v)}, t0 = thr(), many = (r) => r.n && r.risk > r.n / 2;
    const rows = L.map((r) => [{v: label(r.c), b: 1}, r.n, r.lessons, r.avg === null ? "—" : {v: f2(r.avg), n: r.avg, bar: r.avg * 10}, r.att === null ? "—" : {v: p1(r.att), n: r.att, bar: r.att, lo: r.att < t0}, {v: r.risk, c: many(r) ? "g2" : "", b: 1}, pp(r.bsb), pp(r.chsb), ...(rq ? [pp(r.qq), pp(r.qu)] : [])]);
    rows.push(Object.assign(["Jami / o'rtacha", T.n, T.lessons, {v: f2(T.avg), n: T.avg}, {v: p1(T.att), n: T.att}, T.risk, pp(T.bsb), pp(T.chsb), ...(rq ? [pp(T.qq), pp(T.qu)] : [])], {tot: 1}));
    const sA = L.filter((r) => r.avg !== null).sort((a, b) => b.avg - a.avg).slice(0, 6), sT = L.filter((r) => r.att !== null).sort((a, b) => b.att - a.att).slice(0, 6);
    const nm = (r) => r.c.name + (L.filter((x) => x.c.name === r.c.name).length > 1 && r.c.subject ? " " + r.c.subject.slice(0, 4) + "." : "");
    const hs = L.filter((r) => r.bsb !== null || r.chsb !== null).slice(0, 6);
    return {...base, title: "Sinflarni solishtirish", sub: `Barcha sinflar · ${per} · ${fmt(lo)} – ${fmt(hi)}`,
      pre: [K([[L.length, "Sinflar"], [T.n, "O'quvchilar"], [f2(T.avg), "O'rtacha baho"], [T.risk, "Xavf ostida", "", T.risk ? "r" : ""]]),
        R(Math.max(102, 40 + Math.max(sA.length, sT.length) * 16), {k: "hbars", t: `O'rtacha baho${L.length > 6 ? " (eng yaxshi 6 ta)" : ""}`, lw: 76, items: sA.map((r, k) => [nm(r), r.avg * 10, f2(r.avg), k === sA.length - 1 && sA.length > 1 ? "lo" : ""])},
          {k: "hbars", t: `Davomat %${L.length > 6 ? " (eng yaxshi 6 ta)" : ""}`, lw: 76, items: sT.map((r, k) => [nm(r), r.att, p1(r.att), k === sT.length - 1 && sT.length > 1 ? "lo" : ""])})],
      fill: [R(150, {k: "bars", t: "Xavf ostidagi o'quvchilar", items: L.slice(0, 10).map((r) => [nm(r), r.risk, many(r) ? "lo" : ""])}, hs.length ? {k: "bars", t: `${bp} va CHSB natijasi, %`, max: 100, items: hs.flatMap((r) => [[nm(r) + " " + (bp === "BSB" ? "BSB" : "BSB+L"), Math.round(r.bsb || 0), "", r.bsb === null ? "—" : Math.round(r.bsb) + "%"], [nm(r) + " CHSB", Math.round(r.chsb || 0), "k2", r.chsb === null ? "—" : Math.round(r.chsb) + "%"]])} : null)],
      cols: [{h: "Sinf", w: rq ? 20 : 26, a: "l", xw: 24}, {h: "O'quvchi", w: rq ? 9 : 10}, {h: "Dars", w: 6}, {h: "O'rtacha", w: rq ? 12 : 14}, {h: "Davomat", w: rq ? 14 : 16, xh: "Davomat %"}, {h: "Xavf", w: rq ? 7 : 8, xh: "Xavf ostida"}, {h: `${esc(bp)} %`, w: rq ? 8 : 10, xh: `${bp} %`}, {h: "CHSB %", w: rq ? 8 : 10}, ...(rq ? [{h: "Sifat %", w: 8}, {h: "O'zl. %", w: 8, xh: "O'zlashtirish %"}] : [])], rows, maxRh: 34,
      leg: o.ch.leg ? `Jami qatori vaznli: baho — barcha baholar, davomat — o'quvchilar, ${bp}/CHSB — ballar yig'indisi bo'yicha.${rq ? " Sifat — chorak bahosi 5 va 4 olganlar ulushi, O'zl. — o'rtacha jami ball." : ""}` : "",
      cap: `⚖️ Sinflarni solishtirish\n${per} · ${L.length} sinf\nO'rtacha: ${f2(T.avg)} · Davomat: ${p1(T.att)}`};
  }

  /* ───────── Ota-onalar majlisi: har o'quvchiga yarim varaq, A4 da 2 ta ───────── */
  function par(o, X) {
    const c = X.c, {lo, hi, rq, per} = rangeOf(o), {rows} = reportRows(c, lo, hi, rq);
    const base = {who: label(c), doc: "Ota-onalar majlisi", period: per, noxl: 1};
    const list = rows.map((r, i) => [r, c.students[i]]).filter(([r]) => o.who !== "risk" || r.risk);
    if (!list.length) return {...base, empty: o.who === "risk" ? "Xavf ostida o'quvchi yo'q" : "O'quvchi yo'q"};
    const gr = rows.filter((r) => r.avg !== null), nG = gr.reduce((a, r) => a + r.n, 0), cAvg = nG ? gr.reduce((a, r) => a + r.avg * r.n, 0) / nG : null;
    const at = rows.filter((r) => r.att !== null), cAtt = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null;
    return {...base, title: "Ota-onalar majlisi", sub: per, land: false,
      cap: `👪 Ota-onalar majlisi\n${label(c)} · ${per}\n${list.length} o'quvchi`,
      pages: (o2, P) => {
        const H = P.hdr(), half = (P.H - 2 * 30 - (o2.ch.pn ? 24 : 0)) / 2;
        const sh = ([r, s]) => {
          const ds = c.dates.filter((d) => lo <= d && d <= hi && !isNoLesson(c, d) && gradesOf(s.marks[d] || "").length).slice(-16);
          const ws = c.works.filter((w) => lo <= w.date && w.date <= hi).sort((a, b) => a.date < b.date ? -1 : 1);
          const debts = feat("debts") ? debtsOf(c, s, lo, hi).filter((d) => !d.done) : [], hw = feat("hw") ? hwStat(s, lo, hi) : {n: 0};
          const why = debts.length ? r.why.filter((_, k) => r.kinds[k] !== "work") : r.why;
          const nt = [why.join("; "), debts.length ? "Qayta topshirish kerak: " + debts.map((d) => d.what).join("; ") : ""].filter(Boolean).join(". ");
          const ab = Object.entries(s.marks).filter(([d, m]) => lo <= d && d <= hi && !isNoLesson(c, d) && ["s", "dq", "k"].includes(attPart(m))).sort().map(([d, m]) => [d5(d), CODES[attPart(m)]]);
          const qg = rq && r.q && r.q.complete ? r.q.grade : null;
          return `<div class="pg-par" style="height:${half - 10}px">
            <div class="pp-h"><div><b>${esc(s.name)}</b><span>${esc(label(c))} · ${fmt(lo)} – ${fmt(hi)}</span>${o2.ch.sch && H.school ? `<small>${esc(H.school)}</small>` : ""}</div>${rq ? `<div class="pp-q"><span>${rq}-chorak bahosi</span><b class="${qg === 5 ? "g5" : qg === 2 ? "g2" : ""}">${qg ?? "—"}</b><small>${r.q ? (r.q.complete ? `jami ${fmtNum(+r.q.total.toFixed(1))} ball` : "ball yetmaydi") : ""}</small></div>` : ""}</div>
            <div class="pg-kpi" style="grid-template-columns:repeat(4,1fr)"><div><span>O'rtacha baho</span><b><i class="pl ${pc10(r.avg)}">${f2(r.avg)}</i></b><small>sinfda ${f2(cAvg)}</small></div><div><span>Baholar</span><b>${r.n}</b><small>shu davrda</small></div><div><span>Davomat</span><b class="${r.att !== null && r.att < thr() ? "r" : ""}">${r.att === null ? "—" : Math.round(r.att) + "%"}</b><small>sinfda ${cAtt === null ? "—" : Math.round(cAtt) + "%"}</small></div><div><span>Qoldirgan</span><b class="${r.s ? "r" : ""}">${r.absent}</b><small>${[["sababsiz", "s"], ["sababli", "dq"], ["kasal", "k"]].filter(([, k]) => r[k]).map(([t, k]) => `${t} ${r[k]}`).join(", ") || "hamma darsda"}</small></div></div>
            <div class="pp-g"><span>Baholar:</span>${ds.length ? ds.map((d) => { const g = gradesOf(s.marks[d]); return `<i class="${Math.max(...g) >= 8 ? "g5" : Math.min(...g) < 5 ? "g2" : ""}">${g.join("/")}<small>${d5(d)}</small></i>`; }).join("") : "<em>yo'q</em>"}</div>
            ${ws.length ? `<div class="pp-w"><span>BSB / CHSB:</span>${ws.map((w) => { const v = (s.scores || {})[w.id]; return `<em class="${!isNum(v) || v / w.max < .3 ? "r" : ""}">${esc(wTag(w))} — <b>${isNum(v) ? `${fmtNum(v)} / ${fmtNum(w.max)}` : "topshirmagan"}</b></em>`; }).join("")}</div>` : ""}
            <div class="pp-a"><span>Kelmagan kunlar:</span>${ab.length ? ab.map(([d, m]) => `<em class="${m === "S" ? "r" : ""}">${d} ${m}</em>`).join("") : "<em>yo'q</em>"}${hw.n ? ` <span style="margin-left:10px">Uy vazifasi: <b>${hw.ok} / ${hw.n}</b></span>` : ""}</div>
            <div class="pg-cell note bx ${nt ? "bad" : r.avg !== null && r.avg >= 8 ? "ok" : "info"}"><div class="pg-ct">${nt ? "E'tibor bering" : r.avg !== null && r.avg >= 8 ? "Yaxshi tomonlari" : "Tavsiya"}</div><div class="nt">${nt ? esc(nt) + "." : r.avg !== null && r.avg >= 8 ? `Baholari yuqori (o'rtacha ${f1(r.avg)}), darslarda muntazam qatnashadi. Shu sur'atni saqlash kerak.` : r.avg === null ? "Bu davrda baho yo'q." : `O'rtacha natija (${f1(r.avg)}). 8 dan yuqori baholar uchun uy vazifalari va mustaqil mashqlarga e'tibor bering.`}</div></div>
            ${o2.ch.cm ? `<div class="pp-l"><span>O'qituvchi izohi:</span><i></i><i></i><i></i></div>` : ""}
            ${o2.ch.sg ? `<div class="pp-s"><span>O'qituvchi: ${esc(H.teacher)} ________</span><span>Ota-ona imzosi: ________</span></div>` : ""}</div>`;
        };
        const out = []; for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
        return out.map((two, k) => `<div class="${P.cls}" style="width:${P.W}px;height:${P.H}px;padding:30px 40px">${two.map(sh).join(`<div class="pp-cut">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>`)}${P.foot(k, out.length)}</div>`);
      }};
  }

  const SPEC = {cls, stats, att, sum, ready, par, cmp};
  const has = (k) => KINDS.includes(k);
  function open(kind, X) {
    const [t, ic, need, ord] = META[kind], oris = ORI[kind];
    const opts = [];
    if (need === "per") { const P = perOpts(X); opts.push({k: "per", t: "Davr", seg: P.L, v: P.v}); }
    else { const L = qs().map((q) => [String(q), `${q}-chorak`]); const v = String(X.q); if (!L.some(([x]) => x === v)) L.push([v, `${v}-chorak`]); opts.push({k: "q", t: "Chorak", seg: L, v}); }
    if (kind === "par") opts.push({k: "who", t: "Kimlar uchun", seg: [["all", "Hammasi"], ["risk", "Xavf ostidagilar"]], v: S.pfilt === "risk" ? "risk" : "all"});
    const chips = kind === "par" ? [["cm", "O'qituvchi izohi uchun joy", 1]] : kind === "cls" ? [["risk", "Xulosa: xavf ostidagilar", 1], ["leg", "Izoh", 1]] : [["leg", "Izoh", 1]];
    const F = {key: kind, t, ic, docs: [{id: kind, t, oris, ori: oris[0], ord, xl: kind !== "par"}], opts, chips, spec: (o) => SPEC[kind](o, X)};
    // Telegram'ga yuborilgan chorak hisoboti belgisi («Bugun» ta'til ro'yxati): solishtirish chorak bo'yicha bo'lsa
    if (kind === "cmp") F.q = (o) => /^q\d$/.test(o.per) ? +o.per[1] : null;
    return EXP.open(F);
  }
  return {open, has, KINDS, SPEC};
})();
