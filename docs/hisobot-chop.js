/* Hisobotlar → chop etish varaqlari: «Sinf hisoboti», «Chorakka tayyorlik», «Sinflarni solishtirish» (Akmal, 2026-11-08, «Chop etish maketi» tasdiqlandi).
   Har biri doim bitta A4 (tik) varaqqa sig'adi: qator balandligi va shrift qatorlar soniga qarab tanlanadi (36 o'quvchi — zich, 18 — keng).
   Varaq (.hb-prt) ekranda ko'rinmaydi; chop etishda va «PDF → Telegram» rasmida u o'zi chiqadi (hisobot paneli yashiriladi).
   Sozlamalar D.web.prt = {bw: 0|1, t: 0|1, g: 0|1} — oq-qora printer, taqsimot qutilari, imzo va izoh qatori. Hisob-kitob index.html dagi
   reportRows, compareRows/compareTotal, readinessRows, quarterResult dan olinadi. */
const HPR = (() => {
  const KINDS = ["cls", "ready", "cmp"];
  const has = (k) => KINDS.includes(k);
  const opt = () => Object.assign({bw: 0, t: 1, g: 1}, (D.web || {}).prt || {});
  const f = (v, d = 1, u = "") => v === null || v === undefined || Number.isNaN(v) ? "—" : (+v).toFixed(d) + u;
  const d5 = (s) => fmt(s).slice(0, 5);
  const W = (v, d = 0) => v === null || v === undefined ? "—" : (+v).toFixed(d) + "%";

  const bar = () => {
    const o = opt();
    return `<div class="hb-prtopt noprint"><span>Chop etish varag'i:</span>
      <div class="hb-seg"><button class="${o.bw ? "" : "on"}" data-prt="bw0">Rangli</button><button class="${o.bw ? "on" : ""}" data-prt="bw1" title="Rangsiz printer: ranglar o'rniga shtrix va to'q fon">Oq-qora</button></div>
      <button class="hb-tg ${o.t ? "on" : ""}" data-prt="t">Taqsimot</button><button class="hb-tg ${o.g ? "on" : ""}" data-prt="g">Izoh va imzo</button></div>`;
  };
  function toggle(k) {
    const o = D.web.prt = Object.assign({bw: 0, t: 1, g: 1}, D.web.prt || {});
    if (k === "bw0") o.bw = 0; else if (k === "bw1") o.bw = 1; else if (k === "t" || k === "g") o[k] = o[k] ? 0 : 1;
    save();
  }

  /* ───────── umumiy bo'laklar ───────── */
  const head = (title, sub) => {
    const h = D.web.bsb_hdr || {};
    return `<div class="hp-h"><div><h1>${esc(title)}</h1><div class="hp-sub">${sub}</div></div><div class="hp-meta">${h.teacher ? `${esc(h.teacher)} (o'qituvchi)<br>` : ""}${h.school ? `${esc(h.school)}<br>` : ""}Chop etilgan: <b>${fmt(todayIso())}</b></div></div>`;
  };
  const k4 = (a) => `<div class="hp-k4">${a.map(([l, v, bad]) => `<div><small>${l}</small><b ${bad ? 'class="bad"' : ""}>${v}</b></div>`).join("")}</div>`;
  const dist = (title, parts) => {
    const t = parts.reduce((a, p) => a + p[1], 0) || 1;
    return `<div><h4>${title}</h4><div class="hp-bar">${parts.map(([, n, c]) => n ? `<i style="width:${100 * n / t}%;background:${c}"></i>` : "").join("")}</div><div class="hp-lg">${parts.map(([l, n, c]) => `<span style="--c:${c}">${l}: <b>${n}</b></span>`).join("")}</div></div>`;
  };
  const pal = (bw) => bw ? {g: ["#111", "#666", "#aaa", "#eee"], a: ["#111", "#888", "#ddd"]} : {g: ["#1f8f55", "#7cc4a0", "#eaa23a", "#c0362c"], a: ["#1f8f55", "#eaa23a", "#c0362c"]};
  const attBar = (v) => v === null ? `<span class="hp-mut">—</span>` : `<div class="hp-at"><span class="tr"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${v >= 90 ? "var(--pg)" : v >= 80 ? "var(--pw)" : "var(--pr)"}"></i></span><b>${v >= 100 ? "100" : f(v, 1)}%</b></div>`;
  const chips = (a) => a.map((t) => `<span class="hp-ch r">${esc(t)}</span>`).join("");
  const tail = (g, legend, foot) => `<div class="hp-bot">${g ? `<div class="hp-leg">${legend}</div><div class="hp-sig"><div><span>O'qituvchi</span><span>${esc(((D.web.bsb_hdr || {}).teacher) || "")}</span></div><div><span>Sinf rahbari</span><span></span></div><div><span>MB rahbari</span><span>${esc(((D.web.bsb_hdr || {}).deputy) || "")}</span></div></div>` : ""}<div class="hp-ft"><span>Yo'qlama jurnali · ${esc(foot)}</span><span>1 / 1</span></div></div>`;
  // jadval qutisi: qator balandligi — mavjud joydan, lekin 9.8 mm dan oshmasin; shrift qatorlar soniga qarab
  const fsOf = (n) => n > 36 ? 7.6 : n > 30 ? 8.2 : n > 24 ? 9 : n > 20 ? 9.8 : n > 12 ? 10.6 : 11;
  const box = (n, inner) => `<div class="hp-tb" style="--mh:${(12.5 + Math.max(n, 3) * 9.8).toFixed(1)}mm;--fs:${fsOf(n)}pt">${inner}</div>`;
  const avgCls = (v) => v >= 8 ? "hi" : v >= (D.settings.risk.avg_below || 5) ? "mid" : "lo";
  const gp = (v) => v === null ? `<span class="hp-mut">—</span>` : `<span class="hp-gp ${avgCls(v)}">${v.toFixed(2)}</span>`;

  /* ───────── 1. Sinf hisoboti ───────── */
  function cls(X, pl, who, o) {
    const {c, lo, hi, rq} = X, {rows, lessons} = reportRows(c, lo, hi, rq), n = rows.length;
    const gr = rows.filter((r) => r.avg !== null), nG = gr.reduce((a, r) => a + r.n, 0), avg = nG ? gr.reduce((a, r) => a + r.avg * r.n, 0) / nG : null;
    const at = rows.filter((r) => r.att !== null), att = at.length ? at.reduce((a, r) => a + r.att, 0) / at.length : null, nRisk = rows.filter((r) => r.risk).length;
    const P = pal(o.bw), sum = (k) => rows.reduce((a, r) => a + r[k], 0), missN = (r) => r.s + r.dq + r.k;
    const g = [rows.filter((r) => r.avg !== null && r.avg >= 9).length, rows.filter((r) => r.avg !== null && r.avg >= 7 && r.avg < 9).length, rows.filter((r) => r.avg !== null && r.avg >= 5 && r.avg < 7).length, rows.filter((r) => r.avg !== null && r.avg < 5).length];
    const a = [rows.filter((r) => r.att !== null && r.att >= 90).length, rows.filter((r) => r.att !== null && r.att >= 80 && r.att < 90).length, rows.filter((r) => r.att !== null && r.att < 80).length];
    const top = rows.map((r) => [r, missN(r)]).filter(([, m]) => m).sort((x, y) => y[1] - x[1]).slice(0, 3);
    const num = (v) => v ? v : "·";
    const body = rows.map((r, i) => {
      const lbl = r.why.map((t, k) => { const [x] = HSB.why1(t, r.kinds[k]); return x.replace("O'rtacha", "O'rt.").replace("Davomat", "Dav.").replace("Baholar pasaymoqda", "Pasayish"); });
      if (lbl.length > 3) lbl.splice(2, lbl.length - 2, `+${lbl.length - 2} ta`);   // katakka sig'maydigan belgilar «+N» bo'lib qisqaradi (to'liq matn — ekrandagi jadvalda)
      return `<tr class="${r.risk ? "hp-rk" : ""}"><td class="c hp-mut">${i + 1}</td><td>${esc(r.name)}</td><td class="c">${gp(r.avg)}</td><td class="c">${r.n}</td><td>${attBar(r.att)}</td><td class="c">${num(r.s)}</td><td class="c">${num(r.dq)}</td><td class="c">${num(r.k)}</td><td class="c">${num(r.kq)}</td>${rq ? `<td class="c">${r.q && r.q.complete ? `<b>${r.q.grade}</b>` : `<span class="hp-mut">—</span>`}</td>` : ""}<td class="iz">${chips(lbl)}</td></tr>`;
    }).join("");
    const cols = rq ? [8, 34, 17, 11, 28, 8, 8, 8, 8, 13] : [8, 36, 17, 11, 28, 8, 8, 8, 8];
    return `${head(`Sinf hisoboti · ${who}`, `${esc(pl[0])} · ${esc(pl[1])} · ${lessons} dars kuni`)}
      ${k4([["O'rtacha baho", f(avg, 2)], ["Davomat", f(att, 1, "%")], ["Xavf ostida", `${nRisk} <i>/ ${n}</i>`, nRisk], ["O'quvchilar", n]])}
      ${o.t ? `<div class="hp-d">${dist("Baholar taqsimoti", [["9–10", g[0], P.g[0]], ["7–8.9", g[1], P.g[1]], ["5–6.9", g[2], P.g[2]], ["5 dan past", g[3], P.g[3]]])}${dist("Davomat taqsimoti", [["90%+", a[0], P.a[0]], ["80–89%", a[1], P.a[1]], ["80% dan past", a[2], P.a[2]]])}<div><h4>Diqqat</h4><div class="hp-n">${top.length ? `Ko'p qoldirgan: ${top.map(([r, m]) => `<b>${esc(r.name.split(" ")[0])}</b> ${m}`).join(" · ")}` : "Qoldirish yo'q"}<br>Xavf ostida: <b>${nRisk}</b> o'quvchi</div></div></div>` : ""}
      ${box(n, `<table><colgroup>${cols.map((w) => `<col style="width:${w}mm">`).join("")}<col></colgroup>
        <thead><tr><th class="c">№</th><th>O'quvchi</th><th class="c">O'rtacha</th><th class="c">Baho</th><th>Davomat</th><th class="c">S</th><th class="c">DQ</th><th class="c">K</th><th class="c">KQ</th>${rq ? `<th class="c">Chorak</th>` : ""}<th>Izoh</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td></td><td>Sinf bo'yicha</td><td class="c">${f(avg, 2)}</td><td class="c">${nG}</td><td class="c">${f(att, 1, "%")}</td><td class="c">${sum("s")}</td><td class="c">${sum("dq")}</td><td class="c">${sum("k")}</td><td class="c">${sum("kq")}</td>${rq ? "<td></td>" : ""}<td>${nRisk} o'quvchi xavf ostida</td></tr></tfoot></table>`)}
      ${tail(o.g, "S — sababsiz, DQ — sababli, K — kasal, KQ — kech qoldi. «Baho» — shu davrdagi baholar soni. Chap qizil chiziq — xavf ostida.<br>Baho: 8 va undan yuqori — yaxshi · 5 dan 8 gacha — o'rta · 5 dan past — past.", `Sinf hisoboti · ${who}`)}`;
  }

  /* ───────── 2. Chorakka tayyorlik ───────── */
  function ready(X, pl, who, o) {
    const {c, q} = X;
    if (!qRange(q)) return `${head(`Chorakka tayyorlik · ${who}`, `${q}-chorak sanalari belgilanmagan`)}`;
    const [cp, list] = readinessRows(c, q), N = c.students.length, ok = N - list.length, works = worksInQuarter(c, q), P = pal(o.bw);
    const nb = works.filter((w) => w.type !== "chsb").length, nc = works.length - nb, r = qRange(q);
    const nBall = list.filter((x) => x.miss.length).length, nFb = list.filter((x) => x.probs.some((t) => t.startsWith("formativ"))).length;
    const byW = works.length <= 5, cols = byW ? works : [];
    const chk = [[1, "Chorak sanalari belgilangan", `${fmt(r[0])} – ${fmt(r[1])}`],
      [!cp.some((x) => x.startsWith("BSB")) && nb, "BSB / Loyiha ishlari", cp.find((x) => x.startsWith("BSB")) || `${nb} ta ish`],
      [!cp.some((x) => x.startsWith("CHSB")) && nc, "CHSB ishi", cp.find((x) => x.startsWith("CHSB")) || `${nc} ta ish`]];
    const chip = (x) => { const out = []; if (x.miss.length) out.push(x.miss.length <= 2 ? `Ball yo'q: ${x.miss.map((w) => wTag(w)).join(", ")}` : `Ball yo'q: ${x.miss.length} ta ish`); if (x.probs.some((t) => t.startsWith("formativ"))) out.push(`Baho ${x.nfb} / ${fbMin()}`); return out; };
    const body = list.map((x) => { const s = c.students[x.i];
      return `<tr class="hp-rk"><td class="c hp-mut">${x.i + 1}</td><td>${esc(x.name)}</td>${byW ? cols.map((w) => `<td class="c"><span class="hp-w ${isNum((s.scores || {})[w.id]) ? "y" : "n"}">${isNum((s.scores || {})[w.id]) ? "✓" : "—"}</span></td>`).join("") : `<td class="c">${works.filter((w) => isNum((s.scores || {})[w.id])).length} / ${works.length}</td>`}<td class="c"><span class="hp-w ${x.nfb < fbMin() ? "n" : "y"}">${x.nfb}</span></td><td class="iz">${chips(chip(x))}</td></tr>`; }).join("");
    return `${head(`Chorakka tayyorlik · ${who}`, `${q}-chorak · ${fmt(r[0])} – ${fmt(r[1])}`)}
      ${k4([["Tayyor o'quvchilar", `${ok} <i>/ ${N}</i>`], ["Tayyorlik", W(N ? 100 * ok / N : 100)], ["Ball yetishmaydi", nBall, nBall], ["Baho kam", nFb, nFb]])}
      ${o.t ? `<div class="hp-d hp-d2"><div><h4>Sinf tekshiruvlari</h4><div class="hp-ck">${chk.map(([y, t, s]) => `<div class="${y ? "y" : "n"}"><i>${y ? "✓" : "✗"}</i><b>${t}</b><small>${esc(s)}</small></div>`).join("")}</div></div>${dist("O'quvchilar holati", [["Tayyor", ok, P.a[0]], ["Ball yetishmaydi", nBall, P.a[2]], ["Baho kam", nFb, P.a[1]]])}</div>` : ""}
      ${cp.length || !nb || !nc ? `<div class="hp-warn">⛔ Sinf hali tayyor emas: ${esc(cp.length ? cp.join("; ") : !nb ? "BSB ishi kiritilmagan" : "CHSB ishi kiritilmagan")}. Bu tuzatilmaguncha chorak bahosi chiqmaydi.</div>` : ""}
      ${list.length ? box(list.length, `<table><colgroup><col style="width:8mm"><col style="width:42mm">${byW ? cols.map(() => `<col style="width:${Math.min(15, 62 / Math.max(cols.length, 1))}mm">`).join("") : `<col style="width:15mm">`}<col style="width:14mm"><col></colgroup>
        <thead><tr><th class="c">№</th><th>O'quvchi</th>${byW ? cols.map((w) => `<th class="c">${esc(wTag(w))}</th>`).join("") : `<th class="c">Ballar</th>`}<th class="c">Baho</th><th>Nima yetishmaydi</th></tr></thead><tbody>${body}</tbody>
        <tfoot><tr><td></td><td>Jami</td><td colspan="${(byW ? cols.length : 1) + 1}" class="c">${list.length} o'quvchi tayyor emas</td><td>${ok} / ${N} tayyor (${W(N ? 100 * ok / N : 100)})</td></tr></tfoot></table>`) : `<div class="hp-okb">✓ Hammasi tayyor: chorak baholarini qo'yish mumkin.</div>`}
      ${tail(o.g, `✓ — ball kiritilgan, — — ball yo'q. «Baho» — kundalik baholar soni (kamida ${fbMin()} ta kerak, kam bo'lsa qizil).`, `Chorakka tayyorlik · ${who}`)}`;
  }

  /* ───────── 3. Sinflarni solishtirish ───────── */
  function cmp(X, pl, who, o) {
    const {lo, hi, rq} = X, L = compareRows(lo, hi, rq), T = compareTotal(L), n = L.length, P = pal(o.bw);
    const bp = bsbPartName(L.flatMap((r) => r.c.works.filter((w) => lo <= w.date && w.date <= hi)));
    const mx = (k, hiBest) => { const v = L.map((r) => r[k]).filter((x) => x !== null); return v.length ? (hiBest ? Math.max(...v) : Math.min(...v)) : null; };
    const pb = (v, m, col, txt) => v === null ? `<span class="hp-mut">—</span>` : `<div class="hp-at"><span class="tr"><i style="width:${Math.max(0, Math.min(100, 100 * v / m))}%;background:${col}"></i></span><b>${txt}</b></div>`;
    const body = L.map((r) => `<tr><td><b>${esc(label(r.c))}</b></td><td class="c">${r.n}</td><td class="c">${r.lessons}</td><td>${pb(r.avg, 10, r.avg === mx("avg", 1) ? "var(--pg)" : "var(--pa)", f(r.avg, 2))}</td><td>${r.att === null ? `<span class="hp-mut">—</span>` : attBar(r.att)}</td><td class="c"><b class="${r.n && r.risk > r.n / 2 ? "hp-bad" : ""}">${r.risk}</b></td><td class="c">${W(r.bsb)}</td><td class="c">${W(r.chsb)}</td>${rq ? `<td class="c">${W(r.qq)}</td><td class="c">${W(r.qu)}</td>` : ""}</tr>`).join("");
    const chart = (title, k, mxv, fmtv) => `<div><h4>${title}</h4>${L.filter((r) => r[k] !== null).sort((a, b) => b[k] - a[k]).slice(0, 6).map((r) => `<div class="hp-at hp-ch1"><span class="hp-cn">${esc(r.c.name)}</span><span class="tr"><i style="width:${Math.min(100, 100 * r[k] / mxv)}%;background:${r[k] === mx(k, 1) ? "var(--pg)" : r[k] === mx(k, 0) ? "var(--pr)" : "var(--pa)"}"></i></span><b>${fmtv(r[k])}</b></div>`).join("")}</div>`;
    const cw = rq ? [38, 15, 12, 28, 30, 12] : [40, 17, 14, 30, 32, 14];
    return `${head("Sinflarni solishtirish", `Barcha sinflar · ${esc(pl[0])} · ${esc(pl[1])}`)}
      ${k4([["Sinflar", n], ["O'quvchilar", T.n], ["O'rtacha baho", f(T.avg, 2)], ["Xavf ostida", T.risk, T.risk]])}
      ${o.t ? `<div class="hp-d hp-d2">${chart("O'rtacha baho (eng yaxshi 6 ta)", "avg", 10, (v) => f(v, 2))}${chart("Davomat % (eng yaxshi 6 ta)", "att", 100, (v) => f(v, 1, "%"))}</div>` : ""}
      ${box(n, `<table><colgroup>${cw.map((w) => `<col style="width:${w}mm">`).join("")}<col><col>${rq ? "<col><col>" : ""}</colgroup>
        <thead><tr><th>Sinf</th><th class="c">O'quvchi</th><th class="c">Dars</th><th>O'rtacha</th><th>Davomat</th><th class="c">Xavf</th><th class="c">${bp === "BSB" ? "BSB" : "BSB+Loy."} %</th><th class="c">CHSB %</th>${rq ? `<th class="c">Sifat %</th><th class="c">O'zl. %</th>` : ""}</tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td>Jami</td><td class="c">${T.n}</td><td class="c">${T.lessons}</td><td class="c">${f(T.avg, 2)}</td><td class="c">${f(T.att, 1, "%")}</td><td class="c">${T.risk}</td><td class="c">${W(T.bsb)}</td><td class="c">${W(T.chsb)}</td>${rq ? `<td class="c">${W(T.qq)}</td><td class="c">${W(T.qu)}</td>` : ""}</tr></tfoot></table>`)}
      ${tail(o.g, "Jami qatori vaznli: baho — barcha baholar, davomat — o'quvchilar, BSB/CHSB — ballar yig'indisi bo'yicha." + (rq ? " Sifat — 5 va 4 olganlar, O'zl. — 3 va undan yuqori." : ""), "Sinflarni solishtirish")}`;
  }

  const MAKE = {cls, ready, cmp};
  function html(kind, X, pl, who) {
    const o = opt();
    let inner;
    try { inner = MAKE[kind](X, pl || ["", ""], who, o); } catch (e) { console.error(e); setTimeout(() => { throw e; }); inner = `<div class="hp-warn">Varaqni tayyorlashda xato: ${esc(e.message)}</div>`; }
    return `<div class="hb-prt${o.bw ? " bw" : ""}" aria-hidden="true">${inner}</div>`;
  }
  return {has, html, bar, toggle};
})();
