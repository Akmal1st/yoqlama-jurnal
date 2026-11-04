/* «Bugun» → arxivlangan chorak ko'rinishi — tasdiqlangan maket v2 «Birlashtirilgan» (Akmal, 2026-11-04).
   Ta'til kunlari (joriy chorak yo'q) va oxirgi tugagan chorak arxivlangan bo'lsa (ARX.entry), «Sinflar ko'rsatkichi» o'rniga:
   tepada «N-chorak yakunlandi» bloki (4 raqam, eng yaxshi / e'tibor kerak sinf, sinflar ustun diagrammasi, chorak baholari),
   ostida «Sinflar bo'yicha» kartochkasi: «Kartalar | Reyting» almashtirgichi (tanlov localStorage da).
   Hisob-kitob index.html dagi compareRows dan. bugun.js dan oldin ulanadi. */
const BAX = (() => {
  const LS = "yoqlama_bax";
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const st = {v: ls(LS + "_v") === "r" ? "r" : "k", m: ["qu", "att", "sq", "av"].includes(ls(LS + "_m")) ? ls(LS + "_m") : "qu"};
  const d5 = (s) => fmt(s).slice(0, 5);
  const tone = (v) => v >= 85 ? "var(--ok)" : v >= 70 ? "var(--acc)" : v >= 55 ? "var(--bn-warn-b)" : "var(--danger)";
  const DC = ["var(--ok)", "var(--acc)", "var(--bn-warn-b)", "var(--danger)"];
  const pc = (v) => v === null || v === undefined ? "—" : Math.round(v) + "%";
  const M = {qu: ["O'zlashtirish", pc, 100], att: ["Davomat", pc, 100], sq: ["Sifat", pc, 100], av: ["O'rtacha baho", (v) => v === null ? "—" : v.toFixed(2), 10]};

  // oxirgi tugagan va arxivlangan chorak (faqat ta'til kunlari)
  function quarter(t) {
    if (typeof ARX === "undefined" || quarterOf(t)) return null;
    const q = [4, 3, 2, 1].find((k) => { const r = qRange(k); return r && r[1] < t; });
    return q && ARX.entry(q) ? q : null;
  }
  function data(q) {
    const [lo, hi] = qRange(q);
    const R = compareRows(lo, hi, q).filter((r) => r.n).map((r) => ({c: r.c, ci: D.classes.indexOf(r.c), n: r.n, att: r.att, avg: r.avg, risk: r.risk,
      qu: r.qu ?? r.qp, sq: r.qq, by: r.by || [0, 0, 0, 0]}));
    const T = compareTotal(compareRows(lo, hi, q).filter((r) => r.n));
    const by = [0, 1, 2, 3].map((i) => R.reduce((a, r) => a + r.by[i], 0));
    const wq = R.filter((r) => r.qu !== null), qu = wq.length ? wq.reduce((a, r) => a + r.qu, 0) / wq.length : null;
    return {q, lo, hi, R, att: T.att, sq: T.qq, qu, by, st: R.reduce((a, r) => a + r.n, 0), avgOf: (k) => { const x = R.filter((r) => r[k] !== null && r[k] !== undefined); return x.length ? x.reduce((a, r) => a + r[k], 0) / x.length : null; }};
  }
  const nm = (r) => esc(label(r.c));
  function dist(by) {
    const t = by.reduce((a, b) => a + b, 0);
    return `<span class="ba-dist" title="5: ${by[0]} · 4: ${by[1]} · 3: ${by[2]} · 2: ${by[3]}">${t ? by.map((x, i) => `<i style="width:${100 * x / t}%;background:${DC[i]}"></i>`).join("") : ""}</span><span class="ba-dl">${t ? `5:${by[0]} · 4:${by[1]} · 3:${by[2]} · 2:${by[3]}` : "chorak baholari hali yo'q"}</span>`;
  }
  function banner(X) {
    const W = X.R.filter((r) => r.qu !== null), best = [...W].sort((a, b) => b.qu - a.qu)[0], low = [...W].sort((a, b) => a.qu - b.qu)[0];
    return `<section class="ba-x"><div class="ba-xl">
        <h2>${X.q}-chorak yakunlandi 🔒</h2><p class="ba-xs">${d5(X.lo)} – ${d5(X.hi)} · ${X.R.length} sinf, ${X.st} o'quvchi · natijalar arxivda saqlandi</p>
        <div class="ba-k"><div><small>O'zlashtirish</small><b>${pc(X.qu)}</b></div><div><small>Davomat</small><b>${pc(X.att)}</b></div><div><small>Sifat (4–5)</small><b>${pc(X.sq)}</b></div><div><small>«2» olganlar</small><b class="${X.by[3] ? "ba-bad" : ""}">${X.by[3]}</b></div></div>
        ${best && W.length > 1 ? `<div class="ba-h"><button data-cls="${best.ci}">🏆<span><b>${nm(best)}</b> — eng yuqori o'zlashtirish</span><b>${pc(best.qu)}</b></button>${low !== best ? `<button data-cls="${low.ci}">⚠<span><b>${nm(low)}</b> — e'tibor kerak${low.risk ? `, ${low.risk} o'quvchi xavfda` : ""}</span><b>${pc(low.qu)}</b></button>` : ""}</div>` : ""}
        <div class="ba-a"><button class="btn btn-primary" data-baxrep="${X.q}">Chorak hisoboti</button><button class="btn" data-axpage="${X.q}">Choraklar arxivi</button></div>
      </div>
      <div class="ba-c"><span class="ba-t">O'zlashtirish, sinflar bo'yicha</span>
        <div class="ba-cols">${X.R.map((r) => `<button data-cls="${r.ci}" title="${nm(r)}"><b>${pc(r.qu)}</b><i style="height:${Math.max(2, r.qu || 0)}%;background:${r.qu === null ? "var(--soft)" : tone(r.qu)}"></i></button>`).join("")}</div>
        <div class="ba-cl">${X.R.map((r) => { const [a, ...b] = label(r.c).split(" · "); return `<span title="${nm(r)}">${esc(a)}${b.length ? `<small>${esc(b.join(" · ").slice(0, 8))}</small>` : ""}</span>`; }).join("")}</div>
        <span class="ba-t" style="margin-top:6px">Chorak baholari (jami)</span>${dist(X.by)}
      </div></section>`;
  }
  function cards(X, tel) {
    return `<div class="ba-g">${X.R.map((r) => `<button class="ba-kt" data-cls="${r.ci}"><span class="ba-kn"><b>${nm(r)}</b>${r.risk ? `<span class="bn-chip bad">⚠ ${r.risk}</span>` : ""}</span>
      <span class="ba-rg"><span class="ba-ring" style="--p:${r.qu || 0};--c:${r.qu === null ? "var(--soft)" : tone(r.qu)}"><b>${pc(r.qu)}</b></span>
      <span class="ba-rl"><span>Davomat <b>${pc(r.att)}</b></span><span>Sifat <b>${pc(r.sq)}</b></span>${tel ? "" : `<span>O'rtacha <b>${r.avg === null ? "—" : r.avg.toFixed(2)}</b></span>`}</span></span>
      <span>${dist(r.by)}</span></button>`).join("")}</div>`;
  }
  function rank(X, tel) {
    const k = st.m, [, f, mx] = M[k], L = X.R.filter((r) => r[k === "av" ? "avg" : k] !== null && r[k === "av" ? "avg" : k] !== undefined), key = k === "av" ? "avg" : k;
    L.sort((a, b) => b[key] - a[key]);
    const avg = X.avgOf(key), col = (v) => k === "av" ? (v < 5 ? "var(--danger)" : v < 7 ? "var(--bn-warn-b)" : "var(--ok)") : tone(v);
    return `<div class="ba-rm"><div class="bn-seg ba-ms">${Object.entries(M).map(([kk, [t]]) => `<button class="${kk === k ? "on" : ""}" data-baxm="${kk}">${tel && kk === "av" ? "O'rtacha" : t}</button>`).join("")}</div></div>
      <div class="ba-rk">${L.map((r, i) => `<button class="ba-rr" data-cls="${r.ci}"><span class="ba-no ${i === 0 ? "g1" : i === L.length - 1 && L.length > 1 ? "gl" : ""}">${i + 1}</span><span class="ba-nm">${nm(r)}<small>${r.n} o'quvchi${r.risk ? ` · ⚠ ${r.risk} xavf` : ""}</small></span>
        <span class="ba-rb"><i style="width:${Math.min(100, 100 * r[key] / mx)}%;background:${col(r[key])}"></i>${avg !== null ? `<u style="left:${Math.min(100, 100 * avg / mx)}%"></u>` : ""}</span><b class="ba-vv">${f(r[key])}</b></button>`).join("") || `<div class="bn-okl bn-mut">Ma'lumot yo'q.</div>`}</div>
      ${L.length ? `<div class="ba-lg"><span><i></i>o'rtacha: ${f(avg)}</span>${L.length > 1 ? `<span>Eng yuqori ${esc(L[0].c.name)}, eng past ${esc(L[L.length - 1].c.name)}</span>` : ""}</div>` : ""}`;
  }
  function clsCard(X, tel) {
    const next = qRange(X.q + 1);
    return `<section class="card ba-card"><div class="bn-ch"><h2>Sinflar bo'yicha</h2><div class="bn-seg ba-sw"><button class="${st.v === "k" ? "on" : ""}" data-baxv="k">Kartalar</button><button class="${st.v === "r" ? "on" : ""}" data-baxv="r">Reyting</button></div></div>
      ${st.v === "r" ? rank(X, tel) : cards(X, tel)}
      <div class="ba-f"><span class="bn-mut">${next ? `${X.q + 1}-chorak ${d5(next[0])} da boshlanadi` : `${d5(X.lo)} – ${d5(X.hi)}`}</span><button class="bn-lnk" data-axpage="${X.q}">Choraklar arxivi →</button></div></section>`;
  }
  function bind(m) {
    const on = (sel, fn) => m.querySelectorAll(sel).forEach((b) => b.onclick = () => fn(b));
    on("[data-baxv]", (b) => { st.v = b.dataset.baxv; ls(LS + "_v", st.v); render(); });
    on("[data-baxm]", (b) => { st.m = b.dataset.baxm; ls(LS + "_m", st.m); render(); });
    on("[data-baxrep]", (b) => { S.rep = {...S.rep, kind: "cmp", per: "q" + b.dataset.baxrep}; go("reports"); });
    // [data-axpage] — arxiv.js dagi umumiy tinglovchi ochadi
  }
  return {quarter, data, banner, clsCard, bind};
})();
